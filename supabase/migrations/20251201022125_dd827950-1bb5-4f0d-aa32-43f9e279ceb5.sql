-- Add transition_speed column to storyboard_video_batches
ALTER TABLE storyboard_video_batches 
ADD COLUMN transition_speed text DEFAULT 'normal' CHECK (transition_speed IN ('fast', 'normal', 'slow'));