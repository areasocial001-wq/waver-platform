-- Create a table for JSON2Video projects
CREATE TABLE public.json2video_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  clips JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtitles JSONB,
  intro JSONB,
  outro JSONB,
  audio_track JSONB,
  sound_effects JSONB DEFAULT '[]'::jsonb,
  transition JSONB,
  resolution TEXT DEFAULT 'full-hd',
  rendered_url TEXT,
  thumbnail_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.json2video_projects ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own projects" 
ON public.json2video_projects 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects" 
ON public.json2video_projects 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects" 
ON public.json2video_projects 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects" 
ON public.json2video_projects 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_json2video_projects_updated_at
BEFORE UPDATE ON public.json2video_projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();