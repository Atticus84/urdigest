-- Atomic increment functions to prevent read-modify-write race conditions
-- on user stats counters.

-- Atomically increment total_posts_saved for a user
CREATE OR REPLACE FUNCTION increment_posts_saved(p_user_id uuid, p_amount int DEFAULT 1)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE users
  SET total_posts_saved = COALESCE(total_posts_saved, 0) + p_amount
  WHERE id = p_user_id;
$$;

-- Atomically increment total_digests_sent (and optionally mark trial as used)
CREATE OR REPLACE FUNCTION increment_digests_sent(p_user_id uuid, p_mark_trial_used boolean DEFAULT false)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE users
  SET total_digests_sent = COALESCE(total_digests_sent, 0) + 1,
      trial_digest_sent = CASE WHEN p_mark_trial_used THEN true ELSE trial_digest_sent END
  WHERE id = p_user_id;
$$;
