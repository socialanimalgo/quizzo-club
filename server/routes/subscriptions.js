const express = require('express');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/subscription
router.get('/', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const result = await pool.query(
      'SELECT status, plan, trial_end, current_period_end FROM subscriptions WHERE user_id = $1',
      [req.userId]
    );
    if (!result.rows.length) return res.json({ status: 'inactive', plan: null });

    const sub = result.rows[0];
    // Treat expired periods as inactive (Stripe webhooks should keep this updated)
    const now = new Date();
    const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;
    if (periodEnd && periodEnd < now && sub.status === 'active') {
      return res.json({ status: 'inactive', plan: sub.plan });
    }

    res.json({
      status: sub.status,
      plan: sub.plan,
      trial_end: sub.trial_end,
      current_period_end: sub.current_period_end,
    });
  } catch (err) {
    console.error('Get subscription error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
