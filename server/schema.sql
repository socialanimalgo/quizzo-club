CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT DEFAULT '',
  last_name TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lingoo_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  total_xp INTEGER DEFAULT 0 NOT NULL,
  current_streak INTEGER DEFAULT 0 NOT NULL,
  longest_streak INTEGER DEFAULT 0 NOT NULL,
  last_active_date DATE,
  hearts INTEGER DEFAULT 5 NOT NULL,
  hearts_last_refill TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT lingoo_progress_user_unique UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS lingoo_lesson_completions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  category_id TEXT NOT NULL,
  lesson_index INTEGER NOT NULL,
  xp_earned INTEGER DEFAULT 0 NOT NULL,
  score DECIMAL(5,2) DEFAULT 0 NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT lingoo_completion_unique UNIQUE(user_id, category_id, lesson_index)
);

CREATE TABLE IF NOT EXISTS lingoo_certificates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  certificate_number TEXT UNIQUE NOT NULL,
  specialization_id TEXT NOT NULL,
  specialization_name TEXT NOT NULL,
  user_name TEXT NOT NULL,
  issued_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lingoo_progress_user ON lingoo_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_lingoo_completions_user ON lingoo_lesson_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_lingoo_completions_category ON lingoo_lesson_completions(user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_lingoo_certificates_number ON lingoo_certificates(certificate_number);

-- Google OAuth + admin columns (idempotent)
DO $$
BEGIN
  BEGIN ALTER TABLE users ADD COLUMN google_id TEXT UNIQUE; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE users ADD COLUMN avatar_url TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT false; EXCEPTION WHEN duplicate_column THEN NULL; END;
END $$;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

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

CREATE INDEX IF NOT EXISTS idx_page_visits_date ON page_visits(visited_at);
CREATE INDEX IF NOT EXISTS idx_page_visits_country ON page_visits(country_code);

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

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub ON subscriptions(stripe_subscription_id);
