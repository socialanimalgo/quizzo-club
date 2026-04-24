const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const https = require('https');
const { authMiddleware } = require('../middleware/auth');
const { sendWelcomeEmail, sendNewUserAlert } = require('../lib/email');
const { getWallet, grantPowerup } = require('../lib/powerups');
const { getAvatarUrl } = require('../lib/avatar-bank');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

function getBaseUrl() {
  return process.env.BASE_URL ||
    (process.env.NODE_ENV === 'production' ? 'https://quizzo.club' : 'http://localhost:5173');
}

function createToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    avatar_url: getAvatarUrl(user.selected_avatar_id, user.avatar_url || null),
    selected_avatar_id: user.selected_avatar_id || null,
    is_admin: Boolean(user.is_admin || user.email === process.env.ADMIN_EMAIL),
    is_blocked: Boolean(user.is_blocked),
    coins: Number(user.coins) || 0,
    gems: Number(user.gems) || 0,
    inventory: user.inventory || null,
    current_streak: Number(user.current_streak) || 0,
  };
}

// ── HTTPS helpers for Google API calls ──────────────────────────

function httpsPost(urlStr, params) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(params).toString();
    const url = new URL(urlStr);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error(data)); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function httpsGet(urlStr, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    https.get({ hostname: url.hostname, path: url.pathname + url.search, headers }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error(data)); } });
    }).on('error', reject);
  });
}

// ── Email / Password ─────────────────────────────────────────────

router.post('/register', async (req, res) => {
  try {
    const { email, password, first_name, last_name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const pool = req.app.get('pool');
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'User with this email already exists' });

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [email, password_hash, first_name || '', last_name || '']
    );

    const user = result.rows[0];
    sendWelcomeEmail(user.email, user.first_name);
    sendNewUserAlert(user.email, user.first_name, user.last_name, 'email');
    res.status(201).json({ token: createToken(user.id), user: sanitizeUser(user) });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const pool = req.app.get('pool');
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid email or password' });

    const user = result.rows[0];
    if (user.is_blocked) return res.status(403).json({ error: 'Account blocked' });
    if (!user.password_hash) return res.status(401).json({ error: 'This account uses Google sign-in' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    res.json({ token: createToken(user.id), user: sanitizeUser(user) });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const client = await pool.connect();
    let user;
    try {
      await client.query('BEGIN');
      const result = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [req.userId]);
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'User not found' });
      }
      user = result.rows[0];

      if (!user.last_daily_reward_date || String(user.last_daily_reward_date) !== new Date().toISOString().slice(0, 10)) {
        await client.query(
          'UPDATE users SET last_daily_reward_date = CURRENT_DATE WHERE id = $1',
          [req.userId]
        );
        await grantPowerup(client, req.userId, 'fifty', 1, 'daily_login');
        user.last_daily_reward_date = new Date().toISOString().slice(0, 10);
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    const wallet = await getWallet(pool, req.userId);
    const statsResult = await pool.query('SELECT current_streak FROM user_stats WHERE user_id = $1', [req.userId]);
    const current_streak = statsResult.rows[0]?.current_streak ?? 0;
    res.json({ user: sanitizeUser({ ...user, inventory: wallet.inv, coins: wallet.coins, gems: wallet.gems, current_streak }) });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Google OAuth ─────────────────────────────────────────────────

router.get('/google', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return res.status(500).json({ error: 'Google OAuth not configured' });

  const redirectUri = `${getBaseUrl()}/api/auth/google/callback`;
  const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
  });
  res.redirect(url);
});

router.get('/google/callback', async (req, res) => {
  const { code, error } = req.query;
  const base = getBaseUrl();

  if (error || !code) return res.redirect(`${base}/signin?error=google_cancelled`);

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${base}/api/auth/google/callback`;

    // Exchange code for tokens
    const tokens = await httpsPost('https://oauth2.googleapis.com/token', {
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    if (!tokens.access_token) return res.redirect(`${base}/signin?error=token_failed`);

    // Get Google profile
    const profile = await httpsGet('https://www.googleapis.com/oauth2/v2/userinfo', {
      Authorization: `Bearer ${tokens.access_token}`,
    });

    if (!profile.email) return res.redirect(`${base}/signin?error=no_email`);

    const pool = req.app.get('pool');

    // Find or create user
    let user;
    const byGoogleId = await pool.query('SELECT * FROM users WHERE google_id = $1', [profile.id]);
    if (byGoogleId.rows.length > 0) {
      user = byGoogleId.rows[0];
      if (user.is_blocked) return res.redirect(`${base}/signin?error=blocked`);
      await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [profile.picture, user.id]);
      user.avatar_url = profile.picture;
    } else {
      const byEmail = await pool.query('SELECT * FROM users WHERE email = $1', [profile.email]);
      if (byEmail.rows.length > 0) {
        user = byEmail.rows[0];
        if (user.is_blocked) return res.redirect(`${base}/signin?error=blocked`);
        await pool.query('UPDATE users SET google_id = $1, avatar_url = $2 WHERE id = $3',
          [profile.id, profile.picture, user.id]);
        user.google_id = profile.id;
        user.avatar_url = profile.picture;
      } else {
        const result = await pool.query(
          `INSERT INTO users (email, google_id, avatar_url, first_name, last_name)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [profile.email, profile.id, profile.picture, profile.given_name || '', profile.family_name || '']
        );
        user = result.rows[0];
        sendWelcomeEmail(user.email, user.first_name);
        sendNewUserAlert(user.email, user.first_name, user.last_name, 'Google');
      }
    }

    res.redirect(`${base}/signin?token=${createToken(user.id)}`);
  } catch (err) {
    console.error('Google OAuth error:', err);
    res.redirect(`${getBaseUrl()}/signin?error=server_error`);
  }
});

module.exports = router;
