-- Create table for API operation logs
CREATE TABLE public.api_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  operation TEXT NOT NULL,
  api_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.api_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own logs"
ON public.api_logs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own logs"
ON public.api_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own logs"
ON public.api_logs
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_api_logs_user_created ON public.api_logs(user_id, created_at DESC);
CREATE INDEX idx_api_logs_status ON public.api_logs(status);
CREATE INDEX idx_api_logs_api_name ON public.api_logs(api_name);