-- Remove the public read policy from edited-frames bucket that bypasses the private bucket setting
DROP POLICY IF EXISTS "Public read access for edited frames" ON storage.objects;