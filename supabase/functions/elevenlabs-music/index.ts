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
  // 'auto' = try ElevenLabs first then fall back to AIML.
  // 'aiml' = skip ElevenLabs entirely (user preference / EL credits exhausted).
  // 'elevenlabs' = force ElevenLabs only.
  provider: z.enum(['auto', 'aiml', 'elevenlabs']).default('auto'),
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

    const { prompt, category, duration, provider } = parseResult.data;
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    const AIML_API_KEY = Deno.env.get('AIML_API_KEY');

    console.log('Generating audio:', { category, provider, prompt: prompt.substring(0, 100), duration });

    // ── Direct AIML route (user explicitly chose AIML, or EL key missing) ──
    if (provider === 'aiml' || !ELEVENLABS_API_KEY) {
      if (!AIML_API_KEY) {
        return jsonResponse({
          error: 'No audio provider configured (ELEVENLABS_API_KEY and AIML_API_KEY both missing)',
          reason: 'no_provider_configured',
          fallback: true,
        }, 200);
      }
      const aimlResult = await generateViaAiml({ prompt, category, duration, AIML_API_KEY, reason: 'user_selected_aiml' });
      if (aimlResult) return jsonResponse(aimlResult, 200);
      return jsonResponse({
        error: 'AIML audio generation failed',
        reason: 'aiml_error',
        fallback: true,
      }, 200);
    }


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
        const aimlPrompt = category === "ambient"
          ? `Ambient soundscape, instrumental only, seamless and atmospheric: ${prompt}`
          : `Background instrumental music, no vocals, smooth and even dynamics suitable for video underscore: ${prompt}`;

        // Try a sequence of AIML models. eleven_music is the most reliable
        // (~30s) — stable-audio sometimes stays queued >60s.
        const aimlAttempts: Array<{ model: string; body: Record<string, unknown> }> = [
          {
            model: "elevenlabs/eleven_music",
            body: {
              model: "elevenlabs/eleven_music",
              prompt: aimlPrompt,
              seconds_total: Math.min(Math.max(duration, 10), 120),
            },
          },
          {
            model: "stable-audio",
            body: {
              model: "stable-audio",
              prompt: aimlPrompt,
              seconds_total: Math.min(Math.max(duration, 1), 47),
              steps: 80,
            },
          },
        ];

        for (const attempt of aimlAttempts) {
          try {
            console.log(`[fallback] ElevenLabs ${lastStatus} → trying AIML ${attempt.model} (category=${category}, duration=${duration})`);

            const submitRes = await fetch("https://api.aimlapi.com/v2/generate/audio", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${AIML_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(attempt.body),
            });

            if (!submitRes.ok) {
              const errTxt = await submitRes.text();
              console.error(`[fallback] AIML ${attempt.model} submit failed: ${submitRes.status} ${errTxt.slice(0, 300)}`);
              continue;
            }

            const submitData = await submitRes.json();
            const generationId = submitData.id || submitData.generation_id;
            console.log(`[fallback] AIML ${attempt.model} submitted, generation_id=${generationId}`);

            if (!generationId) {
              console.error(`[fallback] AIML ${attempt.model} returned no id:`, JSON.stringify(submitData).slice(0, 300));
              continue;
            }

            // Poll up to ~120s (40 * 3s). eleven_music typically completes in 30–60s.
            let aimlAudioUrl: string | null = null;
            let lastPollStatus = "unknown";
            for (let i = 0; i < 40; i++) {
              await new Promise(r => setTimeout(r, 3000));
              const statusRes = await fetch(
                `https://api.aimlapi.com/v2/generate/audio?generation_id=${generationId}`,
                { headers: { "Authorization": `Bearer ${AIML_API_KEY}` } }
              );
              if (!statusRes.ok) {
                console.warn(`[fallback] AIML ${attempt.model} poll #${i + 1} HTTP ${statusRes.status}`);
                continue;
              }
              const statusData = await statusRes.json();
              lastPollStatus = statusData.status || "unknown";
              if (statusData.audio_file?.url || statusData.status === "completed") {
                aimlAudioUrl = statusData.audio_file?.url || statusData.url || null;
                console.log(`[fallback] AIML ${attempt.model} completed after ${(i + 1) * 3}s`);
                break;
              }
              if (statusData.status === "failed" || statusData.status === "error") {
                console.error(`[fallback] AIML ${attempt.model} reported failure:`, JSON.stringify(statusData.error || statusData).slice(0, 300));
                aimlAudioUrl = null;
                break;
              }
            }

            if (!aimlAudioUrl) {
              console.error(`[fallback] AIML ${attempt.model} timed out (lastStatus=${lastPollStatus})`);
              continue;
            }

            // Download the audio
            const audioRes = await fetch(aimlAudioUrl);
            if (!audioRes.ok) {
              console.error(`[fallback] AIML ${attempt.model} download failed: HTTP ${audioRes.status}`);
              continue;
            }
            const fallbackBuffer = await audioRes.arrayBuffer();
            const fallbackBase64 = base64Encode(fallbackBuffer);
            console.log(`[fallback] AIML ${attempt.model} success: ${fallbackBuffer.byteLength} bytes`);
            return jsonResponse({
              audioContent: fallbackBase64,
              format: "mp3",
              category,
              duration,
              bytes: fallbackBuffer.byteLength,
              provider: "aiml",
              providerModel: attempt.model,
              fallbackUsed: true,
              fallbackReason: lastStatus === 429 ? "elevenlabs_rate_limited" : "elevenlabs_credits_exhausted",
            }, 200);
          } catch (fallbackErr) {
            console.error(`[fallback] AIML ${attempt.model} error:`, fallbackErr);
          }
        }
      } else if (!AIML_API_KEY) {
        console.warn("[fallback] AIML_API_KEY missing — cannot attempt fallback");
      } else if (category === "sfx") {
        console.warn("[fallback] AIML fallback skipped: SFX not supported by Suno/Stable-Audio");
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
