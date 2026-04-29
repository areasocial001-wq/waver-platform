-- Add B-roll mix to agent projects
ALTER TABLE public.agent_projects
ADD COLUMN IF NOT EXISTS broll_mix jsonb NOT NULL DEFAULT '{"talking_head": 50, "sketch": 50}'::jsonb;

-- Custom user presets for the Video Agent
CREATE TABLE IF NOT EXISTS public.agent_user_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  base_preset text NOT NULL DEFAULT 'opus',
  color_palette jsonb NOT NULL DEFAULT '{"primary":"#00D4E0","secondary":"#0B1B2B","accent":"#2B8CD9"}'::jsonb,
  typography text NOT NULL DEFAULT 'Inter',
  transition_level text NOT NULL DEFAULT 'subtle',
  subtitle_config jsonb NOT NULL DEFAULT '{"enabled":true,"language":"auto","fontSize":"medium","position":"bottom-center"}'::jsonb,
  intro_title jsonb,
  outro_cta jsonb,
  broll_mix jsonb NOT NULL DEFAULT '{"talking_head":50,"sketch":50}'::jsonb,
  aspect_ratio text NOT NULL DEFAULT '9:16',
  scene_duration_sec numeric NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_user_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own agent presets" ON public.agent_user_presets
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own agent presets" ON public.agent_user_presets
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own agent presets" ON public.agent_user_presets
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own agent presets" ON public.agent_user_presets
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_agent_user_presets_updated_at
BEFORE UPDATE ON public.agent_user_presets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_agent_user_presets_user ON public.agent_user_presets(user_id);