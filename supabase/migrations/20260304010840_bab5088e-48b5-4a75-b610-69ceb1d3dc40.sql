
CREATE TABLE public.audio_effect_presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.audio_effect_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own presets" ON public.audio_effect_presets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own presets" ON public.audio_effect_presets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own presets" ON public.audio_effect_presets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own presets" ON public.audio_effect_presets FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER handle_audio_effect_presets_updated_at
  BEFORE UPDATE ON public.audio_effect_presets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
