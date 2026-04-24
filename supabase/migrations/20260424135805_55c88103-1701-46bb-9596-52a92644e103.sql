-- Voice mappings: map ElevenLabs voice IDs to Inworld voice names
CREATE TABLE public.voice_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  elevenlabs_voice_id TEXT NOT NULL UNIQUE,
  elevenlabs_voice_name TEXT NOT NULL,
  inworld_voice_name TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookup
CREATE INDEX idx_voice_mappings_eleven_id ON public.voice_mappings(elevenlabs_voice_id);

-- Enable RLS
ALTER TABLE public.voice_mappings ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read mappings (so edge fns and clients can resolve voices)
CREATE POLICY "Authenticated users can view voice mappings"
ON public.voice_mappings
FOR SELECT
TO authenticated
USING (true);

-- Only admins can insert/update/delete
CREATE POLICY "Admins can insert voice mappings"
ON public.voice_mappings
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update voice mappings"
ON public.voice_mappings
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete voice mappings"
ON public.voice_mappings
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Auto-update timestamp
CREATE TRIGGER update_voice_mappings_updated_at
BEFORE UPDATE ON public.voice_mappings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default mappings (matches the hard-coded VOICE_MAP in inworld-tts edge function)
INSERT INTO public.voice_mappings (elevenlabs_voice_id, elevenlabs_voice_name, inworld_voice_name) VALUES
  ('EXAVITQu4vr4xnSDxMaL', 'Sarah',    'Sarah'),
  ('JBFqnCBsd6RMkjVDRZzb', 'George',   'Edward'),
  ('onwK4e9ZLuTAKqWW03F9', 'Daniel',   'Mark'),
  ('pFZP5JQG7iQjIQuC4Bku', 'Lily',     'Olivia'),
  ('TX3LPaxmHKxFdv7VOQHJ', 'Liam',     'Liam'),
  ('XrExE9yKIg1WjnnlVkGX', 'Matilda',  'Ashley'),
  ('9BWtsMINqrJLrRacOk9x', 'Aria',     'Julia'),
  ('CwhRBWXzGAHq8TQ4Fs17', 'Roger',    'Roger'),
  ('FGY2WhTYpPnrIDTdsKH5', 'Laura',    'Wendy'),
  ('IKne3meq5aSn9XLyUdCD', 'Charlie',  'Alex'),
  ('N2lVS1w4EtoT3dr4eOWO', 'Callum',   'Dennis'),
  ('SAz9YHcvj6GT2YYXdXww', 'River',    'Priya'),
  ('Xb7hH8MSUJpSbSDYk0k2', 'Alice',    'Deborah'),
  ('bIHbv24MWmeRgasZH58o', 'Will',     'Theodore'),
  ('cgSgspJ2msm6clMCkdW9', 'Jessica',  'Pixie'),
  ('cjVigY5qzO86Huf0OWal', 'Eric',     'Ronald'),
  ('iP95p4xoKVk53GoZ742B', 'Chris',    'Craig'),
  ('nPczCjzI2devNBz1zQrb', 'Brian',    'Hades');
