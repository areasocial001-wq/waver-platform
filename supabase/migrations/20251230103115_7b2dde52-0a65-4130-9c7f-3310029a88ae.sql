-- Add columns for public sharing of workflows
ALTER TABLE public.ai_workflows 
ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN share_code TEXT UNIQUE;

-- Create policy for viewing public workflows
CREATE POLICY "Anyone can view public workflows"
  ON public.ai_workflows
  FOR SELECT
  USING (is_public = true);

-- Create index for share_code lookups
CREATE INDEX idx_ai_workflows_share_code ON public.ai_workflows(share_code) WHERE share_code IS NOT NULL;