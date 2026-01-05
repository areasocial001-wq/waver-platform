-- Create table for custom motion presets
CREATE TABLE public.motion_presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'custom',
  tags TEXT[] DEFAULT '{}',
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.motion_presets ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own presets" 
ON public.motion_presets 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can view public presets" 
ON public.motion_presets 
FOR SELECT 
USING (is_public = true);

CREATE POLICY "Users can create their own presets" 
ON public.motion_presets 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own presets" 
ON public.motion_presets 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own presets" 
ON public.motion_presets 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_motion_presets_updated_at
  BEFORE UPDATE ON public.motion_presets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add tags column to video_generations for filtering
ALTER TABLE public.video_generations 
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Add category column to video_generations for filtering
ALTER TABLE public.video_generations 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';