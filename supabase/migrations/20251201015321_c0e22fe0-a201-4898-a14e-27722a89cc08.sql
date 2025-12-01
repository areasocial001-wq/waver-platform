-- Create table for storyboard video generation batches
CREATE TABLE IF NOT EXISTS public.storyboard_video_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  storyboard_id UUID NOT NULL REFERENCES public.storyboards(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'processing',
  total_videos INTEGER NOT NULL,
  completed_videos INTEGER NOT NULL DEFAULT 0,
  duration INTEGER NOT NULL,
  camera_movement TEXT,
  audio_type TEXT,
  audio_prompt TEXT,
  transition_prompt TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add batch reference to video_generations
ALTER TABLE public.video_generations 
ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.storyboard_video_batches(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS sequence_order INTEGER;

-- Enable RLS
ALTER TABLE public.storyboard_video_batches ENABLE ROW LEVEL SECURITY;

-- RLS Policies for storyboard_video_batches
CREATE POLICY "Users can view their own batches"
  ON public.storyboard_video_batches
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own batches"
  ON public.storyboard_video_batches
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own batches"
  ON public.storyboard_video_batches
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own batches"
  ON public.storyboard_video_batches
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_storyboard_video_batches_updated_at
  BEFORE UPDATE ON public.storyboard_video_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();