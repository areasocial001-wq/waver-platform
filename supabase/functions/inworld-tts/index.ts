import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Same input shape as elevenlabs-tts so callers can swap transparently
const requestSchema = z.object({
  text: z.string().min(1, "Testo obbligatorio").max(5000, "Testo troppo lungo"),
  voiceId: z.string().max(100).optional(),
  speed: z.number().min(0.5).max(2.0).optional(),
  // Accept (and ignore) ElevenLabs-specific knobs so callers don't have to branch
  stability: z.number().min(0).max(1).optional(),
  similarityBoost: z.number().min(0).max(1).optional(),
  style: z.number().min(0).max(1).optional(),
  languageCode: z.string().length(2).optional(),
  modelId: z.string().max(100).optional(),
});

const normalizeLang = (value?: string | null) =>
  (value || "").toLowerCase().replace("_", "-").split("-")[0];

const DEFAULT_BY_LANGUAGE: Record<string, string> = {
  en: "Sarah",
};

interface InworldVoice {
  name?: string;
  voiceId?: string;
  displayName?: string;
  langCode?: string;
  tags?: string[];
  source?: string;
}

function normalizeInworldVoiceId(voice: InworldVoice): string {
  if (voice.source === "IVC" && voice.name?.startsWith("workspaces/")) return voice.name;
  return String(voice.voiceId || voice.name || voice.displayName || "");
}

function voiceSupportsLanguage(voice: InworldVoice, lang: string): boolean {
  const target = normalizeLang(lang);
  const direct = normalizeLang(voice.langCode);
  if (direct) return direct === target;
  return (voice.tags || []).some((tag) => normalizeLang(tag) === target || tag.toLowerCase().includes(`language:${target}`));
}

async function getLanguageNativeVoice(apiKey: string, lang: string, requested?: string): Promise<string | null> {
  const call = (scheme: "Basic" | "Bearer") =>
    fetch("https://api.inworld.ai/voices/v1/voices", { headers: { Authorization: `${scheme} ${apiKey}` } });
  let resp = await call("Basic");
  if (resp.status === 401 || resp.status === 403) resp = await call("Bearer");
  if (!resp.ok) return null;
  const json = await resp.json().catch(() => ({}));
  const voices: InworldVoice[] = Array.isArray(json?.voices) ? json.voices : [];
  const native = voices
    .map((voice) => ({ voice, id: normalizeInworldVoiceId(voice) }))
    .filter((entry) => entry.id && voiceSupportsLanguage(entry.voice, lang));
  const requestedMatch = requested ? native.find((entry) =>
    entry.id === requested ||
    entry.voice.name === requested ||
    entry.voice.displayName === requested ||
    entry.voice.voiceId === requested,
  ) : undefined;
  return requestedMatch?.id || native[0]?.id || null;
}

/**
 * Map ElevenLabs default voice IDs (and a few common names) to Inworld voice names.
 * Inworld voices: Sarah, Roger, Liam, Ashley, Alex, Edward, Olivia, Mark, Hades,
 * Theodore, Pixie, Wendy, Dennis, Timothy, Ronald, Deborah, Craig, Julia, Priya, ...
 * We pick close gender/timbre matches.
 */
const VOICE_MAP: Record<string, string> = {
  // ElevenLabs default voices → Inworld
  "EXAVITQu4vr4xnSDxMaL": "Sarah",        // Sarah → Sarah
  "JBFqnCBsd6RMkjVDRZzb": "Edward",       // George → Edward (mature male)
  "onwK4e9ZLuTAKqWW03F9": "Mark",         // Daniel → Mark
  "pFZP5JQG7iQjIQuC4Bku": "Olivia",       // Lily → Olivia
  "TX3LPaxmHKxFdv7VOQHJ": "Liam",         // Liam → Liam
  "XrExE9yKIg1WjnnlVkGX": "Ashley",       // Matilda → Ashley
  "9BWtsMINqrJLrRacOk9x": "Julia",        // Aria → Julia
  "CwhRBWXzGAHq8TQ4Fs17": "Roger",        // Roger → Roger
  "FGY2WhTYpPnrIDTdsKH5": "Wendy",        // Laura → Wendy
  "IKne3meq5aSn9XLyUdCD": "Alex",         // Charlie → Alex
  "N2lVS1w4EtoT3dr4eOWO": "Dennis",       // Callum → Dennis
  "SAz9YHcvj6GT2YYXdXww": "Priya",        // River → Priya
  "Xb7hH8MSUJpSbSDYk0k2": "Deborah",      // Alice → Deborah
  "bIHbv24MWmeRgasZH58o": "Theodore",     // Will → Theodore
  "cgSgspJ2msm6clMCkdW9": "Pixie",        // Jessica → Pixie
  "cjVigY5qzO86Huf0OWal": "Ronald",       // Eric → Ronald
  "iP95p4xoKVk53GoZ742B": "Craig",        // Chris → Craig
  "nPczCjzI2devNBz1zQrb": "Hades",        // Brian → Hades
};

function mapToInworldVoice(voiceId?: string, dbMap?: Record<string, string>): string {
  if (!voiceId) return "Sarah";
  // IVC voice path returned by /voices/v1/voices (e.g.
  // "workspaces/<ws>/voices/<id>") — Inworld TTS accepts this as voiceId.
  if (voiceId.startsWith("workspaces/")) return voiceId;
  // Some legacy clients send the short IVC form "default-<ws>__<id>".
  if (/^default-[a-z0-9]+__[a-z0-9_-]+$/i.test(voiceId)) return voiceId;
  // If it's already an Inworld voice name (capitalized, no hyphens), pass through
  if (/^[A-Z][a-zA-Z]{2,30}$/.test(voiceId)) return voiceId;
  // DB mapping wins over the hardcoded fallback
  if (dbMap && dbMap[voiceId]) return dbMap[voiceId];
  if (VOICE_MAP[voiceId]) return VOICE_MAP[voiceId];
  // Unknown → safe default
  return "Sarah";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // JWT validation (same pattern as elevenlabs-tts)
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
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (!claimsError && claimsData?.claims) {
      userId = claimsData.claims.sub as string;
    }
  } catch (_) {
    // older SDK
  }
  if (!userId) {
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData?.user) {
      console.error("JWT validation failed:", userError);
      return new Response(
        JSON.stringify({ error: "Invalid authentication token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    userId = userData.user.id;
  }

  try {
    const body = await req.json();

    if (body.healthCheck) {
      return new Response(
        JSON.stringify({ status: "ok", service: "inworld-tts" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const parseResult = requestSchema.safeParse(body);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: parseResult.error.errors[0].message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { text, voiceId, modelId } = parseResult.data;

    const INWORLD_API_KEY = Deno.env.get("INWORLD_API_KEY");
    if (!INWORLD_API_KEY) {
      throw new Error("INWORLD_API_KEY is not configured");
    }

    // Try to load admin-managed mappings from DB (best effort; falls back to hardcoded map)
    let dbMap: Record<string, string> | undefined;
    try {
      const { data: rows } = await supabaseClient
        .from("voice_mappings")
        .select("elevenlabs_voice_id, inworld_voice_name");
      if (rows) {
        dbMap = {};
        for (const r of rows as Array<{ elevenlabs_voice_id: string; inworld_voice_name: string }>) {
          dbMap[r.elevenlabs_voice_id] = r.inworld_voice_name;
        }
      }
    } catch (e) {
      console.warn("[inworld-tts] could not load voice_mappings, using hardcoded map", e);
    }

    const normalizedLang = normalizeLang(parseResult.data.languageCode || "en");
    const mappedVoice = mapToInworldVoice(voiceId, dbMap);
    const languageNativeVoice = normalizedLang !== "en"
      ? await getLanguageNativeVoice(INWORLD_API_KEY, normalizedLang, voiceId || mappedVoice)
      : null;
    const selectedVoice = languageNativeVoice || DEFAULT_BY_LANGUAGE[normalizedLang] || mappedVoice;
    const isLikelyIvcVoice = selectedVoice.startsWith("workspaces/");
    const selectedModel = modelId || (
      normalizedLang && normalizedLang !== "en"
        ? "inworld-tts-1.5-max"
        : isLikelyIvcVoice
          ? "inworld-tts-1.5-max"
          : "inworld-tts-1"
    );

    console.log(
      "[inworld-tts] text:",
      text.substring(0, 80) + "...",
      "voice:",
      selectedVoice,
      "model:",
      selectedModel,
    );

    // Inworld TTS API
    // The `Authorization` header format depends on the key type:
    //   - Inworld Studio "API key" (base64 user:pass)  → `Basic <key>`
    //   - Inworld platform "Bearer token" / OAuth key  → `Bearer <key>`
    // We try Basic first (most common for platform.inworld.ai keys), and on
    // 401/403 we transparently retry with Bearer before giving up.
    const callInworld = async (scheme: "Basic" | "Bearer") =>
      fetch("https://api.inworld.ai/tts/v1/voice", {
        method: "POST",
        headers: {
          "Authorization": `${scheme} ${INWORLD_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          voiceId: selectedVoice,
          modelId: selectedModel,
        }),
      });

    let inworldResponse = await callInworld("Basic");
    if (inworldResponse.status === 401 || inworldResponse.status === 403) {
      const firstErr = await inworldResponse.text();
      console.warn(
        "[inworld-tts] Basic auth rejected (",
        inworldResponse.status,
        firstErr.slice(0, 120),
        ") — retrying with Bearer",
      );
      inworldResponse = await callInworld("Bearer");
    }

    if (!inworldResponse.ok) {
      const errorText = await inworldResponse.text();
      console.error("[inworld-tts] API error:", inworldResponse.status, errorText);

      // Surface a structured fallback signal (mirrors elevenlabs-tts shape).
      // 403 = invalid credentials → treat as auth failure, NOT a 500, so the
      // client can show a clean message and (optionally) fall back to ElevenLabs.
      if (
        inworldResponse.status === 401 ||
        inworldResponse.status === 402 ||
        inworldResponse.status === 403 ||
        inworldResponse.status === 429
      ) {
        const reason =
          inworldResponse.status === 429
            ? "inworld_rate_limited"
            : inworldResponse.status === 403 || inworldResponse.status === 401
              ? "inworld_invalid_credentials"
              : "inworld_insufficient_credits";
        const message =
          inworldResponse.status === 429
            ? "Inworld momentaneamente occupato. Riprova tra poco."
            : inworldResponse.status === 403 || inworldResponse.status === 401
              ? "API key Inworld non valida. Controlla la chiave su platform.inworld.ai (deve essere una TTS API key attiva)."
              : "Crediti Inworld esauriti.";
        return new Response(
          JSON.stringify({
            fallback: true,
            reason,
            status: inworldResponse.status,
            error: message,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      throw new Error(`Inworld API error: ${inworldResponse.status} - ${errorText}`);
    }

    // Inworld returns JSON: { audioContent: "<base64 wav>" }
    // It may also return raw audio in some endpoints; handle both.
    const contentType = inworldResponse.headers.get("content-type") || "";
    let base64Audio: string;
    let format: "mp3" | "wav" = "wav";

    if (contentType.includes("application/json")) {
      const json = await inworldResponse.json();
      if (typeof json.audioContent === "string") {
        base64Audio = json.audioContent;
      } else if (typeof json.audio === "string") {
        base64Audio = json.audio;
      } else {
        throw new Error("Unexpected Inworld response shape: " + JSON.stringify(json).slice(0, 200));
      }
    } else {
      // Raw binary audio fallback
      const buf = await inworldResponse.arrayBuffer();
      const u8 = new Uint8Array(buf);
      let binary = "";
      const chunkSize = 0x8000;
      for (let i = 0; i < u8.length; i += chunkSize) {
        const chunk = u8.subarray(i, Math.min(i + chunkSize, u8.length));
        binary += String.fromCharCode.apply(null, [...chunk]);
      }
      base64Audio = btoa(binary);
    }

    console.log("[inworld-tts] success, base64 length:", base64Audio.length);

    return new Response(
      JSON.stringify({
        audioContent: base64Audio,
        format,
        provider: "inworld",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[inworld-tts] error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
