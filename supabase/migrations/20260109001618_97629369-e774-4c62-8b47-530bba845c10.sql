-- Create table for talking avatar projects
CREATE TABLE public.talking_avatar_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  scenes JSONB NOT NULL DEFAULT '[]'::jsonb,
  timeline_clips JSONB NOT NULL DEFAULT '[]'::jsonb,
  reference_images JSONB NOT NULL DEFAULT '[]'::jsonb,
  background_music_url TEXT,
  background_music_emotion TEXT,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.talking_avatar_projects ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own projects" 
ON public.talking_avatar_projects 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects" 
ON public.talking_avatar_projects 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects" 
ON public.talking_avatar_projects 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects" 
ON public.talking_avatar_projects 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_talking_avatar_projects_updated_at
BEFORE UPDATE ON public.talking_avatar_projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();