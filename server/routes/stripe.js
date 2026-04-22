const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { sendTrialStartedEmail } = require('../lib/email');

const router = express.Router();

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return require('stripe')(process.env.STRIPE_SECRET_KEY);
}

function getBaseUrl() {
  return process.env.BASE_URL || 'https://quizzo.club';
}

// POST /api/stripe/checkout
router.post('/checkout', authMiddleware, async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });

  const { plan } = req.body;
  const priceId = plan === 'yearly'
    ? process.env.STRIPE_YEARLY_PRICE_ID
    : process.env.STRIPE_MONTHLY_PRICE_ID;

  if (!priceId) return res.status(500).json({ error: 'Price not configured' });

  try {
    const pool = req.app.get('pool');
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
    if (!userResult.rows.length) return res.status(404).json({ error: 'User not found' });
    const user = userResult.rows[0];

    // Get or create Stripe customer
    let customerId;
    const subResult = await pool.query(
      'SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1',
      [req.userId]
    );
    if (subResult.rows.length && subResult.rows[0].stripe_customer_id) {
      customerId = subResult.rows[0].stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.first_name} ${user.last_name}`.trim() || user.email,
        metadata: { userId: req.userId },
      });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      subscription_data: { trial_period_days: 30 },
      success_url: `${getBaseUrl()}/subscribe?success=true`,
      cancel_url: `${getBaseUrl()}/subscribe`,
      allow_promotion_codes: true,
      customer_update: { address: 'auto' },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// POST /api/stripe/portal
router.post('/portal', authMiddleware, async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });

  try {
    const pool = req.app.get('pool');
    const subResult = await pool.query(
      'SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1',
      [req.userId]
    );
    if (!subResult.rows.length || !subResult.rows[0].stripe_customer_id) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subResult.rows[0].stripe_customer_id,
      return_url: `${getBaseUrl()}/subscribe`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Portal error:', err);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

// POST /api/stripe/webhook  (raw body — registered in index.js)
router.post('/webhook', async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(500).send('Stripe not configured');

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const pool = req.app.get('pool');

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode !== 'subscription') break;

        const sub = await stripe.subscriptions.retrieve(session.subscription);
        const plan = sub.items.data[0]?.price?.recurring?.interval === 'year' ? 'yearly' : 'monthly';

        await pool.query(`
          INSERT INTO subscriptions (user_id, stripe_customer_id, stripe_subscription_id, status, plan, trial_end, current_period_end, updated_at)
          VALUES (
            (SELECT id FROM users WHERE id = (SELECT metadata->>'userId' FROM (SELECT stripe_customers.metadata FROM stripe_customers WHERE stripe_customers.id = $1) x)),
            $1, $2, $3, $4, $5, $6, NOW()
          )
          ON CONFLICT (stripe_customer_id) DO UPDATE SET
            stripe_subscription_id = $2, status = $3, plan = $4,
            trial_end = $5, current_period_end = $6, updated_at = NOW()
        `, [
          session.customer,
          sub.id,
          sub.status,
          plan,
          sub.trial_end ? new Date(sub.trial_end * 1000) : null,
          new Date(sub.current_period_end * 1000),
        ]).catch(async () => {
          // Fallback: use customer metadata
          const customer = await stripe.customers.retrieve(session.customer);
          const userId = customer.metadata?.userId;
          if (!userId) return;

          await pool.query(`
            INSERT INTO subscriptions (user_id, stripe_customer_id, stripe_subscription_id, status, plan, trial_end, current_period_end, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            ON CONFLICT (user_id) DO UPDATE SET
              stripe_customer_id = $2, stripe_subscription_id = $3, status = $4,
              plan = $5, trial_end = $6, current_period_end = $7, updated_at = NOW()
          `, [
            userId, session.customer, sub.id, sub.status, plan,
            sub.trial_end ? new Date(sub.trial_end * 1000) : null,
            new Date(sub.current_period_end * 1000),
          ]);

          // Send trial started email
          const user = await pool.query('SELECT email, first_name FROM users WHERE id = $1', [userId]);
          if (user.rows.length) {
            sendTrialStartedEmail(user.rows[0].email, user.rows[0].first_name, plan);
          }
        });
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await pool.query(`
          UPDATE subscriptions SET
            status = $1, trial_end = $2, current_period_end = $3, updated_at = NOW()
          WHERE stripe_subscription_id = $4
        `, [
          sub.status,
          sub.trial_end ? new Date(sub.trial_end * 1000) : null,
          new Date(sub.current_period_end * 1000),
          sub.id,
        ]);
        break;
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
  }

  res.json({ received: true });
});

module.exports = router;
