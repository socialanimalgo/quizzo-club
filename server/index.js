const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const authRoutes = require('./routes/auth');
const progressRoutes = require('./routes/progress');
const certificateRoutes = require('./routes/certificates');
const adminRoutes = require('./routes/admin');
const stripeRoutes = require('./routes/stripe');
const subscriptionRoutes = require('./routes/subscriptions');

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
app.use('/api', progressRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/subscription', subscriptionRoutes);

// ── Geo locale ───────────────────────────────────────────────────
app.get('/api/locale', (req, res) => {
  const ip = (req.headers['x-forwarded-for'] || req.ip || '')
    .split(',')[0].trim().replace('::ffff:', '');

  if (!ip || ip === '127.0.0.1' || ip === '::1') {
    return res.json({ countryCode: 'US' });
  }

  http.get(`http://ip-api.com/json/${ip}?fields=status,countryCode`, r => {
    let data = '';
    r.on('data', c => data += c);
    r.on('end', () => {
      try {
        const geo = JSON.parse(data);
        res.json({ countryCode: geo.status === 'success' ? geo.countryCode : 'US' });
      } catch {
        res.json({ countryCode: 'US' });
      }
    });
  }).on('error', () => res.json({ countryCode: 'US' }));
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
    console.log('Database schema migration complete');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
