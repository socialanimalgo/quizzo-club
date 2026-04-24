const express = require('express');
const router = express.Router();
const { authMiddleware, optionalAuth } = require('../middleware/auth');

function getZagrebParts(date = new Date(), timeZone = 'Europe/Zagreb') {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: parts.weekday,
  };
}

function zonedTimeToUtc(parts, timeZone = 'Europe/Zagreb') {
  let guess = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second || 0);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  for (let i = 0; i < 4; i += 1) {
    const current = Object.fromEntries(formatter.formatToParts(new Date(guess)).map(part => [part.type, part.value]));
    const currentUtc = Date.UTC(
      Number(current.year),
      Number(current.month) - 1,
      Number(current.day),
      Number(current.hour),
      Number(current.minute),
      Number(current.second)
    );
    const targetUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second || 0);
    const delta = targetUtc - currentUtc;
    if (delta === 0) break;
    guess += delta;
  }

  return new Date(guess);
}

function pseudoLocalDate(parts) {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second || 0));
}

function partsFromPseudoDate(date) {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds(),
  };
}

function getDailyWindow(now = new Date(), timeZone = 'Europe/Zagreb') {
  const parts = getZagrebParts(now, timeZone);
  const startParts = { ...parts, hour: 0, minute: 0, second: 0 };
  const start = zonedTimeToUtc(startParts, timeZone);
  const endPseudo = pseudoLocalDate(startParts);
  endPseudo.setUTCDate(endPseudo.getUTCDate() + 1);
  const end = zonedTimeToUtc(partsFromPseudoDate(endPseudo), timeZone);
  return { start, end };
}

function getWeeklyWindow(now = new Date(), timeZone = 'Europe/Zagreb') {
  const parts = getZagrebParts(now, timeZone);
  const localNow = pseudoLocalDate(parts);
  const boundary = pseudoLocalDate({ ...parts, hour: 20, minute: 0, second: 0 });
  boundary.setUTCDate(boundary.getUTCDate() - boundary.getUTCDay());
  if (localNow < boundary) boundary.setUTCDate(boundary.getUTCDate() - 7);

  const nextBoundary = new Date(boundary);
  nextBoundary.setUTCDate(nextBoundary.getUTCDate() + 7);

  return {
    start: zonedTimeToUtc(partsFromPseudoDate(boundary), timeZone),
    end: zonedTimeToUtc(partsFromPseudoDate(nextBoundary), timeZone),
  };
}

async function getTopic(pool, slug) {
  const { rows } = await pool.query('SELECT * FROM hot_topic_quizzes WHERE slug = $1', [slug]);
  return rows[0] || null;
}

function aggregateOrderSql(alias = 'a') {
  return `SUM(${alias}.leaderboard_points_awarded) DESC,
          SUM(${alias}.correct_answers) DESC,
          SUM(${alias}.time_ms) ASC,
          MIN(${alias}.created_at) ASC`;
}

async function getLeaderboard(pool, slug, period = 'weekly', limit = 10) {
  const topic = await getTopic(pool, slug);
  if (!topic) return { topic: null, rows: [], window: null };

  const window = period === 'daily' ? getDailyWindow(new Date(), topic.timezone) : getWeeklyWindow(new Date(), topic.timezone);
  const { rows } = await pool.query(
    `WITH ranked AS (
      SELECT
        a.user_id,
        u.first_name,
        u.last_name,
        u.avatar_url,
        SUM(a.leaderboard_points_awarded)::int AS points,
        SUM(a.correct_answers)::int AS total_correct,
        SUM(a.time_ms)::int AS total_time_ms,
        MIN(a.created_at) AS first_score_at,
        RANK() OVER (ORDER BY ${aggregateOrderSql('a')}) AS rank
      FROM hot_topic_attempts a
      JOIN users u ON u.id = a.user_id
      WHERE a.hot_topic_slug = $1
        AND a.created_at >= $2
        AND a.created_at < $3
      GROUP BY a.user_id, u.first_name, u.last_name, u.avatar_url
    )
    SELECT * FROM ranked
    ORDER BY rank
    LIMIT $4`,
    [slug, window.start.toISOString(), window.end.toISOString(), limit]
  );
  return { topic, rows, window };
}

async function getMyStanding(pool, slug, userId) {
  const topic = await getTopic(pool, slug);
  if (!topic || !userId) return null;

  const periods = {
    daily: getDailyWindow(new Date(), topic.timezone),
    weekly: getWeeklyWindow(new Date(), topic.timezone),
  };

  const results = {};
  for (const [period, window] of Object.entries(periods)) {
    const { rows } = await pool.query(
      `WITH ranked AS (
        SELECT
          a.user_id,
          SUM(a.leaderboard_points_awarded)::int AS points,
          SUM(a.correct_answers)::int AS total_correct,
          SUM(a.time_ms)::int AS total_time_ms,
          MIN(a.created_at) AS first_score_at,
          RANK() OVER (ORDER BY ${aggregateOrderSql('a')}) AS rank
        FROM hot_topic_attempts a
        WHERE a.hot_topic_slug = $1
          AND a.created_at >= $2
          AND a.created_at < $3
        GROUP BY a.user_id
      )
      SELECT * FROM ranked WHERE user_id = $4`,
      [slug, window.start.toISOString(), window.end.toISOString(), userId]
    );
    results[period] = rows[0] || { rank: null, points: 0, total_correct: 0 };
  }

  const { rows: badgeRows } = await pool.query(
    'SELECT badge_key, title FROM user_badges WHERE user_id = $1',
    [userId]
  );

  return {
    daily: results.daily,
    weekly: results.weekly,
    badges: badgeRows,
  };
}

async function finalizePreviousWeeklyRewards(pool, topic) {
  const current = getWeeklyWindow(new Date(), topic.timezone);
  const previousEnd = current.start;
  const previousStart = new Date(previousEnd);
  previousStart.setUTCDate(previousStart.getUTCDate() - 7);

  const { rows: existingClaims } = await pool.query(
    `SELECT 1
     FROM hot_topic_reward_claims
     WHERE hot_topic_slug = $1
       AND period_type = 'weekly'
       AND period_start = $2
     LIMIT 1`,
    [topic.slug, previousStart.toISOString()]
  );
  if (existingClaims.length) return;

  const { rows: winners } = await pool.query(
    `SELECT
      a.user_id,
      SUM(a.leaderboard_points_awarded)::int AS points,
      SUM(a.correct_answers)::int AS total_correct,
      SUM(a.time_ms)::int AS total_time_ms,
      MIN(a.created_at) AS first_score_at
     FROM hot_topic_attempts a
     WHERE a.hot_topic_slug = $1
       AND a.created_at >= $2
       AND a.created_at < $3
     GROUP BY a.user_id
     ORDER BY ${aggregateOrderSql('a')}
     LIMIT 3`,
    [topic.slug, previousStart.toISOString(), previousEnd.toISOString()]
  );

  for (const winner of winners) {
    const { rowCount: gemClaimed } = await pool.query(
      `INSERT INTO hot_topic_reward_claims (hot_topic_slug, user_id, period_type, period_start, period_end, reward_type)
       VALUES ($1, $2, 'weekly', $3, $4, 'gems')
       ON CONFLICT (hot_topic_slug, user_id, period_type, period_start, reward_type) DO NOTHING`,
      [topic.slug, winner.user_id, previousStart.toISOString(), previousEnd.toISOString()]
    );
    if (gemClaimed) {
      await pool.query('UPDATE users SET gems = gems + $1 WHERE id = $2', [topic.reward_gems, winner.user_id]);
    }

    if (topic.badge_key && topic.badge_title) {
      const { rowCount: badgeClaimed } = await pool.query(
        `INSERT INTO hot_topic_reward_claims (hot_topic_slug, user_id, period_type, period_start, period_end, reward_type)
         VALUES ($1, $2, 'weekly', $3, $4, 'badge')
         ON CONFLICT (hot_topic_slug, user_id, period_type, period_start, reward_type) DO NOTHING`,
        [topic.slug, winner.user_id, previousStart.toISOString(), previousEnd.toISOString()]
      );
      if (badgeClaimed) {
        await pool.query(
          `INSERT INTO user_badges (user_id, badge_key, title, source)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, badge_key) DO NOTHING`,
          [winner.user_id, topic.badge_key, topic.badge_title, `${topic.slug}:weekly_top3`]
        );
      }
    }
  }
}

router.get('/:slug', optionalAuth, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const topic = await getTopic(pool, req.params.slug);
    if (!topic) return res.status(404).json({ error: 'Hot topic not found' });

    await finalizePreviousWeeklyRewards(pool, topic);
    const weekly = getWeeklyWindow(new Date(), topic.timezone);
    res.json({
      hot_topic: {
        slug: topic.slug,
        title: topic.title,
        category_id: topic.category_id,
        status: topic.status,
        timezone: topic.timezone,
        reward_gems: topic.reward_gems,
        badge_key: topic.badge_key,
        badge_title: topic.badge_title,
        image_url: topic.image_url,
        question_count: topic.question_count,
        weekly_cutoff: weekly.end.toISOString(),
      },
    });
  } catch (err) {
    console.error('Hot topic meta error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:slug/leaderboard', optionalAuth, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const period = req.query.period === 'daily' ? 'daily' : 'weekly';
    const limit = Math.min(Number(req.query.limit) || 10, 100);
    const result = await getLeaderboard(pool, req.params.slug, period, limit);
    if (!result.topic) return res.status(404).json({ error: 'Hot topic not found' });
    await finalizePreviousWeeklyRewards(pool, result.topic);
    res.json({
      leaderboard: result.rows,
      period,
      period_start: result.window.start.toISOString(),
      period_end: result.window.end.toISOString(),
    });
  } catch (err) {
    console.error('Hot topic leaderboard error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:slug/me', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const topic = await getTopic(pool, req.params.slug);
    if (!topic) return res.status(404).json({ error: 'Hot topic not found' });
    await finalizePreviousWeeklyRewards(pool, topic);
    const me = await getMyStanding(pool, req.params.slug, req.userId);
    res.json({ me });
  } catch (err) {
    console.error('Hot topic me error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:slug/start', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const userId = req.userId;
    const topic = await getTopic(pool, req.params.slug);
    if (!topic) return res.status(404).json({ error: 'Hot topic not found' });
    if (topic.status !== 'active') return res.status(409).json({ error: 'Hot topic is not active' });

    const { rows: qRows } = await pool.query(
      `SELECT id FROM questions WHERE category_id = $1 AND active = true ORDER BY RANDOM() LIMIT $2`,
      [topic.category_id, topic.question_count]
    );
    if (qRows.length < topic.question_count) {
      return res.status(400).json({ error: 'Not enough questions in this hot topic' });
    }

    const questionIds = qRows.map(row => row.id);
    const { rows: sessionRows } = await pool.query(
      `INSERT INTO quiz_sessions (user_id, category_id, session_type, question_ids, total_questions)
       VALUES ($1, $2, 'hot_topic', $3, $4)
       RETURNING id`,
      [userId, topic.category_id, JSON.stringify(questionIds), topic.question_count]
    );
    const { rows: questionRows } = await pool.query(
      `SELECT id, question, options FROM questions WHERE id = ANY($1::uuid[])`,
      [questionIds]
    );
    const ordered = questionIds.map(id => questionRows.find(question => question.id === id)).filter(Boolean);
    res.json({ session_id: sessionRows[0].id, questions: ordered, hot_topic: topic.slug });
  } catch (err) {
    console.error('Hot topic start error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:slug/complete', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const userId = req.userId;
    const { session_id } = req.body;
    const topic = await getTopic(pool, req.params.slug);
    if (!topic) return res.status(404).json({ error: 'Hot topic not found' });
    if (!session_id) return res.status(400).json({ error: 'session_id required' });

    const { rows: sessionRows } = await pool.query(
      `SELECT * FROM quiz_sessions
       WHERE id = $1 AND user_id = $2 AND completed = true AND session_type = 'hot_topic'`,
      [session_id, userId]
    );
    if (!sessionRows.length) return res.status(404).json({ error: 'Completed hot topic session not found' });
    const session = sessionRows[0];
    const answers = Array.isArray(session.answers) ? session.answers : [];
    const totalTimeMs = answers.reduce((sum, answer) => sum + Number(answer?.time_ms || 0), 0);
    const xpAwarded = Math.floor(Number(session.score || 0) / 10) + (Number(session.correct_count || 0) * 5);
    const leaderboardPointsAwarded = Number(session.score || 0) + (Number(session.correct_count || 0) * 20);

    const { rows: inserted } = await pool.query(
      `INSERT INTO hot_topic_attempts (
         hot_topic_slug, user_id, session_id, score, correct_answers, xp_awarded, leaderboard_points_awarded, time_ms
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (session_id) DO NOTHING
       RETURNING *`,
      [topic.slug, userId, session_id, session.score || 0, session.correct_count || 0, xpAwarded, leaderboardPointsAwarded, totalTimeMs]
    );

    await finalizePreviousWeeklyRewards(pool, topic);
    const me = await getMyStanding(pool, topic.slug, userId);
    res.json({
      recorded: inserted.length > 0,
      leaderboard_points_awarded: leaderboardPointsAwarded,
      me,
    });
  } catch (err) {
    console.error('Hot topic complete error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
