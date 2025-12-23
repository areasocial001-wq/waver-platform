-- Remove the problematic restrictive policy that blocks all access
DROP POLICY IF EXISTS "Deny anonymous access to video_generations" ON video_generations;