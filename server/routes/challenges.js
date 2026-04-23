const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { authMiddleware } = require('../middleware/auth');
const { createNotification } = require('../lib/notifications');

async function loadOrderedQuestions(pool, questionIds) {
  const { rows: questions } = await pool.query(
    `SELECT id, question, options FROM questions WHERE id = ANY($1::uuid[])`,
    [questionIds]
  );
  return questionIds.map(id => questions.find(q => q.id === id));
}

async function createChallengeSession(pool, userId, categoryId, mode) {
  const { rows: qRows } = await pool.query(
    `SELECT id FROM questions WHERE category_id = $1 AND active = true ORDER BY RANDOM() LIMIT 10`,
    [categoryId]
  );
  if (qRows.length < 10) {
    throw new Error('Not enough questions');
  }

  const questionIds = qRows.map(r => r.id);
  const { rows: sRows } = await pool.query(
    `INSERT INTO quiz_sessions (user_id, category_id, session_type, question_ids, total_questions)
     VALUES ($1, $2, $3, $4, 10) RETURNING id`,
    [userId, categoryId, mode, JSON.stringify(questionIds)]
  );

  return { sessionId: sRows[0].id, questionIds };
}

// POST /api/challenges/create — create a challenge
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { category_id, mode = 'challenge', challenged_user_id = null } = req.body;
    const userId = req.user.userId;

    if (!category_id) return res.status(400).json({ error: 'category_id required' });
    if (challenged_user_id && challenged_user_id === userId) return res.status(400).json({ error: 'Cannot challenge yourself' });

    const shareCode = crypto.randomBytes(5).toString('hex').toUpperCase();

    if (challenged_user_id) {
      const { rows } = await pool.query('SELECT id FROM users WHERE id = $1', [challenged_user_id]);
      if (!rows.length) return res.status(404).json({ error: 'Target user not found' });
    }

    const { sessionId, questionIds } = await createChallengeSession(pool, userId, category_id, mode);

    const { rows: cRows } = await pool.query(
      `INSERT INTO challenges (challenger_id, challenged_id, category_id, mode, challenger_session_id, share_code, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'active') RETURNING *`,
      [userId, challenged_user_id, category_id, mode, sessionId, shareCode]
    );

    const ordered = await loadOrderedQuestions(pool, questionIds);

    if (challenged_user_id) {
      const { rows: challengerRows } = await pool.query(
        'SELECT first_name, last_name FROM users WHERE id = $1',
        [userId]
      );
      const { rows: categoryRows } = await pool.query(
        'SELECT name FROM categories WHERE id = $1',
        [category_id]
      );
      const challengerName = `${challengerRows[0]?.first_name || ''} ${challengerRows[0]?.last_name || ''}`.trim();
      await createNotification(pool, {
        userId: challenged_user_id,
        type: 'challenge_received',
        title: `${challengerName || 'Novi igrač'} te izaziva`,
        body: `${categoryRows[0]?.name || category_id} · ${mode === 'hunter' ? 'Hunter Mode' : 'Izazov'} · kod ${shareCode}`,
        data: { challenge_id: cRows[0].id, share_code: shareCode, category_id, mode, challenger_id: userId },
      });
    }

    res.json({
      challenge_id: cRows[0].id,
      share_code: shareCode,
      session_id: sessionId,
      challenged_user_id,
      questions: ordered,
    });
  } catch (err) {
    if (err.message === 'Not enough questions') {
      return res.status(400).json({ error: 'Not enough questions' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

async function acceptChallenge(req, res, challengeLookup) {
  try {
    const pool = req.app.get('pool');
    const userId = req.user.userId;

    const { rows } = await challengeLookup(pool, userId);
    if (!rows.length) return res.status(404).json({ error: 'Challenge not found or already completed' });

    const challenge = rows[0];
    if (challenge.challenger_id === userId) {
      return res.status(400).json({ error: 'Cannot accept your own challenge' });
    }

    if (challenge.challenged_id && challenge.challenged_id !== userId) {
      return res.status(403).json({ error: 'This challenge is assigned to another user' });
    }

    const { rows: qRows } = await pool.query(
      `SELECT id FROM questions WHERE category_id = $1 AND active = true
       AND id != ALL($2::uuid[])
       ORDER BY RANDOM() LIMIT 10`,
      [challenge.category_id, challenge.challenger_question_ids || []]
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
      `UPDATE challenges SET challenged_id = $1, challenged_session_id = $2, accepted_at = COALESCE(accepted_at, NOW()) WHERE id = $3`,
      [userId, sRows[0].id, challenge.id]
    );

    const ordered = await loadOrderedQuestions(pool, questionIds);

    await createNotification(pool, {
      userId: challenge.challenger_id,
      type: 'challenge_accepted',
      title: 'Izazov je prihvaćen',
      body: `${challenge.challenged_name || 'Protivnik'} je prihvatio tvoj izazov`,
      data: { challenge_id: challenge.id, challenged_id: userId, category_id: challenge.category_id },
    });

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
}

// POST /api/challenges/:code/accept — accept by share code
router.post('/:code/accept', authMiddleware, async (req, res) => {
  return acceptChallenge(req, res, (pool) => pool.query(
    `SELECT c.*, s.question_ids AS challenger_question_ids, challenger.first_name AS challenger_name, challenger.last_name AS challenger_last_name,
            acceptor.first_name AS challenged_name
     FROM challenges c
     LEFT JOIN quiz_sessions s ON s.id = c.challenger_session_id
     LEFT JOIN users challenger ON challenger.id = c.challenger_id
     LEFT JOIN users acceptor ON acceptor.id = c.challenged_id
     WHERE c.share_code = $1 AND c.status = 'active'`,
    [req.params.code.toUpperCase()]
  ));
});

router.post('/by-id/:id/accept', authMiddleware, async (req, res) => {
  return acceptChallenge(req, res, (pool, userId) => pool.query(
    `SELECT c.*, s.question_ids AS challenger_question_ids, challenger.first_name AS challenger_name, challenger.last_name AS challenger_last_name,
            receiver.first_name AS challenged_name
     FROM challenges c
     LEFT JOIN quiz_sessions s ON s.id = c.challenger_session_id
     LEFT JOIN users challenger ON challenger.id = c.challenger_id
     LEFT JOIN users receiver ON receiver.id = c.challenged_id
     WHERE c.id = $1
       AND c.status = 'active'
       AND (c.challenged_id IS NULL OR c.challenged_id = $2)`,
    [req.params.id, userId]
  ));
});

router.get('/incoming', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { rows } = await pool.query(
      `SELECT c.*, challenger.first_name AS challenger_first_name, challenger.last_name AS challenger_last_name,
              cat.name AS category_name
       FROM challenges c
       JOIN users challenger ON challenger.id = c.challenger_id
       JOIN categories cat ON cat.id = c.category_id
       WHERE c.status = 'active'
         AND c.challenged_id = $1
         AND c.challenged_session_id IS NULL
       ORDER BY c.created_at DESC`,
      [req.userId]
    );
    res.json({ challenges: rows });
  } catch (err) {
    console.error('Incoming challenges error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/history', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const userId = req.userId;
    const { rows } = await pool.query(
      `SELECT c.id, c.mode, c.category_id, c.completed_at, c.created_at, c.winner_id, c.challenger_id, c.challenged_id,
              cat.name AS category_name,
              challenger.first_name AS challenger_first_name, challenger.last_name AS challenger_last_name,
              challenged.first_name AS challenged_first_name, challenged.last_name AS challenged_last_name,
              s1.score AS challenger_score, s1.correct_count AS challenger_correct,
              s2.score AS challenged_score, s2.correct_count AS challenged_correct
       FROM challenges c
       JOIN categories cat ON cat.id = c.category_id
       LEFT JOIN users challenger ON challenger.id = c.challenger_id
       LEFT JOIN users challenged ON challenged.id = c.challenged_id
       LEFT JOIN quiz_sessions s1 ON s1.id = c.challenger_session_id
       LEFT JOIN quiz_sessions s2 ON s2.id = c.challenged_session_id
       WHERE (c.challenger_id = $1 OR c.challenged_id = $1)
         AND c.status = 'completed'
       ORDER BY c.completed_at DESC NULLS LAST, c.created_at DESC`,
      [userId]
    );

    res.json({
      history: rows.map(row => {
        const isChallenger = String(row.challenger_id) === String(userId);
        const opponentName = isChallenger
          ? `${row.challenged_first_name || ''} ${row.challenged_last_name || ''}`.trim()
          : `${row.challenger_first_name || ''} ${row.challenger_last_name || ''}`.trim();
        return {
          ...row,
          result: row.winner_id ? (String(row.winner_id) === String(userId) ? 'win' : 'loss') : 'draw',
          opponent_name: opponentName || 'Nepoznati protivnik',
          my_score: isChallenger ? row.challenger_score : row.challenged_score,
          opponent_score: isChallenger ? row.challenged_score : row.challenger_score,
          my_correct: isChallenger ? row.challenger_correct : row.challenged_correct,
          opponent_correct: isChallenger ? row.challenged_correct : row.challenger_correct,
          xp_earned: Math.floor(((isChallenger ? row.challenger_score : row.challenged_score) || 0) / 10) + (((isChallenger ? row.challenger_correct : row.challenged_correct) || 0) * 5),
        };
      }),
    });
  } catch (err) {
    console.error('Challenge history error:', err);
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

// POST /api/challenges/:id/complete — finalize challenge after both done
router.post('/:id/complete', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.get('pool');

    const { rows } = await pool.query(
      `SELECT c.*,
              c.challenger_id, c.challenged_id,
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

    if (c.challenger_id) {
      await pool.query(
        `INSERT INTO user_stats (user_id, challenge_wins, challenge_losses)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE SET
           challenge_wins = user_stats.challenge_wins + $2,
           challenge_losses = user_stats.challenge_losses + $3,
           updated_at = NOW()`,
        [c.challenger_id, winnerId === c.challenger_id ? 1 : 0, winnerId && winnerId !== c.challenger_id ? 1 : 0]
      );
    }
    if (c.challenged_id) {
      await pool.query(
        `INSERT INTO user_stats (user_id, challenge_wins, challenge_losses)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE SET
           challenge_wins = user_stats.challenge_wins + $2,
           challenge_losses = user_stats.challenge_losses + $3,
           updated_at = NOW()`,
        [c.challenged_id, winnerId === c.challenged_id ? 1 : 0, winnerId && winnerId !== c.challenged_id ? 1 : 0]
      );
    }

    const { rows: nameRows } = await pool.query(
      `SELECT
         challenger.first_name AS challenger_first_name, challenger.last_name AS challenger_last_name,
         challenged.first_name AS challenged_first_name, challenged.last_name AS challenged_last_name
       FROM challenges c
       LEFT JOIN users challenger ON challenger.id = c.challenger_id
       LEFT JOIN users challenged ON challenged.id = c.challenged_id
       WHERE c.id = $1`,
      [c.id]
    );
    const names = nameRows[0] || {};
    const challengerName = `${names.challenger_first_name || ''} ${names.challenger_last_name || ''}`.trim();
    const challengedName = `${names.challenged_first_name || ''} ${names.challenged_last_name || ''}`.trim();

    if (c.challenger_id) {
      await createNotification(pool, {
        userId: c.challenger_id,
        type: 'challenge_result',
        title: winnerId === c.challenger_id ? `Pobijedio si ${challengedName || 'protivnika'}!` : winnerId === null ? 'Izazov je završio neriješeno' : `${challengedName || 'Protivnik'} te pobijedio`,
        body: `${c.category_id} · ${c.challenger_correct}/10 protiv ${c.challenged_correct}/10`,
        data: { challenge_id: c.id, result: winnerId === c.challenger_id ? 'win' : winnerId === null ? 'draw' : 'loss' },
      });
    }
    if (c.challenged_id) {
      await createNotification(pool, {
        userId: c.challenged_id,
        type: 'challenge_result',
        title: winnerId === c.challenged_id ? `Pobijedio si ${challengerName || 'protivnika'}!` : winnerId === null ? 'Izazov je završio neriješeno' : `${challengerName || 'Protivnik'} te pobijedio`,
        body: `${c.category_id} · ${c.challenged_correct}/10 protiv ${c.challenger_correct}/10`,
        data: { challenge_id: c.id, result: winnerId === c.challenged_id ? 'win' : winnerId === null ? 'draw' : 'loss' },
      });
    }

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
