ALTER TABLE public.story_mode_projects 
ADD COLUMN IF NOT EXISTS recovery_history jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.story_mode_projects.recovery_history IS 'Append-only log of failed Shotstack recovery attempts: [{ timestamp, context, attempts, assets: [{type, sceneNumber, url}] }]';