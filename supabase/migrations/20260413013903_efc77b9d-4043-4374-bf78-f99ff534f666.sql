
-- Fix 1: audio-uploads INSERT policy - enforce folder ownership
DROP POLICY IF EXISTS "Users can upload audio files" ON storage.objects;
CREATE POLICY "Users can upload audio files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'audio-uploads' 
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Fix 2: edited-frames - make bucket private
UPDATE storage.buckets SET public = false WHERE id = 'edited-frames';

-- Fix 3: edited-frames - drop overly permissive SELECT policy and replace with owner-scoped
DROP POLICY IF EXISTS "Public edited frames access" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view edited frames" ON storage.objects;

CREATE POLICY "Users can view their own edited frames"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'edited-frames'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Fix 4: edited-frames - fix INSERT policy to enforce folder ownership
DROP POLICY IF EXISTS "Users can upload edited frames" ON storage.objects;
CREATE POLICY "Users can upload edited frames"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'edited-frames'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Fix 5: edited-frames - add DELETE policy scoped to owner
DROP POLICY IF EXISTS "Users can delete edited frames" ON storage.objects;
CREATE POLICY "Users can delete edited frames"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'edited-frames'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);
