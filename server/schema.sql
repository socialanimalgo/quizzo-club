-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  first_name TEXT DEFAULT '',
  last_name TEXT DEFAULT '',
  google_id TEXT UNIQUE,
  avatar_url TEXT,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics: page visits
CREATE TABLE IF NOT EXISTS page_visits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ip_address TEXT,
  country TEXT,
  country_code TEXT,
  city TEXT,
  visited_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  status TEXT DEFAULT 'inactive',
  plan TEXT,
  trial_end TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quiz categories
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#4F46E5',
  question_count INTEGER DEFAULT 0
);

-- Questions
CREATE TABLE IF NOT EXISTS questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id TEXT REFERENCES categories(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_index INTEGER NOT NULL,
  difficulty TEXT DEFAULT 'medium',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quiz sessions
CREATE TABLE IF NOT EXISTS quiz_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  category_id TEXT,
  session_type TEXT DEFAULT 'solo',
  question_ids JSONB,
  answers JSONB DEFAULT '[]',
  score INTEGER DEFAULT 0,
  total_questions INTEGER DEFAULT 10,
  correct_count INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Daily quiz (same questions for everyone on a given date)
CREATE TABLE IF NOT EXISTS daily_quizzes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_date DATE UNIQUE NOT NULL,
  question_ids JSONB NOT NULL
);

-- Daily completions (one per user per day)
CREATE TABLE IF NOT EXISTS daily_completions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  quiz_date DATE NOT NULL,
  session_id UUID REFERENCES quiz_sessions(id),
  score INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, quiz_date)
);
-- Migrations: add missing columns if table existed from old schema
ALTER TABLE daily_completions ADD COLUMN IF NOT EXISTS quiz_date DATE;
ALTER TABLE daily_completions ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES quiz_sessions(id);
ALTER TABLE daily_completions ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0;
ALTER TABLE daily_completions ADD COLUMN IF NOT EXISTS correct_count INTEGER DEFAULT 0;

-- Challenges / Hunter Mode
CREATE TABLE IF NOT EXISTS challenges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  challenger_id UUID REFERENCES users(id) ON DELETE CASCADE,
  challenged_id UUID REFERENCES users(id) ON DELETE SET NULL,
  category_id TEXT,
  mode TEXT DEFAULT 'challenge',
  status TEXT DEFAULT 'pending',
  challenger_session_id UUID REFERENCES quiz_sessions(id),
  challenged_session_id UUID REFERENCES quiz_sessions(id),
  winner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  share_code TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- User stats / leaderboard
CREATE TABLE IF NOT EXISTS user_stats (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
  total_quizzes INTEGER DEFAULT 0,
  total_correct INTEGER DEFAULT 0,
  total_questions INTEGER DEFAULT 0,
  best_score INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_quiz_date DATE,
  xp INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migrations: add missing columns if tables existed from old schema
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS best_score INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS last_quiz_date DATE;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_page_visits_date ON page_visits(visited_at);
CREATE INDEX IF NOT EXISTS idx_page_visits_country ON page_visits(country_code);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category_id);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user ON quiz_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_type ON quiz_sessions(session_type);
CREATE INDEX IF NOT EXISTS idx_daily_completions_date ON daily_completions(quiz_date);
CREATE INDEX IF NOT EXISTS idx_challenges_code ON challenges(share_code);
CREATE INDEX IF NOT EXISTS idx_user_stats_xp ON user_stats(xp DESC);

-- Seed categories (idempotent)
INSERT INTO categories (id, name, emoji, description, color) VALUES
  ('geography',   'Geografija',      '🌍', 'Gradovi, rijeke, planine, države', '#2563EB'),
  ('history',     'Povijest',        '📚', 'Bitke, vladari, civilizacije', '#D97706'),
  ('sports',      'Sport',           '⚽', 'Nogomet, košarka, tenis i više', '#16A34A'),
  ('science',     'Priroda i Znanost','🔬', 'Fizika, biologija, kemija, svemirr', '#7C3AED'),
  ('film_music',  'Film i Glazba',   '🎬', 'Filmovi, glazbenici, nagrade', '#DB2777'),
  ('pop_culture', 'Pop Kultura',     '🎭', 'Internet, trendovi, poznate ličnosti', '#EA580C')
ON CONFLICT (id) DO NOTHING;
