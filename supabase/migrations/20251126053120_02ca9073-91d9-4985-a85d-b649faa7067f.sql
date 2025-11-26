-- Add tags column to storyboards table
ALTER TABLE public.storyboards 
ADD COLUMN tags text[] DEFAULT '{}';

-- Create an index for better tag filtering performance
CREATE INDEX idx_storyboards_tags ON public.storyboards USING GIN(tags);