const express = require('express');
const router = express.Router();
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { maybeNotifyLeaderboard, maybeNotifyStreak } = require('../lib/notifications');

const DAILY_QUESTION_COUNT = 30;

function normalizeQuestionIds(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function getOrCreateDailyQuiz(pool) {
  const { rows: dRows } = await pool.query(
    'SELECT * FROM daily_quizzes WHERE quiz_date = CURRENT_DATE'
  );

  if (dRows.length && Array.isArray(dRows[0].question_ids) && dRows[0].question_ids.length === DAILY_QUESTION_COUNT) {
    return dRows[0];
  }

  const { rows: qRows } = await pool.query(
    `SELECT id FROM questions WHERE active = true ORDER BY RANDOM() LIMIT $1`,
    [DAILY_QUESTION_COUNT]
  );
  const ids = qRows.map(r => r.id);

  if (ids.length < DAILY_QUESTION_COUNT) {
    throw new Error('Not enough questions for daily quiz');
  }

  if (dRows.length) {
    const { rows: updated } = await pool.query(
      'UPDATE daily_quizzes SET question_ids = $1 WHERE quiz_date = CURRENT_DATE RETURNING *',
      [JSON.stringify(ids)]
    );
    return updated[0];
  }

  const { rows: inserted } = await pool.query(
    'INSERT INTO daily_quizzes (quiz_date, question_ids) VALUES (CURRENT_DATE, $1) RETURNING *',
    [JSON.stringify(ids)]
  );

  return inserted[0];
}

async function loadOrderedQuestions(pool, questionIds) {
  const ids = normalizeQuestionIds(questionIds);
  if (!ids.length) return [];

  const { rows: questions } = await pool.query(
    `SELECT id, question, options FROM questions WHERE id = ANY($1::uuid[])`,
    [ids]
  );
  return ids.map(id => questions.find(q => q.id === id)).filter(Boolean);
}

// GET /api/quiz/categories
router.get('/categories', async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { rows } = await pool.query(
      `SELECT c.*, COUNT(q.id) AS question_count
       FROM categories c
       LEFT JOIN questions q ON q.category_id = c.id AND q.active = true
       GROUP BY c.id
       ORDER BY c.id`
    );
    res.json({ categories: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/quiz/start — start a solo quiz session
router.post('/start', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { category_id, count = 10 } = req.body;
    const userId = req.user.userId;

    if (!category_id) return res.status(400).json({ error: 'category_id required' });

    // Pick random questions
    const { rows: qRows } = await pool.query(
      `SELECT id FROM questions WHERE category_id = $1 AND active = true ORDER BY RANDOM() LIMIT $2`,
      [category_id, count]
    );

    if (qRows.length < count) {
      return res.status(400).json({ error: 'Not enough questions in this category' });
    }

    const questionIds = qRows.map(r => r.id);

    const { rows } = await pool.query(
      `INSERT INTO quiz_sessions (user_id, category_id, session_type, question_ids, total_questions)
       VALUES ($1, $2, 'solo', $3, $4) RETURNING id`,
      [userId, category_id, JSON.stringify(questionIds), count]
    );

    // Load full question data (without revealing correct_index in order)
    const { rows: questions } = await pool.query(
      `SELECT id, question, options FROM questions WHERE id = ANY($1::uuid[])`,
      [questionIds]
    );

    // Return in the same random order
    const ordered = questionIds.map(id => questions.find(q => q.id === id));

    res.json({ session_id: rows[0].id, questions: ordered });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/quiz/answer — submit answer for current question
router.post('/answer', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { session_id, question_id, answer_index, time_ms } = req.body;
    const userId = req.user.userId;

    const { rows } = await pool.query(
      'SELECT * FROM quiz_sessions WHERE id = $1 AND user_id = $2 AND completed = false',
      [session_id, userId]
    );

    if (!rows.length) return res.status(404).json({ error: 'Session not found' });

    const session = rows[0];

    // Get correct answer
    const { rows: qRows } = await pool.query(
      'SELECT correct_index FROM questions WHERE id = $1',
      [question_id]
    );
    if (!qRows.length) return res.status(404).json({ error: 'Question not found' });

    const correct = qRows[0].correct_index === answer_index;
    const points = correct ? Math.max(100 - Math.floor((time_ms || 10000) / 100), 10) : 0;

    const answers = session.answers || [];
    answers.push({ question_id, answer_index, correct, time_ms: time_ms || 0, points });

    await pool.query(
      `UPDATE quiz_sessions SET answers = $1, score = score + $2,
       correct_count = correct_count + $3 WHERE id = $4`,
      [JSON.stringify(answers), points, correct ? 1 : 0, session_id]
    );

    res.json({ correct, correct_index: qRows[0].correct_index, points });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/quiz/finish — complete a session
router.post('/finish', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { session_id } = req.body;
    const userId = req.user.userId;

    const { rows } = await pool.query(
      `UPDATE quiz_sessions SET completed = true, completed_at = NOW()
       WHERE id = $1 AND user_id = $2 AND completed = false
       RETURNING *`,
      [session_id, userId]
    );

    if (!rows.length) return res.status(404).json({ error: 'Session not found' });

    const session = rows[0];
    const xpEarned = Math.floor(session.score / 10) + (session.correct_count * 5);

    // Update user stats
    await pool.query(
      `INSERT INTO user_stats (user_id, total_quizzes, total_correct, total_questions, best_score, xp, last_quiz_date)
       VALUES ($1, 1, $2, $3, $4, $5, CURRENT_DATE)
       ON CONFLICT (user_id) DO UPDATE SET
         total_quizzes = user_stats.total_quizzes + 1,
         total_correct = user_stats.total_correct + $2,
         total_questions = user_stats.total_questions + $3,
         best_score = GREATEST(user_stats.best_score, $4),
         xp = user_stats.xp + $5,
         current_streak = CASE
           WHEN user_stats.last_quiz_date = CURRENT_DATE - 1 THEN user_stats.current_streak + 1
           WHEN user_stats.last_quiz_date = CURRENT_DATE THEN user_stats.current_streak
           ELSE 1
         END,
         longest_streak = GREATEST(user_stats.longest_streak, CASE
           WHEN user_stats.last_quiz_date = CURRENT_DATE - 1 THEN user_stats.current_streak + 1
           ELSE 1
         END),
         last_quiz_date = CURRENT_DATE,
         updated_at = NOW()`,
      [userId, session.correct_count, session.total_questions, session.score, xpEarned]
    );

    const { rows: statRows } = await pool.query(
      'SELECT current_streak FROM user_stats WHERE user_id = $1',
      [userId]
    );
    await maybeNotifyStreak(pool, userId, statRows[0]?.current_streak || 0);
    await maybeNotifyLeaderboard(pool, userId);

    // If this was a daily quiz session type, record daily completion
    if (session.session_type === 'daily') {
      await pool.query(
        `INSERT INTO daily_completions (user_id, quiz_date, session_id, score, correct_count)
         VALUES ($1, CURRENT_DATE, $2, $3, $4)
         ON CONFLICT (user_id, quiz_date) DO NOTHING`,
        [userId, session_id, session.score, session.correct_count]
      );
    }

    res.json({
      session,
      xp_earned: xpEarned,
      percentage: Math.round((session.correct_count / session.total_questions) * 100),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/quiz/daily — get or create today's daily quiz
router.get('/daily', optionalAuth, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const userId = req.user?.userId;

    const daily = await getOrCreateDailyQuiz(pool);

    let completed = null;
    if (userId) {
      const { rows: cRows } = await pool.query(
        'SELECT * FROM daily_completions WHERE user_id = $1 AND quiz_date = CURRENT_DATE',
        [userId]
      );
      if (cRows.length) completed = cRows[0];
    }

    const ordered = await loadOrderedQuestions(pool, daily.question_ids);

    res.json({
      questions: ordered,
      already_completed: !!completed,
      completion: completed,
      quiz_date: daily.quiz_date,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/daily/start', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const userId = req.user.userId;
    const daily = await getOrCreateDailyQuiz(pool);

    const { rows: completionRows } = await pool.query(
      'SELECT * FROM daily_completions WHERE user_id = $1 AND quiz_date = CURRENT_DATE',
      [userId]
    );
    if (completionRows.length) {
      return res.status(409).json({ error: 'Daily quiz already completed', completion: completionRows[0] });
    }

    const { rows: existingRows } = await pool.query(
      `SELECT *
       FROM quiz_sessions
       WHERE user_id = $1
         AND session_type = 'daily'
         AND completed = false
         AND started_at::date = CURRENT_DATE
       ORDER BY started_at DESC
       LIMIT 1`,
      [userId]
    );

    let session = existingRows[0];
    let normalizedSessionIds = normalizeQuestionIds(session?.question_ids);
    let questions = session ? await loadOrderedQuestions(pool, normalizedSessionIds) : [];

    const badExistingSession =
      session &&
      (
        !session.id ||
        normalizedSessionIds.length !== daily.question_ids.length ||
        questions.length !== daily.question_ids.length
      );

    if (badExistingSession) {
      await pool.query('DELETE FROM quiz_sessions WHERE id = $1', [session.id]);
      session = null;
      normalizedSessionIds = [];
      questions = [];
    }

    if (!session) {
      const { rows } = await pool.query(
        `INSERT INTO quiz_sessions (user_id, category_id, session_type, question_ids, total_questions)
         VALUES ($1, NULL, 'daily', $2, $3)
         RETURNING *`,
        [userId, JSON.stringify(daily.question_ids), daily.question_ids.length]
      );
      session = rows[0];
      normalizedSessionIds = normalizeQuestionIds(session.question_ids);
      questions = await loadOrderedQuestions(pool, normalizedSessionIds);
    }

    if (questions.length !== daily.question_ids.length) {
      return res.status(500).json({ error: 'Daily quiz session is invalid' });
    }

    res.json({
      session_id: session.id,
      questions,
      already_completed: false,
      quiz_date: daily.quiz_date,
    });
  } catch (err) {
    console.error(err);
    res.status(err.message === 'Not enough questions for daily quiz' ? 400 : 500).json({ error: err.message === 'Not enough questions for daily quiz' ? err.message : 'Server error' });
  }
});

// GET /api/quiz/session/:id — get session results
router.get('/session/:id', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const userId = req.user.userId;

    const { rows } = await pool.query(
      'SELECT * FROM quiz_sessions WHERE id = $1 AND user_id = $2',
      [req.params.id, userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });

    // Enrich answers with question text + correct answer
    const session = rows[0];
    if (session.answers?.length && session.question_ids?.length) {
      const { rows: qData } = await pool.query(
        `SELECT id, question, options, correct_index FROM questions WHERE id = ANY($1::uuid[])`,
        [session.question_ids]
      );
      const qMap = Object.fromEntries(qData.map(q => [q.id, q]));
      session.answers_enriched = session.answers.map(a => ({
        ...a,
        question: qMap[a.question_id]?.question,
        options: qMap[a.question_id]?.options,
        correct_index: qMap[a.question_id]?.correct_index,
      }));
    }

    res.json({ session });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
