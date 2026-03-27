
-- Drop overly permissive policy and rely on security definer trigger instead
DROP POLICY IF EXISTS "Service can insert profiles" ON public.profiles;
