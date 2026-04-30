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
      heartbeat_at: new Date().toISOString(),
    })
    .eq("id", projectId);
}

// Lightweight heartbeat — call inside long-running loops so the client knows
// the worker is still alive even when no log line is being added.
async function heartbeat(supabase: any, projectId: string) {
  try {
    await supabase
      .from("agent_projects")
      .update({ heartbeat_at: new Date().toISOString() })
      .eq("id", projectId);
  } catch (_) {
    // best-effort
  }
}

// Append a failed scene record (or replace the entry for the same scene index).
async function recordFailedScene(
  supabase: any,
  projectId: string,
  entry: { index: number; keyword: string; reason: string; provider: string }
) {
  const { data } = await supabase
    .from("agent_projects")
    .select("failed_scenes")
    .eq("id", projectId)
    .single();
  const list = Array.isArray(data?.failed_scenes) ? data.failed_scenes : [];
  const filtered = list.filter((f: any) => f?.index !== entry.index);
  filtered.push({ ...entry, at: Date.now() });
  await supabase
    .from("agent_projects")
    .update({ failed_scenes: filtered, heartbeat_at: new Date().toISOString() })
    .eq("id", projectId);
}

// Persist a single Vidnoz scene asset incrementally into selected_assets so a
// resume invocation doesn't have to regenerate it.
async function persistVidnozScene(
  supabase: any,
  projectId: string,
  index: number,
  asset: SelectedAsset
) {
  const { data } = await supabase
    .from("agent_projects")
    .select("selected_assets")
    .eq("id", projectId)
    .single();
  const list = Array.isArray(data?.selected_assets) ? data.selected_assets : [];
  const filtered = list.filter((a: any) => a?._vidnozScene !== index);
  filtered.push({ ...asset, _vidnozScene: index });
  await supabase
    .from("agent_projects")
    .update({ selected_assets: filtered, heartbeat_at: new Date().toISOString() })
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

    const reqBody = await req.json().catch(() => ({}));
    const { projectId, resume, retryScenes } = reqBody as {
      projectId: string;
      resume?: boolean;
      retryScenes?: number[];
    };
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

    const isResume = !!resume || (Array.isArray(retryScenes) && retryScenes.length > 0);
    const heartbeatAt = project.heartbeat_at ? new Date(project.heartbeat_at).getTime() : 0;
    const isFreshRun =
      (project.execution_status === "running" || project.execution_status === "rendering") &&
      heartbeatAt > 0 &&
      Date.now() - heartbeatAt < 2 * 60 * 1000;
    if (isFreshRun && !isResume) {
      return new Response(JSON.stringify({ error: "Produzione già in corso. Attendi il completamento o usa Riprendi solo se si blocca." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If resuming, preserve previously generated assets and progress log so we
    // skip already-completed scenes. Clear failed_scenes for the ones we are
    // about to retry.
    const initPatch: Record<string, unknown> = {
      execution_status: "running",
      error_message: null,
      heartbeat_at: new Date().toISOString(),
      json2video_project_id: null,
      final_video_url: null,
    };
    if (!isResume) {
      initPatch.progress_pct = 0;
      initPatch.progress_log = [];
      initPatch.selected_assets = [];
      initPatch.failed_scenes = [];
    } else if (Array.isArray(retryScenes) && retryScenes.length > 0) {
      // Drop only the entries we're about to retry; keep the rest.
      const keepFailed = (Array.isArray(project.failed_scenes) ? project.failed_scenes : [])
        .filter((f: any) => !retryScenes.includes(f?.index));
      const keepAssets = (Array.isArray(project.selected_assets) ? project.selected_assets : [])
        .filter((a: any) => !retryScenes.includes(a?._vidnozScene));
      initPatch.failed_scenes = keepFailed;
      initPatch.selected_assets = keepAssets;
    }
    await adminClient
      .from("agent_projects")
      .update(initPatch)
      .eq("id", projectId);

    const FREEPIK_API_KEY = Deno.env.get("FREEPIK_API_KEY");
    const JSON2VIDEO_API_KEY = Deno.env.get("JSON2VIDEO_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

    if (!FREEPIK_API_KEY || !JSON2VIDEO_API_KEY) {
      throw new Error("Missing FREEPIK_API_KEY or JSON2VIDEO_API_KEY");
    }

    // Run the heavy pipeline in the background to avoid the 150s edge idle timeout.
    // The client polls agent_projects (realtime + agent-status) for progress.
    const runPipeline = async () => {
      try {

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

    // === Vidnoz: parallel generation across all talking-head scenes ===
    // Sequential per-scene polling (each up to ~3 min) blew the edge worker
    // background-task budget and left projects stuck mid-pipeline. Run in parallel.
    // On a resume invocation, scenes already persisted in selected_assets are
    // skipped so the user doesn't pay/wait twice.
    const vidnozResults: Record<number, { url: string; error?: string }> = {};
    const previouslyPersisted: any[] = Array.isArray(project.selected_assets)
      ? project.selected_assets
      : [];
    if (useVidnoz && VIDNOZ_API_KEY && thIndices.length > 0) {
      // Pre-load already-completed scenes so we don't regenerate them.
      const alreadyDone = new Set<number>();
      for (const a of previouslyPersisted) {
        if (typeof a?._vidnozScene === "number" && a?.url) {
          vidnozResults[a._vidnozScene] = { url: a.url };
          alreadyDone.add(a._vidnozScene);
        }
      }
      const targets = (Array.isArray(retryScenes) && retryScenes.length > 0)
        ? thIndices.filter((i) => retryScenes.includes(i))
        : thIndices.filter((i) => !alreadyDone.has(i));

      if (alreadyDone.size > 0 && targets.length < thIndices.length) {
        await appendLog(
          adminClient,
          projectId,
          `Resume: skipping ${alreadyDone.size} Vidnoz scene(s) already generated`,
          12,
          "vidnoz-avatar"
        );
      }

      if (targets.length > 0) {
        await appendLog(
          adminClient,
          projectId,
          `Generating ${targets.length} Vidnoz avatar scene(s) in parallel...`,
          12,
          "vidnoz-avatar"
        );
      }
      let completedCount = 0;

      // Vidnoz charges/queues per generated clip and rate-limits aggressive bursts.
      // Keep this deliberately sequential: slower, but prevents paid failures from
      // duplicate starts and provider-side burst limits.
      const VIDNOZ_CONCURRENCY = 1;
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

      const summarizeVidnozError = (status: number, data: any) => {
        const code = data?.code;
        const message = String(data?.message || data?.msg || data?.error || JSON.stringify(data || {}));
        return `Vidnoz start error${code ? ` code ${code}` : ""}: HTTP ${status} - ${message.slice(0, 220)}`;
      };

      const isRetryableVidnozStart = (status: number, code: unknown) => {
        if (code === 803 || status === 429 || status === 408) return true;
        return status >= 500 && status < 600;
      };

      const startVidnozTask = async (sliceText: string): Promise<string> => {
        let attempt = 0;
        const maxAttempts = 5;
        let lastErr = "";
        while (attempt < maxAttempts) {
          const fd = new FormData();
          fd.append("voice_id", project.vidnoz_voice_id);
          fd.append("text", sliceText.slice(0, 1500));
          fd.append("type", "0");
          fd.append("avatar_url", project.vidnoz_avatar_url);
          if (project.vidnoz_voice_style) {
            fd.append("emotion", project.vidnoz_voice_style);
            fd.append("style", project.vidnoz_voice_style);
          }
          const startResp = await fetch(
            "https://devapi.vidnoz.com/v2/task/generate-talking-head",
            {
              method: "POST",
              headers: { Authorization: `Bearer ${VIDNOZ_API_KEY}`, accept: "application/json" },
              body: fd,
            }
          );
          const startJson = await startResp.json().catch(() => ({}));
          const code = startJson?.code;
          if (startResp.ok && code === 200) {
            const taskId = String(startJson?.data?.id ?? startJson?.data?.task_id ?? "");
            if (!taskId) throw new Error("Vidnoz returned no task id");
            return taskId;
          }
          lastErr = summarizeVidnozError(startResp.status, startJson);
          // 803 = frequent requests rate limit; 429 / 5xx also retryable
          const retryable = isRetryableVidnozStart(startResp.status, code);
          if (!retryable) throw new Error(lastErr);
          attempt++;
          // Exponential backoff with jitter: 5s, 10s, 20s, 40s
          const backoff = Math.min(5000 * Math.pow(2, attempt - 1), 40_000);
          const jitter = Math.floor(Math.random() * 2000);
          await sleep(backoff + jitter);
        }
        throw new Error(lastErr || "Vidnoz start failed after retries");
      };

      const processOne = async (i: number, slot: number) => {
        // Stagger initial starts to avoid simultaneous burst hitting Vidnoz.
        await sleep(slot * 1500);
        const ov = overrides[i];
        const sliceText = wordSlices[i] || transcript.slice(0, 200);
        try {
          const taskId = await startVidnozTask(sliceText);

          let url = "";
          const maxMs = 180_000;
          const t0 = Date.now();
          let delay = 4000;
          let lastBeat = Date.now();
          while (Date.now() - t0 < maxMs && !url) {
            await sleep(delay);
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
            if (Date.now() - lastBeat > 20_000) {
              await heartbeat(adminClient, projectId);
              lastBeat = Date.now();
            }
          }
          if (!url) throw new Error("Vidnoz polling timeout (180s)");
          vidnozResults[i] = { url };
          await persistVidnozScene(adminClient, projectId, i, {
            keyword: ov.keyword,
            url,
            thumb: project.vidnoz_avatar_url,
            source: "vidnoz",
            duration: Number(ov.duration) || 4,
          });
          completedCount++;
          await appendLog(
            adminClient,
            projectId,
            `✓ Vidnoz ready for "${ov.keyword}" (${completedCount}/${targets.length})`,
            12 + Math.round((completedCount / targets.length) * 30),
            "vidnoz-avatar"
          );
        } catch (vidErr) {
          const reason = String((vidErr as Error)?.message || vidErr);
          console.error(`Vidnoz failed for scene ${i}:`, reason);
          vidnozResults[i] = { url: "", error: reason };
          completedCount++;
          await recordFailedScene(adminClient, projectId, {
            index: i,
            keyword: ov.keyword,
            reason,
            provider: "vidnoz",
          });
          await appendLog(
            adminClient,
            projectId,
            `⚠ Vidnoz failed for "${ov.keyword}": ${reason.slice(0, 80)} — using Freepik fallback`,
            12 + Math.round((completedCount / targets.length) * 30),
            "vidnoz-fallback"
          );
        }
      };

      // Concurrency-limited worker pool
      const queue = [...targets];
      const workers: Promise<void>[] = [];
      for (let s = 0; s < Math.min(VIDNOZ_CONCURRENCY, queue.length); s++) {
        workers.push(
          (async () => {
            while (queue.length > 0) {
              const next = queue.shift();
              if (next === undefined) break;
              await processOne(next, s);
            }
          })()
        );
      }
      await Promise.all(workers);
    }


    if (overrides.length > 0) {
      for (let i = 0; i < overrides.length; i++) {
        const ov = overrides[i];
        const isTH = ov?.broll_type === "talking_head";
        const dur = Number(ov.duration) || 4;

        const vidRes = vidnozResults[i];
        if (vidRes && vidRes.url) {
          assets.push({
            keyword: ov.keyword,
            url: vidRes.url,
            thumb: project.vidnoz_avatar_url,
            source: "vidnoz",
            duration: dur,
          });
          continue;
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
        // Watermark/preview URL guard: never let a suspicious URL into the final render.
        if (pick?.url && /watermark|\/preview\b|wm[-_]/i.test(pick.url)) {
          await appendLog(
            adminClient,
            projectId,
            `⚠️ Asset scartato per "${ov.keyword}": URL contiene "watermark"/"preview". Cerco alternativa pulita.`,
            10 + Math.round((i / overrides.length) * 35),
            "asset-collection"
          );
          const found = await searchFreepikVideo(FREEPIK_API_KEY, ov.keyword);
          pick = found ? { url: found.url, thumb: found.thumb, source: "freepik" } : undefined;
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

      const inworldVoices = await listInworldVoices(Deno.env.get("INWORLD_API_KEY"));
      const languageVoice = resolveVoiceForLanguage(inworldVoices, project.voice_id, lang);
      let resolvedVoiceId: string | undefined;
      if (isEnglish) {
        resolvedVoiceId = project.voice_id || undefined;
      } else {
        resolvedVoiceId = languageVoice.selectedId || languageVoice.fallbackId;
        if (!resolvedVoiceId) {
          throw new Error(`Nessuna voce Inworld nativa disponibile per ${lang.toUpperCase()}. Apri il selettore voce e scegli una voce realmente supportata.`);
        }
        if (project.voice_id && project.voice_id !== resolvedVoiceId) {
          await appendLog(
            adminClient,
            projectId,
            `⚠️ La voce scelta "${project.voice_id}" non è nativa/disponibile per ${lang.toUpperCase()}. Uso "${resolvedVoiceId}".`,
            53,
            "narration",
          );
        }
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

      const FALLBACK_VOICE = isEnglish ? "Sarah" : (languageVoice.fallbackId || resolvedVoiceId);
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

        if (isUnknownVoice && FALLBACK_VOICE && resolvedVoiceId !== FALLBACK_VOICE) {
          ttsWarning = `La voce "${resolvedVoiceId}" non è disponibile su Inworld per ${lang.toUpperCase()}. Uso fallback nativo "${FALLBACK_VOICE}".`;
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
      none: { style: "crossfade", duration: 0 },
      subtle: { style: "crossfade", duration: 0.3 },
      medium: { style: "crossfade", duration: 0.6 },
      bold: { style: "crossfade", duration: 0.8 },
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
            duration: a.duration,
            loop: -1,
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
      } catch (err) {
        console.error("agent-execute pipeline error:", err);
        const msg = err instanceof Error ? err.message : "Unknown error";
        try {
          await adminClient
            .from("agent_projects")
            .update({ execution_status: "error", error_message: msg })
            .eq("id", projectId);
          await appendLog(adminClient, projectId, `[ERROR] ${msg}`, 0, "error");
        } catch (_) {}
      }
    };

    // @ts-ignore EdgeRuntime is provided by Supabase Deno runtime
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(runPipeline());
    } else {
      runPipeline();
    }

    return new Response(
      JSON.stringify({ success: true, queued: true, projectId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 202 }
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
