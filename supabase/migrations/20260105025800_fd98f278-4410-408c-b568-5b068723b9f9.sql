-- Create the update_updated_at_column function first
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create table for API status history (for uptime chart)
CREATE TABLE public.api_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  api_name TEXT NOT NULL,
  status TEXT NOT NULL,
  response_time INTEGER,
  checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.api_status_history ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own status history"
ON public.api_status_history
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own status history"
ON public.api_status_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own status history"
ON public.api_status_history
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for efficient queries
CREATE INDEX idx_api_status_history_user_api_time 
ON public.api_status_history (user_id, api_name, checked_at DESC);

-- Create table for API threshold settings
CREATE TABLE public.api_threshold_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  thresholds JSONB NOT NULL DEFAULT '{
    "Replicate": {"warning": 1000, "critical": 3000},
    "Freepik": {"warning": 1000, "critical": 3000},
    "Shotstack": {"warning": 1000, "critical": 3000},
    "ElevenLabs": {"warning": 1000, "critical": 3000}
  }'::jsonb,
  notify_on_status_change BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.api_threshold_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own settings"
ON public.api_threshold_settings
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own settings"
ON public.api_threshold_settings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
ON public.api_threshold_settings
FOR UPDATE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_api_threshold_settings_updated_at
BEFORE UPDATE ON public.api_threshold_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();