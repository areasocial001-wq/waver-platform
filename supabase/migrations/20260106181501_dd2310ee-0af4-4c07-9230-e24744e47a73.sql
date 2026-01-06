-- Add columns to store dialogue text and audio URL for TTS voiceover
ALTER TABLE public.video_generations 
ADD COLUMN IF NOT EXISTS dialogue_text TEXT,
ADD COLUMN IF NOT EXISTS audio_url TEXT,
ADD COLUMN IF NOT EXISTS original_prompt TEXT;