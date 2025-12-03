-- Create storage bucket for generated videos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('generated-videos', 'generated-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy for public read access
CREATE POLICY "Public video read access" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'generated-videos');

-- Create policy for service role upload
CREATE POLICY "Service role video upload" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'generated-videos');