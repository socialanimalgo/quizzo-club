const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { authMiddleware } = require('../middleware/auth');

// POST /api/challenges/create — create a challenge
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { category_id, mode = 'challenge' } = req.body;
    const userId = req.user.userId;

    if (!category_id) return res.status(400).json({ error: 'category_id required' });

    const shareCode = crypto.randomBytes(5).toString('hex').toUpperCase();

    // Pick 10 questions for challenger
    const { rows: qRows } = await pool.query(
      `SELECT id FROM questions WHERE category_id = $1 AND active = true ORDER BY RANDOM() LIMIT 10`,
      [category_id]
    );
    if (qRows.length < 10) {
      return res.status(400).json({ error: 'Not enough questions' });
    }
    const questionIds = qRows.map(r => r.id);

    // Create challenger's session
    const { rows: sRows } = await pool.query(
      `INSERT INTO quiz_sessions (user_id, category_id, session_type, question_ids, total_questions)
       VALUES ($1, $2, $3, $4, 10) RETURNING id`,
      [userId, category_id, mode, JSON.stringify(questionIds)]
    );

    // Create challenge
    const { rows: cRows } = await pool.query(
      `INSERT INTO challenges (challenger_id, category_id, mode, challenger_session_id, share_code, status)
       VALUES ($1, $2, $3, $4, $5, 'active') RETURNING *`,
      [userId, category_id, mode, sRows[0].id, shareCode]
    );

    // Load questions (no correct_index)
    const { rows: questions } = await pool.query(
      `SELECT id, question, options FROM questions WHERE id = ANY($1::uuid[])`,
      [questionIds]
    );
    const ordered = questionIds.map(id => questions.find(q => q.id === id));

    res.json({
      challenge_id: cRows[0].id,
      share_code: shareCode,
      session_id: sRows[0].id,
      questions: ordered,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/challenges/:code — look up challenge by share code
router.get('/:code', async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { rows } = await pool.query(
      `SELECT c.*,
              u.first_name AS challenger_name, u.last_name AS challenger_lastname,
              u.avatar_url AS challenger_avatar,
              cat.name AS category_name, cat.emoji AS category_emoji
       FROM challenges c
       JOIN users u ON u.id = c.challenger_id
       JOIN categories cat ON cat.id = c.category_id
       WHERE c.share_code = $1`,
      [req.params.code.toUpperCase()]
    );
    if (!rows.length) return res.status(404).json({ error: 'Challenge not found' });
    res.json({ challenge: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/challenges/:code/accept — accept a challenge
router.post('/:code/accept', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const userId = req.user.userId;

    const { rows } = await pool.query(
      `SELECT * FROM challenges WHERE share_code = $1 AND status = 'active'`,
      [req.params.code.toUpperCase()]
    );
    if (!rows.length) return res.status(404).json({ error: 'Challenge not found or already completed' });

    const challenge = rows[0];
    if (challenge.challenger_id === userId) {
      return res.status(400).json({ error: 'Cannot accept your own challenge' });
    }

    // In Hunter Mode, pick DIFFERENT questions from same category
    const { rows: qRows } = await pool.query(
      `SELECT id FROM questions WHERE category_id = $1 AND active = true
       AND id != ALL($2::uuid[])
       ORDER BY RANDOM() LIMIT 10`,
      [challenge.category_id, challenge.question_ids || []]
    );

    let questionIds;
    if (qRows.length < 10) {
      // Fall back to any 10 if not enough different ones
      const { rows: fallback } = await pool.query(
        `SELECT id FROM questions WHERE category_id = $1 AND active = true ORDER BY RANDOM() LIMIT 10`,
        [challenge.category_id]
      );
      questionIds = fallback.map(r => r.id);
    } else {
      questionIds = qRows.map(r => r.id);
    }

    // Create challenged session
    const { rows: sRows } = await pool.query(
      `INSERT INTO quiz_sessions (user_id, category_id, session_type, question_ids, total_questions)
       VALUES ($1, $2, $3, $4, 10) RETURNING id`,
      [userId, challenge.category_id, challenge.mode, JSON.stringify(questionIds)]
    );

    await pool.query(
      `UPDATE challenges SET challenged_id = $1, challenged_session_id = $2 WHERE id = $3`,
      [userId, sRows[0].id, challenge.id]
    );

    const { rows: questions } = await pool.query(
      `SELECT id, question, options FROM questions WHERE id = ANY($1::uuid[])`,
      [questionIds]
    );
    const ordered = questionIds.map(id => questions.find(q => q.id === id));

    res.json({
      challenge_id: challenge.id,
      session_id: sRows[0].id,
      category_id: challenge.category_id,
      mode: challenge.mode,
      questions: ordered,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/challenges/:id/complete — finalize challenge after both done
router.post('/:id/complete', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.get('pool');

    const { rows } = await pool.query(
      `SELECT c.*,
              s1.score AS challenger_score, s1.correct_count AS challenger_correct, s1.completed AS challenger_done,
              s2.score AS challenged_score, s2.correct_count AS challenged_correct, s2.completed AS challenged_done
       FROM challenges c
       LEFT JOIN quiz_sessions s1 ON s1.id = c.challenger_session_id
       LEFT JOIN quiz_sessions s2 ON s2.id = c.challenged_session_id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Challenge not found' });

    const c = rows[0];
    if (!c.challenger_done || !c.challenged_done) {
      return res.json({ status: 'waiting', challenge: c });
    }
    if (c.status === 'completed') {
      return res.json({ status: 'completed', challenge: c });
    }

    // Determine winner by correct count, tiebreak by score
    let winnerId = null;
    if (c.challenger_correct > c.challenged_correct) {
      winnerId = c.challenger_id;
    } else if (c.challenged_correct > c.challenger_correct) {
      winnerId = c.challenged_id;
    } else if (c.challenger_score > c.challenged_score) {
      winnerId = c.challenger_id;
    } else if (c.challenged_score > c.challenger_score) {
      winnerId = c.challenged_id;
    }

    await pool.query(
      `UPDATE challenges SET status = 'completed', winner_id = $1, completed_at = NOW() WHERE id = $2`,
      [winnerId, c.id]
    );

    res.json({
      status: 'completed',
      winner_id: winnerId,
      challenger_score: c.challenger_score,
      challenged_score: c.challenged_score,
      challenger_correct: c.challenger_correct,
      challenged_correct: c.challenged_correct,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
