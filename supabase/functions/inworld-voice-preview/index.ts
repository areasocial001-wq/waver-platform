import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Default sample text per language (used when caller does not provide one).
// IVC voices (e.g. Marina Official) clone the speaker's accent, so we want to
// preview them with a sentence in the matching language instead of the
// server-side English default returned by /tts/v1/voice:preview.
const DEFAULT_SAMPLES: Record<string, string> = {
  IT: "Ciao, questa è un'anteprima della mia voce. Spero ti piaccia.",
  EN: "Hi, this is a short preview of my voice. I hope you like it.",
  ES: "Hola, esta es una breve muestra de mi voz. Espero que te guste.",
  FR: "Bonjour, ceci est un court aperçu de ma voix. J'espère qu'elle vous plaira.",
  DE: "Hallo, das ist eine kurze Hörprobe meiner Stimme. Ich hoffe, sie gefällt dir.",
  PT: "Olá, esta é uma breve amostra da minha voz. Espero que goste.",
};

function pickDefaultSample(langCode?: string | null): string {
  if (!langCode) return DEFAULT_SAMPLES.IT;
  const key = langCode.toUpperCase().split("_")[0];
  return DEFAULT_SAMPLES[key] ?? DEFAULT_SAMPLES.IT;
}

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
    const langCode = url.searchParams.get("langCode"); // e.g. "IT" or "IT_IT"
    const customText = url.searchParams.get("text");
    if (!voiceId) return jsonError(400, "voiceId is required");

    const sampleText = (customText && customText.trim().length > 0)
      ? customText.slice(0, 300)
      : pickDefaultSample(langCode);

    // Use the regular TTS endpoint so we control language/accent of the sample.
    // /tts/v1/voice:preview returns a fixed English sentence which doesn't
    // showcase IVC voices cloned from non-English speakers.
    const callInworld = async (scheme: "Basic" | "Bearer") => fetch(
      "https://api.inworld.ai/tts/v1/voice",
      {
        method: "POST",
        headers: {
          Authorization: `${scheme} ${INWORLD_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: sampleText,
          voiceId,
          modelId,
        }),
      },
    );

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
    const audioContent = json?.audioContent ?? json?.audio;
    if (!audioContent) return jsonError(502, "Risposta senza audio");

    return new Response(
      JSON.stringify({ audioContent, format: "mp3", sampleText, langCode: langCode ?? "IT" }),
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
