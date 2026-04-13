
-- Fix 1: Remove overly permissive storage policies on generated-videos bucket
DROP POLICY IF EXISTS "Public video read access" ON storage.objects;
DROP POLICY IF EXISTS "Service role video upload" ON storage.objects;

-- Re-create INSERT policy for service_role only
CREATE POLICY "Service role video upload"
ON storage.objects
FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'generated-videos');

-- Fix 2: Add RESTRICTIVE policy on user_roles to prevent privilege escalation
CREATE POLICY "Restrict inserts to admins only"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
);
