const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { POWERUPS, BUNDLES, GEM_PACKS, getWallet } = require('../lib/powerups');

const router = express.Router();

router.get('/catalog', authMiddleware, async (_req, res) => {
  res.json({
    powerups: Object.values(POWERUPS),
    bundles: Object.values(BUNDLES),
    gemPacks: Object.values(GEM_PACKS),
  });
});

router.get('/wallet', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const wallet = await getWallet(pool, req.userId);
    res.json(wallet);
  } catch (err) {
    console.error('Shop wallet error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/buy-powerup', authMiddleware, async (req, res) => {
  const { powerup_id, currency, qty = 1 } = req.body || {};
  const powerup = POWERUPS[powerup_id];
  const count = Number(qty) || 1;

  if (!powerup) return res.status(400).json({ error: 'Invalid powerup_id' });
  if (!['coins', 'gems'].includes(currency)) return res.status(400).json({ error: 'Invalid currency' });
  if (count < 1) return res.status(400).json({ error: 'Invalid qty' });

  const pool = req.app.get('pool');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: userRows } = await client.query(
      'SELECT coins, gems FROM users WHERE id = $1 FOR UPDATE',
      [req.userId]
    );
    if (!userRows.length) throw new Error('User not found');

    const field = currency === 'coins' ? 'coins' : 'gems';
    const unitCost = currency === 'coins' ? powerup.coins : powerup.gems;
    const totalCost = unitCost * count;
    if ((Number(userRows[0][field]) || 0) < totalCost) {
      await client.query('ROLLBACK');
      return res.status(422).json({ error: `Nedovoljno ${currency === 'coins' ? 'kovanica' : 'dragulja'}` });
    }

    await client.query(
      `UPDATE users SET ${field} = ${field} - $1 WHERE id = $2`,
      [totalCost, req.userId]
    );
    await client.query(
      `INSERT INTO user_powerups (user_id, powerup_id, qty)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, powerup_id) DO UPDATE SET qty = user_powerups.qty + $3`,
      [req.userId, powerup_id, count]
    );
    const { rows: purchaseRows } = await client.query(
      `INSERT INTO powerup_purchases (user_id, powerup_id, qty, currency, cost_coins, cost_gems, source)
       VALUES ($1, $2, $3, $4, $5, $6, 'shop')
       RETURNING *`,
      [req.userId, powerup_id, count, currency, currency === 'coins' ? totalCost : null, currency === 'gems' ? totalCost : null]
    );
    await client.query('COMMIT');

    const wallet = await getWallet(pool, req.userId);
    res.json({ wallet, purchase: purchaseRows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Buy powerup error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

router.post('/buy-bundle', authMiddleware, async (req, res) => {
  const { bundle_id } = req.body || {};
  const bundle = BUNDLES[bundle_id];
  if (!bundle) return res.status(400).json({ error: 'Invalid bundle_id' });

  const pool = req.app.get('pool');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: userRows } = await client.query(
      'SELECT gems FROM users WHERE id = $1 FOR UPDATE',
      [req.userId]
    );
    if (!userRows.length) throw new Error('User not found');
    if ((Number(userRows[0].gems) || 0) < bundle.cost_gems) {
      await client.query('ROLLBACK');
      return res.status(422).json({ error: 'Nedovoljno dragulja' });
    }

    await client.query(
      'UPDATE users SET gems = gems - $1 WHERE id = $2',
      [bundle.cost_gems, req.userId]
    );

    for (const [powerupId, qty] of Object.entries(bundle.items)) {
      await client.query(
        `INSERT INTO user_powerups (user_id, powerup_id, qty)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, powerup_id) DO UPDATE SET qty = user_powerups.qty + $3`,
        [req.userId, powerupId, qty]
      );
    }

    const { rows: purchaseRows } = await client.query(
      `INSERT INTO powerup_purchases (user_id, powerup_id, qty, currency, cost_gems, bundle_id, source)
       VALUES ($1, 'bundle', 1, 'bundle', $2, $3, 'shop')
       RETURNING *`,
      [req.userId, bundle.cost_gems, bundle_id]
    );
    await client.query('COMMIT');

    const wallet = await getWallet(pool, req.userId);
    res.json({ wallet, purchase: purchaseRows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Buy bundle error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

router.post('/buy-gems', authMiddleware, async (req, res) => {
  const { pack_id } = req.body || {};
  const pack = GEM_PACKS[pack_id];
  if (!pack) return res.status(400).json({ error: 'Invalid pack_id' });

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Plaćanje trenutno nije dostupno' });
  }

  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const baseUrl = process.env.BASE_URL || 'https://quizzo.club';
  const totalGems = pack.gems + pack.bonus;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          unit_amount: Math.round(pack.price_eur * 100),
          product_data: {
            name: `💎 ${totalGems} Dragulja`,
            description: pack.bonus
              ? `${pack.gems} dragulja + ${pack.bonus} bonus dragulja`
              : `${pack.gems} dragulja`,
          },
        },
        quantity: 1,
      }],
      metadata: { user_id: req.userId, pack_id: pack.id },
      success_url: `${baseUrl}/shop?gems_ok=1&pack=${pack.id}`,
      cancel_url: `${baseUrl}/shop`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe gem checkout error:', err);
    res.status(500).json({ error: 'Greška pri kreiranju naplate' });
  }
});

module.exports = router;
