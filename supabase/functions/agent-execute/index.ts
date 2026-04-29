import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SelectedAsset {
  keyword: string;
  url: string;
  thumb: string;
  source: string;
  duration: number; // seconds for the storyboard slot
}

async function appendLog(
  supabase: any,
  projectId: string,
  message: string,
  pct: number,
  step?: string
) {
  // Read current log to append safely (no SQL array push without function)
  const { data } = await supabase
    .from("agent_projects")
    .select("progress_log")
    .eq("id", projectId)
    .single();
  const log = Array.isArray(data?.progress_log) ? data.progress_log : [];
  log.push({ at: Date.now(), message });
  await supabase
    .from("agent_projects")
    .update({
      progress_log: log,
      progress_pct: pct,
      execution_step: step ?? message,
    })
    .eq("id", projectId);
}

async function searchFreepikVideo(
  apiKey: string,
  term: string
): Promise<{ url: string; thumb: string } | null> {
  try {
    const params = new URLSearchParams({ term, limit: "5" });
    const r = await fetch(`https://api.freepik.com/v1/videos?${params}`, {
      headers: { "x-freepik-api-key": apiKey },
    });
    if (!r.ok) return null;
    const data = await r.json();
    const items: any[] = Array.isArray(data?.data) ? data.data : [];
    for (const it of items) {
      // Freepik video item: image.source.url is preview MP4, preview / thumbnails available
      const previewUrl =
        it?.image?.source?.url ||
        it?.video?.preview?.url ||
        it?.preview?.url ||
        it?.url;
      const thumb =
        it?.image?.source?.url ||
        it?.thumbnails?.[0]?.url ||
        it?.image?.thumb ||
        previewUrl;
      if (previewUrl && /\.(mp4|webm|mov)(\?|$)/i.test(previewUrl)) {
        return { url: previewUrl, thumb };
      }
    }
    return null;
  } catch (e) {
    console.error("Freepik search failed for", term, e);
    return null;
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
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const token = authHeader.replace("Bearer ", "");
    let userId: string | undefined;
    try {
      const { data, error } = await supabase.auth.getClaims(token);
      if (!error && data?.claims) userId = data.claims.sub as string;
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

    const { projectId } = await req.json();
    const { data: project } = await adminClient
      .from("agent_projects")
      .select("*")
      .eq("id", projectId)
      .eq("user_id", userId)
      .single();
    if (!project || !project.plan?.transcript) {
      return new Response(JSON.stringify({ error: "Plan not ready" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await adminClient
      .from("agent_projects")
      .update({
        execution_status: "running",
        progress_pct: 0,
        progress_log: [],
        error_message: null,
      })
      .eq("id", projectId);

    const FREEPIK_API_KEY = Deno.env.get("FREEPIK_API_KEY");
    const JSON2VIDEO_API_KEY = Deno.env.get("JSON2VIDEO_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

    if (!FREEPIK_API_KEY || !JSON2VIDEO_API_KEY) {
      throw new Error("Missing FREEPIK_API_KEY or JSON2VIDEO_API_KEY");
    }

    // === 1. Asset collection (honor user overrides if present) ===
    await appendLog(adminClient, projectId, "Locking visual style...", 5, "style");
    const overrides: any[] = Array.isArray(project.scene_overrides) ? project.scene_overrides : [];
    const assets: SelectedAsset[] = [];

    if (overrides.length > 0) {
      for (let i = 0; i < overrides.length; i++) {
        const ov = overrides[i];
        await appendLog(
          adminClient,
          projectId,
          `Using selected asset for "${ov.keyword}"...`,
          10 + Math.round((i / overrides.length) * 35),
          "asset-collection"
        );
        const idx = typeof ov.selectedIndex === "number" ? ov.selectedIndex : 0;
        const pick = ov.suggestions?.[idx] ?? ov.suggestions?.[0];
        if (pick?.url) {
          assets.push({
            keyword: ov.keyword,
            url: pick.url,
            thumb: pick.thumb,
            source: pick.source || "freepik",
            duration: Number(ov.duration) || 4,
          });
        }
      }
    } else {
      const keywords: string[] = (project.plan.scene_keywords || []).slice(0, 6);
      const sceneDuration = Math.max(
        3,
        Math.round((project.target_duration / Math.max(keywords.length, 1)) * 10) / 10
      );
      for (let i = 0; i < keywords.length; i++) {
        const kw = keywords[i];
        await appendLog(
          adminClient,
          projectId,
          `Searching for "${kw}"...`,
          10 + Math.round((i / keywords.length) * 35),
          "asset-collection"
        );
        const found = await searchFreepikVideo(FREEPIK_API_KEY, kw);
        if (found) {
          assets.push({
            keyword: kw,
            url: found.url,
            thumb: found.thumb,
            source: "freepik",
            duration: sceneDuration,
          });
        }
      }
    }

    if (assets.length === 0) {
      throw new Error("No stock assets found for any keyword");
    }

    await adminClient
      .from("agent_projects")
      .update({ selected_assets: assets, storyboard: { scenes: assets } })
      .eq("id", projectId);

    // === 2. Narration TTS ===
    await appendLog(adminClient, projectId, "Generating narration voiceover...", 50, "narration");

    const ttsResp = await fetch(`${SUPABASE_URL}/functions/v1/inworld-tts`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: project.plan.transcript,
        voiceId: project.voice_id || undefined,
        languageCode: project.language?.slice(0, 2) || "en",
      }),
    });

    if (!ttsResp.ok) {
      const txt = await ttsResp.text();
      throw new Error(`TTS failed: ${ttsResp.status} ${txt.slice(0, 200)}`);
    }
    const ttsData = await ttsResp.json();
    const audioBase64: string | undefined = ttsData?.audioContent;
    if (!audioBase64) throw new Error("TTS returned no audio");

    // Upload narration to storage (decode base64)
    const audioBytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
    const audioPath = `${userId}/${projectId}/narration-${Date.now()}.mp3`;
    const { error: upErr } = await adminClient.storage
      .from("agent-uploads")
      .upload(audioPath, audioBytes, { contentType: "audio/mpeg", upsert: true });
    if (upErr) throw new Error(`Audio upload failed: ${upErr.message}`);
    const { data: audioUrlData } = adminClient.storage
      .from("agent-uploads")
      .getPublicUrl(audioPath);
    const narrationUrl = audioUrlData.publicUrl;

    await adminClient
      .from("agent_projects")
      .update({ narration_url: narrationUrl })
      .eq("id", projectId);

    // === 3. Render via JSON2Video (with style + subtitles + intro/outro) ===
    await appendLog(adminClient, projectId, "Building storyboard & rendering...", 70, "render");

    const resolution =
      project.aspect_ratio === "9:16"
        ? { width: 1080, height: 1920 }
        : project.aspect_ratio === "1:1"
        ? { width: 1080, height: 1080 }
        : { width: 1920, height: 1080 };

    const palette = (project.color_palette || {}) as any;
    const primary = palette.primary || "#3B82F6";
    const secondary = palette.secondary || "#0F172A";
    const accent = palette.accent || "#F59E0B";
    const fontFamily = project.typography || "Inter";
    const transitionLevel = project.transition_level || "medium";
    const transitionMap: Record<string, { style: string; duration: number }> = {
      none: { style: "fade", duration: 0 },
      subtle: { style: "fade", duration: 0.3 },
      medium: { style: "fade", duration: 0.6 },
      bold: { style: "wipeleft", duration: 0.8 },
    };
    const t = transitionMap[transitionLevel] || transitionMap.medium;

    const scenes: any[] = [];

    // Intro title scene
    const intro = project.intro_title as any;
    if (intro?.enabled && intro?.text) {
      scenes.push({
        duration: Number(intro.duration) || 2.5,
        "background-color": secondary,
        elements: [
          {
            type: "text",
            text: String(intro.text).slice(0, 120),
            settings: {
              "font-family": fontFamily,
              "font-size": project.aspect_ratio === "9:16" ? 90 : 72,
              "font-weight": "700",
              color: primary,
              "text-align": "center",
              "vertical-align": "center",
            },
            "fade-in": 0.4,
            "fade-out": 0.4,
          },
        ],
      });
    }

    // Body scenes from assets
    for (const a of assets) {
      scenes.push({
        duration: a.duration,
        transition: { style: t.style, duration: t.duration },
        elements: [
          {
            type: "video",
            src: a.url,
            resize: "cover",
            muted: true,
            "fade-in": 0.3,
            "fade-out": 0.3,
          },
        ],
      });
    }

    // Outro CTA scene
    const outro = project.outro_cta as any;
    if (outro?.enabled && outro?.text) {
      scenes.push({
        duration: Number(outro.duration) || 3,
        "background-color": secondary,
        elements: [
          {
            type: "text",
            text: String(outro.text).slice(0, 120),
            settings: {
              "font-family": fontFamily,
              "font-size": project.aspect_ratio === "9:16" ? 80 : 64,
              "font-weight": "700",
              color: accent,
              "text-align": "center",
              "vertical-align": "center",
            },
            "fade-in": 0.4,
          },
        ],
      });
    }

    const sub = (project.subtitle_config || {}) as any;
    const fontSizeMap: Record<string, number> = {
      small: project.aspect_ratio === "9:16" ? 54 : 42,
      medium: project.aspect_ratio === "9:16" ? 70 : 56,
      large: project.aspect_ratio === "9:16" ? 88 : 72,
    };
    const subPosition: string =
      sub?.position && ["bottom-center", "top-center", "mid-center"].includes(sub.position)
        ? sub.position
        : "bottom-center";

    const elements: any[] = [
      {
        type: "audio",
        src: narrationUrl,
        volume: 1,
        "fade-in": 0.2,
        "fade-out": 0.5,
      },
    ];

    if (sub?.enabled !== false) {
      elements.push({
        type: "subtitles",
        language: sub?.language && sub.language !== "auto" ? sub.language : (project.language?.slice(0, 2) || "auto"),
        settings: {
          style: "classic-progressive",
          position: subPosition,
          "font-family": `${fontFamily} Bold`,
          "font-size": fontSizeMap[sub?.fontSize] || fontSizeMap.medium,
          "word-color": "#FFFFFF",
          "line-color": "#FFFFFF",
          "outline-color": "#000000",
          "outline-width": 3,
          "max-words-per-line": 6,
        },
      });
    }

    const movie: any = {
      resolution: "custom",
      width: resolution.width,
      height: resolution.height,
      quality: "high",
      draft: false,
      scenes,
      elements,
    };

    const renderResp = await fetch("https://api.json2video.com/v2/movies", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": JSON2VIDEO_API_KEY,
      },
      body: JSON.stringify(movie),
    });

    if (!renderResp.ok) {
      const txt = await renderResp.text();
      throw new Error(`JSON2Video render failed: ${renderResp.status} ${txt.slice(0, 300)}`);
    }
    const renderData = await renderResp.json();
    const j2vProjectId = renderData?.project;

    await adminClient
      .from("agent_projects")
      .update({
        json2video_project_id: j2vProjectId,
        execution_step: "rendering",
        progress_pct: 80,
      })
      .eq("id", projectId);
    await appendLog(adminClient, projectId, "Rendering on JSON2Video...", 80, "rendering");

    return new Response(
      JSON.stringify({ success: true, projectId: j2vProjectId, narrationUrl, scenes: assets.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("agent-execute error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    try {
      const { projectId } = await req.clone().json();
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      if (projectId) {
        await adminClient
          .from("agent_projects")
          .update({ execution_status: "error", error_message: msg })
          .eq("id", projectId);
      }
    } catch (_) {}
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
