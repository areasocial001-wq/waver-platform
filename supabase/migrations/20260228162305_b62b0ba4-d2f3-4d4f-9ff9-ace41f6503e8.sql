-- Allow service role to update (upsert) videos in generated-videos bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Service role can update videos' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Service role can update videos"
    ON storage.objects FOR UPDATE
    TO service_role
    USING (bucket_id = 'generated-videos');
  END IF;
END $$;