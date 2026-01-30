-- Add onboarding state for DM conversation flow
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS onboarding_state TEXT DEFAULT NULL
CHECK (onboarding_state IN (NULL, 'awaiting_email', 'awaiting_time', 'onboarded'));
