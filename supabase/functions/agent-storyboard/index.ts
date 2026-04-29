// Pre-fetch multiple Freepik suggestions per scene keyword so the user
// can review and swap assets before the final render.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Suggestion {
  url: string;
  thumb: string;
  source: string;
  id?: string;
}

async function freepikDownloadUrl(apiKey: string, resourceId: string | number): Promise<string | null> {
  try {
    const r = await fetch(`https://api.freepik.com/v1/videos/${resourceId}/download`, {
      headers: { "x-freepik-api-key": apiKey },
    });
    if (!r.ok) return null;
    const data = await r.json().catch(() => ({}));
    const url: string | undefined = data?.data?.url || data?.url;
    return url && /^https?:\/\//.test(url) ? url : null;
  } catch (e) {
    console.error("freepik download err", resourceId, e);
    return null;
  }
}

async function searchFreepik(apiKey: string, term: string, limit = 6): Promise<Suggestion[]> {
  try {
    const params = new URLSearchParams({ term, limit: String(limit) });
    const r = await fetch(`https://api.freepik.com/v1/videos?${params}`, {
      headers: { "x-freepik-api-key": apiKey },
    });
    if (!r.ok) return [];
    const data = await r.json();
    const items: any[] = Array.isArray(data?.data) ? data.data : [];
    const out: Suggestion[] = [];
    for (const it of items) {
      const previews: any[] = Array.isArray(it?.previews) ? it.previews : [];
      const previewUrl =
        previews[previews.length - 1]?.url ||
        previews[0]?.url ||
        it?.image?.source?.url ||
        it?.video?.preview?.url ||
        it?.preview?.url;
      const thumbs: any[] = Array.isArray(it?.thumbnails) ? it.thumbnails : [];
      const thumb =
        thumbs[thumbs.length - 1]?.url ||
        thumbs[0]?.url ||
        it?.image?.source?.url ||
        previewUrl;
      const resourceId = it?.id;
      const cleanUrl = resourceId ? await freepikDownloadUrl(apiKey, resourceId) : null;
      if (cleanUrl) {
        out.push({ url: cleanUrl, thumb: thumb || cleanUrl, source: "freepik", id: String(resourceId) });
      } else if (previewUrl && /\.(mp4|webm|mov)(\?|$)/i.test(previewUrl)) {
        console.warn(`freepik skipped watermarked preview for "${term}" (id=${resourceId})`);
      }
    }
    return out;
  } catch (e) {
    console.error("freepik search err", term, e);
    return [];
  }
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
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
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
        return new Response(JSON.stringify({ error: "Invalid" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      userId = data.user.id;
    }

    const { projectId } = await req.json();
    const { data: project } = await admin
      .from("agent_projects")
      .select("*")
      .eq("id", projectId)
      .eq("user_id", userId)
      .single();
    if (!project?.plan?.scene_keywords?.length) {
      return new Response(JSON.stringify({ error: "Plan not ready" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const FREEPIK_API_KEY = Deno.env.get("FREEPIK_API_KEY");
    if (!FREEPIK_API_KEY) throw new Error("FREEPIK_API_KEY missing");

    const keywords: string[] = project.plan.scene_keywords.slice(0, 8);
    const sceneDuration =
      Math.max(3, Math.round((project.target_duration / Math.max(keywords.length, 1)) * 10) / 10);

    // B-roll mix: deterministic distribution of "talking head" vs "sketch" qualifiers across scenes
    const mix = (project.broll_mix || { talking_head: 50, sketch: 50 }) as {
      talking_head: number;
      sketch: number;
    };
    const totalMix = Math.max(1, (mix.talking_head || 0) + (mix.sketch || 0));
    const sketchTarget = Math.round(((mix.sketch || 0) / totalMix) * keywords.length);
    // Build per-scene type assignment, evenly interleaved
    const types: Array<"talking_head" | "sketch"> = [];
    const step = keywords.length / Math.max(1, sketchTarget || 1);
    for (let i = 0; i < keywords.length; i++) {
      const isSketch = sketchTarget > 0 && Math.floor(i % step) === 0 && types.filter((t) => t === "sketch").length < sketchTarget;
      types.push(isSketch ? "sketch" : "talking_head");
    }
    const qualifier = (t: "talking_head" | "sketch") =>
      t === "sketch" ? "sketch blueprint illustration animation" : "person talking close up portrait real footage";

    const overrides: Array<{
      keyword: string;
      duration: number;
      broll_type: "talking_head" | "sketch";
      suggestions: Suggestion[];
      selectedIndex: number;
    }> = [];

    for (let i = 0; i < keywords.length; i++) {
      const kw = keywords[i];
      const t = types[i];
      const term = `${kw} ${qualifier(t)}`;
      const suggestions = await searchFreepik(FREEPIK_API_KEY, term, 6);
      // Fallback to plain keyword if styled search returns nothing
      const finalSuggestions = suggestions.length > 0 ? suggestions : await searchFreepik(FREEPIK_API_KEY, kw, 6);
      overrides.push({
        keyword: kw,
        duration: sceneDuration,
        broll_type: t,
        suggestions: finalSuggestions,
        selectedIndex: finalSuggestions.length > 0 ? 0 : -1,
      });
    }

    await admin
      .from("agent_projects")
      .update({ scene_overrides: overrides })
      .eq("id", projectId);

    return new Response(JSON.stringify({ success: true, overrides }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("agent-storyboard error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
