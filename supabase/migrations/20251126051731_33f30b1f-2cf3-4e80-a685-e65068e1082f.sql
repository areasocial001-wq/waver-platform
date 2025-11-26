-- Create storyboards table
CREATE TABLE public.storyboards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  layout TEXT NOT NULL,
  template_type TEXT NOT NULL,
  panels JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.storyboards ENABLE ROW LEVEL SECURITY;

-- Create policies for storyboards
CREATE POLICY "Users can view their own storyboards"
ON public.storyboards
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own storyboards"
ON public.storyboards
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own storyboards"
ON public.storyboards
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own storyboards"
ON public.storyboards
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view public storyboards"
ON public.storyboards
FOR SELECT
USING (is_public = true);

-- Create trigger for updated_at
CREATE TRIGGER update_storyboards_updated_at
BEFORE UPDATE ON public.storyboards
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Create index for faster queries
CREATE INDEX idx_storyboards_user_id ON public.storyboards(user_id);
CREATE INDEX idx_storyboards_is_public ON public.storyboards(is_public);