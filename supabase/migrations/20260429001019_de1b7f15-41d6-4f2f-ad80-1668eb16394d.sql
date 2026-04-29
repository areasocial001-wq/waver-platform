
-- Storage bucket for clip source videos
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('clip-uploads', 'clip-uploads', true, 524288000)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 524288000;

CREATE POLICY "Public read clip-uploads"
ON storage.objects FOR SELECT
USING (bucket_id = 'clip-uploads');

CREATE POLICY "Users upload own clip-uploads"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'clip-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own clip-uploads"
ON storage.objects FOR UPDATE
USING (bucket_id = 'clip-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own clip-uploads"
ON storage.objects FOR DELETE
USING (bucket_id = 'clip-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Project table
CREATE TABLE public.clip_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled',
  source_video_url TEXT NOT NULL,
  source_video_duration NUMERIC,
  search_prompt TEXT,
  analysis_status TEXT NOT NULL DEFAULT 'pending',
  analysis_error TEXT,
  suggested_clips JSONB NOT NULL DEFAULT '[]'::jsonb,
  rendered_clips JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clip_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own clip projects"
ON public.clip_projects FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own clip projects"
ON public.clip_projects FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own clip projects"
ON public.clip_projects FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users delete own clip projects"
ON public.clip_projects FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_clip_projects_updated_at
BEFORE UPDATE ON public.clip_projects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_clip_projects_user_created ON public.clip_projects(user_id, created_at DESC);
