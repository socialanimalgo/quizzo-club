const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

async function loadActiveUser(req, userId) {
  const pool = req.app.get('pool');
  const { rows } = await pool.query(
    'SELECT id, email, is_admin, is_blocked FROM users WHERE id = $1 AND deleted_at IS NULL',
    [userId]
  );
  if (!rows[0]) return null;
  return {
    ...rows[0],
    is_admin: Boolean(rows[0].is_admin || (process.env.ADMIN_EMAIL && rows[0].email === process.env.ADMIN_EMAIL)),
  };
}

function touchLastSeen(req, userId) {
  const pool = req.app.get('pool');
  pool.query(
    'UPDATE users SET last_seen_at = NOW() WHERE id = $1',
    [userId]
  ).catch(() => {});
}

async function getUserFromAccessToken(req, token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await loadActiveUser(req, payload.userId);
    if (!user || user.is_blocked) return null;
    touchLastSeen(req, user.id);
    return user;
  } catch {
    return null;
  }
}

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const user = await getUserFromAccessToken(req, token);
    if (!user) return res.status(401).json({ error: 'Invalid or expired token' });
    req.user = user;
    req.userId = user.id;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const user = await getUserFromAccessToken(req, authHeader.split(' ')[1]);
    if (user) {
      req.user = user;
      req.userId = user.id;
    }
  }
  next();
}

async function adminMiddleware(req, res, next) {
  try {
    if (!req.user?.is_admin) return res.status(403).json({ error: 'Forbidden' });
    next();
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { authMiddleware, optionalAuth, adminMiddleware, getUserFromAccessToken };
