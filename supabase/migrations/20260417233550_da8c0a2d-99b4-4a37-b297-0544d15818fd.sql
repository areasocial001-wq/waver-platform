ALTER TABLE public.story_mode_projects 
ADD COLUMN IF NOT EXISTS pending_render_id text,
ADD COLUMN IF NOT EXISTS render_started_at timestamptz;