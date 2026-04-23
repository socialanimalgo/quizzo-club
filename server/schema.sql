-- If categories.id is not TEXT (old lingee-app schema with INTEGER id),
-- drop all quiz tables so they can be recreated with the correct schema.
-- Users and subscriptions are preserved.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories'
      AND column_name = 'id'
      AND data_type != 'text'
  ) THEN
    DROP TABLE IF EXISTS notifications CASCADE;
    DROP TABLE IF EXISTS friendships CASCADE;
    DROP TABLE IF EXISTS friend_requests CASCADE;
    DROP TABLE IF EXISTS challenges CASCADE;
    DROP TABLE IF EXISTS daily_completions CASCADE;
    DROP TABLE IF EXISTS quiz_sessions CASCADE;
    DROP TABLE IF EXISTS daily_quizzes CASCADE;
    DROP TABLE IF EXISTS questions CASCADE;
    DROP TABLE IF EXISTS user_stats CASCADE;
    DROP TABLE IF EXISTS categories CASCADE;
    DROP TABLE IF EXISTS page_visits CASCADE;
  END IF;
END $$;

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
  is_blocked BOOLEAN DEFAULT false,
  coins INTEGER DEFAULT 0,
  gems INTEGER DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS coins INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gems INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_daily_reward_date DATE;

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
  powerup_state JSONB DEFAULT '{}'::jsonb,
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

CREATE TABLE IF NOT EXISTS user_powerups (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  powerup_id TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 0 CHECK (qty >= 0),
  PRIMARY KEY (user_id, powerup_id)
);

CREATE TABLE IF NOT EXISTS powerup_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  powerup_id TEXT NOT NULL,
  qty INTEGER NOT NULL,
  currency TEXT NOT NULL,
  cost_coins INTEGER,
  cost_gems INTEGER,
  bundle_id TEXT,
  revenue_eur NUMERIC(10,2),
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gem_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  pack_id TEXT NOT NULL,
  gems_amount INTEGER NOT NULL,
  price_eur NUMERIC(10,2) NOT NULL,
  stripe_payment_intent TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS powerup_uses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  powerup_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS friend_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  UNIQUE (requester_id, receiver_id)
);

CREATE TABLE IF NOT EXISTS friendships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_one_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  user_two_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_one_id, user_two_id),
  CHECK (user_one_id <> user_two_id)
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
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS challenge_wins INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS challenge_losses INTEGER DEFAULT 0;

ALTER TABLE categories ADD COLUMN IF NOT EXISTS emoji TEXT NOT NULL DEFAULT '';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#4F46E5';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS question_count INTEGER DEFAULT 0;

ALTER TABLE questions ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'medium';
ALTER TABLE questions ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

ALTER TABLE quiz_sessions ADD COLUMN IF NOT EXISTS session_type TEXT DEFAULT 'solo';
ALTER TABLE quiz_sessions ADD COLUMN IF NOT EXISTS question_ids JSONB;
ALTER TABLE quiz_sessions ADD COLUMN IF NOT EXISTS answers JSONB DEFAULT '[]';
ALTER TABLE quiz_sessions ADD COLUMN IF NOT EXISTS powerup_state JSONB DEFAULT '{}'::jsonb;
ALTER TABLE quiz_sessions ADD COLUMN IF NOT EXISTS correct_count INTEGER DEFAULT 0;
ALTER TABLE quiz_sessions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

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
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON friend_requests(receiver_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_friendships_user_one ON friendships(user_one_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_friendships_user_two ON friendships(user_two_id, created_at DESC);

-- Seed categories (upsert — also fixes rows missing emoji/description from old schema)
INSERT INTO categories (id, name, emoji, description, color) VALUES
  ('geography',   'Geografija',      '🌍', 'Gradovi, rijeke, planine, države', '#2563EB'),
  ('history',     'Povijest',        '📚', 'Bitke, vladari, civilizacije', '#D97706'),
  ('sports',      'Sport',           '⚽', 'Nogomet, košarka, tenis i više', '#16A34A'),
  ('science',     'Priroda i Znanost','🔬', 'Fizika, biologija, kemija, svemirr', '#7C3AED'),
  ('film_music',  'Film i Glazba',   '🎬', 'Filmovi, glazbenici, nagrade', '#DB2777'),
  ('pop_culture', 'Pop Kultura',     '🎭', 'Internet, trendovi, poznate ličnosti', '#EA580C')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  emoji = EXCLUDED.emoji,
  description = EXCLUDED.description,
  color = EXCLUDED.color;
