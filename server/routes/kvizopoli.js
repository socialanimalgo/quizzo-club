const express = require('express');
const router = express.Router();
const { authMiddleware, getUserFromAccessToken } = require('../middleware/auth');
const { createNotification } = require('../lib/notifications');
const { publishKvizopoli, subscribeKvizopoli } = require('../lib/realtime');

const PLAYER_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];
const BOARD_TOPICS = [
  'geography',
  'film_music',
  'sports',
  'history',
  'science',
  'pop_culture',
];
const MATCH_DURATION_MS = 10 * 60 * 1000;
const QUESTION_TIME_LIMIT_MS = 20 * 1000;
const matchEndTimers = new Map();
const questionTimers = new Map();

function activeMembershipWhereClause() {
  return `status IN ('lobby', 'active')
          AND (ends_at IS NULL OR ends_at > NOW())`;
}

function randomJoinCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'QZ-';
  for (let index = 0; index < 4; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function normalizeJsonArray(value) {
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

function buildBoardSpaces() {
  return Array.from({ length: 24 }, (_, index) => ({
    id: index,
    topicId: BOARD_TOPICS[index % BOARD_TOPICS.length],
    ownerId: null,
    ownerSince: null,
  }));
}

function buildPlayer(user, seatIndex) {
  return {
    id: user.id,
    name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
    avatar: user.avatar_url || null,
    color: PLAYER_COLORS[seatIndex],
    position: seatIndex * 6,
    connected: true,
    correctAnswers: 0,
    takeoverCount: 0,
    averageAnswerMs: 0,
    answerCount: 0,
    seatIndex,
    joinedAt: new Date().toISOString(),
  };
}

function serializeMatch(match) {
  const currentQuestion = match.current_question
    ? {
        id: match.current_question.id,
        spaceId: match.current_question.spaceId,
        topicId: match.current_question.topicId,
        prompt: match.current_question.prompt,
        answers: match.current_question.answers,
        expiresAt: match.current_question.expiresAt,
      }
    : null;

  return {
    id: match.id,
    joinCode: match.join_code,
    hostUserId: match.host_user_id,
    status: match.status,
    phase: match.phase,
    players: match.players,
    boardSpaces: match.board_spaces,
    activePlayerId: match.active_player_id,
    startedAt: match.started_at,
    durationMs: match.duration_ms,
    endsAt: match.ends_at,
    winnerId: match.winner_id || null,
    currentDiceValue: match.current_dice_value,
    currentQuestion,
  };
}

function findPlayer(match, userId) {
  return match.players.find(player => player && player.id === userId) || null;
}

function propertyCount(boardSpaces, playerId) {
  return boardSpaces.filter(space => space.ownerId === playerId).length;
}

function findPropertyToTransfer(activePlayerId, boardSpaces) {
  const owned = boardSpaces
    .filter(space => space.ownerId === activePlayerId)
    .sort((left, right) => {
      if (left.ownerSince && right.ownerSince) return new Date(left.ownerSince) - new Date(right.ownerSince);
      return left.id - right.id;
    });
  return owned[0] || null;
}

function getNextActivePlayerId(players, currentPlayerId) {
  const activePlayers = players.filter(Boolean).sort((left, right) => left.seatIndex - right.seatIndex);
  const currentIndex = activePlayers.findIndex(player => player.id === currentPlayerId);
  if (currentIndex < 0) return activePlayers[0]?.id || null;
  return activePlayers[(currentIndex + 1) % activePlayers.length]?.id || currentPlayerId;
}

function finalizeMatch(match) {
  const players = [...match.players].filter(Boolean);
  players.sort((left, right) => {
    const propertyDelta = propertyCount(match.board_spaces, right.id) - propertyCount(match.board_spaces, left.id);
    if (propertyDelta !== 0) return propertyDelta;
    const correctDelta = right.correctAnswers - left.correctAnswers;
    if (correctDelta !== 0) return correctDelta;
    const takeoverDelta = right.takeoverCount - left.takeoverCount;
    if (takeoverDelta !== 0) return takeoverDelta;
    return left.averageAnswerMs - right.averageAnswerMs;
  });

  return {
    ...match,
    status: 'complete',
    phase: 'match_complete',
    active_player_id: null,
    current_question: null,
    winner_id: players[0]?.id || null,
  };
}

function isLobby(match) {
  return match.status === 'lobby' || match.phase === 'waiting_for_players';
}

function isDisposableSoloLobby(match, userId) {
  if (!match || !isLobby(match)) return false;
  if ((match.players || []).length !== 1) return false;
  if (match.host_user_id !== userId) return false;
  return match.players[0]?.id === userId;
}

function clearTimers(matchId) {
  const matchTimer = matchEndTimers.get(matchId);
  if (matchTimer) {
    clearTimeout(matchTimer);
    matchEndTimers.delete(matchId);
  }
  const questionTimer = questionTimers.get(matchId);
  if (questionTimer) {
    clearTimeout(questionTimer);
    questionTimers.delete(matchId);
  }
}

async function pickQuestion(pool, topicId, askedQuestionIds) {
  const exclude = normalizeJsonArray(askedQuestionIds);
  let rows;

  if (exclude.length) {
    ({ rows } = await pool.query(
      `SELECT id, question, options, correct_index
       FROM questions
       WHERE category_id = $1
         AND active = true
         AND NOT (id = ANY($2::uuid[]))
       ORDER BY RANDOM()
       LIMIT 1`,
      [topicId, exclude]
    ));
  } else {
    rows = [];
  }

  if (!rows || !rows.length) {
    ({ rows } = await pool.query(
      `SELECT id, question, options, correct_index
       FROM questions
       WHERE category_id = $1
         AND active = true
       ORDER BY RANDOM()
       LIMIT 1`,
      [topicId]
    ));
  }

  return rows[0] || null;
}

async function loadMatch(pool, matchId) {
  const { rows } = await pool.query('SELECT * FROM kvizopoli_matches WHERE id = $1', [matchId]);
  if (!rows.length) return null;
  const row = rows[0];
  return {
    ...row,
    players: normalizeJsonArray(row.players),
    board_spaces: normalizeJsonArray(row.board_spaces),
    asked_question_ids: normalizeJsonArray(row.asked_question_ids),
    eliminated_player_ids: normalizeJsonArray(row.eliminated_player_ids),
    current_question: row.current_question || null,
  };
}

async function saveMatch(pool, match) {
  const { rows } = await pool.query(
    `UPDATE kvizopoli_matches
     SET status = $2,
         phase = $3,
         players = $4,
         board_spaces = $5,
         active_player_id = $6,
         current_dice_value = $7,
         current_question = $8,
         asked_question_ids = $9,
         eliminated_player_ids = $10,
         host_user_id = $11,
         started_at = $12,
         ends_at = $13,
         winner_id = $14,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      match.id,
      match.status,
      match.phase,
      JSON.stringify(match.players),
      JSON.stringify(match.board_spaces),
      match.active_player_id,
      match.current_dice_value,
      match.current_question ? JSON.stringify(match.current_question) : null,
      JSON.stringify(match.asked_question_ids || []),
      JSON.stringify(match.eliminated_player_ids || []),
      match.host_user_id,
      match.started_at,
      match.ends_at,
      match.winner_id || null,
    ]
  );
  const next = await loadMatch(pool, rows[0].id);
  publishKvizopoli(next.id, serializeMatch(next));
  return next;
}

async function normalizeLegacyLobbyMatch(pool, match) {
  if (!match) return match;
  if (match.status === 'active' && !isLobby(match) && !match.ends_at) {
    const startedAt = match.started_at ? new Date(match.started_at) : new Date();
    match.started_at = startedAt.toISOString();
    match.ends_at = new Date(startedAt.getTime() + (match.duration_ms || MATCH_DURATION_MS)).toISOString();
    return saveMatch(pool, match);
  }
  if (match.status !== 'active') return match;
  if ((match.players || []).length >= 2) return match;
  if ((match.asked_question_ids || []).length > 0) return match;
  if (match.current_question) return match;

  match.status = 'lobby';
  match.phase = 'waiting_for_players';
  match.active_player_id = null;
  match.current_dice_value = null;
  match.started_at = null;
  match.ends_at = null;
  return saveMatch(pool, match);
}

async function disposeMatch(pool, matchId) {
  clearTimers(matchId);
  await pool.query('DELETE FROM kvizopoli_matches WHERE id = $1', [matchId]);
}

function stripPlayerOwnership(match, playerId) {
  match.board_spaces = match.board_spaces.map(space => (
    space.ownerId === playerId
      ? { ...space, ownerId: null, ownerSince: null }
      : space
  ));
}

function removePlayerAndResolve(match, userId) {
  const leavingPlayer = findPlayer(match, userId);
  if (!leavingPlayer) return match;

  match.players = match.players.filter(player => player.id !== userId);
  match.eliminated_player_ids = Array.from(new Set([...(match.eliminated_player_ids || []), userId]));
  stripPlayerOwnership(match, userId);

  if (match.host_user_id === userId) {
    match.host_user_id = match.players.sort((left, right) => left.seatIndex - right.seatIndex)[0]?.id || null;
  }

  if (!match.players.length) return null;

  if (match.players.length === 1 && !isLobby(match)) {
    const winner = match.players[0];
    match.status = 'complete';
    match.phase = 'match_complete';
    match.active_player_id = null;
    match.current_question = null;
    match.current_dice_value = null;
    match.winner_id = winner.id;
    if (!match.ends_at) match.ends_at = new Date().toISOString();
    return match;
  }

  if (isLobby(match)) {
    match.phase = 'waiting_for_players';
    match.active_player_id = null;
    match.current_question = null;
    match.current_dice_value = null;
    return match;
  }

  if (match.active_player_id === userId) {
    match.current_question = null;
    match.current_dice_value = null;
    match.active_player_id = getNextActivePlayerId(match.players, userId);
    match.phase = 'waiting_to_roll';
  }

  return match;
}

async function finalizeIfExpired(pool, match) {
  if (match.status === 'complete') return match;
  if (!match.ends_at || isLobby(match)) return match;
  if (new Date(match.ends_at).getTime() > Date.now()) return match;
  const finalized = finalizeMatch(match);
  return saveMatch(pool, finalized);
}

function resolveCurrentQuestionState(match, answerId = null) {
  if (!match.current_question) return match;

  const isExpired = new Date(match.current_question.expiresAt).getTime() <= Date.now();
  const isCorrect = !isExpired && answerId === match.current_question.correctAnswerId;
  const elapsedMs = Math.max(0, Date.now() - new Date(match.current_question.askedAt).getTime());

  const landedSpace = match.board_spaces.find(space => space.id === match.current_question.spaceId);
  const priorOwnerId = landedSpace?.ownerId || null;

  if (landedSpace) {
    if (isCorrect) {
      landedSpace.ownerId = match.active_player_id;
      landedSpace.ownerSince = new Date().toISOString();
    } else if (priorOwnerId && priorOwnerId !== match.active_player_id) {
      const transferable = findPropertyToTransfer(match.active_player_id, match.board_spaces);
      if (transferable) {
        transferable.ownerId = priorOwnerId;
        transferable.ownerSince = new Date().toISOString();
      }
    }
  }

  match.players = match.players.map(player => {
    if (!player || player.id !== match.active_player_id) return player;
    const nextAnswerCount = (player.answerCount || 0) + 1;
    const totalMs = Math.round((player.averageAnswerMs || 0) * (player.answerCount || 0) + elapsedMs);
    return {
      ...player,
      correctAnswers: player.correctAnswers + (isCorrect ? 1 : 0),
      takeoverCount: player.takeoverCount + (isCorrect && priorOwnerId && priorOwnerId !== match.active_player_id ? 1 : 0),
      answerCount: nextAnswerCount,
      averageAnswerMs: Math.round(totalMs / nextAnswerCount),
    };
  });

  match.current_question = null;
  match.current_dice_value = null;
  match.active_player_id = getNextActivePlayerId(match.players, match.active_player_id);
  match.phase = new Date(match.ends_at).getTime() <= Date.now() ? 'match_complete' : 'waiting_to_roll';
  if (match.phase === 'match_complete') {
    match.status = 'complete';
    match.active_player_id = null;
  }

  return { match, correct: isCorrect };
}

function scheduleMatchTimers(pool, matchId) {
  clearTimers(matchId);

  loadMatch(pool, matchId).then(async currentMatch => {
    if (!currentMatch) return;
    if (currentMatch.status === 'complete') return;
    if (isLobby(currentMatch) || !currentMatch.ends_at) return;

    const matchDelay = Math.max(0, new Date(currentMatch.ends_at).getTime() - Date.now());
    const matchTimer = setTimeout(async () => {
      const latest = await loadMatch(pool, matchId);
      if (!latest || latest.status === 'complete') return;
      const finalized = finalizeMatch(latest);
      await saveMatch(pool, finalized);
      clearTimers(matchId);
    }, matchDelay + 20);
    matchEndTimers.set(matchId, matchTimer);

    if (currentMatch.current_question?.expiresAt) {
      const questionDelay = Math.max(0, new Date(currentMatch.current_question.expiresAt).getTime() - Date.now());
      const questionTimer = setTimeout(async () => {
        const latest = await loadMatch(pool, matchId);
        if (!latest || latest.status === 'complete' || !latest.current_question) return;
        const resolved = resolveCurrentQuestionState(latest, null);
        await saveMatch(pool, resolved.match);
        scheduleMatchTimers(pool, matchId);
      }, questionDelay + 20);
      questionTimers.set(matchId, questionTimer);
    }
  }).catch(() => {});
}

router.get('/matches/:id/stream', async (req, res) => {
  try {
    const token = String(req.query.access_token || '');
    if (!token) return res.status(401).json({ error: 'Missing access token' });
    const user = await getUserFromAccessToken(req, token);
    if (!user) return res.status(401).json({ error: 'Invalid or expired token' });

    let match = await loadMatch(req.app.get('pool'), req.params.id);
    if (!match) return res.status(404).json({ error: 'Match not found' });
    match = await normalizeLegacyLobbyMatch(req.app.get('pool'), match);
    if (!findPlayer(match, user.id)) return res.status(403).json({ error: 'Forbidden' });
    match = await finalizeIfExpired(req.app.get('pool'), match);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    res.write(`event: state\n`);
    res.write(`data: ${JSON.stringify(serializeMatch(match))}\n\n`);

    const unsubscribe = subscribeKvizopoli(match.id, payload => {
      res.write(`event: state\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    });
    const heartbeat = setInterval(() => {
      res.write(`event: ping\n`);
      res.write(`data: {}\n\n`);
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
      res.end();
    });
  } catch (err) {
    console.error('Kvizopoli stream error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Server error' });
  }
});

router.use(authMiddleware);

router.post('/create', async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const user = req.user;

    const { rows: existingRows } = await pool.query(
      `SELECT id
       FROM kvizopoli_matches
       WHERE ${activeMembershipWhereClause()}
         AND EXISTS (
           SELECT 1
           FROM jsonb_array_elements(players) AS player
           WHERE player->>'id' = $1
         )
       ORDER BY updated_at DESC
       LIMIT 1`,
      [user.id]
    );

    if (existingRows.length) {
      const existing = await normalizeLegacyLobbyMatch(pool, await loadMatch(pool, existingRows[0].id));
      return res.json({ match: serializeMatch(await finalizeIfExpired(pool, existing)) });
    }

    let joinCode = randomJoinCode();
    while (true) {
      const { rows: dupRows } = await pool.query('SELECT id FROM kvizopoli_matches WHERE join_code = $1', [joinCode]);
      if (!dupRows.length) break;
      joinCode = randomJoinCode();
    }

    const players = [buildPlayer(user, 0)];
    const { rows } = await pool.query(
      `INSERT INTO kvizopoli_matches (
         join_code, host_user_id, status, phase, players, board_spaces, active_player_id, duration_ms, started_at, ends_at
       )
       VALUES ($1, $2, 'lobby', 'waiting_for_players', $3, $4, NULL, $5, NULL, NULL)
       RETURNING id`,
      [joinCode, user.id, JSON.stringify(players), JSON.stringify(buildBoardSpaces()), MATCH_DURATION_MS]
    );

    const match = await loadMatch(pool, rows[0].id);
    res.status(201).json({ match: serializeMatch(match) });
  } catch (err) {
    console.error('Kvizopoli create error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/join', async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const user = req.user;
    const joinCode = String(req.body.join_code || '').trim().toUpperCase();
    if (!joinCode) return res.status(400).json({ error: 'join_code required' });

    const { rows: existingMembershipRows } = await pool.query(
      `SELECT id, join_code
       FROM kvizopoli_matches
       WHERE ${activeMembershipWhereClause()}
         AND EXISTS (
           SELECT 1
           FROM jsonb_array_elements(players) AS player
           WHERE player->>'id' = $1
         )
       ORDER BY updated_at DESC
       LIMIT 1`,
      [user.id]
    );

    let match = await (async () => {
      const { rows } = await pool.query('SELECT id FROM kvizopoli_matches WHERE join_code = $1', [joinCode]);
      if (!rows.length) return null;
      return loadMatch(pool, rows[0].id);
    })();

    if (!match) return res.status(404).json({ error: 'Match not found' });
    match = await normalizeLegacyLobbyMatch(pool, match);
    match = await finalizeIfExpired(pool, match);
    if (match.status === 'complete') return res.status(409).json({ error: 'Match already complete' });

    if (existingMembershipRows.length && existingMembershipRows[0].id !== match.id) {
      const existingMembership = await normalizeLegacyLobbyMatch(pool, await loadMatch(pool, existingMembershipRows[0].id));
      if (isDisposableSoloLobby(existingMembership, user.id)) {
        await disposeMatch(pool, existingMembership.id);
      } else {
        return res.status(409).json({ error: 'Already in another active match', join_code: existingMembershipRows[0].join_code });
      }
    }

    const existing = findPlayer(match, user.id);
    if (existing) return res.json({ match: serializeMatch(match) });
    if ((match.eliminated_player_ids || []).includes(user.id)) {
      return res.status(409).json({ error: 'You already left this match' });
    }
    if (!isLobby(match)) return res.status(409).json({ error: 'Match already started' });
    if (match.players.length >= 4) return res.status(409).json({ error: 'Match is full' });

    const nextSeat = match.players.length;
    match.players.push(buildPlayer(user, nextSeat));
    match = await saveMatch(pool, match);
    res.json({ match: serializeMatch(match) });
  } catch (err) {
    console.error('Kvizopoli join error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/matches/:id/start', async (req, res) => {
  try {
    const pool = req.app.get('pool');
    let match = await loadMatch(pool, req.params.id);
    if (!match) return res.status(404).json({ error: 'Match not found' });
    match = await normalizeLegacyLobbyMatch(pool, match);
    if (!findPlayer(match, req.userId)) return res.status(403).json({ error: 'Forbidden' });
    if (match.host_user_id !== req.userId) return res.status(403).json({ error: 'Only host can start' });
    if (!isLobby(match)) return res.status(409).json({ error: 'Match already started' });
    if (match.players.length < 2) return res.status(409).json({ error: 'Potrebna su najmanje 2 igraca' });

    const startedAt = new Date();
    match.status = 'active';
    match.phase = 'waiting_to_roll';
    match.active_player_id = match.host_user_id;
    match.started_at = startedAt.toISOString();
    match.ends_at = new Date(startedAt.getTime() + match.duration_ms).toISOString();

    match = await saveMatch(pool, match);
    scheduleMatchTimers(pool, match.id);
    res.json({ match: serializeMatch(match) });
  } catch (err) {
    console.error('Kvizopoli start error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/matches/:id', async (req, res) => {
  try {
    const pool = req.app.get('pool');
    let match = await loadMatch(pool, req.params.id);
    if (!match) return res.status(404).json({ error: 'Match not found' });
    match = await normalizeLegacyLobbyMatch(pool, match);
    if (!findPlayer(match, req.userId)) return res.status(403).json({ error: 'Forbidden' });
    match = await finalizeIfExpired(pool, match);
    res.json({ match: serializeMatch(match) });
  } catch (err) {
    console.error('Kvizopoli state error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/matches/:id/roll', async (req, res) => {
  try {
    const pool = req.app.get('pool');
    let match = await loadMatch(pool, req.params.id);
    if (!match) return res.status(404).json({ error: 'Match not found' });
    match = await normalizeLegacyLobbyMatch(pool, match);
    if (!findPlayer(match, req.userId)) return res.status(403).json({ error: 'Forbidden' });
    match = await finalizeIfExpired(pool, match);
    if (isLobby(match)) return res.status(409).json({ error: 'Match has not started' });
    if (match.status === 'complete') return res.status(409).json({ error: 'Match already complete' });
    if (match.phase !== 'waiting_to_roll') return res.status(409).json({ error: 'Cannot roll right now' });
    if (match.active_player_id !== req.userId) return res.status(403).json({ error: 'Not your turn' });

    const dice = Math.floor(Math.random() * 6) + 1;
    match.current_dice_value = dice;
    match.phase = 'answering';

    match.players = match.players.map(player => {
      if (!player || player.id !== req.userId) return player;
      return { ...player, position: (player.position + dice) % 24 };
    });

    const activePlayer = findPlayer(match, req.userId);
    const landedSpace = match.board_spaces.find(space => space.id === activePlayer.position);
    const question = await pickQuestion(pool, landedSpace.topicId, match.asked_question_ids);
    if (!question) return res.status(400).json({ error: 'Not enough questions in this topic' });

    match.current_question = {
      id: question.id,
      spaceId: landedSpace.id,
      topicId: landedSpace.topicId,
      prompt: question.question,
      answers: question.options.map((text, index) => ({ id: `a${index}`, text })),
      correctAnswerId: `a${question.correct_index}`,
      askedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + QUESTION_TIME_LIMIT_MS).toISOString(),
    };
    match.asked_question_ids = [...match.asked_question_ids, question.id];

    match = await saveMatch(pool, match);
    scheduleMatchTimers(pool, match.id);
    res.json({ match: serializeMatch(match) });
  } catch (err) {
    console.error('Kvizopoli roll error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/matches/:id/answer', async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { answer_id } = req.body;
    let match = await loadMatch(pool, req.params.id);
    if (!match) return res.status(404).json({ error: 'Match not found' });
    match = await normalizeLegacyLobbyMatch(pool, match);
    if (!findPlayer(match, req.userId)) return res.status(403).json({ error: 'Forbidden' });
    match = await finalizeIfExpired(pool, match);
    if (isLobby(match)) return res.status(409).json({ error: 'Match has not started' });
    if (match.status === 'complete') return res.status(409).json({ error: 'Match already complete' });
    if (match.phase !== 'answering' || !match.current_question) return res.status(409).json({ error: 'No active question' });
    if (match.active_player_id !== req.userId) return res.status(403).json({ error: 'Not your turn' });

    const resolved = resolveCurrentQuestionState(match, answer_id);
    match = await saveMatch(pool, resolved.match);
    scheduleMatchTimers(pool, match.id);
    res.json({ match: serializeMatch(match), correct: resolved.correct });
  } catch (err) {
    console.error('Kvizopoli answer error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/matches/:id/leave', async (req, res) => {
  try {
    const pool = req.app.get('pool');
    let match = await loadMatch(pool, req.params.id);
    if (!match) return res.status(404).json({ error: 'Match not found' });
    match = await normalizeLegacyLobbyMatch(pool, match);
    if (!findPlayer(match, req.userId)) return res.status(403).json({ error: 'Forbidden' });

    const next = removePlayerAndResolve(match, req.userId);
    if (!next) {
      await disposeMatch(pool, match.id);
      return res.json({ ok: true, deleted: true });
    }

    const saved = await saveMatch(pool, next);
    if (saved.status === 'complete') clearTimers(saved.id);
    else scheduleMatchTimers(pool, saved.id);
    res.json({ ok: true, match: serializeMatch(saved) });
  } catch (err) {
    console.error('Kvizopoli leave error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/matches/:id/invite', async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    let match = await loadMatch(pool, req.params.id);
    if (!match) return res.status(404).json({ error: 'Match not found' });
    match = await normalizeLegacyLobbyMatch(pool, match);
    if (!findPlayer(match, req.userId)) return res.status(403).json({ error: 'Forbidden' });
    match = await finalizeIfExpired(pool, match);
    if (match.status === 'complete') return res.status(409).json({ error: 'Match already complete' });

    const { rows: userRows } = await pool.query(
      'SELECT id, first_name, last_name FROM users WHERE id = $1 AND deleted_at IS NULL',
      [user_id]
    );
    if (!userRows.length) return res.status(404).json({ error: 'User not found' });

    const inviter = findPlayer(match, req.userId);
    await createNotification(pool, {
      userId: user_id,
      type: 'kvizopoli_invite',
      title: 'Poziv u Kvizopoli',
      body: `${inviter.name} te poziva u sobu ${match.join_code}`,
      data: { match_id: match.id, join_code: match.join_code, inviter_id: req.userId },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('Kvizopoli invite error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
