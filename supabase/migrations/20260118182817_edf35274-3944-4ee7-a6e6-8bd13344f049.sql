-- Add voice_settings column to video_generations to store TTS settings
ALTER TABLE public.video_generations 
ADD COLUMN IF NOT EXISTS voice_settings JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.video_generations.voice_settings IS 'Stores TTS voice settings: voiceId, speed, stability, similarityBoost, style';