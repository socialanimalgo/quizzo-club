const express = require('express');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { createNotification } = require('../lib/notifications');
const { grantPowerup, getWallet } = require('../lib/powerups');

const router = express.Router();

async function logAdminAction(pool, adminId, targetUserId, action, payload = {}) {
  await pool.query(
    `INSERT INTO admin_actions (admin_id, target_user_id, action, payload)
     VALUES ($1, $2, $3, $4)`,
    [adminId, targetUserId, action, JSON.stringify(payload)]
  );
}

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

router.get('/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const q = String(req.query.q || '').trim();
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;
    const search = q ? `%${q}%` : null;

    const where = [
      'u.deleted_at IS NULL',
      q ? '(u.first_name ILIKE $1 OR u.last_name ILIKE $1 OR u.email ILIKE $1)' : null,
    ].filter(Boolean).join(' AND ');

    const params = q ? [search, limit, offset] : [limit, offset];
    const limitIndex = q ? 2 : 1;
    const offsetIndex = q ? 3 : 2;

    const { rows } = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.avatar_url, u.is_admin, u.is_blocked, u.created_at,
              us.xp, us.current_streak, us.total_quizzes,
              s.status AS subscription_status, s.plan AS subscription_plan,
              pv.last_seen_at
       FROM users u
       LEFT JOIN user_stats us ON us.user_id = u.id
       LEFT JOIN subscriptions s ON s.user_id = u.id
       LEFT JOIN (
         SELECT user_id, MAX(visited_at) AS last_seen_at
         FROM page_visits
         GROUP BY user_id
       ) pv ON pv.user_id = u.id
       WHERE ${where}
       ORDER BY pv.last_seen_at DESC NULLS LAST, u.created_at DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      params
    );

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM users u
       WHERE ${where}`,
      q ? [search] : []
    );

    res.json({ users: rows, total: countRows[0].total });
  } catch (err) {
    console.error('Admin users error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/users/:id/block', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { rows } = await pool.query(
      'UPDATE users SET is_blocked = true WHERE id = $1 AND deleted_at IS NULL RETURNING *',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    await logAdminAction(pool, req.userId, req.params.id, 'block');
    res.json({ user: rows[0] });
  } catch (err) {
    console.error('Block user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/users/:id/unblock', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { rows } = await pool.query(
      'UPDATE users SET is_blocked = false WHERE id = $1 AND deleted_at IS NULL RETURNING *',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    await logAdminAction(pool, req.userId, req.params.id, 'unblock');
    res.json({ user: rows[0] });
  } catch (err) {
    console.error('Unblock user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    await pool.query(
      `UPDATE users
       SET deleted_at = NOW(),
           email = CONCAT('deleted+', id::text, '@quizzo.invalid'),
           first_name = 'Deleted',
           last_name = 'User',
           avatar_url = NULL,
           password_hash = NULL,
           google_id = NULL,
           is_blocked = true
       WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    await logAdminAction(pool, req.userId, req.params.id, 'delete');
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/users/:id/gift', authMiddleware, adminMiddleware, async (req, res) => {
  const { kind, powerup_id, qty = 1 } = req.body || {};
  const count = Number(qty) || 1;
  const pool = req.app.get('pool');
  try {
    if (!['powerup', 'xp', 'pro'].includes(kind)) {
      return res.status(400).json({ error: 'Invalid gift kind' });
    }

    if (kind === 'powerup') {
      await grantPowerup(pool, req.params.id, powerup_id, count, 'admin_gift');
      await createNotification(pool, {
        userId: req.params.id,
        type: 'admin_gift',
        title: 'Primio si powerup',
        body: `Admin ti je poslao ${count}× ${powerup_id}`,
        data: { kind, powerup_id, qty: count },
      });
    }

    if (kind === 'xp') {
      await pool.query(
        `INSERT INTO user_stats (user_id, xp)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET xp = user_stats.xp + $2, updated_at = NOW()`,
        [req.params.id, count * 100]
      );
      await createNotification(pool, {
        userId: req.params.id,
        type: 'admin_gift',
        title: 'Primio si XP',
        body: `Admin ti je dodijelio ${count * 100} XP`,
        data: { kind, xp: count * 100 },
      });
    }

    if (kind === 'pro') {
      await pool.query(
        `INSERT INTO subscriptions (user_id, status, plan, current_period_end, updated_at)
         VALUES ($1, 'active', 'gifted', NOW() + ($2::text || ' days')::interval, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           status = 'active',
           plan = COALESCE(subscriptions.plan, 'gifted'),
           current_period_end = GREATEST(COALESCE(subscriptions.current_period_end, NOW()), NOW()) + ($2::text || ' days')::interval,
           updated_at = NOW()`,
        [req.params.id, count]
      );
      await createNotification(pool, {
        userId: req.params.id,
        type: 'admin_gift',
        title: 'Primio si Pro',
        body: `Admin ti je dodijelio ${count} dana Pro pristupa`,
        data: { kind, days: count },
      });
    }

    await logAdminAction(pool, req.userId, req.params.id, kind === 'powerup' ? 'gift_powerup' : kind === 'xp' ? 'gift_xp' : 'gift_pro', req.body || {});
    const wallet = await getWallet(pool, req.params.id);
    const { rows: userRows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    res.json({ user: userRows[0], wallet });
  } catch (err) {
    console.error('Gift user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/users/:id/notify', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const message = String(req.body?.message || '').trim();
    if (!message) return res.status(400).json({ error: 'Message required' });
    const notification = await createNotification(pool, {
      userId: req.params.id,
      type: 'admin_message',
      title: 'Poruka od admina',
      body: message,
      data: {},
    });
    await logAdminAction(pool, req.userId, req.params.id, 'notify', { message });
    res.json({ notification });
  } catch (err) {
    console.error('Notify user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/categories', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { rows } = await pool.query(
      `WITH plays AS (
         SELECT category_id, COUNT(*)::int AS plays
         FROM quiz_sessions
         WHERE completed = true AND category_id IS NOT NULL
         GROUP BY category_id
       ),
       totals AS (
         SELECT COALESCE(SUM(plays), 0)::float AS total FROM plays
       )
       SELECT c.id, c.name, c.emoji, COALESCE(p.plays, 0) AS plays,
              CASE WHEN t.total > 0 THEN ROUND((COALESCE(p.plays, 0) / t.total) * 100) ELSE 0 END AS pct
       FROM categories c
       LEFT JOIN plays p ON p.category_id = c.id
       CROSS JOIN totals t
       ORDER BY plays DESC, c.name ASC`
    );
    res.json({ categories: rows });
  } catch (err) {
    console.error('Admin categories error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/powerups', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { rows } = await pool.query(
      `SELECT powerup_id AS id,
              COALESCE(SUM(qty), 0)::int AS total,
              COALESCE(SUM(qty) FILTER (WHERE created_at >= CURRENT_DATE), 0)::int AS today,
              COALESCE(SUM(revenue_eur), 0)::float AS revenue_eur
       FROM powerup_purchases
       WHERE powerup_id != 'bundle'
       GROUP BY powerup_id
       ORDER BY total DESC`
    );
    const totals = rows.reduce((acc, row) => ({
      units: acc.units + Number(row.total || 0),
      revenue_eur: acc.revenue_eur + Number(row.revenue_eur || 0),
    }), { units: 0, revenue_eur: 0 });

    res.json({ totals, per_type: rows });
  } catch (err) {
    console.error('Admin powerups error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

const DAILY_Q_COUNT = 30;

// GET /api/admin/daily-quizzes?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/daily-quizzes', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const today = new Date().toISOString().slice(0, 10);
    const from = req.query.from || today;
    const to = req.query.to || (() => {
      const d = new Date(from); d.setDate(d.getDate() + 6); return d.toISOString().slice(0, 10);
    })();

    const { rows } = await pool.query(
      `SELECT quiz_date::text AS date,
              CASE WHEN question_ids IS NULL THEN 0 ELSE jsonb_array_length(question_ids) END AS question_count
       FROM daily_quizzes WHERE quiz_date BETWEEN $1 AND $2 ORDER BY quiz_date`,
      [from, to]
    );

    const scheduled = new Map(rows.map(r => [r.date, parseInt(r.question_count)]));
    const result = [];
    const d = new Date(from);
    const end = new Date(to);
    while (d <= end) {
      const dateStr = d.toISOString().slice(0, 10);
      result.push({ date: dateStr, question_count: scheduled.get(dateStr) ?? 0, scheduled: scheduled.has(dateStr) });
      d.setDate(d.getDate() + 1);
    }
    res.json({ quizzes: result });
  } catch (err) {
    console.error('Admin daily quizzes list error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/daily-quizzes/:date
router.get('/daily-quizzes/:date', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { date } = req.params;
    const { rows } = await pool.query('SELECT * FROM daily_quizzes WHERE quiz_date = $1', [date]);

    if (!rows.length) return res.json({ date, questions: [] });

    const ids = Array.isArray(rows[0].question_ids) ? rows[0].question_ids : (rows[0].question_ids || []);
    if (!ids.length) return res.json({ date, questions: [] });

    const { rows: questions } = await pool.query(
      `SELECT q.id, q.question, q.category_id, c.name AS category_name, c.emoji AS category_emoji
       FROM questions q JOIN categories c ON c.id = q.category_id
       WHERE q.id = ANY($1::uuid[])`,
      [ids]
    );
    const qMap = new Map(questions.map(q => [q.id, q]));
    res.json({ date, questions: ids.map(id => qMap.get(id)).filter(Boolean) });
  } catch (err) {
    console.error('Admin daily quiz detail error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/admin/daily-quizzes/:date
router.put('/daily-quizzes/:date', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { date } = req.params;
    const { question_ids } = req.body;
    if (!Array.isArray(question_ids)) return res.status(400).json({ error: 'question_ids must be array' });

    await pool.query(
      `INSERT INTO daily_quizzes (quiz_date, question_ids) VALUES ($1, $2)
       ON CONFLICT (quiz_date) DO UPDATE SET question_ids = $2`,
      [date, JSON.stringify(question_ids)]
    );
    await logAdminAction(pool, req.userId, null, 'update_daily_quiz', { date, count: question_ids.length });
    res.json({ ok: true, date, count: question_ids.length });
  } catch (err) {
    console.error('Admin update daily quiz error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/daily-quizzes/schedule
router.post('/daily-quizzes/schedule', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const days = Math.min(Number(req.body.days) || 30, 90);

    let scheduled = 0;
    let skipped = 0;

    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);

      const { rows: existing } = await pool.query(
        'SELECT question_ids FROM daily_quizzes WHERE quiz_date = $1', [dateStr]
      );
      if (existing.length) {
        const ids = Array.isArray(existing[0].question_ids) ? existing[0].question_ids : [];
        if (ids.length === DAILY_Q_COUNT) { skipped++; continue; }
      }

      const { rows: qRows } = await pool.query(
        `SELECT id FROM questions WHERE active = true ORDER BY RANDOM() LIMIT $1`, [DAILY_Q_COUNT]
      );
      if (qRows.length < DAILY_Q_COUNT) { skipped++; continue; }

      await pool.query(
        `INSERT INTO daily_quizzes (quiz_date, question_ids) VALUES ($1, $2)
         ON CONFLICT (quiz_date) DO UPDATE SET question_ids = $2`,
        [dateStr, JSON.stringify(qRows.map(r => r.id))]
      );
      scheduled++;
    }

    await logAdminAction(pool, req.userId, null, 'schedule_daily_quizzes', { scheduled, skipped, days });
    res.json({ ok: true, scheduled, skipped });
  } catch (err) {
    console.error('Admin schedule daily quizzes error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/questions/search?q=&exclude=id1,id2&limit=15
router.get('/questions/search', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { q = '', limit = 15, exclude = '' } = req.query;
    const excludeIds = exclude ? exclude.split(',').filter(id => id.trim()) : [];
    const pattern = `%${q}%`;

    let rows;
    if (excludeIds.length > 0) {
      ({ rows } = await pool.query(
        `SELECT q.id, q.question, q.category_id, c.name AS category_name, c.emoji AS category_emoji
         FROM questions q JOIN categories c ON c.id = q.category_id
         WHERE q.active = true AND q.id != ALL($3::uuid[])
           AND (q.question ILIKE $1 OR c.name ILIKE $1)
         ORDER BY RANDOM() LIMIT $2`,
        [pattern, Number(limit), excludeIds]
      ));
    } else {
      ({ rows } = await pool.query(
        `SELECT q.id, q.question, q.category_id, c.name AS category_name, c.emoji AS category_emoji
         FROM questions q JOIN categories c ON c.id = q.category_id
         WHERE q.active = true AND (q.question ILIKE $1 OR c.name ILIKE $1)
         ORDER BY RANDOM() LIMIT $2`,
        [pattern, Number(limit)]
      ));
    }
    res.json({ questions: rows });
  } catch (err) {
    console.error('Admin question search error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
