-- Create cloned_voices table to persist user's cloned voices
CREATE TABLE public.cloned_voices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  elevenlabs_voice_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.cloned_voices ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own cloned voices" 
ON public.cloned_voices 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own cloned voices" 
ON public.cloned_voices 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cloned voices" 
ON public.cloned_voices 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add index for faster lookups
CREATE INDEX idx_cloned_voices_user_id ON public.cloned_voices(user_id);