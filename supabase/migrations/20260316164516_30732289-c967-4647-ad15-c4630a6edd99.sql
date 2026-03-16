
CREATE TABLE public.storyboard_characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  storyboard_id uuid REFERENCES public.storyboards(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  reference_images jsonb NOT NULL DEFAULT '[]'::jsonb,
  color text NOT NULL DEFAULT '#6366f1',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.storyboard_characters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create their own characters"
  ON public.storyboard_characters FOR INSERT
  TO public
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own characters"
  ON public.storyboard_characters FOR SELECT
  TO public
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own characters"
  ON public.storyboard_characters FOR UPDATE
  TO public
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own characters"
  ON public.storyboard_characters FOR DELETE
  TO public
  USING (auth.uid() = user_id);

CREATE TRIGGER update_storyboard_characters_updated_at
  BEFORE UPDATE ON public.storyboard_characters
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
