CREATE TABLE public.video_cost_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,
  seconds_billed NUMERIC NOT NULL DEFAULT 0,
  cost_eur NUMERIC NOT NULL DEFAULT 0,
  story_project_id UUID,
  scene_index INTEGER,
  status TEXT NOT NULL DEFAULT 'success',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_video_cost_log_user_created ON public.video_cost_log(user_id, created_at DESC);
CREATE INDEX idx_video_cost_log_project ON public.video_cost_log(story_project_id) WHERE story_project_id IS NOT NULL;

ALTER TABLE public.video_cost_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own cost log"
  ON public.video_cost_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert their own cost log"
  ON public.video_cost_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cost log"
  ON public.video_cost_log FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));