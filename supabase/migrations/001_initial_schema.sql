-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Settings
  digest_time TIME DEFAULT '06:00:00',
  timezone VARCHAR(50) DEFAULT 'America/New_York',
  digest_enabled BOOLEAN DEFAULT TRUE,

  -- Subscription
  subscription_status VARCHAR(20) DEFAULT 'trial', -- trial, active, canceled, past_due
  subscription_started_at TIMESTAMPTZ,
  subscription_ends_at TIMESTAMPTZ,
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  trial_digest_sent BOOLEAN DEFAULT FALSE,

  -- Stats
  total_posts_saved INTEGER DEFAULT 0,
  total_digests_sent INTEGER DEFAULT 0,

  -- Instagram connection
  instagram_username VARCHAR(255),
  last_post_received_at TIMESTAMPTZ
);

-- Saved posts
CREATE TABLE saved_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Instagram post data
  instagram_post_id VARCHAR(255),
  instagram_url TEXT NOT NULL,
  post_type VARCHAR(20), -- photo, video, carousel, reel

  -- Content
  caption TEXT,
  author_username VARCHAR(255),
  author_profile_url TEXT,
  media_urls JSONB,
  thumbnail_url TEXT,

  -- Metadata
  posted_at TIMESTAMPTZ,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_user_post UNIQUE(user_id, instagram_post_id)
);

-- Digests (sent emails)
CREATE TABLE digests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Content
  subject VARCHAR(255),
  html_content TEXT,
  summary TEXT,
  post_ids UUID[],
  post_count INTEGER DEFAULT 0,

  -- AI cost tracking
  ai_tokens_used INTEGER,
  ai_cost_usd DECIMAL(10, 6),

  -- Email delivery
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  resend_email_id VARCHAR(255),
  opened_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscription events
CREATE TABLE subscription_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  event_type VARCHAR(50),
  stripe_event_id VARCHAR(255),
  metadata JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_saved_posts_user_id ON saved_posts(user_id);
CREATE INDEX idx_saved_posts_saved_at ON saved_posts(saved_at);
CREATE INDEX idx_saved_posts_processed ON saved_posts(processed) WHERE processed = FALSE;
CREATE INDEX idx_digests_user_id ON digests(user_id);
CREATE INDEX idx_digests_sent_at ON digests(sent_at);
CREATE INDEX idx_users_subscription_status ON users(subscription_status);
CREATE INDEX idx_users_digest_enabled ON users(digest_enabled) WHERE digest_enabled = TRUE;

-- Row Level Security (RLS) Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE digests ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

-- Users can only read/update their own data
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Saved posts policies
CREATE POLICY "Users can view own saved posts" ON saved_posts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved posts" ON saved_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved posts" ON saved_posts
  FOR DELETE USING (auth.uid() = user_id);

-- Digests policies
CREATE POLICY "Users can view own digests" ON digests
  FOR SELECT USING (auth.uid() = user_id);

-- Subscription events policies
CREATE POLICY "Users can view own subscription events" ON subscription_events
  FOR SELECT USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for users table
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_profile();
