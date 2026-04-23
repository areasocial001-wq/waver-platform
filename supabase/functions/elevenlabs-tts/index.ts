import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
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

  // Try getClaims first, fall back to getUser
  let userId: string | undefined;
  try {
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (!claimsError && claimsData?.claims) {
      userId = claimsData.claims.sub as string;
    }
  } catch (_) {
    // getClaims not available in this SDK version
  }

  if (!userId) {
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData?.user) {
      console.error('JWT validation failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    userId = userData.user.id;
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

    // Detect if voice is cloned (not in default list)
    const defaultVoiceIds = [
      'EXAVITQu4vr4xnSDxMaL', 'JBFqnCBsd6RMkjVDRZzb', 'onwK4e9ZLuTAKqWW03F9',
      'pFZP5JQG7iQjIQuC4Bku', 'TX3LPaxmHKxFdv7VOQHJ', 'XrExE9yKIg1WjnnlVkGX',
      '9BWtsMINqrJLrRacOk9x', 'CwhRBWXzGAHq8TQ4Fs17',
    ];
    const isClonedVoice = !defaultVoiceIds.includes(selectedVoiceId);

    // Higher stability for cloned voices to reduce artifacts/noise
    const voiceStability = stability ?? (isClonedVoice ? 0.7 : 0.5);
    const voiceSimilarity = similarityBoost ?? 0.75;
    // Lower style for cloned voices to reduce distortion
    const voiceStyle = style ?? (isClonedVoice ? 0.2 : 0.5);
    // Cloned voices tend to speak faster; use 0.85 as default
    const voiceSpeed = speed ?? (isClonedVoice ? 0.85 : 1.0);
    // Clamp to API limits
    const clampedSpeed = Math.max(0.7, Math.min(1.2, voiceSpeed));
    
    // Disable speaker boost for cloned voices to prevent mic noise amplification
    const useSpeakerBoost = !isClonedVoice;
    
    // Default to Italian if no language specified
    const selectedLanguage = languageCode || 'it';

    console.log('Generating TTS for text:', text.substring(0, 100) + '...');
    console.log('Using voice ID:', selectedVoiceId, isClonedVoice ? '(cloned)' : '(default)');
    console.log('Language code:', selectedLanguage);
    console.log('Settings - Speed:', clampedSpeed, 'Stability:', voiceStability, 'Similarity:', voiceSimilarity, 'Style:', voiceStyle, 'SpeakerBoost:', useSpeakerBoost);

    // CRITICAL: output_format must be a query parameter, NOT in the body
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          language_code: selectedLanguage,
          voice_settings: {
            stability: voiceStability,
            similarity_boost: voiceSimilarity,
            style: voiceStyle,
            use_speaker_boost: useSpeakerBoost,
            speed: clampedSpeed,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', response.status, errorText);

      // ── AIML FALLBACK ──────────────────────────────────────────────
      // When ElevenLabs is out of credits / rate-limited / unauthorized,
      // route TTS through AIML's OpenAI TTS-1-HD so Story Mode keeps
      // producing voice-overs.
      const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
      const fallbackEligible =
        OPENAI_API_KEY &&
        (response.status === 401 || response.status === 402 || response.status === 429);

      if (fallbackEligible) {
        try {
          console.log(`[fallback] ElevenLabs TTS ${response.status} → trying OpenAI TTS-1-HD`);
          const openAiVoice = selectedLanguage === 'it' ? 'nova' : 'alloy';
          const openAiRes = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'tts-1-hd',
              input: text,
              voice: openAiVoice,
              response_format: 'mp3',
              speed: clampedSpeed,
            }),
          });

          if (openAiRes.ok) {
            const fallbackBuffer = await openAiRes.arrayBuffer();
            const fbBase64 = base64Encode(fallbackBuffer);
            console.log(`[fallback] OpenAI TTS success: ${fallbackBuffer.byteLength} bytes`);
            return new Response(
              JSON.stringify({
                audioContent: fbBase64,
                format: 'mp3',
                provider: 'openai',
                fallbackUsed: true,
                fallbackReason: response.status === 429
                  ? 'elevenlabs_rate_limited'
                  : response.status === 401 || response.status === 402
                    ? 'elevenlabs_insufficient_credits'
                    : 'elevenlabs_unavailable',
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          } else {
            const openAiErr = await openAiRes.text();
            console.error(`[fallback] OpenAI TTS failed: ${openAiRes.status} ${openAiErr.slice(0, 200)}`);
          }
        } catch (fbErr) {
          console.error('[fallback] OpenAI TTS error:', fbErr);
        }
      }

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
