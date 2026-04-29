
ALTER TABLE public.agent_projects
  ADD COLUMN IF NOT EXISTS style_preset text NOT NULL DEFAULT 'modern',
  ADD COLUMN IF NOT EXISTS color_palette jsonb NOT NULL DEFAULT '{"primary":"#3B82F6","secondary":"#0F172A","accent":"#F59E0B"}'::jsonb,
  ADD COLUMN IF NOT EXISTS typography text NOT NULL DEFAULT 'Inter',
  ADD COLUMN IF NOT EXISTS transition_level text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS subtitle_config jsonb NOT NULL DEFAULT '{"enabled":true,"language":"auto","fontSize":"medium","position":"bottom-center"}'::jsonb,
  ADD COLUMN IF NOT EXISTS intro_title jsonb,
  ADD COLUMN IF NOT EXISTS outro_cta jsonb,
  ADD COLUMN IF NOT EXISTS scene_overrides jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_agent_projects_user_created
  ON public.agent_projects(user_id, created_at DESC);
