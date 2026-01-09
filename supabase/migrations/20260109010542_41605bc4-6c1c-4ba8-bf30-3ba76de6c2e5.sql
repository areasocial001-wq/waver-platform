-- Create table for user custom templates
CREATE TABLE public.user_story_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'custom',
  scenes JSONB NOT NULL DEFAULT '[]'::jsonb,
  suggested_music_emotion TEXT,
  estimated_duration INTEGER DEFAULT 60,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.user_story_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own templates" 
ON public.user_story_templates 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can view public templates" 
ON public.user_story_templates 
FOR SELECT 
USING (is_public = true);

CREATE POLICY "Users can create their own templates" 
ON public.user_story_templates 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates" 
ON public.user_story_templates 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates" 
ON public.user_story_templates 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_story_templates_updated_at
BEFORE UPDATE ON public.user_story_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();