-- Add share_password column to storyboards table for password-protected sharing
ALTER TABLE public.storyboards 
ADD COLUMN share_password text DEFAULT NULL;

-- Add index for better query performance
CREATE INDEX idx_storyboards_share_password ON public.storyboards(share_password) WHERE share_password IS NOT NULL;

COMMENT ON COLUMN public.storyboards.share_password IS 'Password for protected sharing. NULL means no password protection.';