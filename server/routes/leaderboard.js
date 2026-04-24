const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');

// GET /api/leaderboard?type=alltime|weekly|daily
router.get('/', optionalAuth, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { type = 'alltime', limit = 50 } = req.query;
    const userId = req.user?.userId;

    let rows;

    if (type === 'daily') {
      const { rows: r } = await pool.query(
        `SELECT dc.user_id, u.first_name, u.last_name, u.avatar_url,
                dc.score, dc.correct_count, dc.completed_at,
                RANK() OVER (ORDER BY dc.score DESC, dc.correct_count DESC) AS rank
         FROM daily_completions dc
         JOIN users u ON u.id = dc.user_id
         WHERE dc.quiz_date = CURRENT_DATE
         ORDER BY rank
         LIMIT $1`,
        [limit]
      );
      rows = r;
    } else if (type === 'weekly') {
      const { rows: r } = await pool.query(
        `SELECT qs.user_id, u.first_name, u.last_name, u.avatar_url,
                SUM(qs.score) AS total_score,
                SUM(qs.correct_count) AS total_correct,
                COUNT(qs.id) AS quizzes_played,
                RANK() OVER (ORDER BY SUM(qs.score) DESC) AS rank
         FROM quiz_sessions qs
         JOIN users u ON u.id = qs.user_id
         WHERE qs.completed = true AND qs.completed_at >= NOW() - INTERVAL '7 days'
         GROUP BY qs.user_id, u.first_name, u.last_name, u.avatar_url
         ORDER BY rank
         LIMIT $1`,
        [limit]
      );
      rows = r;
    } else {
      const { rows: r } = await pool.query(
        `SELECT us.user_id, u.first_name, u.last_name, u.avatar_url,
                us.xp, us.total_quizzes, us.best_score, us.current_streak,
                us.total_correct, us.total_questions,
                RANK() OVER (ORDER BY us.xp DESC) AS rank
         FROM user_stats us
         JOIN users u ON u.id = us.user_id
         ORDER BY rank
         LIMIT $1`,
        [limit]
      );
      rows = r;
    }

    // Find current user's rank if logged in
    let myRank = null;
    if (userId) {
      myRank = rows.find(r => r.user_id === userId) || null;

      // User is outside the top-N — fetch their rank separately
      if (!myRank) {
        if (type === 'alltime') {
          const { rows: r } = await pool.query(
            `SELECT us.user_id, u.first_name, u.last_name,
                    us.xp, us.total_quizzes, us.best_score, us.current_streak,
                    (SELECT COUNT(*) + 1 FROM user_stats us2 WHERE us2.xp > us.xp) AS rank
             FROM user_stats us
             JOIN users u ON u.id = us.user_id
             WHERE us.user_id = $1`,
            [userId]
          );
          myRank = r[0] || null;
        } else if (type === 'weekly') {
          const { rows: r } = await pool.query(
            `WITH all_weekly AS (
               SELECT qs.user_id,
                      SUM(qs.score) AS total_score,
                      COUNT(qs.id) AS quizzes_played,
                      RANK() OVER (ORDER BY SUM(qs.score) DESC) AS rank
               FROM quiz_sessions qs
               WHERE qs.completed = true AND qs.completed_at >= NOW() - INTERVAL '7 days'
               GROUP BY qs.user_id
             )
             SELECT aw.*, u.first_name, u.last_name
             FROM all_weekly aw
             JOIN users u ON u.id = aw.user_id
             WHERE aw.user_id = $1`,
            [userId]
          );
          myRank = r[0] || null;
        } else if (type === 'daily') {
          const { rows: r } = await pool.query(
            `WITH all_daily AS (
               SELECT dc.user_id, dc.score, dc.correct_count,
                      RANK() OVER (ORDER BY dc.score DESC, dc.correct_count DESC) AS rank
               FROM daily_completions dc
               WHERE dc.quiz_date = CURRENT_DATE
             )
             SELECT ad.*, u.first_name, u.last_name
             FROM all_daily ad
             JOIN users u ON u.id = ad.user_id
             WHERE ad.user_id = $1`,
            [userId]
          );
          myRank = r[0] || null;
        }
      }
    }

    res.json({ leaderboard: rows, my_rank: myRank });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
