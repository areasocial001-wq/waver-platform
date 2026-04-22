-- Add audio mix preferences column to user_preferences
ALTER TABLE public.user_preferences
ADD COLUMN IF NOT EXISTS story_mode_audio_mix jsonb NOT NULL DEFAULT jsonb_build_object(
  'narrationVolume', 100,
  'ambienceVolume', 18,
  'sfxVolume', 22,
  'musicVolume', 25,
  'autoMix', true,
  'lufsTarget', -14,
  'preset', 'balanced'
);