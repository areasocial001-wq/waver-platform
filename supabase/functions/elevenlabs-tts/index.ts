import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const requestSchema = z.object({
  text: z.string().min(1, 'Testo obbligatorio').max(5000, 'Testo troppo lungo'),
  voiceId: z.string().max(100).optional(),
  speed: z.number().min(0.5).max(2.0).optional(),
  stability: z.number().min(0).max(1).optional(),
  similarityBoost: z.number().min(0).max(1).optional(),
  style: z.number().min(0).max(1).optional(),
  languageCode: z.string().length(2).optional(), // ISO 639-1 code (e.g., "it", "en")
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // JWT validation
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Missing authorization header' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const token = authHeader.replace('Bearer ', '');
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    console.error('JWT validation failed:', claimsError);
    return new Response(
      JSON.stringify({ error: 'Invalid authentication token' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json();
    
    // Handle health check requests
    if (body.healthCheck) {
      return new Response(
        JSON.stringify({ status: 'ok', service: 'elevenlabs-tts' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate input
    const parseResult = requestSchema.safeParse(body);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: parseResult.error.errors[0].message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { text, voiceId, speed, stability, similarityBoost, style, languageCode } = parseResult.data;
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');

    if (!ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }

    // Default to a natural Italian voice if not specified
    const selectedVoiceId = voiceId || 'EXAVITQu4vr4xnSDxMaL'; // Sarah - natural multilingual voice

    // Use provided values or sensible defaults
    const voiceStability = stability ?? 0.5;
    const voiceSimilarity = similarityBoost ?? 0.75;
    const voiceStyle = style ?? 0.5;
    const voiceSpeed = Math.max(0.7, Math.min(1.2, speed ?? 1.0));
    
    // Default to Italian if no language specified
    const selectedLanguage = languageCode || 'it';

    console.log('Generating TTS for text:', text.substring(0, 100) + '...');
    console.log('Using voice ID:', selectedVoiceId);
    console.log('Language code:', selectedLanguage);
    console.log('Settings - Speed:', voiceSpeed, 'Stability:', voiceStability, 'Similarity:', voiceSimilarity, 'Style:', voiceStyle);

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          output_format: 'mp3_44100_128',
          language_code: selectedLanguage, // Force specific language pronunciation
          voice_settings: {
            stability: voiceStability,
            similarity_boost: voiceSimilarity,
            style: voiceStyle,
            use_speaker_boost: true,
            speed: voiceSpeed,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', response.status, errorText);
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    console.log('Audio generated successfully, size:', audioBuffer.byteLength);

    // Convert to base64 for easier frontend handling
    const uint8Array = new Uint8Array(audioBuffer);
    let binary = '';
    const chunkSize = 0x8000;
    
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binary += String.fromCharCode.apply(null, [...chunk]);
    }
    
    const base64Audio = btoa(binary);

    return new Response(
      JSON.stringify({ 
        audioContent: base64Audio,
        format: 'mp3'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in elevenlabs-tts function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
