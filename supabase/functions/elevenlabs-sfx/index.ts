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
    const { text, duration_seconds = 5, prompt_influence = 0.3 } = body as {
      text?: string; duration_seconds?: number; prompt_influence?: number;
    };

    if (!text || typeof text !== "string" || text.length === 0) {
      return jsonResponse({ error: "text parameter is required" }, 400);
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
