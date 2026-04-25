/**
 * Compatibility alias for the removed `elevenlabs-tts` function.
 *
 * The platform has migrated to Inworld TTS (which manages voices and supports
 * IVC). Existing frontend code still calls `/functions/v1/elevenlabs-tts`, so
 * this thin shim forwards every request to the `inworld-tts` function and
 * returns its response unchanged. The Inworld function already accepts the
 * legacy ElevenLabs payload shape (text, voiceId, speed, stability, …) and
 * maps default ElevenLabs voice IDs to Inworld voice names internally.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) {
    return new Response(
      JSON.stringify({ error: "SUPABASE_URL not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const headers = new Headers();
    const auth = req.headers.get("Authorization");
    const apikey = req.headers.get("apikey");
    if (auth) headers.set("Authorization", auth);
    if (apikey) headers.set("apikey", apikey);
    const ct = req.headers.get("Content-Type");
    if (ct) headers.set("Content-Type", ct);

    const upstream = await fetch(`${supabaseUrl}/functions/v1/inworld-tts`, {
      method: "POST",
      headers,
      body: req.body,
    });

    const respHeaders = new Headers(upstream.headers);
    for (const [k, v] of Object.entries(corsHeaders)) {
      respHeaders.set(k, v);
    }
    return new Response(upstream.body, { status: upstream.status, headers: respHeaders });
  } catch (e) {
    console.error("[elevenlabs-tts→inworld-tts] proxy error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "proxy_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
