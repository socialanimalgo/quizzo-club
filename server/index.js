const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { execFileSync } = require('child_process');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const stripeRoutes = require('./routes/stripe');
const subscriptionRoutes = require('./routes/subscriptions');
const quizRoutes = require('./routes/quiz');
const leaderboardRoutes = require('./routes/leaderboard');
const challengeRoutes = require('./routes/challenges');
const notificationRoutes = require('./routes/notifications');
const userRoutes = require('./routes/users');
const shopRoutes = require('./routes/shop');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

app.set('trust proxy', 1);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});
app.set('pool', pool);

// Raw body for Stripe webhooks — MUST come before express.json()
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/shop', shopRoutes);

// ── Geo locale ───────────────────────────────────────────────────
app.get('/api/locale', (req, res) => {
  const ip = (req.headers['x-forwarded-for'] || req.ip || '')
    .split(',')[0].trim().replace('::ffff:', '');

  if (!ip || ip === '127.0.0.1' || ip === '::1') {
    return res.json({ countryCode: 'HR' });
  }

  http.get(`http://ip-api.com/json/${ip}?fields=status,countryCode`, r => {
    let data = '';
    r.on('data', c => data += c);
    r.on('end', () => {
      try {
        const geo = JSON.parse(data);
        res.json({ countryCode: geo.status === 'success' ? geo.countryCode : 'HR' });
      } catch {
        res.json({ countryCode: 'HR' });
      }
    });
  }).on('error', () => res.json({ countryCode: 'HR' }));
});

// ── Visit tracking ────────────────────────────────────────────────
app.post('/api/analytics/visit', async (req, res) => {
  try {
    const ip = (req.headers['x-forwarded-for'] || req.ip || '')
      .split(',')[0].trim().replace('::ffff:', '');
    let userId = null;
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      try {
        const payload = jwt.verify(auth.split(' ')[1], JWT_SECRET);
        userId = payload.userId;
      } catch {}
    }

    const result = await pool.query(
      'INSERT INTO page_visits (user_id, ip_address) VALUES ($1, $2) RETURNING id',
      [userId || null, ip || null]
    );
    const visitId = result.rows[0].id;
    res.json({ ok: true });

    if (ip && ip !== '127.0.0.1' && ip !== '::1') {
      http.get(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,city`, r => {
        let data = '';
        r.on('data', c => data += c);
        r.on('end', () => {
          try {
            const geo = JSON.parse(data);
            if (geo.status === 'success') {
              pool.query(
                'UPDATE page_visits SET country=$1, country_code=$2, city=$3 WHERE id=$4',
                [geo.country, geo.countryCode, geo.city, visitId]
              ).catch(() => {});
            }
          } catch {}
        });
      }).on('error', () => {});
    }
  } catch (err) {
    console.error('Visit tracking error:', err);
    res.json({ ok: false });
  }
});

// Serve static files
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

async function start() {
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    await pool.query(schema);
    const { rows } = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM categories) AS category_count,
         (SELECT COUNT(*)::int FROM questions WHERE active = true) AS active_question_count`
    );

    const { category_count: categoryCount, active_question_count: activeQuestionCount } = rows[0];
    if (categoryCount > 0 && activeQuestionCount === 0) {
      console.log('No active questions found, running automatic seed...');
      execFileSync(process.execPath, [path.join(__dirname, 'seeds', 'questions.js')], {
        stdio: 'inherit',
        env: process.env,
      });
    }

    console.log('Database schema migration complete');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
