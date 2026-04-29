ALTER TABLE public.agent_projects
  ADD COLUMN IF NOT EXISTS vidnoz_avatar_id text,
  ADD COLUMN IF NOT EXISTS vidnoz_avatar_url text,
  ADD COLUMN IF NOT EXISTS vidnoz_voice_id text,
  ADD COLUMN IF NOT EXISTS use_vidnoz_for_talking_head boolean NOT NULL DEFAULT false;