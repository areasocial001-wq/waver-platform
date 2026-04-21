ALTER TABLE public.user_preferences
ADD COLUMN IF NOT EXISTS story_mode_lock_character_default boolean NOT NULL DEFAULT false;