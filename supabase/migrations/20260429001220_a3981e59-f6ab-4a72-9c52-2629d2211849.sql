
-- Drop previous clip_projects table (was for ClipAnything, pivoted to Agent flow)
DROP TABLE IF EXISTS public.clip_projects CASCADE;

-- Rename clip-uploads bucket to agent-uploads (or create if not present)
UPDATE storage.buckets SET id='agent-uploads', name='agent-uploads' WHERE id='clip-uploads';
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('agent-uploads', 'agent-uploads', true, 52428800)
ON CONFLICT (id) DO UPDATE SET public=true, file_size_limit=52428800;

-- Drop and recreate storage policies cleanly for agent-uploads
DROP POLICY IF EXISTS "Public read clip-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own clip-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users update own clip-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own clip-uploads" ON storage.objects;

CREATE POLICY "Public read agent-uploads"
ON storage.objects FOR SELECT
USING (bucket_id = 'agent-uploads');

CREATE POLICY "Users upload own agent-uploads"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'agent-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own agent-uploads"
ON storage.objects FOR UPDATE
USING (bucket_id = 'agent-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own agent-uploads"
ON storage.objects FOR DELETE
USING (bucket_id = 'agent-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Agent projects table
CREATE TABLE public.agent_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled',
  brief TEXT NOT NULL,
  pdf_text TEXT,
  pdf_url TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  voice_id TEXT,
  target_duration INTEGER NOT NULL DEFAULT 35,
  aspect_ratio TEXT NOT NULL DEFAULT '16:9',
  -- AI-generated plan (topic, audience, transcript, references)
  plan JSONB,
  plan_status TEXT NOT NULL DEFAULT 'idle',
  -- Execution
  execution_status TEXT NOT NULL DEFAULT 'idle',
  execution_step TEXT,
  progress_pct INTEGER NOT NULL DEFAULT 0,
  progress_log JSONB NOT NULL DEFAULT '[]'::jsonb,
  storyboard JSONB,
  selected_assets JSONB NOT NULL DEFAULT '[]'::jsonb,
  narration_url TEXT,
  final_video_url TEXT,
  json2video_project_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own agent projects"
ON public.agent_projects FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own agent projects"
ON public.agent_projects FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own agent projects"
ON public.agent_projects FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users delete own agent projects"
ON public.agent_projects FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_agent_projects_updated_at
BEFORE UPDATE ON public.agent_projects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_agent_projects_user_created ON public.agent_projects(user_id, created_at DESC);

-- Enable realtime for live progress
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_projects;
