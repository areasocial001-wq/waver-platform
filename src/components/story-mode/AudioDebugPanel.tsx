import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, RefreshCw, Music, Mic, Volume2, AlertTriangle, CheckCircle2, FileAudio, Link2, RotateCw, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/* ──────────────────────────────────────────────────────────────────────────
 * AudioDebugPanel
 * ──────────────────────────────────────────────────────────────────────────
 * Loads the most-recently-updated Story Mode project for the current user
 * and probes every audio asset (narration, sfx, background music) to show:
 *   • URL kind (https / blob / supabase storage)
 *   • Reachability + content-type + byte size (HEAD then partial GET fallback)
 *   • MP3 header validity (ID3 tag or MPEG sync byte) — catches base64 decode
 *     bugs that produce JSON-wrapped or zero-byte payloads silently uploaded
 *     as ".mp3"
 *
 * Pure UI / diagnostics — no business-logic changes.
 * ────────────────────────────────────────────────────────────────────────── */

interface SceneRow {
  sceneNumber: number;
  audioUrl?: string;
  sfxUrl?: string;
  duration?: number;
  audioStatus?: string;
  sfxStatus?: string;
  narration?: string;
  voiceId?: string;
  sfxPrompt?: string;
  mood?: string;
}

interface ProjectSnapshot {
  id: string;
  title: string;
  updatedAt: string;
  scenes: SceneRow[];
  backgroundMusicUrl: string | null;
  suggestedMusic: string | null;
  inputConfig: Record<string, unknown>;
}

type Verdict = "ok" | "warn" | "error" | "idle" | "checking";

interface ProbeResult {
  verdict: Verdict;
  reachable: boolean;
  status?: number;
  contentType?: string | null;
  bytes?: number | null;
  isMp3Header: boolean | null;
  jsonWrapped: boolean | null;
  failureReason?: string;
  notes: string[];
}

interface AttemptLog {
  at: string;          // ISO timestamp
  step: string;        // "fetch" | "decode" | "validate" | "upload" | "db-update"
  ok: boolean;
  message: string;
  bytes?: number;
}

interface AssetCheck {
  key: string;
  label: string;
  type: "narration" | "sfx" | "music";
  url: string | null | undefined;
  sceneNumber?: number;
  sceneIndex?: number;        // index in project.scenes for retry
  result?: ProbeResult;
  retrying?: boolean;
  attempts?: AttemptLog[];
  showAttempts?: boolean;
}

const isHttp = (u?: string | null) => !!u && /^https?:\/\//i.test(u);
const isBlob = (u?: string | null) => !!u && u.startsWith("blob:");
const isStorage = (u?: string | null) =>
  !!u && /supabase\.co\/storage\/v1\/object/i.test(u);

const getReadableAuthError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return message === "AUTH_REQUIRED"
    ? "Devi accedere per rigenerare gli asset audio."
    : message;
};

const formatBytes = (n?: number | null) => {
  if (n == null || isNaN(n)) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
};

/** Match the MP3 validation logic used in StoryModeWizard upload path. */
const isLikelyMp3Bytes = (bytes: Uint8Array): boolean => {
  if (bytes.length < 4) return false;
  // ID3v2 tag
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true;
  // MPEG sync 0xFFEx / 0xFFFx
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return true;
  return false;
};

const looksLikeJson = (bytes: Uint8Array): boolean => {
  // Skip leading whitespace
  let i = 0;
  while (i < bytes.length && (bytes[i] === 0x20 || bytes[i] === 0x0a || bytes[i] === 0x0d || bytes[i] === 0x09)) i++;
  return bytes[i] === 0x7b /* { */ || bytes[i] === 0x5b /* [ */;
};

function classifyFailure(opts: {
  reachable: boolean;
  isMp3: boolean | null;
  isJson: boolean | null;
  bytes: number | null | undefined;
  status?: number;
  contentType?: string | null;
}): string | undefined {
  const { reachable, isMp3, isJson, bytes, status, contentType } = opts;
  if (!reachable) return `URL non raggiungibile${status ? ` (HTTP ${status})` : ""}`;
  if (isJson) return "Risposta JSON: l'edge function ha restituito errore o il base64 non è stato decodificato";
  if (bytes != null && bytes > 0 && bytes < 1024) return "File troppo piccolo (<1KB), upload probabilmente troncato";
  if (isMp3 === false) {
    if (contentType && /audio\/(wav|ogg|mpeg|mp4)/i.test(contentType)) {
      return `File audio in formato non-MP3 (${contentType})`;
    }
    return "Header MP3 mancante: file corrotto o codifica errata";
  }
  return undefined;
}

async function probeAsset(url: string): Promise<ProbeResult> {
  const notes: string[] = [];
  // blob: URLs cannot be reached server-side, but we can still inspect them client-side
  if (isBlob(url)) {
    notes.push("URL blob: locale alla sessione corrente del browser, non raggiungibile dal renderer.");
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        return { verdict: "error", reachable: false, isMp3Header: null, jsonWrapped: null, failureReason: `HTTP ${resp.status}`, notes: [...notes, `HTTP ${resp.status}`] };
      }
      const buf = await resp.arrayBuffer();
      const bytes = new Uint8Array(buf.slice(0, 16));
      const ok = isLikelyMp3Bytes(bytes);
      const jw = looksLikeJson(bytes);
      const ct = resp.headers.get("content-type");
      return {
        verdict: ok ? "warn" : "error",
        reachable: true,
        contentType: ct,
        bytes: buf.byteLength,
        isMp3Header: ok,
        jsonWrapped: jw,
        failureReason: classifyFailure({ reachable: true, isMp3: ok, isJson: jw, bytes: buf.byteLength, contentType: ct }),
        notes: [...notes, ok ? "Header MP3 valido localmente" : jw ? "Sembra JSON, non MP3 grezzo" : "Header MP3 non riconosciuto"],
      };
    } catch (e) {
      return { verdict: "error", reachable: false, isMp3Header: null, jsonWrapped: null, failureReason: `Fetch fallito: ${(e as Error).message}`, notes: [...notes, `Fetch fallito: ${(e as Error).message}`] };
    }
  }

  // Remote URL — try HEAD first to get content-length quickly
  let headStatus: number | undefined;
  let headContentType: string | null = null;
  let headBytes: number | null = null;
  try {
    const head = await fetch(url, { method: "HEAD" });
    headStatus = head.status;
    headContentType = head.headers.get("content-type");
    const len = head.headers.get("content-length");
    if (len) headBytes = parseInt(len, 10);
  } catch {
    notes.push("HEAD fallito, fallback a GET parziale.");
  }

  // Partial GET (Range 0-31) to inspect first bytes — same as MP3 validator
  try {
    const get = await fetch(url, { headers: { Range: "bytes=0-31" } });
    if (!get.ok && get.status !== 206) {
      return {
        verdict: "error",
        reachable: false,
        status: get.status,
        contentType: headContentType,
        bytes: headBytes,
        isMp3Header: null,
        jsonWrapped: null,
        failureReason: `URL non raggiungibile (HTTP ${get.status})`,
        notes: [...notes, `GET ${get.status}`],
      };
    }
    const buf = await get.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const ok = isLikelyMp3Bytes(bytes);
    const jw = looksLikeJson(bytes);
    if (jw) notes.push("Inizio file simile a JSON: probabile risposta non decodificata correttamente.");
    if (!ok && !jw) notes.push("Header MP3 non riconosciuto (potrebbe essere wav/ogg o file corrotto).");
    if ((headBytes ?? 0) > 0 && (headBytes ?? 0) < 1024) notes.push("File molto piccolo (<1KB), spesso indica un errore di upload.");
    return {
      verdict: ok ? "ok" : jw ? "error" : "warn",
      reachable: true,
      status: headStatus ?? 200,
      contentType: headContentType,
      bytes: headBytes,
      isMp3Header: ok,
      jsonWrapped: jw,
      failureReason: classifyFailure({ reachable: true, isMp3: ok, isJson: jw, bytes: headBytes, status: headStatus, contentType: headContentType }),
      notes,
    };
  } catch (e) {
    return { verdict: "error", reachable: false, isMp3Header: null, jsonWrapped: null, failureReason: `Fetch fallito: ${(e as Error).message}`, notes: [...notes, `Fetch fallito: ${(e as Error).message}`] };
  }
}

export const AudioDebugPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectSnapshot | null>(null);
  const [checks, setChecks] = useState<AssetCheck[]>([]);
  const [probing, setProbing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProject = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("Devi essere autenticato per usare il pannello di debug audio.");
        return;
      }
      const { data, error: qErr } = await supabase
        .from("story_mode_projects")
        .select("id, title, updated_at, scenes, background_music_url, suggested_music, input_config")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (qErr) throw qErr;
      if (!data) {
        setProject(null);
        setChecks([]);
        return;
      }
      const rawScenes = Array.isArray(data.scenes) ? (data.scenes as unknown as SceneRow[]) : [];
      const snap: ProjectSnapshot = {
        id: data.id,
        title: data.title || "Senza titolo",
        updatedAt: data.updated_at,
        scenes: rawScenes,
        backgroundMusicUrl: (data as { background_music_url: string | null }).background_music_url,
        suggestedMusic: (data as { suggested_music: string | null }).suggested_music ?? null,
        inputConfig: (data as { input_config: Record<string, unknown> | null }).input_config ?? {},
      };
      setProject(snap);
      const list: AssetCheck[] = [];
      list.push({ key: "music", label: "Musica di sottofondo", type: "music", url: snap.backgroundMusicUrl });
      rawScenes.forEach((s, i) => {
        const num = s.sceneNumber ?? i + 1;
        list.push({ key: `nar-${i}`, label: `Voce scena ${num}`, type: "narration", url: s.audioUrl, sceneNumber: num, sceneIndex: i });
        if (s.sfxUrl !== undefined && s.sfxUrl !== null) {
          list.push({ key: `sfx-${i}`, label: `SFX scena ${num}`, type: "sfx", url: s.sfxUrl, sceneNumber: num, sceneIndex: i });
        }
      });
      setChecks(list);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  const runProbes = useCallback(async () => {
    setProbing(true);
    setChecks((prev) => prev.map((c) => ({ ...c, result: c.url ? { verdict: "checking", reachable: false, isMp3Header: null, jsonWrapped: null, notes: [] } : c.result })));
    // Probe sequentially in small batches to avoid request stampede
    const out: AssetCheck[] = [];
    for (const c of checks) {
      if (!c.url) {
        out.push({ ...c, result: { verdict: "idle", reachable: false, isMp3Header: null, jsonWrapped: null, notes: ["Asset non generato"] } });
        continue;
      }
      const r = await probeAsset(c.url);
      out.push({ ...c, result: r });
      setChecks([...out, ...checks.slice(out.length)]);
    }
    setChecks(out);
    setProbing(false);
  }, [checks]);

  // Regenerate a single asset (TTS / SFX / Music) with retries + detailed log
  const regenerateAsset = useCallback(async (key: string) => {
    if (!project) return;
    const target = checks.find((c) => c.key === key);
    if (!target) return;

    const log: AttemptLog[] = [];
    const stamp = () => new Date().toISOString();
    const pushLog = (entry: Omit<AttemptLog, "at">) => {
      log.push({ at: stamp(), ...entry });
      setChecks((prev) => prev.map((c) => (c.key === key ? { ...c, attempts: [...log], showAttempts: true } : c)));
    };

    setChecks((prev) => prev.map((c) => (c.key === key ? { ...c, retrying: true, attempts: [], showAttempts: true } : c)));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("AUTH_REQUIRED");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${token}`,
      };

      // Build endpoint + payload
      let endpoint = "";
      let body: Record<string, unknown> = {};
      const cfg = project.inputConfig as Record<string, unknown>;
      if (target.type === "narration") {
        const sc = project.scenes[target.sceneIndex ?? -1];
        if (!sc?.narration) throw new Error("Scena senza testo di narrazione");
        endpoint = "elevenlabs-tts";
        body = {
          text: sc.narration,
          voiceId: sc.voiceId || (cfg.voiceId as string) || "EXAVITQu4vr4xnSDxMaL",
          language_code: (cfg.language as string) || "it",
        };
      } else if (target.type === "sfx") {
        const sc = project.scenes[target.sceneIndex ?? -1];
        const prompt = sc?.sfxPrompt || sc?.mood || "ambient background";
        endpoint = "elevenlabs-sfx";
        body = { text: prompt, duration_seconds: Math.min(sc?.duration ?? 5, 10) };
      } else if (target.type === "music") {
        endpoint = "elevenlabs-music";
        const totalDuration = project.scenes.reduce((acc, s) => acc + Math.min(s.duration ?? 5, 10), 0);
        body = {
          prompt: project.suggestedMusic || "cinematic background score",
          duration: Math.min(Math.max(totalDuration, 10), 300),
        };
      }

      const MAX_ATTEMPTS = 3;
      let blob: Blob | null = null;
      let lastError = "";
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        pushLog({ step: "fetch", ok: true, message: `Tentativo ${attempt}/${MAX_ATTEMPTS} → ${endpoint}` });
        try {
          const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${endpoint}`, {
            method: "POST", headers, body: JSON.stringify(body),
          });
          if (!res.ok) {
            const text = await res.text();
            lastError = `HTTP ${res.status}: ${text.slice(0, 200)}`;
            pushLog({ step: "fetch", ok: false, message: lastError });
            await new Promise((r) => setTimeout(r, 800 * attempt));
            continue;
          }

          const ct = res.headers.get("content-type") || "";
          let candidate: Uint8Array;
          if (ct.includes("application/json")) {
            const json = await res.json();
            const b64 = json.audioContent || json.audio || json.audio_base64;
            if (!b64) {
              lastError = `Risposta JSON senza campo audioContent`;
              pushLog({ step: "decode", ok: false, message: lastError });
              await new Promise((r) => setTimeout(r, 800 * attempt));
              continue;
            }
            const bin = atob(b64);
            candidate = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) candidate[i] = bin.charCodeAt(i);
            pushLog({ step: "decode", ok: true, message: `Base64 decodificato (${candidate.byteLength} byte)`, bytes: candidate.byteLength });
          } else {
            const buf = await res.arrayBuffer();
            candidate = new Uint8Array(buf);
            pushLog({ step: "decode", ok: true, message: `Stream binario ricevuto (${candidate.byteLength} byte)`, bytes: candidate.byteLength });
          }

          const head = candidate.slice(0, 16);
          if (!isLikelyMp3Bytes(head)) {
            const jw = looksLikeJson(head);
            lastError = jw ? "Header non MP3 (sembra JSON)" : "Header MP3 non valido";
            pushLog({ step: "validate", ok: false, message: lastError });
            await new Promise((r) => setTimeout(r, 800 * attempt));
            continue;
          }
          pushLog({ step: "validate", ok: true, message: "Header MP3 valido (ID3 o sync MPEG)" });
          blob = new Blob([candidate.buffer.slice(0) as ArrayBuffer], { type: "audio/mpeg" });
          break;
        } catch (e) {
          lastError = (e as Error).message;
          pushLog({ step: "fetch", ok: false, message: `Eccezione: ${lastError}` });
          await new Promise((r) => setTimeout(r, 800 * attempt));
        }
      }

      if (!blob) throw new Error(`Tutti i ${MAX_ATTEMPTS} tentativi hanno fallito. Ultimo errore: ${lastError}`);

      // Upload to storage
      const path = `${project.id}/${target.type}-${target.sceneIndex ?? "all"}-${Date.now()}.mp3`;
      const { error: upErr } = await supabase.storage.from("audio").upload(path, blob, {
        contentType: "audio/mpeg", upsert: true,
      });
      if (upErr) {
        pushLog({ step: "upload", ok: false, message: upErr.message });
        throw upErr;
      }
      const { data: pub } = supabase.storage.from("audio").getPublicUrl(path);
      const newUrl = pub.publicUrl;
      pushLog({ step: "upload", ok: true, message: `Caricato su storage: ${newUrl}` });

      // Update DB
      const updates: Record<string, unknown> = {};
      if (target.type === "music") {
        updates.background_music_url = newUrl;
      } else if (target.sceneIndex != null) {
        const updatedScenes = [...project.scenes];
        const field = target.type === "narration" ? "audioUrl" : "sfxUrl";
        updatedScenes[target.sceneIndex] = { ...updatedScenes[target.sceneIndex], [field]: newUrl };
        updates.scenes = updatedScenes as unknown as Record<string, unknown>;
      }
      const { error: dbErr } = await supabase.from("story_mode_projects").update(updates).eq("id", project.id);
      if (dbErr) {
        pushLog({ step: "db-update", ok: false, message: dbErr.message });
        throw dbErr;
      }
      pushLog({ step: "db-update", ok: true, message: "Progetto aggiornato in database" });

      toast.success(`${target.label} rigenerato con successo`);

      // Re-probe the freshly uploaded asset
      const fresh = await probeAsset(newUrl);
      setChecks((prev) => prev.map((c) => (c.key === key ? { ...c, url: newUrl, result: fresh, retrying: false } : c)));
      // Refresh local project state
      if (target.type === "music") {
        setProject((p) => p ? { ...p, backgroundMusicUrl: newUrl } : p);
      } else if (target.sceneIndex != null) {
        setProject((p) => {
          if (!p) return p;
          const scenes = [...p.scenes];
          const field = target.type === "narration" ? "audioUrl" : "sfxUrl";
          scenes[target.sceneIndex!] = { ...scenes[target.sceneIndex!], [field]: newUrl };
          return { ...p, scenes };
        });
      }
    } catch (e) {
      const msg = getReadableAuthError(e);
      pushLog({ step: "error", ok: false, message: msg });
      toast.error(`Rigenerazione fallita: ${msg}`);
      setChecks((prev) => prev.map((c) => (c.key === key ? { ...c, retrying: false } : c)));
    }
  }, [checks, project]);

  const toggleAttempts = useCallback((key: string) => {
    setChecks((prev) => prev.map((c) => (c.key === key ? { ...c, showAttempts: !c.showAttempts } : c)));
  }, []);

  const verdictBadge = (v?: Verdict) => {
    switch (v) {
      case "ok":
        return <Badge variant="outline" className="border-green-500/40 text-green-400 bg-green-500/5"><CheckCircle2 className="w-3 h-3 mr-1" />OK</Badge>;
      case "warn":
        return <Badge variant="outline" className="border-yellow-500/40 text-yellow-400 bg-yellow-500/5"><AlertTriangle className="w-3 h-3 mr-1" />Attenzione</Badge>;
      case "error":
        return <Badge variant="outline" className="border-destructive/50 text-destructive bg-destructive/5"><AlertTriangle className="w-3 h-3 mr-1" />Errore</Badge>;
      case "checking":
        return <Badge variant="outline" className="border-primary/40 text-primary bg-primary/5"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Controllo</Badge>;
      case "idle":
      default:
        return <Badge variant="outline" className="text-muted-foreground">—</Badge>;
    }
  };

  const urlKind = (u?: string | null) => {
    if (!u) return <Badge variant="outline" className="text-[10px] text-muted-foreground">assente</Badge>;
    if (isBlob(u)) return <Badge variant="outline" className="text-[10px] border-yellow-500/40 text-yellow-400">blob:</Badge>;
    if (isStorage(u)) return <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">storage</Badge>;
    if (isHttp(u)) return <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">https</Badge>;
    return <Badge variant="outline" className="text-[10px] text-muted-foreground">altro</Badge>;
  };

  const iconFor = (t: AssetCheck["type"]) =>
    t === "music" ? <Music className="w-3.5 h-3.5" /> : t === "sfx" ? <Volume2 className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />;

  // Aggregate stats
  const okCount = checks.filter((c) => c.result?.verdict === "ok").length;
  const warnCount = checks.filter((c) => c.result?.verdict === "warn").length;
  const errCount = checks.filter((c) => c.result?.verdict === "error").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileAudio className="h-5 w-5" />
          Debug audio Story Mode
        </CardTitle>
        <CardDescription>
          Analizza l'ultimo progetto Story Mode salvato per verificare voce, SFX e musica: raggiungibilità, dimensione e validità del header MP3
          (per individuare base64 decoded male o upload corrotti).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Caricamento progetto...
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : !project ? (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Nessun progetto Story Mode trovato. Crea o salva un progetto per usare la diagnostica audio.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border bg-muted/30">
              <div className="space-y-0.5">
                <div className="text-sm font-medium flex items-center gap-2">
                  <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
                  {project.title}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Aggiornato {new Date(project.updatedAt).toLocaleString("it-IT")} · {project.scenes.length} scene
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={loadProject} disabled={probing}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Ricarica
                </Button>
                <Button size="sm" onClick={runProbes} disabled={probing || checks.length === 0}>
                  {probing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
                  Verifica audio
                </Button>
              </div>
            </div>

            {(okCount + warnCount + errCount) > 0 && (
              <div className="flex gap-2 flex-wrap text-xs">
                <Badge variant="outline" className="border-green-500/40 text-green-400">{okCount} ok</Badge>
                <Badge variant="outline" className="border-yellow-500/40 text-yellow-400">{warnCount} attenzioni</Badge>
                <Badge variant="outline" className="border-destructive/50 text-destructive">{errCount} errori</Badge>
              </div>
            )}

            <div className="space-y-2">
              {checks.map((c) => (
                <div
                  key={c.key}
                  className={cn(
                    "rounded-lg border p-3 space-y-2 transition-colors",
                    c.result?.verdict === "error" && "border-destructive/40 bg-destructive/5",
                    c.result?.verdict === "warn" && "border-yellow-500/30 bg-yellow-500/5",
                    c.result?.verdict === "ok" && "border-green-500/30 bg-green-500/5",
                  )}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {iconFor(c.type)}
                      {c.label}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {urlKind(c.url)}
                      {verdictBadge(c.result?.verdict)}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => regenerateAsset(c.key)}
                        disabled={c.retrying || (c.type !== "music" && c.sceneIndex == null)}
                        title="Rigenera questo asset con retry automatici e validazione MP3"
                      >
                        {c.retrying ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RotateCw className="w-3 h-3 mr-1" />}
                        Rigenera
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-muted-foreground">
                    <div>
                      <span className="block text-[10px] uppercase tracking-wide opacity-70">Status</span>
                      <span className="font-mono text-foreground/80">{c.result?.status ?? "—"}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase tracking-wide opacity-70">Content-Type</span>
                      <span className="font-mono text-foreground/80 truncate block" title={c.result?.contentType ?? ""}>
                        {c.result?.contentType ?? "—"}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase tracking-wide opacity-70">Dimensione</span>
                      <span className="font-mono text-foreground/80">{formatBytes(c.result?.bytes)}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase tracking-wide opacity-70">Header MP3</span>
                      <span className={cn(
                        "font-mono",
                        c.result?.isMp3Header === true && "text-green-400",
                        c.result?.isMp3Header === false && "text-destructive",
                        c.result?.isMp3Header == null && "text-muted-foreground",
                      )}>
                        {c.result?.isMp3Header == null ? "—" : c.result.isMp3Header ? "valido" : c.result.jsonWrapped ? "JSON!" : "non valido"}
                      </span>
                    </div>
                  </div>
                  {c.url && (
                    <div className="text-[10px] font-mono break-all text-muted-foreground/70 bg-muted/30 px-2 py-1 rounded">
                      {c.url}
                    </div>
                  )}
                  {c.result?.failureReason && (
                    <div className="rounded border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive flex items-start gap-1.5">
                      <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                      <span><span className="font-semibold">Motivo: </span>{c.result.failureReason}</span>
                    </div>
                  )}
                  {c.result?.notes && c.result.notes.length > 0 && (
                    <ul className="text-[11px] text-muted-foreground list-disc list-inside space-y-0.5">
                      {c.result.notes.map((n, idx) => (
                        <li key={idx}>{n}</li>
                      ))}
                    </ul>
                  )}
                  {c.attempts && c.attempts.length > 0 && (
                    <div className="border-t border-border/40 pt-2 mt-2 space-y-1.5">
                      <button
                        onClick={() => toggleAttempts(c.key)}
                        className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {c.showAttempts ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        Log tentativi ({c.attempts.length})
                      </button>
                      {c.showAttempts && (
                        <div className="space-y-1 font-mono text-[10px] bg-muted/30 rounded p-2 max-h-48 overflow-y-auto">
                          {c.attempts.map((a, idx) => (
                            <div
                              key={idx}
                              className={cn(
                                "flex items-start gap-2",
                                a.ok ? "text-foreground/80" : "text-destructive",
                              )}
                            >
                              <span className="text-muted-foreground shrink-0">
                                {new Date(a.at).toLocaleTimeString("it-IT", { hour12: false })}
                              </span>
                              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">{a.step}</Badge>
                              <span className="break-all">{a.message}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {checks.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nessun asset audio nel progetto.</p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AudioDebugPanel;
