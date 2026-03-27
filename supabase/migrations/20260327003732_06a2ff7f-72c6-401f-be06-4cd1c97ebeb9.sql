
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Service role can update notifications" ON public.json2video_render_notifications;

-- The existing "Users can update their own notifications" policy already covers user updates.
-- Edge functions use the service role key which bypasses RLS entirely,
-- so no replacement policy is needed for service role access.
