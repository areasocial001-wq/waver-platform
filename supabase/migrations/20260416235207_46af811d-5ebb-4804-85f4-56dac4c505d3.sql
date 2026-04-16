-- Enable extensions for scheduled cleanup
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Composite index for api_status_history queries (user + time range)
CREATE INDEX IF NOT EXISTS idx_api_status_history_user_checked 
  ON public.api_status_history (user_id, checked_at DESC);

-- Composite index for api_logs queries
CREATE INDEX IF NOT EXISTS idx_api_logs_user_created 
  ON public.api_logs (user_id, created_at DESC);

-- Index for story_mode_projects listing (ordered by updated_at)
CREATE INDEX IF NOT EXISTS idx_story_mode_projects_user_updated 
  ON public.story_mode_projects (user_id, updated_at DESC);