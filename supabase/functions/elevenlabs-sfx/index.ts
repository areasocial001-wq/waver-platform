import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function callElevenLabsSfx(apiKey: string, text: string, duration_seconds: number, prompt_influence: number) {
  const response = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      duration_seconds: Math.min(duration_seconds, 22),
      prompt_influence,
    }),
  });
  return response;
}

/**
 * Generate a short SFX via AIML stable-audio. Returns the raw mp3 buffer or
 * null on failure. Used both as a fallback (when ElevenLabs fails) and as the
 * primary route when the user explicitly chooses AIML.
 */
async function tryAimlSfx(AIML_API_KEY: string, text: string, duration_seconds: number): Promise<ArrayBuffer | null> {
  try {
    const submitRes = await fetch("https://api.aimlapi.com/v2/generate/audio", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${AIML_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "stable-audio",
        prompt: `Sound effect: ${text}`,
        seconds_total: Math.min(Math.max(duration_seconds, 1), 22),
        steps: 75,
      }),
    });
    if (!submitRes.ok) {
      const errTxt = await submitRes.text();
      console.error(`[aiml-sfx] submit failed: ${submitRes.status} ${errTxt.slice(0, 200)}`);
      return null;
    }
    const submitData = await submitRes.json();
    const generationId = submitData.id || submitData.generation_id;
    if (!generationId) return null;
    let aimlAudioUrl: string | null = null;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 2500));
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
      if (statusData.status === "failed" || statusData.status === "error") break;
    }
    if (!aimlAudioUrl) return null;
    const audioRes = await fetch(aimlAudioUrl);
    if (!audioRes.ok) return null;
    const buf = await audioRes.arrayBuffer();
    console.log(`[aiml-sfx] success: ${buf.byteLength} bytes`);
    return buf;
  } catch (err) {
    console.error("[aiml-sfx] error:", err);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    let userId: string | undefined;
    try {
      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
      if (!claimsError && claimsData?.claims) {
        userId = claimsData.claims.sub as string;
      }
    } catch (_) {
      // getClaims not available in this SDK version
    }
    if (!userId) {
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData?.user) {
        console.error("JWT validation failed:", userError);
        return jsonResponse({ error: "Invalid authentication token" }, 401);
      }
      userId = userData.user.id;
    }

    // Try multiple ElevenLabs keys (primary + connector-managed fallback)
    const candidateKeys = [
      { name: "ELEVENLABS_API_KEY", value: Deno.env.get("ELEVENLABS_API_KEY") },
      { name: "ELEVENLABS_API_KEY_1", value: Deno.env.get("ELEVENLABS_API_KEY_1") },
    ].filter(k => !!k.value) as { name: string; value: string }[];

    if (candidateKeys.length === 0) {
      console.error("No ElevenLabs API key configured");
      return jsonResponse({
        error: "ELEVENLABS_API_KEY not configured",
        reason: "missing_api_key",
        fallback: true,
      }, 200);
    }

    const body = await req.json().catch(() => ({}));
    const { text, duration_seconds = 5, prompt_influence = 0.3, provider = 'auto' } = body as {
      text?: string; duration_seconds?: number; prompt_influence?: number;
      provider?: 'auto' | 'aiml' | 'elevenlabs';
    };

    if (!text || typeof text !== "string" || text.length === 0) {
      return jsonResponse({ error: "text parameter is required" }, 400);
    }

    const AIML_API_KEY = Deno.env.get("AIML_API_KEY");

    // ── Direct AIML route when user explicitly chose AIML ──
    if (provider === 'aiml') {
      if (!AIML_API_KEY) {
        return jsonResponse({
          error: 'AIML_API_KEY not configured',
          reason: 'missing_api_key',
          fallback: true,
        }, 200);
      }
      const buf = await tryAimlSfx(AIML_API_KEY, text, duration_seconds);
      if (buf) {
        return new Response(buf, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'audio/mpeg',
            'X-Provider': 'aiml',
          },
        });
      }
      return jsonResponse({
        error: 'AIML SFX generation failed',
        reason: 'aiml_error',
        fallback: true,
      }, 200);
    }

    console.log(`Generating SFX: "${text.slice(0, 80)}..." duration=${duration_seconds}s, candidate keys: ${candidateKeys.map(k => `${k.name}(len=${k.value.length}, prefix=${k.value.slice(0, 4)})`).join(", ")}`);

    let lastStatus = 0;
    let lastErrText = "";
    let lastKeyName = "";

    for (const { name, value } of candidateKeys) {
      const response = await callElevenLabsSfx(value, text, duration_seconds, prompt_influence);
      lastKeyName = name;

      if (response.ok) {
        const audioBuffer = await response.arrayBuffer();
        console.log(`SFX generated with ${name}: ${audioBuffer.byteLength} bytes`);
        return new Response(audioBuffer, {
          headers: { ...corsHeaders, "Content-Type": "audio/mpeg" },
        });
      }

      lastStatus = response.status;
      lastErrText = await response.text().catch(() => "");
      console.error(`ElevenLabs SFX error with key ${name}: ${response.status} ${lastErrText.slice(0, 200)}`);

      // If it's not an auth issue, stop trying other keys (e.g. quota, validation)
      if (response.status !== 401 && response.status !== 403) {
        break;
      }
    }

    // ── AIML FALLBACK ──────────────────────────────────────────────
    // When ElevenLabs is rate-limited / out of credits / unauthorized,
    // try AIML's stable-audio for short SFX so Story Mode keeps a sound.
    const AIML_API_KEY = Deno.env.get("AIML_API_KEY");
    const fallbackEligible =
      AIML_API_KEY &&
      (lastStatus === 401 || lastStatus === 402 || lastStatus === 429);

    if (fallbackEligible) {
      try {
        console.log(`[fallback] ElevenLabs SFX ${lastStatus} → trying AIML stable-audio`);
        const submitRes = await fetch("https://api.aimlapi.com/v2/generate/audio", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${AIML_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "stable-audio",
            prompt: `Sound effect: ${text}`,
            seconds_total: Math.min(Math.max(duration_seconds, 1), 22),
            steps: 75,
          }),
        });

        if (submitRes.ok) {
          const submitData = await submitRes.json();
          const generationId = submitData.id || submitData.generation_id;
          if (generationId) {
            let aimlAudioUrl: string | null = null;
            for (let i = 0; i < 20; i++) {
              await new Promise(r => setTimeout(r, 2500));
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
              if (statusData.status === "failed" || statusData.status === "error") break;
            }
            if (aimlAudioUrl) {
              const audioRes = await fetch(aimlAudioUrl);
              if (audioRes.ok) {
                const fallbackBuffer = await audioRes.arrayBuffer();
                console.log(`[fallback] AIML SFX success: ${fallbackBuffer.byteLength} bytes`);
                return new Response(fallbackBuffer, {
                  headers: {
                    ...corsHeaders,
                    "Content-Type": "audio/mpeg",
                    "X-Provider": "aiml",
                    "X-Fallback-Used": "true",
                  },
                });
              }
            }
          }
        } else {
          const errTxt = await submitRes.text();
          console.error(`[fallback] AIML SFX submit failed: ${submitRes.status} ${errTxt.slice(0, 200)}`);
        }
      } catch (fbErr) {
        console.error("[fallback] AIML SFX error:", fbErr);
      }
    }

    // Graceful failure: return 200 with structured error so the frontend can degrade instead of crashing
    const reason =
      lastStatus === 401 ? "elevenlabs_unauthorized"
      : lastStatus === 403 ? "elevenlabs_forbidden"
      : lastStatus === 429 ? "elevenlabs_rate_limited"
      : lastStatus >= 500 ? "elevenlabs_service_unavailable"
      : "elevenlabs_error";

    return jsonResponse({
      error: `SFX generation failed: ${lastStatus}`,
      reason,
      keyTried: lastKeyName,
      providerMessage: lastErrText.slice(0, 300),
      fallback: true,
    }, 200);
  } catch (error) {
    console.error("SFX function error:", error);
    return jsonResponse({
      error: (error as Error).message,
      reason: "function_exception",
      fallback: true,
    }, 200);
  }
});
