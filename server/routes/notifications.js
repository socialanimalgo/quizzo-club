const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const userId = req.userId;
    const { filter = 'all', limit = 50 } = req.query;

    const params = [userId, Math.min(Number(limit) || 50, 100)];
    const where = filter === 'unread' ? 'AND n.read_at IS NULL' : '';
    const { rows: items } = await pool.query(
      `SELECT n.*
       FROM notifications n
       WHERE n.user_id = $1
       ${where}
       ORDER BY n.created_at DESC
       LIMIT $2`,
      params
    );

    const { rows: counts } = await pool.query(
      `SELECT
         COUNT(*)::int AS all_count,
         COUNT(*) FILTER (WHERE read_at IS NULL)::int AS unread_count
       FROM notifications
       WHERE user_id = $1`,
      [userId]
    );

    res.json({
      notifications: items,
      counts: counts[0] || { all_count: 0, unread_count: 0 },
    });
  } catch (err) {
    console.error('Notifications list error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { rows } = await pool.query(
      `SELECT COUNT(*) FILTER (WHERE read_at IS NULL)::int AS unread_count
       FROM notifications
       WHERE user_id = $1`,
      [req.userId]
    );
    res.json({ unread_count: rows[0]?.unread_count || 0 });
  } catch (err) {
    console.error('Notifications summary error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/mark-all-read', async (req, res) => {
  try {
    const pool = req.app.get('pool');
    await pool.query(
      `UPDATE notifications
       SET read_at = COALESCE(read_at, NOW())
       WHERE user_id = $1`,
      [req.userId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/read', async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { rows } = await pool.query(
      `UPDATE notifications
       SET read_at = COALESCE(read_at, NOW())
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [req.params.id, req.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Notification not found' });
    res.json({ notification: rows[0] });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
