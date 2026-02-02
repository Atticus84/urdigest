-- Migration: Shareable Personal Digests
-- Adds: digest_followers, follow_links tables; extends users with sharing fields

-- 1. Users: add sharing-related columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS digest_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS digest_description TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS follow_slug TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sharing_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS follower_count INTEGER NOT NULL DEFAULT 0;

-- Index for public follow page lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_follow_slug ON users(follow_slug) WHERE follow_slug IS NOT NULL;

-- 2. Digest followers (replaces/extends digest_recipients for the sharing use case)
CREATE TABLE IF NOT EXISTS digest_followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'link' | 'forwarded'
  confirmed BOOLEAN NOT NULL DEFAULT false,
  confirmation_token UUID DEFAULT gen_random_uuid(),
  unsubscribe_token UUID DEFAULT gen_random_uuid(),
  note TEXT, -- optional note from the person who shared
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  UNIQUE(user_id, email)
);

CREATE INDEX IF NOT EXISTS idx_digest_followers_user_confirmed
  ON digest_followers(user_id) WHERE confirmed = true AND unsubscribed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_digest_followers_confirmation_token
  ON digest_followers(confirmation_token);

CREATE INDEX IF NOT EXISTS idx_digest_followers_unsubscribe_token
  ON digest_followers(unsubscribe_token);

-- RLS for digest_followers
ALTER TABLE digest_followers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own followers" ON digest_followers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own followers" ON digest_followers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own followers" ON digest_followers
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own followers" ON digest_followers
  FOR DELETE USING (auth.uid() = user_id);

-- Service role needs full access (for confirmation/unsubscribe endpoints)
-- The service role key bypasses RLS by default, so no extra policy needed.

-- 3. Track digest sends (who received what)
CREATE TABLE IF NOT EXISTS digest_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  digest_id UUID NOT NULL REFERENCES digests(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  recipient_type TEXT NOT NULL DEFAULT 'owner', -- 'owner' | 'follower'
  resend_email_id TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opened_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_digest_sends_digest_id ON digest_sends(digest_id);

-- RLS for digest_sends
ALTER TABLE digest_sends ENABLE ROW LEVEL SECURITY;

-- Users can view sends for their own digests
CREATE POLICY "Users can view own digest sends" ON digest_sends
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM digests WHERE digests.id = digest_sends.digest_id AND digests.user_id = auth.uid())
  );

-- 4. Digests: add sent_to_followers_count
ALTER TABLE digests ADD COLUMN IF NOT EXISTS sent_to_followers_count INTEGER NOT NULL DEFAULT 0;
