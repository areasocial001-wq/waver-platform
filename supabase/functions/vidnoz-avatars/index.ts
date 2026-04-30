// List Vidnoz official avatars + voices for the Video Agent UI selectors.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VIDNOZ_BASE = "https://devapi.vidnoz.com/v2";

// In-memory cache (per warm edge instance). TTL = 10 minutes.
const CACHE_TTL_MS = 10 * 60 * 1000;
let _cache: { ts: number; payload: { avatars: any[]; voices: any[] } } | null = null;

// Heuristic: keywords that suggest a corporate/business-friendly avatar.
const BUSINESS_KEYWORDS = [
  "business", "office", "suit", "executive", "ceo", "manager", "professional",
  "corporate", "formal", "presenter", "anchor", "host", "interview", "consultant",
  "doctor", "lawyer", "teacher", "lecturer", "speaker", "broadcast", "newscaster",
  "uomo d'affari", "donna d'affari", "manager", "professionista",
];

function isBusinessAvatar(a: any): boolean {
  const haystack = [
    a.name, a.avatar_name, a.category, a.tags, a.description, a.style, a.scene,
  ]
    .filter(Boolean)
    .map((x: any) => (Array.isArray(x) ? x.join(" ") : String(x)))
    .join(" ")
    .toLowerCase();
  return BUSINESS_KEYWORDS.some((k) => haystack.includes(k));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    let userId: string | undefined;
    try {
      const { data } = await supabase.auth.getClaims(token);
      if (data?.claims) userId = data.claims.sub as string;
    } catch (_) {}
    if (!userId) {
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user)
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      userId = data.user.id;
    }

    const VIDNOZ_API_KEY = Deno.env.get("VIDNOZ_API_KEY");
    if (!VIDNOZ_API_KEY) throw new Error("VIDNOZ_API_KEY not configured");

    // Allow forced refresh via ?refresh=1 or { refresh: true } in body
    let forceRefresh = false;
    try {
      const url = new URL(req.url);
      if (url.searchParams.get("refresh") === "1") forceRefresh = true;
    } catch (_) {}
    if (!forceRefresh && req.method === "POST") {
      try {
        const body = await req.clone().json();
        if (body?.refresh === true) forceRefresh = true;
      } catch (_) {}
    }

    // Serve from in-memory cache when fresh
    if (!forceRefresh && _cache && Date.now() - _cache.ts < CACHE_TTL_MS) {
      return new Response(
        JSON.stringify({
          ...(_cache.payload),
          cached: true,
          cache_age_ms: Date.now() - _cache.ts,
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=300",
          },
        }
      );
    }

    const headers = { Authorization: `Bearer ${VIDNOZ_API_KEY}`, accept: "application/json" };

    const [avatarsRes, voicesRes] = await Promise.all([
      fetch(`${VIDNOZ_BASE}/avatar/list`, { headers }),
      fetch(`${VIDNOZ_BASE}/voice/list`, { headers }),
    ]);

    const avatarsJson = await avatarsRes.json().catch(() => ({}));
    const voicesJson = await voicesRes.json().catch(() => ({}));

    // Normalize. Vidnoz can return arrays directly, or { data: { list/avatars/voices/items: [...] } }
    const pickArray = (root: any, keys: string[]): any[] => {
      if (Array.isArray(root)) return root;
      if (!root || typeof root !== "object") return [];
      for (const k of keys) {
        if (Array.isArray(root[k])) return root[k];
      }
      // Fallback: first array value found in the object
      for (const v of Object.values(root)) {
        if (Array.isArray(v)) return v as any[];
      }
      return [];
    };

    const avatarsRoot = avatarsJson?.data ?? avatarsJson;
    const voicesRoot = voicesJson?.data ?? voicesJson;

    console.log("vidnoz-avatars raw shape:", {
      avatarsKeys: avatarsRoot && typeof avatarsRoot === "object" ? Object.keys(avatarsRoot) : typeof avatarsRoot,
      voicesKeys: voicesRoot && typeof voicesRoot === "object" ? Object.keys(voicesRoot) : typeof voicesRoot,
      avatarsCode: avatarsJson?.code,
      voicesCode: voicesJson?.code,
    });

    const rawAvatars = pickArray(avatarsRoot, ["avatars", "list", "items", "data"])
      .filter((a: any) => a && (a.avatar_id || a.id));

    // Normalize, tag business-friendly, and sort business-first
    const avatars = rawAvatars
      .map((a: any) => ({
        avatar_id: a.avatar_id || a.id,
        name: a.name || a.avatar_name || "Avatar",
        gender: a.gender || "unknown",
        category: a.category || a.style || "",
        thumb: a.preview_image_url || a.thumb_url || a.image_url || a.avatar_url || "",
        avatar_url: a.avatar_url || a.image_url || a.preview_image_url || "",
        preview_video_url: a.preview_video_url || "",
        is_business: isBusinessAvatar(a),
      }))
      .sort((a: any, b: any) => Number(b.is_business) - Number(a.is_business));

    const voices = pickArray(voicesRoot, ["voices", "list", "items", "data"])
      .map((v: any) => ({
        voice_id: v.voice_id || v.id,
        name: v.name,
        language: v.language,
        country_name: v.country_name,
        gender: v.gender,
        preview_audio_url: v.preview_audio_url,
        preview_image_url: v.preview_image_url,
        emotions: v.emotions || [],
        styles: v.style_list || v.emotions || [],
      }))
      .filter((v: any) => v.voice_id);

    const payload = { avatars, voices };
    _cache = { ts: Date.now(), payload };

    return new Response(
      JSON.stringify({ ...payload, cached: false, business_count: avatars.filter((a: any) => a.is_business).length }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300",
        },
      }
    );
  } catch (e) {
    console.error("vidnoz-avatars error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
