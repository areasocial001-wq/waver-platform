/**
 * Compatibility alias for the removed ElevenLabs SFX function.
 *
 * Sound effects now go exclusively through AIML's `stable-audio` model. The
 * endpoint name is kept so every legacy caller (Story Mode, JSON2Video, …)
 * keeps working with no client-side changes.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function generateSfxViaAiml(
  apiKey: string,
  text: string,
  durationSeconds: number,
): Promise<ArrayBuffer | null> {
  try {
    const seconds = Math.min(Math.max(durationSeconds, 1), 22);
    const submitRes = await fetch("https://api.aimlapi.com/v2/generate/audio", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "stable-audio",
        prompt: `Sound effect: ${text}`,
        seconds_total: seconds,
        steps: 75,
      }),
    });
    if (!submitRes.ok) {
      const txt = await submitRes.text();
      console.error(`[aiml-sfx] submit failed: ${submitRes.status} ${txt.slice(0, 200)}`);
      return null;
    }
    const submitData = await submitRes.json();
    const generationId = submitData.id || submitData.generation_id;
    if (!generationId) return null;

    let audioUrl: string | null = null;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 2500));
      const statusRes = await fetch(
        `https://api.aimlapi.com/v2/generate/audio?generation_id=${generationId}`,
        { headers: { Authorization: `Bearer ${apiKey}` } },
      );
      if (!statusRes.ok) continue;
      const statusData = await statusRes.json();
      if (statusData.status === "completed" || statusData.audio_file?.url) {
        audioUrl = statusData.audio_file?.url || statusData.url;
        break;
      }
      if (statusData.status === "failed" || statusData.status === "error") break;
    }
    if (!audioUrl) return null;
    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) return null;
    return await audioRes.arrayBuffer();
  } catch (err) {
    console.error("[aiml-sfx] error:", err);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    let userId: string | undefined;
    try {
      const { data: claimsData } = await supabase.auth.getClaims(token);
      if (claimsData?.claims) userId = claimsData.claims.sub as string;
    } catch (_) { /* older SDK */ }
    if (!userId) {
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData?.user) {
        return jsonResponse({ error: "Invalid authentication token" }, 401);
      }
      userId = userData.user.id;
    }

    const body = await req.json().catch(() => ({}));
    const text = body.text as string | undefined;
    const duration = Number(body.duration_seconds ?? 5);

    if (!text || typeof text !== "string") {
      return jsonResponse({ error: "text is required" }, 400);
    }

    const AIML_API_KEY = Deno.env.get("AIML_API_KEY");
    if (!AIML_API_KEY) {
      return jsonResponse({
        error: "AIML_API_KEY not configured",
        reason: "missing_api_key",
        fallback: true,
      }, 200);
    }

    console.log(`[sfx] generating via AIML stable-audio: "${text.slice(0, 80)}..." duration=${duration}s`);
    const buf = await generateSfxViaAiml(AIML_API_KEY, text, duration);
    if (!buf) {
      return jsonResponse({
        error: "SFX generation failed",
        reason: "aiml_error",
        fallback: true,
      }, 200);
    }

    return new Response(buf, {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "X-Provider": "aiml",
      },
    });
  } catch (error) {
    console.error("[sfx] function error:", error);
    return jsonResponse({
      error: (error as Error).message,
      reason: "function_exception",
      fallback: true,
    }, 200);
  }
});
