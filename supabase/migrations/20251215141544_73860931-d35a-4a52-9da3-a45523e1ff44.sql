-- 1. Fix RLS for video_generations - deny anonymous access explicitly
CREATE POLICY "Deny anonymous access to video_generations"
ON public.video_generations
FOR ALL
TO anon
USING (false);

-- 2. Update storage bucket to private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'generated-videos';

-- 3. Remove old public read policy and create proper RLS
DROP POLICY IF EXISTS "Anyone can view videos" ON storage.objects;
DROP POLICY IF EXISTS "Public access to generated videos" ON storage.objects;

-- 4. Create storage policy allowing authenticated users to view their own videos
CREATE POLICY "Users can view their own videos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'generated-videos' AND
  EXISTS (
    SELECT 1 FROM public.video_generations vg
    WHERE vg.video_url LIKE '%' || storage.objects.name
    AND vg.user_id = auth.uid()
  )
);

-- 5. Keep service role upload policy
DROP POLICY IF EXISTS "Service role can upload videos" ON storage.objects;
CREATE POLICY "Service role can upload videos"
ON storage.objects
FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'generated-videos');

-- 6. Service role can delete videos
CREATE POLICY "Service role can delete videos"
ON storage.objects
FOR DELETE
TO service_role
USING (bucket_id = 'generated-videos');