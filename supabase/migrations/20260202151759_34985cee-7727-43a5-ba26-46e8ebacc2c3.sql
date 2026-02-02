-- Create table for JSON2Video templates with variables
CREATE TABLE public.json2video_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  -- Template with variable placeholders like {{product_name}}
  template_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Variable definitions with default values
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Preview thumbnail
  thumbnail_url TEXT,
  -- Metadata
  is_public BOOLEAN NOT NULL DEFAULT false,
  category TEXT NOT NULL DEFAULT 'custom',
  tags TEXT[] DEFAULT '{}'::text[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.json2video_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can create their own templates" 
  ON public.json2video_templates FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own templates" 
  ON public.json2video_templates FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view public templates" 
  ON public.json2video_templates FOR SELECT 
  USING (is_public = true);

CREATE POLICY "Users can update their own templates" 
  ON public.json2video_templates FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates" 
  ON public.json2video_templates FOR DELETE 
  USING (auth.uid() = user_id);

-- Create table for JSON2Video render webhooks/notifications
CREATE TABLE public.json2video_render_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id TEXT NOT NULL,
  render_project_id TEXT NOT NULL,
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending',
  -- Render result
  video_url TEXT,
  video_duration NUMERIC,
  video_size BIGINT,
  error_message TEXT,
  -- Timestamps
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  -- Notification sent
  notified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.json2video_render_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own notifications" 
  ON public.json2video_render_notifications FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own notifications" 
  ON public.json2video_render_notifications FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" 
  ON public.json2video_render_notifications FOR UPDATE 
  USING (auth.uid() = user_id);

-- Allow edge functions to update via service role
CREATE POLICY "Service role can update notifications" 
  ON public.json2video_render_notifications FOR UPDATE 
  USING (true);

-- Index for efficient lookups
CREATE INDEX idx_json2video_notifications_render_project 
  ON public.json2video_render_notifications(render_project_id);

CREATE INDEX idx_json2video_notifications_user_status 
  ON public.json2video_render_notifications(user_id, status);

-- Trigger for updated_at on templates
CREATE TRIGGER update_json2video_templates_updated_at
  BEFORE UPDATE ON public.json2video_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for notifications (for instant updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.json2video_render_notifications;