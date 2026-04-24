import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // JWT validation
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonError(401, "Missing authorization header");
  }
  const token = authHeader.replace("Bearer ", "");
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  let userId: string | undefined;
  try {
    const { data, error } = await supabaseClient.auth.getClaims(token);
    if (!error && data?.claims) userId = data.claims.sub as string;
  } catch (_) { /* older SDK */ }
  if (!userId) {
    const { data, error } = await supabaseClient.auth.getUser(token);
    if (error || !data?.user) return jsonError(401, "Invalid authentication token");
    userId = data.user.id;
  }

  try {
    const INWORLD_API_KEY = Deno.env.get("INWORLD_API_KEY");
    if (!INWORLD_API_KEY) return jsonError(500, "INWORLD_API_KEY is not configured");

    const url = new URL(req.url);
    const voiceId = url.searchParams.get("voiceId");
    const modelId = url.searchParams.get("modelId") ?? "inworld-tts-1";
    if (!voiceId) return jsonError(400, "voiceId is required");

    const inworldUrl = new URL("https://api.inworld.ai/tts/v1/voice:preview");
    inworldUrl.searchParams.set("voice_id", voiceId);
    inworldUrl.searchParams.set("model_id", modelId);

    const callInworld = async (scheme: "Basic" | "Bearer") => fetch(inworldUrl.toString(), {
      method: "GET",
      headers: { Authorization: `${scheme} ${INWORLD_API_KEY}` },
    });

    let resp = await callInworld("Basic");
    if (resp.status === 401 || resp.status === 403) {
      resp = await callInworld("Bearer");
    }
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      console.error("[inworld-voice-preview] upstream error", resp.status, body.slice(0, 300));
      return jsonError(502, `Inworld API error: ${resp.status}`, body.slice(0, 300));
    }

    const json = await resp.json();
    if (!json?.audioContent) return jsonError(502, "Risposta senza audio");

    return new Response(
      JSON.stringify({ audioContent: json.audioContent, format: "mp3" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[inworld-voice-preview] error:", message);
    return jsonError(500, message);
  }

  function jsonError(status: number, error: string, details?: string) {
    return new Response(
      JSON.stringify({ error, details }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
