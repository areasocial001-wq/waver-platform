import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
// NOTE: Story Mode needs ONE music track that covers the WHOLE final video,
// so we no longer cap to 30s. Hard upper bound 300s (5 min) keeps abuse limited
// while giving enough headroom for typical Story Mode outputs (8 scenes × 10s = 80s).
const requestSchema = z.object({
  prompt: z.string().min(1, 'Prompt obbligatorio').max(1000, 'Prompt troppo lungo'),
  category: z.enum(['music', 'sfx', 'ambient']).default('music'),
  duration: z.number().min(1).default(30).transform(v => Math.min(Math.max(v, 1), 300)),
});

// Verify the response bytes look like a real MP3 (magic bytes: ID3 tag or MPEG sync 0xFF Ex).
// ElevenLabs occasionally returns truncated/corrupted bodies under load → we want to fail
// FAST so the client retries instead of uploading a broken file to storage.
const isLikelyMp3 = (bytes: Uint8Array): boolean => {
  if (bytes.length < 4) return false;
  // ID3v2 header
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true;
  // MPEG frame sync: 11 bits set → first byte 0xFF, second byte 0xE? or 0xF?
  if (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0) return true;
  return false;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    // Validate input
    const parseResult = requestSchema.safeParse(body);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: parseResult.error.errors[0].message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { prompt, category, duration } = parseResult.data;
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');

    if (!ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }

    console.log('Generating audio:', { category, prompt: prompt.substring(0, 100), duration });

    // Server-side retry: ElevenLabs music endpoint occasionally returns 5xx or truncated
    // payloads. We retry up to 3 times with linear backoff before giving up.
    const MAX_ATTEMPTS = 3;
    let lastError: string = "Unknown error";
    let audioBuffer: ArrayBuffer | null = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        let response: Response;
        if (category === 'sfx') {
          response = await fetch(
            'https://api.elevenlabs.io/v1/sound-generation',
            {
              method: 'POST',
              headers: {
                'xi-api-key': ELEVENLABS_API_KEY,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                text: prompt,
                duration_seconds: Math.min(duration, 22),
                prompt_influence: 0.3,
              }),
            }
          );
        } else {
          const enhancedPrompt = category === 'ambient'
            ? `Ambient soundscape: ${prompt}. Seamless, loopable, atmospheric, no abrupt changes, consistent texture throughout.`
            // For music we explicitly ask for a SINGLE consistent track so it works as a unified
            // bed under multiple scenes — no genre changes, no intros/outros that would clash
            // with crossfades between scenes.
            : `Background music: ${prompt}. Single consistent track from start to end, instrumental only, no vocals, no genre changes, no abrupt intro or outro, smooth and even dynamics suitable for video underscore.`;

          response = await fetch(
            'https://api.elevenlabs.io/v1/music',
            {
              method: 'POST',
              headers: {
                'xi-api-key': ELEVENLABS_API_KEY,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                prompt: enhancedPrompt,
                duration_seconds: duration,
              }),
            }
          );
        }

        if (!response.ok) {
          const errorText = await response.text();
          lastError = `ElevenLabs ${response.status}: ${errorText.slice(0, 200)}`;
          console.error(`Attempt ${attempt}/${MAX_ATTEMPTS} failed:`, lastError);
          if (attempt < MAX_ATTEMPTS) {
            await new Promise(r => setTimeout(r, 1000 * attempt));
            continue;
          }
          throw new Error(lastError);
        }

        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);

        // Validate MP3 magic bytes — only meaningful for music/ambient (mp3) responses,
        // SFX endpoint also returns mp3 by default.
        if (!isLikelyMp3(bytes)) {
          lastError = `Risposta audio corrotta (${bytes.length} bytes, no MP3 header)`;
          console.error(`Attempt ${attempt}/${MAX_ATTEMPTS} failed:`, lastError);
          if (attempt < MAX_ATTEMPTS) {
            await new Promise(r => setTimeout(r, 1000 * attempt));
            continue;
          }
          throw new Error(lastError);
        }

        audioBuffer = buffer;
        console.log(`Audio generated successfully on attempt ${attempt}, size: ${bytes.length}`);
        break;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        if (attempt >= MAX_ATTEMPTS) throw err;
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }

    if (!audioBuffer) throw new Error(lastError);

    const base64Audio = base64Encode(audioBuffer);

    return new Response(
      JSON.stringify({
        audioContent: base64Audio,
        format: 'mp3',
        category,
        duration,
        bytes: audioBuffer.byteLength,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in elevenlabs-music function:', error);
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
