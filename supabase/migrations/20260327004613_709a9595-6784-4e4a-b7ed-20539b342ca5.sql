
-- Create separate table for share passwords
CREATE TABLE public.storyboard_share_passwords (
    storyboard_id UUID PRIMARY KEY REFERENCES public.storyboards(id) ON DELETE CASCADE,
    share_password TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.storyboard_share_passwords ENABLE ROW LEVEL SECURITY;

-- Only owners can access their passwords
CREATE POLICY "Owner can select their share password"
ON public.storyboard_share_passwords
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.storyboards
        WHERE storyboards.id = storyboard_share_passwords.storyboard_id
        AND storyboards.user_id = auth.uid()
    )
);

CREATE POLICY "Owner can insert their share password"
ON public.storyboard_share_passwords
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.storyboards
        WHERE storyboards.id = storyboard_share_passwords.storyboard_id
        AND storyboards.user_id = auth.uid()
    )
);

CREATE POLICY "Owner can update their share password"
ON public.storyboard_share_passwords
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.storyboards
        WHERE storyboards.id = storyboard_share_passwords.storyboard_id
        AND storyboards.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.storyboards
        WHERE storyboards.id = storyboard_share_passwords.storyboard_id
        AND storyboards.user_id = auth.uid()
    )
);

CREATE POLICY "Owner can delete their share password"
ON public.storyboard_share_passwords
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.storyboards
        WHERE storyboards.id = storyboard_share_passwords.storyboard_id
        AND storyboards.user_id = auth.uid()
    )
);

-- Migrate existing data
INSERT INTO public.storyboard_share_passwords (storyboard_id, share_password)
SELECT id, share_password
FROM public.storyboards
WHERE share_password IS NOT NULL;

-- Drop the column from storyboards
ALTER TABLE public.storyboards DROP COLUMN share_password;
