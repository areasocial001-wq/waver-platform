import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InworldVoice {
  name: string;
  voiceId: string;
  displayName?: string;
  description?: string;
  langCode?: string;
  tags?: string[];
  source?: "SYSTEM" | "IVC" | string;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { ts: number; voices: InworldVoice[] } | null = null;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // JWT validation (same pattern as inworld-tts)
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Missing authorization header" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
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
    if (error || !data?.user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    userId = data.user.id;
  }

  try {
    const INWORLD_API_KEY = Deno.env.get("INWORLD_API_KEY");
    if (!INWORLD_API_KEY) {
      return new Response(
        JSON.stringify({ error: "INWORLD_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Optional language filter (?language=EN_US). If omitted, list all.
    const url = new URL(req.url);
    const language = url.searchParams.get("language");
    const force = url.searchParams.get("force") === "1";

    // Serve from cache when fresh
    const now = Date.now();
    if (!force && cache && (now - cache.ts) < CACHE_TTL_MS) {
      const voices = filterByLang(cache.voices, language);
      return ok({ voices, system: voices.filter(v => v.source !== "IVC"), ivc: voices.filter(v => v.source === "IVC"), cached: true });
    }

    const inworldUrl = new URL("https://api.inworld.ai/voices/v1/voices");
    if (language) inworldUrl.searchParams.set("languages", language);

    const callInworld = async (scheme: "Basic" | "Bearer") => fetch(inworldUrl.toString(), {
      method: "GET",
      headers: { Authorization: `${scheme} ${INWORLD_API_KEY}` },
    });

    let resp = await callInworld("Basic");
    if (resp.status === 401 || resp.status === 403) {
      console.warn("[inworld-list-voices] Basic rejected, retrying with Bearer");
      resp = await callInworld("Bearer");
    }
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      console.error("[inworld-list-voices] upstream error", resp.status, body.slice(0, 300));
      return new Response(
        JSON.stringify({ error: `Inworld API error: ${resp.status}`, details: body.slice(0, 300) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const json = await resp.json();
    const voices: InworldVoice[] = Array.isArray(json?.voices) ? json.voices : [];
    cache = { ts: now, voices };

    const filtered = filterByLang(voices, language);
    return ok({
      voices: filtered,
      system: filtered.filter(v => v.source !== "IVC"),
      ivc: filtered.filter(v => v.source === "IVC"),
      cached: false,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[inworld-list-voices] error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function ok(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function filterByLang(voices: InworldVoice[], language: string | null): InworldVoice[] {
  if (!language) return voices;
  return voices.filter(v => !v.langCode || v.langCode === language);
}
