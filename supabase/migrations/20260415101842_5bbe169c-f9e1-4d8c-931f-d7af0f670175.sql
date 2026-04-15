
-- Create storage bucket for story mode reference images
INSERT INTO storage.buckets (id, name, public)
VALUES ('story-references', 'story-references', true);

-- Allow public read access
CREATE POLICY "Story references are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'story-references');

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload their own story references"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'story-references' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to delete their own references
CREATE POLICY "Users can delete their own story references"
ON storage.objects FOR DELETE
USING (bucket_id = 'story-references' AND auth.uid()::text = (storage.foldername(name))[1]);
