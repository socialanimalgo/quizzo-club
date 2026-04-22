const express = require('express');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

async function adminMiddleware(req, res, next) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return res.status(403).json({ error: 'Admin not configured' });
  try {
    const pool = req.app.get('pool');
    const result = await pool.query('SELECT email FROM users WHERE id = $1', [req.userId]);
    if (result.rows.length === 0 || result.rows[0].email !== adminEmail) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/admin/stats
router.get('/stats', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const pool = req.app.get('pool');

    const [total, todayVisits, todayUsers, dailyVisits, dailyUsers, countries] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query(`SELECT COUNT(*) FROM page_visits WHERE DATE(visited_at AT TIME ZONE 'UTC') = CURRENT_DATE`),
      pool.query(`SELECT COUNT(*) FROM users WHERE DATE(created_at AT TIME ZONE 'UTC') = CURRENT_DATE`),
      pool.query(`
        SELECT DATE(visited_at AT TIME ZONE 'UTC') AS date, COUNT(*) AS count
        FROM page_visits
        WHERE visited_at >= NOW() - INTERVAL '14 days'
        GROUP BY DATE(visited_at AT TIME ZONE 'UTC')
        ORDER BY date
      `),
      pool.query(`
        SELECT DATE(created_at AT TIME ZONE 'UTC') AS date, COUNT(*) AS count
        FROM users
        WHERE created_at >= NOW() - INTERVAL '14 days'
        GROUP BY DATE(created_at AT TIME ZONE 'UTC')
        ORDER BY date
      `),
      pool.query(`
        SELECT country, country_code, COUNT(*) AS count
        FROM page_visits
        WHERE country IS NOT NULL AND visited_at >= NOW() - INTERVAL '30 days'
        GROUP BY country, country_code
        ORDER BY count DESC
        LIMIT 10
      `),
    ]);

    res.json({
      totalUsers: parseInt(total.rows[0].count),
      todayVisits: parseInt(todayVisits.rows[0].count),
      todayNewUsers: parseInt(todayUsers.rows[0].count),
      dailyVisits: dailyVisits.rows.map(r => ({ date: r.date, count: parseInt(r.count) })),
      dailyNewUsers: dailyUsers.rows.map(r => ({ date: r.date, count: parseInt(r.count) })),
      topCountries: countries.rows.map(r => ({ country: r.country, code: r.country_code, count: parseInt(r.count) })),
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
