const { publishNotification } = require('./realtime');

async function createNotification(pool, { userId, type, title, body, data = {} }) {
  const { rows } = await pool.query(
    `INSERT INTO notifications (user_id, type, title, body, data)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, type, title, body, JSON.stringify(data)]
  );
  publishNotification(userId, rows[0]);
  return rows[0];
}

async function hasRecentNotification(pool, userId, type, windowHours = 24, matchData = {}) {
  const { rows } = await pool.query(
    `SELECT data
     FROM notifications
     WHERE user_id = $1
       AND type = $2
       AND created_at >= NOW() - ($3::text || ' hours')::interval
     ORDER BY created_at DESC
     LIMIT 10`,
    [userId, type, String(windowHours)]
  );

  return rows.some(row => {
    const data = row.data || {};
    return Object.entries(matchData).every(([key, value]) => String(data[key]) === String(value));
  });
}

async function getUserRank(pool, userId) {
  const { rows } = await pool.query(
    `SELECT rank
     FROM (
       SELECT user_id, RANK() OVER (ORDER BY xp DESC) AS rank
       FROM user_stats
     ) ranked
     WHERE user_id = $1`,
    [userId]
  );
  return rows[0]?.rank ?? null;
}

async function maybeNotifyStreak(pool, userId, streak) {
  if (!streak || streak < 3) return;
  const exists = await hasRecentNotification(pool, userId, 'streak', 24, { streak });
  if (exists) return;
  await createNotification(pool, {
    userId,
    type: 'streak',
    title: `${streak} dana zaredom!`,
    body: 'Igraj danas da ne izgubiš streak',
    data: { streak },
  });
}

async function maybeNotifyLeaderboard(pool, userId) {
  const rank = await getUserRank(pool, userId);
  if (!rank || rank > 20) return;

  const bucket = rank <= 3 ? 'top3' : 'top20';
  const exists = await hasRecentNotification(pool, userId, 'leaderboard_rank', 72, { bucket, rank });
  if (exists) return;

  await createNotification(pool, {
    userId,
    type: 'leaderboard_rank',
    title: bucket === 'top3' ? 'Ušao si u Top 3' : 'Probio si Top 20',
    body: `Trenutno si #${rank} na globalnoj ljestvici`,
    data: { rank, bucket },
  });
}

module.exports = {
  createNotification,
  getUserRank,
  maybeNotifyLeaderboard,
  maybeNotifyStreak,
};
