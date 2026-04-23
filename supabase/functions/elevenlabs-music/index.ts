import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const requestSchema = z.object({
  prompt: z.string().min(1, 'Prompt obbligatorio').max(1000, 'Prompt troppo lungo'),
  category: z.enum(['music', 'sfx', 'ambient']).default('music'),
  duration: z.number().min(1).default(30).transform(v => Math.min(Math.max(v, 1), 300)),
});

const isLikelyMp3 = (bytes: Uint8Array): boolean => {
  if (bytes.length < 4) return false;
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true;
  if (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0) return true;
  return false;
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    const parseResult = requestSchema.safeParse(body);
    if (!parseResult.success) {
      return jsonResponse({ error: parseResult.error.errors[0].message }, 400);
    }

    const { prompt, category, duration } = parseResult.data;
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');

    if (!ELEVENLABS_API_KEY) {
      return jsonResponse({
        error: 'ELEVENLABS_API_KEY is not configured',
        reason: 'elevenlabs_missing_key',
        fallback: true,
      }, 200);
    }

    console.log('Generating audio:', { category, prompt: prompt.substring(0, 100), duration });

    // Retry budget. For 429 (concurrent_limit_exceeded) we wait significantly
    // longer because the user's plan caps at 2 concurrent ElevenLabs calls and
    // music gen is by far the slowest one — a quick retry is guaranteed to fail.
    const MAX_ATTEMPTS = 4;
    let lastStatus = 0;
    let lastError = "Unknown error";
    let audioBuffer: ArrayBuffer | null = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        let response: Response;
        if (category === 'sfx') {
          response = await fetch(
            'https://api.elevenlabs.io/v1/sound-generation',
            {
              method: 'POST',
              headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
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
            : `Background music: ${prompt}. Single consistent track from start to end, instrumental only, no vocals, no genre changes, no abrupt intro or outro, smooth and even dynamics suitable for video underscore.`;

          response = await fetch(
            'https://api.elevenlabs.io/v1/music',
            {
              method: 'POST',
              headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt: enhancedPrompt, duration_seconds: duration }),
            }
          );
        }

        if (!response.ok) {
          lastStatus = response.status;
          const errorText = await response.text();
          lastError = `ElevenLabs ${response.status}: ${errorText.slice(0, 200)}`;
          console.error(`Attempt ${attempt}/${MAX_ATTEMPTS} failed:`, lastError);

          // Non-retryable: insufficient credits / unauthorized → fail fast with fallback flag.
          if (response.status === 401 || response.status === 402) {
            break;
          }

          if (attempt < MAX_ATTEMPTS) {
            // 429 → much longer wait (concurrent slot needs to free up).
            // Others → linear backoff.
            const waitMs = response.status === 429
              ? 5000 + attempt * 3000   // 8s, 11s, 14s
              : 1000 * attempt;
            await new Promise(r => setTimeout(r, waitMs));
            continue;
          }
          break;
        }

        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);

        if (!isLikelyMp3(bytes)) {
          lastError = `Risposta audio corrotta (${bytes.length} bytes, no MP3 header)`;
          console.error(`Attempt ${attempt}/${MAX_ATTEMPTS} failed:`, lastError);
          if (attempt < MAX_ATTEMPTS) {
            await new Promise(r => setTimeout(r, 1000 * attempt));
            continue;
          }
          break;
        }

        audioBuffer = buffer;
        console.log(`Audio generated successfully on attempt ${attempt}, size: ${bytes.length}`);
        break;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        if (attempt >= MAX_ATTEMPTS) break;
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }

    if (!audioBuffer) {
      // ── AIML FALLBACK ──────────────────────────────────────────────
      // Before giving up, try AIML API (Suno) for music/ambient. SFX
      // generation isn't supported by Suno so we skip the fallback there.
      const AIML_API_KEY = Deno.env.get("AIML_API_KEY");
      const fallbackEligible =
        AIML_API_KEY &&
        category !== "sfx" &&
        (lastStatus === 401 || lastStatus === 402 || lastStatus === 429);

      if (fallbackEligible) {
        try {
          console.log(`[fallback] ElevenLabs ${lastStatus} → trying AIML Suno (category=${category})`);
          const aimlPrompt = category === "ambient"
            ? `Ambient soundscape, instrumental only, seamless and atmospheric: ${prompt}`
            : `Background instrumental music, no vocals, smooth and even dynamics suitable for video underscore: ${prompt}`;

          // 1) Submit generation task
          const submitRes = await fetch("https://api.aimlapi.com/v2/generate/audio", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${AIML_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "stable-audio",
              prompt: aimlPrompt,
              seconds_total: Math.min(Math.max(duration, 1), 47),
              steps: 100,
            }),
          });

          if (submitRes.ok) {
            const submitData = await submitRes.json();
            const generationId = submitData.id || submitData.generation_id;

            if (generationId) {
              // 2) Poll for completion (max 90s)
              let aimlAudioUrl: string | null = null;
              for (let i = 0; i < 30; i++) {
                await new Promise(r => setTimeout(r, 3000));
                const statusRes = await fetch(
                  `https://api.aimlapi.com/v2/generate/audio?generation_id=${generationId}`,
                  { headers: { "Authorization": `Bearer ${AIML_API_KEY}` } }
                );
                if (!statusRes.ok) continue;
                const statusData = await statusRes.json();
                if (statusData.status === "completed" || statusData.audio_file?.url) {
                  aimlAudioUrl = statusData.audio_file?.url || statusData.url;
                  break;
                }
                if (statusData.status === "failed" || statusData.status === "error") {
                  throw new Error(`AIML generation failed: ${statusData.error || "unknown"}`);
                }
              }

              // 3) Download the audio
              if (aimlAudioUrl) {
                const audioRes = await fetch(aimlAudioUrl);
                if (audioRes.ok) {
                  const fallbackBuffer = await audioRes.arrayBuffer();
                  const fallbackBase64 = base64Encode(fallbackBuffer);
                  console.log(`[fallback] AIML Suno success: ${fallbackBuffer.byteLength} bytes`);
                  return jsonResponse({
                    audioContent: fallbackBase64,
                    format: "mp3",
                    category,
                    duration,
                    bytes: fallbackBuffer.byteLength,
                    provider: "aiml",
                    fallbackUsed: true,
                    fallbackReason: lastStatus === 429 ? "elevenlabs_rate_limited" : "elevenlabs_credits_exhausted",
                  }, 200);
                }
              }
            }
          } else {
            const errTxt = await submitRes.text();
            console.error(`[fallback] AIML submit failed: ${submitRes.status} ${errTxt.slice(0, 200)}`);
          }
        } catch (fallbackErr) {
          console.error("[fallback] AIML music fallback error:", fallbackErr);
        }
      }

      // Translate ElevenLabs failure into a graceful fallback so the client
      // doesn't crash with a 500 — Story Mode can proceed without music.
      const reason =
        lastStatus === 429 ? "elevenlabs_rate_limited" :
        lastStatus === 401 ? "elevenlabs_unauthorized" :
        lastStatus === 402 ? "elevenlabs_insufficient_credits" :
        "elevenlabs_error";
      return jsonResponse({
        error: lastError,
        reason,
        status: lastStatus,
        fallback: true,
      }, 200);
    }

    const base64Audio = base64Encode(audioBuffer);

    return jsonResponse({
      audioContent: base64Audio,
      format: 'mp3',
      category,
      duration,
      bytes: audioBuffer.byteLength,
    }, 200);
  } catch (error) {
    console.error('Error in elevenlabs-music function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({
      error: errorMessage,
      reason: "internal_error",
      fallback: true,
    }, 200);
  }
});
