-- Add columns for queue system with priority and retry logic
ALTER TABLE public.video_generations
ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_retries integer DEFAULT 3,
ADD COLUMN IF NOT EXISTS next_retry_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS queue_position integer,
ADD COLUMN IF NOT EXISTS priority integer DEFAULT 5,
ADD COLUMN IF NOT EXISTS provider text;

-- Create index for queue ordering
CREATE INDEX IF NOT EXISTS idx_video_generations_queue 
ON public.video_generations (status, priority DESC, created_at ASC)
WHERE status = 'processing' OR status = 'pending';

-- Create index for retry lookup
CREATE INDEX IF NOT EXISTS idx_video_generations_retry 
ON public.video_generations (next_retry_at)
WHERE next_retry_at IS NOT NULL AND status = 'pending';

-- Function to calculate queue position
CREATE OR REPLACE FUNCTION public.calculate_queue_position()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('pending', 'processing') THEN
    SELECT COUNT(*) + 1 INTO NEW.queue_position
    FROM video_generations
    WHERE status IN ('pending', 'processing')
      AND (priority > NEW.priority OR (priority = NEW.priority AND created_at < NEW.created_at));
  ELSE
    NEW.queue_position = NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for queue position calculation
DROP TRIGGER IF EXISTS calculate_queue_position_trigger ON public.video_generations;
CREATE TRIGGER calculate_queue_position_trigger
BEFORE INSERT OR UPDATE OF status, priority ON public.video_generations
FOR EACH ROW
EXECUTE FUNCTION public.calculate_queue_position();