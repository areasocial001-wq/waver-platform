import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ElevenLabs default voice IDs → Inworld voice names (used by the fallback path)
const ELEVENLABS_TO_INWORLD_VOICE: Record<string, string> = {
  'EXAVITQu4vr4xnSDxMaL': 'Sarah',
  'JBFqnCBsd6RMkjVDRZzb': 'Edward',
  'onwK4e9ZLuTAKqWW03F9': 'Mark',
  'pFZP5JQG7iQjIQuC4Bku': 'Olivia',
  'TX3LPaxmHKxFdv7VOQHJ': 'Liam',
  'XrExE9yKIg1WjnnlVkGX': 'Ashley',
  '9BWtsMINqrJLrRacOk9x': 'Julia',
  'CwhRBWXzGAHq8TQ4Fs17': 'Roger',
};
function mapElevenLabsToInworld(voiceId: string): string {
  return ELEVENLABS_TO_INWORLD_VOICE[voiceId] || 'Sarah';
}

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

      // ── NO DIRECT OPENAI FALLBACK ──────────────────────────────────
      // Direct calls to api.openai.com are FORBIDDEN in this project to
      // avoid uncontrolled costs on the user's OpenAI account.
      const primaryFallbackReason = response.status === 429
        ? 'elevenlabs_rate_limited'
        : response.status === 401 || response.status === 402
          ? 'elevenlabs_insufficient_credits'
          : 'elevenlabs_unavailable';

      if (response.status === 401 || response.status === 402 || response.status === 429) {
        // ── INWORLD FALLBACK ────────────────────────────────────────
        // For DEFAULT voices we transparently retry on Inworld TTS.
        // For CLONED voices we keep returning a structured `fallback`
        // signal so the client can prompt the user (timbres are not
        // interchangeable across providers).
        const INWORLD_API_KEY = Deno.env.get('INWORLD_API_KEY');
        if (!isClonedVoice && INWORLD_API_KEY) {
          console.log('[elevenlabs-tts] falling back to Inworld for default voice', selectedVoiceId);
          try {
            const inworldVoice = mapElevenLabsToInworld(selectedVoiceId);
            const inworldResp = await fetch('https://api.inworld.ai/tts/v1/voice', {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${INWORLD_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                text,
                voiceId: inworldVoice,
                modelId: 'inworld-tts-1.5',
              }),
            });

            if (inworldResp.ok) {
              const ct = inworldResp.headers.get('content-type') || '';
              let base64: string;
              if (ct.includes('application/json')) {
                const j = await inworldResp.json();
                base64 = j.audioContent || j.audio;
                if (!base64) throw new Error('Inworld response missing audioContent');
              } else {
                const buf = await inworldResp.arrayBuffer();
                const u8 = new Uint8Array(buf);
                let binary = '';
                const chunkSize = 0x8000;
                for (let i = 0; i < u8.length; i += chunkSize) {
                  const chunk = u8.subarray(i, Math.min(i + chunkSize, u8.length));
                  binary += String.fromCharCode.apply(null, [...chunk]);
                }
                base64 = btoa(binary);
              }
              console.log('[elevenlabs-tts] Inworld fallback success, base64 length:', base64.length);
              return new Response(
                JSON.stringify({
                  audioContent: base64,
                  format: 'wav',
                  provider: 'inworld',
                  fellBackFrom: 'elevenlabs',
                  reason: primaryFallbackReason,
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            } else {
              const inworldErr = await inworldResp.text();
              console.error('[elevenlabs-tts] Inworld fallback also failed:', inworldResp.status, inworldErr);
            }
          } catch (fbErr) {
            console.error('[elevenlabs-tts] Inworld fallback exception:', fbErr);
          }
        }

        return new Response(
          JSON.stringify({
            fallback: true,
            reason: primaryFallbackReason,
            status: response.status,
            error: response.status === 429
              ? 'Provider audio momentaneamente occupato. Riprova tra poco.'
              : isClonedVoice
                ? 'Crediti ElevenLabs esauriti. La voce clonata non può essere sostituita con un altro provider — ricarica i crediti ElevenLabs.'
                : 'Crediti ElevenLabs esauriti e fallback Inworld non disponibile.',
            providerMessage: isClonedVoice ? 'cloned_voice_no_fallback' : 'elevenlabs_no_backup',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
