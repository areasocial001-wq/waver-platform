-- First, delete any existing records with NULL user_id (orphaned records)
DELETE FROM public.video_generations WHERE user_id IS NULL;

-- Add NOT NULL constraint to user_id column to prevent future NULL values
ALTER TABLE public.video_generations ALTER COLUMN user_id SET NOT NULL;