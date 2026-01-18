-- Create a public bucket for audio files used in transcription
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-uploads', 'audio-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload audio files
CREATE POLICY "Users can upload audio files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'audio-uploads');

-- Allow public read access to audio files (needed for transcription API)
CREATE POLICY "Audio files are publicly accessible"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'audio-uploads');

-- Allow users to delete their own audio files
CREATE POLICY "Users can delete own audio files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'audio-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);