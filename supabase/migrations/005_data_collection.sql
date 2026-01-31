-- Migration: Data collection enhancements for user interest profiling and ad targeting

-- 1. Add content categorization fields to saved_posts
ALTER TABLE saved_posts ADD COLUMN categories TEXT[] DEFAULT '{}';
ALTER TABLE saved_posts ADD COLUMN tags TEXT[] DEFAULT '{}';
ALTER TABLE saved_posts ADD COLUMN sentiment VARCHAR(20);

-- 2. Add demographic fields to users
ALTER TABLE users ADD COLUMN age_range VARCHAR(10);
ALTER TABLE users ADD COLUMN gender VARCHAR(20);
ALTER TABLE users ADD COLUMN city VARCHAR(100);
ALTER TABLE users ADD COLUMN country VARCHAR(100);
ALTER TABLE users ADD COLUMN occupation VARCHAR(100);

-- 3. Click tracking for digest emails
CREATE TABLE digest_clicks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  digest_id UUID REFERENCES digests(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES saved_posts(id) ON DELETE SET NULL,
  clicked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_digest_clicks_user_id ON digest_clicks(user_id);
CREATE INDEX idx_digest_clicks_digest_id ON digest_clicks(digest_id);
CREATE INDEX idx_digest_clicks_clicked_at ON digest_clicks(clicked_at);

ALTER TABLE digest_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own clicks" ON digest_clicks
  FOR SELECT USING (auth.uid() = user_id);

-- 4. User interest profiles (computed nightly from saved post categories)
CREATE TABLE user_interest_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,

  -- Interest distribution: {"fitness": 0.45, "cooking": 0.30, ...}
  interests JSONB NOT NULL DEFAULT '{}',

  -- Top specific tags across all posts
  top_tags TEXT[] DEFAULT '{}',

  -- Which post format they save most: photo, video, reel, carousel
  content_format_preference VARCHAR(20),

  -- Engagement metrics
  avg_posts_per_week DECIMAL(5,2) DEFAULT 0,
  email_open_rate DECIMAL(5,4) DEFAULT 0,
  email_click_rate DECIMAL(5,4) DEFAULT 0,
  engagement_score DECIMAL(5,2) DEFAULT 0,

  -- Total posts analyzed (for incremental updates)
  posts_analyzed INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_interest_profiles_engagement ON user_interest_profiles(engagement_score DESC);

ALTER TABLE user_interest_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own interest profile" ON user_interest_profiles
  FOR SELECT USING (auth.uid() = user_id);

-- 5. Ad campaigns table (for future use)
CREATE TABLE ad_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  advertiser_name VARCHAR(255) NOT NULL,
  target_categories TEXT[] DEFAULT '{}',
  target_age_ranges TEXT[] DEFAULT '{}',
  target_genders TEXT[] DEFAULT '{}',
  target_countries TEXT[] DEFAULT '{}',
  budget_cents INTEGER NOT NULL,
  spent_cents INTEGER DEFAULT 0,
  pricing_model VARCHAR(10) NOT NULL, -- 'cpm' or 'cpc'
  rate_cents INTEGER NOT NULL,
  image_url TEXT,
  headline VARCHAR(255),
  body_text TEXT,
  cta_url TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Ad impressions tracking
CREATE TABLE ad_impressions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  digest_id UUID REFERENCES digests(id) ON DELETE SET NULL,
  shown_at TIMESTAMPTZ DEFAULT NOW(),
  clicked_at TIMESTAMPTZ
);

CREATE INDEX idx_ad_impressions_campaign ON ad_impressions(campaign_id);
CREATE INDEX idx_ad_impressions_user ON ad_impressions(user_id);

ALTER TABLE ad_impressions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own ad impressions" ON ad_impressions
  FOR SELECT USING (auth.uid() = user_id);

-- 7. Indexes for category/tag queries
CREATE INDEX idx_saved_posts_categories ON saved_posts USING GIN(categories);
CREATE INDEX idx_saved_posts_tags ON saved_posts USING GIN(tags);
