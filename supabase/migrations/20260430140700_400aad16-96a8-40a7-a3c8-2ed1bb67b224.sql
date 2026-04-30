ALTER TABLE public.agent_projects
  ADD COLUMN IF NOT EXISTS heartbeat_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_scenes jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_agent_projects_heartbeat
  ON public.agent_projects (heartbeat_at)
  WHERE execution_status = 'running';