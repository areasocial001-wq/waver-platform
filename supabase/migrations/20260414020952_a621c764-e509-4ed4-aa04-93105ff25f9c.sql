CREATE TABLE public.story_mode_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Story',
  synopsis TEXT,
  suggested_music TEXT,
  scenes JSONB NOT NULL DEFAULT '[]'::jsonb,
  input_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  final_video_url TEXT,
  background_music_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.story_mode_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own story projects"
  ON public.story_mode_projects FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own story projects"
  ON public.story_mode_projects FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own story projects"
  ON public.story_mode_projects FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own story projects"
  ON public.story_mode_projects FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_story_mode_projects_updated_at
  BEFORE UPDATE ON public.story_mode_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();