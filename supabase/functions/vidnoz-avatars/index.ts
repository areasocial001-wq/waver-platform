// List Vidnoz official avatars + voices for the Video Agent UI selectors.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VIDNOZ_BASE = "https://devapi.vidnoz.com/v2";

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

    const avatars = pickArray(avatarsRoot, ["avatars", "list", "items", "data"])
      .filter((a: any) => a && (a.avatar_id || a.id))
      .map((a: any) => ({
        avatar_id: a.avatar_id || a.id,
        name: a.name || a.avatar_name || "Avatar",
        gender: a.gender || "unknown",
        thumb: a.preview_image_url || a.thumb_url || a.image_url || a.avatar_url || "",
        avatar_url: a.avatar_url || a.image_url || a.preview_image_url || "",
        preview_video_url: a.preview_video_url || "",
      }));

    const voices = (voicesJson?.data?.voices || voicesJson?.data || [])
      .filter((v: any) => v && v.voice_id)
      .map((v: any) => ({
        voice_id: v.voice_id,
        name: v.name,
        language: v.language,
        country_name: v.country_name,
        gender: v.gender,
        preview_audio_url: v.preview_audio_url,
        styles: v.style_list || [],
      }));

    return new Response(
      JSON.stringify({ avatars, voices }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("vidnoz-avatars error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
