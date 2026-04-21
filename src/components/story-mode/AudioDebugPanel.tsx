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
                  {c.result?.notes && c.result.notes.length > 0 && (
                    <ul className="text-[11px] text-muted-foreground list-disc list-inside space-y-0.5">
                      {c.result.notes.map((n, idx) => (
                        <li key={idx}>{n}</li>
                      ))}
                    </ul>
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
