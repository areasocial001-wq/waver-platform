-- Create storage bucket for edited frames
INSERT INTO storage.buckets (id, name, public)
VALUES ('edited-frames', 'edited-frames', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload frames
CREATE POLICY "Users can upload edited frames"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'edited-frames' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow public read access for video generation APIs
CREATE POLICY "Public read access for edited frames"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'edited-frames');

-- Allow users to delete their own frames
CREATE POLICY "Users can delete their own frames"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'edited-frames' AND auth.uid()::text = (storage.foldername(name))[1]);