
ALTER TABLE public.agent_projects
  ADD COLUMN IF NOT EXISTS image_source text NOT NULL DEFAULT 'freepik',
  ADD COLUMN IF NOT EXISTS voice_quality_strict boolean NOT NULL DEFAULT true;
