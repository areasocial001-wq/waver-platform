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

// Resolve a clean (non-watermarked) MP4 URL for a given Freepik video resource ID.
// Consumes 1 download credit on the Freepik account.
async function freepikDownloadUrl(apiKey: string, resourceId: string | number): Promise<string | null> {
  try {
    const r = await fetch(`https://api.freepik.com/v1/videos/${resourceId}/download`, {
      headers: { "x-freepik-api-key": apiKey },
    });
    if (!r.ok) {
      const t = await r.text();
      console.warn(`Freepik download failed for ${resourceId}: ${r.status} ${t.slice(0, 160)}`);
      return null;
    }
    const data = await r.json();
    // Freepik response shape: { data: { url: "https://..." } }
    const cleanUrl: string | undefined = data?.data?.url || data?.url;
    if (cleanUrl && /^https?:\/\//.test(cleanUrl)) return cleanUrl;
    return null;
  } catch (e) {
    console.error("Freepik download error", resourceId, e);
    return null;
  }
}

interface InworldVoice {
  name?: string;
  voiceId?: string;
  displayName?: string;
  langCode?: string;
  tags?: string[];
  source?: string;
}

const normalizeLang = (value?: string | null) =>
  (value || "").toLowerCase().replace("_", "-").split("-")[0];

const normalizeVoiceId = (voice: InworldVoice): string => {
  if (voice.source === "IVC" && voice.name?.startsWith("workspaces/")) return voice.name;
  return String(voice.voiceId || voice.name || voice.displayName || "");
};

function voiceSupportsLanguage(voice: InworldVoice, lang: string): boolean {
  const target = normalizeLang(lang);
  const direct = normalizeLang(voice.langCode);
  if (direct) return direct === target;
  const tags = Array.isArray(voice.tags) ? voice.tags : [];
  return tags.some((tag) => normalizeLang(tag) === target || tag.toLowerCase().includes(`language:${target}`));
}

async function listInworldVoices(apiKey?: string): Promise<InworldVoice[]> {
  if (!apiKey) return [];
  const call = (scheme: "Basic" | "Bearer") =>
    fetch("https://api.inworld.ai/voices/v1/voices", {
      headers: { Authorization: `${scheme} ${apiKey}` },
    });
  let resp = await call("Basic");
  if (resp.status === 401 || resp.status === 403) resp = await call("Bearer");
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    console.warn("Inworld voice list unavailable:", resp.status, body.slice(0, 180));
    return [];
  }
  const json = await resp.json().catch(() => ({}));
  return Array.isArray(json?.voices) ? json.voices : [];
}

function resolveVoiceForLanguage(voices: InworldVoice[], requestedVoiceId: string | null | undefined, lang: string) {
  const supported = voices
    .map((voice) => ({ voice, id: normalizeVoiceId(voice) }))
    .filter((entry) => entry.id && voiceSupportsLanguage(entry.voice, lang));
  const requested = requestedVoiceId || "";
  const selected = requested
    ? supported.find((entry) =>
        entry.id === requested ||
        entry.voice.name === requested ||
        entry.voice.displayName === requested ||
        entry.voice.voiceId === requested,
      )
    : undefined;
  const fallback = supported.find((entry) =>
    /female|woman|girl|donna|femminile|mujer|femme|weiblich/i.test(
      `${entry.voice.displayName || ""} ${(entry.voice.tags || []).join(" ")}`,
    ),
  ) || supported[0];
  return {
    selectedId: selected?.id,
    fallbackId: fallback?.id,
    supportedCount: supported.length,
  };
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
      const resourceId = it?.id;
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
        previewUrl;

      // Try to fetch the clean (non-watermarked) URL via the download endpoint
      if (resourceId) {
        const cleanUrl = await freepikDownloadUrl(apiKey, resourceId);
        if (cleanUrl) {
          return { url: cleanUrl, thumb: thumb || cleanUrl };
        }
      }
      if (previewUrl && /\.(mp4|webm|mov)(\?|$)/i.test(previewUrl)) {
        console.warn(`Freepik: skipped watermarked preview for "${term}" (id=${resourceId})`);
      }
    }
    console.log(`Freepik: no usable video found in ${items.length} results for "${term}"`);
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

    // Vidnoz substitution config
    const useVidnoz = !!project.use_vidnoz_for_talking_head
      && !!project.vidnoz_avatar_url
      && !!project.vidnoz_voice_id;
    const VIDNOZ_API_KEY = Deno.env.get("VIDNOZ_API_KEY");

    // Pre-split transcript across talking-head scenes proportional to duration
    const transcript: string = String(project.plan.transcript || "");
    const transcriptWords = transcript.split(/\s+/).filter(Boolean);
    const thIndices: number[] = useVidnoz
      ? overrides
          .map((o, i) => (o?.broll_type === "talking_head" ? i : -1))
          .filter((i) => i >= 0)
      : [];
    const totalThDuration = thIndices.reduce((s, i) => s + (Number(overrides[i]?.duration) || 4), 0);
    const wordSlices: Record<number, string> = {};
    if (useVidnoz && thIndices.length > 0 && transcriptWords.length > 0) {
      let cursor = 0;
      for (let k = 0; k < thIndices.length; k++) {
        const idx = thIndices[k];
        const dur = Number(overrides[idx]?.duration) || 4;
        const share = totalThDuration > 0 ? dur / totalThDuration : 1 / thIndices.length;
        const isLast = k === thIndices.length - 1;
        const wordCount = isLast
          ? transcriptWords.length - cursor
          : Math.max(1, Math.round(transcriptWords.length * share));
        wordSlices[idx] = transcriptWords.slice(cursor, cursor + wordCount).join(" ");
        cursor += wordCount;
      }
    }

    if (overrides.length > 0) {
      for (let i = 0; i < overrides.length; i++) {
        const ov = overrides[i];
        const isTH = ov?.broll_type === "talking_head";
        const dur = Number(ov.duration) || 4;

        if (useVidnoz && isTH && VIDNOZ_API_KEY) {
          const sliceText = wordSlices[i] || transcript.slice(0, 200);
          await appendLog(
            adminClient,
            projectId,
            `Generating Vidnoz avatar for scene "${ov.keyword}"...`,
            10 + Math.round((i / overrides.length) * 35),
            "vidnoz-avatar"
          );
          try {
            const fd = new FormData();
            fd.append("voice_id", project.vidnoz_voice_id);
            fd.append("text", sliceText.slice(0, 1500));
            fd.append("type", "0");
            fd.append("avatar_url", project.vidnoz_avatar_url);
            const startResp = await fetch(
              "https://devapi.vidnoz.com/v2/task/generate-talking-head",
              {
                method: "POST",
                headers: { Authorization: `Bearer ${VIDNOZ_API_KEY}`, accept: "application/json" },
                body: fd,
              }
            );
            const startJson = await startResp.json();
            if (!startResp.ok || startJson?.code !== 200) {
              throw new Error(`Vidnoz start error: ${JSON.stringify(startJson).slice(0, 200)}`);
            }
            const taskId = String(startJson?.data?.id ?? startJson?.data?.task_id ?? "");
            if (!taskId) throw new Error("Vidnoz returned no task id");

            // Poll
            let url = "";
            const maxMs = 240_000;
            const t0 = Date.now();
            let delay = 4000;
            while (Date.now() - t0 < maxMs && !url) {
              await new Promise((r) => setTimeout(r, delay));
              delay = Math.min(delay + 1000, 8000);
              const dfd = new FormData();
              dfd.append("id", taskId);
              const dResp = await fetch("https://devapi.vidnoz.com/v2/task/detail", {
                method: "POST",
                headers: { Authorization: `Bearer ${VIDNOZ_API_KEY}`, accept: "application/json" },
                body: dfd,
              });
              const dJson = await dResp.json().catch(() => ({}));
              const additional = dJson?.data?.additional_data || {};
              url = additional?.video_720p?.url || additional?.url || "";
            }
            if (!url) throw new Error("Vidnoz polling timeout");

            assets.push({
              keyword: ov.keyword,
              url,
              thumb: project.vidnoz_avatar_url,
              source: "vidnoz",
              duration: dur,
            });
            continue; // skip Freepik fallback
          } catch (vidErr) {
            console.error("Vidnoz scene generation failed, falling back to Freepik:", vidErr);
            await appendLog(
              adminClient,
              projectId,
              `Vidnoz failed for "${ov.keyword}", using Freepik fallback`,
              10 + Math.round((i / overrides.length) * 35),
              "vidnoz-fallback"
            );
          }
        }

        // Default: use selected suggestion, else fallback to live Freepik search
        await appendLog(
          adminClient,
          projectId,
          `Resolving asset for "${ov.keyword}"...`,
          10 + Math.round((i / overrides.length) * 35),
          "asset-collection"
        );
        const idx = typeof ov.selectedIndex === "number" && ov.selectedIndex >= 0 ? ov.selectedIndex : 0;
        let pick = ov.suggestions?.[idx] ?? ov.suggestions?.[0];
        if (pick?.source === "freepik" && pick?.id) {
          const cleanUrl = await freepikDownloadUrl(FREEPIK_API_KEY, pick.id);
          if (cleanUrl) {
            pick = { ...pick, url: cleanUrl, thumb: pick.thumb || cleanUrl };
          } else {
            await appendLog(
              adminClient,
              projectId,
              `⚠️ Asset Freepik "${ov.keyword}" ignorato: disponibile solo anteprima con watermark. Cerco un'alternativa pulita.`,
              10 + Math.round((i / overrides.length) * 35),
              "asset-collection"
            );
            pick = undefined;
          }
        }
        if (!pick?.url) {
          const found = await searchFreepikVideo(FREEPIK_API_KEY, ov.keyword);
          if (found) pick = { url: found.url, thumb: found.thumb, source: "freepik" };
        }
        if (pick?.url) {
          assets.push({
            keyword: ov.keyword,
            url: pick.url,
            thumb: pick.thumb,
            source: pick.source || "freepik",
            duration: dur,
          });
        } else {
          console.warn(`No asset found for keyword "${ov.keyword}" (no suggestion + Freepik empty)`);
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
      throw new Error("No assets generated for any keyword");
    }

    await adminClient
      .from("agent_projects")
      .update({ selected_assets: assets, storyboard: { scenes: assets } })
      .eq("id", projectId);

    // === 2. Narration TTS (skipped when Vidnoz handles voice) ===
    let narrationUrl: string | null = null;
    if (!useVidnoz) {
      await appendLog(adminClient, projectId, "Generating narration voiceover...", 50, "narration");

      const lang = (project.language?.slice(0, 2).toLowerCase() || "en");
      const isEnglish = lang === "en";

      // Curated Inworld native voices per language. These all run on the
      // multilingual model `inworld-tts-1.5-max` and produce native pronunciation
      // (no English accent on Italian/Spanish/etc.). First entry is the default.
      // Real Inworld voice names (language-agnostic). Pronunciation comes from
      // the multilingual model `inworld-tts-1.5-max` + languageCode. Sending a
      // non-existent name like "Giulia" returns 404 from Inworld.
      const MULTILINGUAL_VOICES = ["Edward", "Mark", "Alex", "Roger", "Sarah", "Olivia", "Ashley", "Julia"];
      const nativeList = MULTILINGUAL_VOICES;

      // Decide which voice to send to Inworld:
      //  - English: respect the user's voice_id (legacy ElevenLabs IDs are mapped server-side).
      //  - Non-English: if the user picked a native voice (a plain Inworld name like "Giulia"
      //    or "Alessandro") use it directly. Otherwise force the curated default for that
      //    language and ignore any English-centric voice_id.
      const looksLikeInworldName = (v?: string | null) =>
        !!v && /^[A-Z][a-zA-Z]{2,30}$/.test(v);

      let resolvedVoiceId: string | undefined;
      if (isEnglish) {
        resolvedVoiceId = project.voice_id || undefined;
      } else if (looksLikeInworldName(project.voice_id) && nativeList.includes(project.voice_id!)) {
        resolvedVoiceId = project.voice_id!;
      } else {
        resolvedVoiceId = nativeList[0]; // curated native default for this language
      }

      // Always force the multilingual high-quality model for non-English narration.
      const forcedModel = isEnglish ? undefined : "inworld-tts-1.5-max";

      await appendLog(
        adminClient,
        projectId,
        `TTS: lang=${lang} voice=${resolvedVoiceId ?? "auto"} model=${forcedModel ?? "default"}`,
        52,
        "narration",
      );

      const FALLBACK_VOICE = "Sarah"; // known-good multilingual default
      async function callTts(voiceId: string | undefined) {
        return await fetch(`${SUPABASE_URL}/functions/v1/inworld-tts`, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: project.plan.transcript,
            voiceId,
            languageCode: lang,
            modelId: forcedModel,
          }),
        });
      }

      let ttsResp = await callTts(resolvedVoiceId);
      let ttsWarning: string | null = null;

      if (!ttsResp.ok) {
        const txt = await ttsResp.text();
        const isUnknownVoice =
          ttsResp.status === 404 ||
          /Unknown voice|not found/i.test(txt);

        if (isUnknownVoice && resolvedVoiceId !== FALLBACK_VOICE) {
          ttsWarning = `La voce "${resolvedVoiceId}" non è disponibile su Inworld per ${lang.toUpperCase()}. Uso fallback "${FALLBACK_VOICE}".`;
          await appendLog(adminClient, projectId, `⚠️ ${ttsWarning}`, 53, "narration");
          ttsResp = await callTts(FALLBACK_VOICE);
          if (!ttsResp.ok) {
            const txt2 = await ttsResp.text();
            throw new Error(`TTS failed (fallback): ${ttsResp.status} ${txt2.slice(0, 200)}`);
          }
        } else {
          throw new Error(`TTS failed: ${ttsResp.status} ${txt.slice(0, 200)}`);
        }
      }
      const ttsData = await ttsResp.json();
      const audioBase64: string | undefined = ttsData?.audioContent;
      if (!audioBase64) throw new Error("TTS returned no audio");

      // Warning already surfaced via appendLog above; wizard polls logs.

      const audioBytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
      const audioPath = `${userId}/${projectId}/narration-${Date.now()}.mp3`;
      const { error: upErr } = await adminClient.storage
        .from("agent-uploads")
        .upload(audioPath, audioBytes, { contentType: "audio/mpeg", upsert: true });
      if (upErr) throw new Error(`Audio upload failed: ${upErr.message}`);
      const { data: audioUrlData } = adminClient.storage
        .from("agent-uploads")
        .getPublicUrl(audioPath);
      narrationUrl = audioUrlData.publicUrl;

      await adminClient
        .from("agent_projects")
        .update({ narration_url: narrationUrl })
        .eq("id", projectId);
    } else {
      await appendLog(adminClient, projectId, "Vidnoz avatars provide voice, skipping TTS", 50, "narration");
    }

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
      const isVidnoz = a.source === "vidnoz";
      scenes.push({
        duration: a.duration,
        transition: { style: t.style, duration: t.duration },
        elements: [
          {
            type: "video",
            src: a.url,
            resize: "cover",
            muted: !isVidnoz, // keep Vidnoz audio (it's the voiceover)
            volume: isVidnoz ? 1 : 0,
            // No per-clip fade: the scene `transition` already handles the
            // crossover between scenes. Stacking both produces long black gaps.
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

    const elements: any[] = [];
    if (narrationUrl) {
      elements.push({
        type: "audio",
        src: narrationUrl,
        volume: 1,
        "fade-in": 0.2,
        "fade-out": 0.5,
      });
    }

    if (sub?.enabled !== false) {
      elements.push({
        type: "subtitles",
        language: sub?.language && sub.language !== "auto" ? sub.language : (project.language?.slice(0, 2) || "auto"),
        settings: {
          style: "classic-progressive",
          position: subPosition,
          "font-family": fontFamily,
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
