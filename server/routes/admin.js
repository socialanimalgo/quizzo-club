const express = require('express');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/admin/stats
router.get('/stats', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const pool = req.app.get('pool');

    const [total, todayVisits, todayUsers, dailyVisits, dailyUsers, countries, quizStats] = await Promise.all([
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
      pool.query(`
        SELECT c.name, c.emoji, COUNT(qs.id) AS sessions_played, AVG(qs.correct_count::float / NULLIF(qs.total_questions,0)) AS avg_accuracy
        FROM categories c
        LEFT JOIN quiz_sessions qs ON qs.category_id = c.id AND qs.completed = true
        GROUP BY c.id, c.name, c.emoji
        ORDER BY sessions_played DESC
      `),
    ]);

    res.json({
      totalUsers: parseInt(total.rows[0].count),
      todayVisits: parseInt(todayVisits.rows[0].count),
      todayNewUsers: parseInt(todayUsers.rows[0].count),
      dailyVisits: dailyVisits.rows.map(r => ({ date: r.date, count: parseInt(r.count) })),
      dailyNewUsers: dailyUsers.rows.map(r => ({ date: r.date, count: parseInt(r.count) })),
      topCountries: countries.rows.map(r => ({ country: r.country, code: r.country_code, count: parseInt(r.count) })),
      categoryStats: quizStats.rows.map(r => ({
        name: r.name,
        emoji: r.emoji,
        sessions: parseInt(r.sessions_played),
        accuracy: r.avg_accuracy ? Math.round(parseFloat(r.avg_accuracy) * 100) : 0,
      })),
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/questions?category=&page=&limit=
router.get('/questions', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { category, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const where = category ? 'WHERE category_id = $3' : '';
    const params = category
      ? [limit, offset, category]
      : [limit, offset];

    const { rows } = await pool.query(
      `SELECT q.*, c.name AS category_name FROM questions q
       JOIN categories c ON c.id = q.category_id
       ${where}
       ORDER BY q.created_at DESC LIMIT $1 OFFSET $2`,
      params
    );

    const countQuery = category
      ? `SELECT COUNT(*) FROM questions WHERE category_id = $1`
      : `SELECT COUNT(*) FROM questions`;
    const { rows: countRows } = await pool.query(countQuery, category ? [category] : []);

    res.json({ questions: rows, total: parseInt(countRows[0].count) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
