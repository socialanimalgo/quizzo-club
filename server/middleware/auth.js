const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    req.userId = payload.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
      req.user = payload;
      req.userId = payload.userId;
    } catch {}
  }
  next();
}

async function adminMiddleware(req, res, next) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return res.status(403).json({ error: 'Forbidden' });
  try {
    const pool = req.app.get('pool');
    const result = await pool.query('SELECT email FROM users WHERE id = $1', [req.userId]);
    if (result.rows[0]?.email !== adminEmail) return res.status(403).json({ error: 'Forbidden' });
    next();
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { authMiddleware, optionalAuth, adminMiddleware };
