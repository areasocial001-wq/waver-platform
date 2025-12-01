-- Add transition_style column to storyboard_video_batches
ALTER TABLE public.storyboard_video_batches 
ADD COLUMN IF NOT EXISTS transition_style TEXT DEFAULT 'smooth';