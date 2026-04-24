const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { createNotification } = require('../lib/notifications');
const { BASIC_IDS, getAvatarCatalog, getAvatarOption } = require('../lib/avatar-bank');

function sortPair(a, b) {
  return a < b ? [a, b] : [b, a];
}

router.use(authMiddleware);


async function getOwnedAvatarIds(pool, userId) {
  const { rows } = await pool.query(
    'SELECT avatar_id FROM user_avatar_ownership WHERE user_id = $1 ORDER BY created_at ASC',
    [userId]
  );
  return [...BASIC_IDS, ...rows.map(row => row.avatar_id)];
}

router.get('/avatar-bank', async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const [catalog, ownedAvatarIdsResult, userRows] = await Promise.all([
      Promise.resolve(getAvatarCatalog()),
      getOwnedAvatarIds(pool, req.userId),
      pool.query('SELECT selected_avatar_id, gems FROM users WHERE id = $1', [req.userId]),
    ]);

    if (!userRows.rows.length) return res.status(404).json({ error: 'User not found' });

    res.json({
      catalog,
      selected_avatar_id: userRows.rows[0].selected_avatar_id || null,
      owned_avatar_ids: ownedAvatarIdsResult,
      gems: Number(userRows.rows[0].gems) || 0,
    });
  } catch (err) {
    console.error('Avatar bank error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/avatar-bank/select', async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { avatar_id } = req.body || {};
    const avatar = getAvatarOption(avatar_id);
    if (!avatar || !avatar.active) return res.status(400).json({ error: 'Invalid avatar_id' });

    const ownedAvatarIds = await getOwnedAvatarIds(pool, req.userId);
    if (!ownedAvatarIds.includes(avatar_id)) return res.status(403).json({ error: 'Avatar nije otključan' });

    const { rows } = await pool.query(
      'UPDATE users SET selected_avatar_id = $1, avatar_url = $2 WHERE id = $3 RETURNING id, selected_avatar_id, avatar_url',
      [avatar_id, avatar.image_url, req.userId]
    );

    res.json({ user: rows[0] });
  } catch (err) {
    console.error('Select avatar error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/avatar-bank/purchase', async (req, res) => {
  const pool = req.app.get('pool');
  const client = await pool.connect();
  try {
    const { avatar_id } = req.body || {};
    const avatar = getAvatarOption(avatar_id);
    if (!avatar || avatar.pack !== 'premium') return res.status(400).json({ error: 'Invalid premium avatar' });

    await client.query('BEGIN');
    const { rows: userRows } = await client.query('SELECT gems FROM users WHERE id = $1 FOR UPDATE', [req.userId]);
    if (!userRows.length) throw new Error('User not found');

    const { rows: ownedRows } = await client.query('SELECT 1 FROM user_avatar_ownership WHERE user_id = $1 AND avatar_id = $2', [req.userId, avatar_id]);
    if (ownedRows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Avatar već posjeduješ' });
    }

    const gems = Number(userRows[0].gems) || 0;
    if (gems < Number(avatar.price_gems || 0)) {
      await client.query('ROLLBACK');
      return res.status(422).json({ error: 'Nedovoljno dragulja' });
    }

    await client.query('UPDATE users SET gems = gems - $1 WHERE id = $2', [avatar.price_gems, req.userId]);
    await client.query('INSERT INTO user_avatar_ownership (user_id, avatar_id, source) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [req.userId, avatar_id, 'purchase']);
    const { rows: updatedRows } = await client.query('SELECT gems, selected_avatar_id FROM users WHERE id = $1', [req.userId]);
    await client.query('COMMIT');

    res.json({
      avatar_id,
      gems: Number(updatedRows[0].gems) || 0,
      selected_avatar_id: updatedRows[0].selected_avatar_id || null,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Purchase avatar error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

router.get('/search', async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const userId = req.userId;
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ users: [] });

    const like = `%${q.toLowerCase()}%`;
    const { rows } = await pool.query(
      `SELECT
         u.id, u.first_name, u.last_name, u.email, u.avatar_url,
         (u.last_seen_at >= NOW() - INTERVAL '5 minutes') AS online,
         EXISTS (
           SELECT 1 FROM friendships f
           WHERE (f.user_one_id = u.id AND f.user_two_id = $1)
              OR (f.user_two_id = u.id AND f.user_one_id = $1)
         ) AS is_friend,
         EXISTS (
           SELECT 1 FROM friend_requests fr
           WHERE fr.status = 'pending'
             AND fr.requester_id = $1
             AND fr.receiver_id = u.id
         ) AS request_sent,
         EXISTS (
           SELECT 1 FROM friend_requests fr
           WHERE fr.status = 'pending'
             AND fr.requester_id = u.id
             AND fr.receiver_id = $1
         ) AS request_received
       FROM users u
       WHERE u.id <> $1
         AND (
           LOWER(u.email) LIKE $2 OR
           LOWER(u.first_name) LIKE $2 OR
           LOWER(u.last_name) LIKE $2 OR
           LOWER(TRIM(u.first_name || ' ' || u.last_name)) LIKE $2
         )
       ORDER BY
         CASE WHEN LOWER(TRIM(u.first_name || ' ' || u.last_name)) LIKE $2 THEN 0 ELSE 1 END,
         u.first_name, u.last_name
       LIMIT 12`,
      [userId, like]
    );

    res.json({ users: rows });
  } catch (err) {
    console.error('User search error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/friends', async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const userId = req.userId;

    const { rows: friends } = await pool.query(
      `SELECT
         CASE WHEN f.user_one_id = $1 THEN u2.id ELSE u1.id END AS id,
         CASE WHEN f.user_one_id = $1 THEN u2.first_name ELSE u1.first_name END AS first_name,
         CASE WHEN f.user_one_id = $1 THEN u2.last_name ELSE u1.last_name END AS last_name,
         CASE WHEN f.user_one_id = $1 THEN u2.email ELSE u1.email END AS email,
         CASE WHEN f.user_one_id = $1 THEN u2.avatar_url ELSE u1.avatar_url END AS avatar_url,
         CASE WHEN f.user_one_id = $1 THEN (u2.last_seen_at >= NOW() - INTERVAL '5 minutes') ELSE (u1.last_seen_at >= NOW() - INTERVAL '5 minutes') END AS online,
         f.created_at
       FROM friendships f
       JOIN users u1 ON u1.id = f.user_one_id
       JOIN users u2 ON u2.id = f.user_two_id
       WHERE f.user_one_id = $1 OR f.user_two_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    const { rows: requests } = await pool.query(
      `SELECT fr.id, fr.requester_id, fr.receiver_id, fr.status, fr.created_at,
              requester.first_name AS requester_first_name, requester.last_name AS requester_last_name, requester.email AS requester_email, requester.avatar_url AS requester_avatar_url,
              receiver.first_name AS receiver_first_name, receiver.last_name AS receiver_last_name, receiver.email AS receiver_email, receiver.avatar_url AS receiver_avatar_url
       FROM friend_requests fr
       JOIN users requester ON requester.id = fr.requester_id
       JOIN users receiver ON receiver.id = fr.receiver_id
       WHERE fr.status = 'pending'
         AND (fr.requester_id = $1 OR fr.receiver_id = $1)
       ORDER BY fr.created_at DESC`,
      [userId]
    );

    res.json({
      friends,
      requests: requests.map(r => ({
        id: r.id,
        created_at: r.created_at,
        direction: r.requester_id === userId ? 'outgoing' : 'incoming',
        user: r.requester_id === userId ? {
          id: r.receiver_id,
          first_name: r.receiver_first_name,
          last_name: r.receiver_last_name,
          email: r.receiver_email,
          avatar_url: r.receiver_avatar_url,
        } : {
          id: r.requester_id,
          first_name: r.requester_first_name,
          last_name: r.requester_last_name,
          email: r.requester_email,
          avatar_url: r.requester_avatar_url,
        },
      })),
    });
  } catch (err) {
    console.error('Friends list error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/friends/request', async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const requesterId = req.userId;
    const { user_id: receiverId } = req.body;

    if (!receiverId) return res.status(400).json({ error: 'user_id required' });
    if (receiverId === requesterId) return res.status(400).json({ error: 'Cannot friend yourself' });

    const { rows: targetRows } = await pool.query('SELECT id, first_name, last_name FROM users WHERE id = $1', [receiverId]);
    if (!targetRows.length) return res.status(404).json({ error: 'User not found' });

    const [userOneId, userTwoId] = sortPair(requesterId, receiverId);
    const { rows: existingFriend } = await pool.query(
      `SELECT id FROM friendships WHERE user_one_id = $1 AND user_two_id = $2`,
      [userOneId, userTwoId]
    );
    if (existingFriend.length) return res.status(409).json({ error: 'Already friends' });

    const { rows: reversePending } = await pool.query(
      `SELECT * FROM friend_requests
       WHERE requester_id = $1 AND receiver_id = $2 AND status = 'pending'`,
      [receiverId, requesterId]
    );

    if (reversePending.length) {
      await pool.query(
        `UPDATE friend_requests SET status = 'accepted', responded_at = NOW() WHERE id = $1`,
        [reversePending[0].id]
      );
      await pool.query(
        `INSERT INTO friendships (user_one_id, user_two_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [userOneId, userTwoId]
      );
      await createNotification(pool, {
        userId: receiverId,
        type: 'friend_request_accepted',
        title: 'Zahtjev prihvaćen',
        body: 'Sada ste prijatelji na Quizzu',
        data: { friend_id: requesterId },
      });
      return res.json({ accepted: true });
    }

    const { rows: existingPending } = await pool.query(
      `SELECT id FROM friend_requests
       WHERE requester_id = $1 AND receiver_id = $2 AND status = 'pending'`,
      [requesterId, receiverId]
    );
    if (existingPending.length) return res.status(409).json({ error: 'Request already sent' });

    const { rows } = await pool.query(
      `INSERT INTO friend_requests (requester_id, receiver_id)
       VALUES ($1, $2)
       RETURNING *`,
      [requesterId, receiverId]
    );

    const { rows: meRows } = await pool.query('SELECT first_name, last_name FROM users WHERE id = $1', [requesterId]);
    const me = meRows[0];
    await createNotification(pool, {
      userId: receiverId,
      type: 'friend_request',
      title: 'Novi zahtjev za prijateljstvo',
      body: `${me.first_name} ${me.last_name}`.trim() || 'Novi korisnik',
      data: { request_id: rows[0].id, requester_id: requesterId },
    });

    res.status(201).json({ request: rows[0] });
  } catch (err) {
    console.error('Friend request error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/friends/requests/:id/respond', async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const userId = req.userId;
    const { action } = req.body;
    if (!['accept', 'decline'].includes(action)) return res.status(400).json({ error: 'Invalid action' });

    const { rows } = await pool.query(
      `SELECT * FROM friend_requests
       WHERE id = $1 AND receiver_id = $2 AND status = 'pending'`,
      [req.params.id, userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Request not found' });

    const request = rows[0];
    await pool.query(
      `UPDATE friend_requests
       SET status = $1, responded_at = NOW()
       WHERE id = $2`,
      [action === 'accept' ? 'accepted' : 'declined', request.id]
    );

    if (action === 'accept') {
      const [userOneId, userTwoId] = sortPair(request.requester_id, request.receiver_id);
      await pool.query(
        `INSERT INTO friendships (user_one_id, user_two_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [userOneId, userTwoId]
      );
    }

    await createNotification(pool, {
      userId: request.requester_id,
      type: action === 'accept' ? 'friend_request_accepted' : 'friend_request_declined',
      title: action === 'accept' ? 'Zahtjev prihvaćen' : 'Zahtjev odbijen',
      body: action === 'accept' ? 'Sada ste prijatelji na Quizzu' : 'Zahtjev za prijateljstvo je odbijen',
      data: { request_id: request.id, user_id: request.receiver_id },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('Respond friend request error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { rows } = await pool.query(
      `SELECT id, first_name, last_name, email, avatar_url,
              (last_seen_at >= NOW() - INTERVAL '5 minutes') AS online
       FROM users
       WHERE id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
