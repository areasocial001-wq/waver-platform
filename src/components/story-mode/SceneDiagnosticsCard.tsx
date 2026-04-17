import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Stethoscope, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Volume2, Music2, Film, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StoryScene } from "./types";
import { cn } from "@/lib/utils";

type SceneCheck = {
  sceneNumber: number;
  videoUrl?: string;
  audioUrl?: string;
  sfxUrl?: string;
  videoStatus?: string;
  videoOk: boolean | null; // null = unknown
  videoMime?: string;
  videoSize?: number;
  videoWidth?: number;
  videoHeight?: number;
  detectedRatio?: string;
  ratioMatchesExpected: boolean | null;
  audioOk: boolean | null;
  sfxOk: boolean | null;
  error?: string;
};

interface SceneDiagnosticsCardProps {
  scenes: StoryScene[];
  expectedAspectRatio: string;
  onReconcile?: () => Promise<void>;
}

const ratioLabel = (w?: number, h?: number): string | undefined => {
  if (!w || !h) return undefined;
  const r = w / h;
  if (Math.abs(r - 16 / 9) < 0.05) return "16:9";
  if (Math.abs(r - 9 / 16) < 0.05) return "9:16";
  if (Math.abs(r - 4 / 3) < 0.05) return "4:3";
  if (Math.abs(r - 1) < 0.05) return "1:1";
  return `${w}×${h}`;
};

// HEAD-only check via fetch — doesn't download the whole video
const headCheck = async (url: string): Promise<{ ok: boolean; mime?: string; size?: number; error?: string }> => {
  try {
    const needsAuth = url.includes("/functions/v1/video-proxy");
    let headers: Record<string, string> = {};
    if (needsAuth) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers = {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        };
      }
    }
    // Try HEAD first; some CDNs only support GET — fall back with Range: 0-0
    let res = await fetch(url, { method: "HEAD", headers });
    if (!res.ok || !res.headers.get("content-type")) {
      res = await fetch(url, { method: "GET", headers: { ...headers, Range: "bytes=0-1023" } });
    }
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const mime = res.headers.get("content-type") || undefined;
    const size = Number(res.headers.get("content-length")) || undefined;
    return { ok: true, mime, size };
  } catch (e: any) {
    return { ok: false, error: e?.message || "fetch failed" };
  }
};

// Probe video dimensions via hidden <video> metadata
const probeVideoDimensions = (url: string, needsAuth: boolean): Promise<{ width?: number; height?: number; error?: string }> =>
  new Promise(async (resolve) => {
    let objectUrl: string | undefined;
    try {
      let srcUrl = url;
      if (needsAuth) {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        // Range request keeps the metadata fetch tiny
        const res = await fetch(url, {
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
                apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                Range: "bytes=0-524287",
              }
            : { Range: "bytes=0-524287" },
        });
        if (!res.ok) {
          resolve({ error: `HTTP ${res.status}` });
          return;
        }
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        srcUrl = objectUrl;
      }
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
      const cleanup = () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        video.src = "";
      };
      const timer = window.setTimeout(() => {
        cleanup();
        resolve({ error: "timeout" });
      }, 8000);
      video.onloadedmetadata = () => {
        window.clearTimeout(timer);
        const w = video.videoWidth;
        const h = video.videoHeight;
        cleanup();
        resolve({ width: w, height: h });
      };
      video.onerror = () => {
        window.clearTimeout(timer);
        cleanup();
        resolve({ error: "metadata error" });
      };
      video.src = srcUrl;
    } catch (e: any) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve({ error: e?.message || "probe failed" });
    }
  });

export const SceneDiagnosticsCard = ({ scenes, expectedAspectRatio, onReconcile }: SceneDiagnosticsCardProps) => {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [checks, setChecks] = useState<SceneCheck[]>([]);
  const [completed, setCompleted] = useState(0);

  const baseRows = useMemo<SceneCheck[]>(
    () =>
      scenes.map((s) => ({
        sceneNumber: s.sceneNumber,
        videoUrl: s.videoUrl,
        audioUrl: s.audioUrl,
        sfxUrl: s.sfxUrl,
        videoStatus: s.videoStatus,
        videoOk: null,
        ratioMatchesExpected: null,
        audioOk: null,
        sfxOk: null,
      })),
    [scenes]
  );

  const runChecks = async () => {
    setRunning(true);
    setCompleted(0);
    const results: SceneCheck[] = [...baseRows];
    setChecks(results);

    for (let i = 0; i < results.length; i++) {
      const row = { ...results[i] };
      try {
        if (row.videoUrl) {
          const head = await headCheck(row.videoUrl);
          row.videoOk = head.ok;
          row.videoMime = head.mime;
          row.videoSize = head.size;
          if (head.ok) {
            const dims = await probeVideoDimensions(
              row.videoUrl,
              row.videoUrl.includes("/functions/v1/video-proxy")
            );
            row.videoWidth = dims.width;
            row.videoHeight = dims.height;
            row.detectedRatio = ratioLabel(dims.width, dims.height);
            row.ratioMatchesExpected =
              row.detectedRatio && expectedAspectRatio
                ? row.detectedRatio === expectedAspectRatio
                : null;
          } else {
            row.error = head.error;
          }
        } else {
          row.videoOk = false;
        }
        if (row.audioUrl) {
          const a = await headCheck(row.audioUrl);
          row.audioOk = a.ok;
        }
        if (row.sfxUrl) {
          const s = await headCheck(row.sfxUrl);
          row.sfxOk = s.ok;
        }
      } catch (e: any) {
        row.error = e?.message || "check error";
      }
      results[i] = row;
      setChecks([...results]);
      setCompleted(i + 1);
    }
    setRunning(false);
  };

  const handleReconcile = async () => {
    if (!onReconcile) return;
    setReconciling(true);
    await onReconcile();
    setReconciling(false);
  };

  const summary = useMemo(() => {
    const total = checks.length;
    const videoBroken = checks.filter((c) => c.videoUrl && c.videoOk === false).length;
    const ratioMismatch = checks.filter((c) => c.ratioMatchesExpected === false).length;
    const audioMissing = checks.filter((c) => !c.audioUrl).length;
    const sfxMissing = checks.filter((c) => !c.sfxUrl).length;
    return { total, videoBroken, ratioMismatch, audioMissing, sfxMissing };
  }, [checks]);

  const rows = checks.length ? checks : baseRows;

  return (
    <Card className="border-accent/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Stethoscope className="w-4 h-4 text-accent" />
              Diagnostica scene
            </CardTitle>
            <CardDescription className="text-xs">
              Controlla per ogni scena video, formato, audio narrato e SFX. Atteso: <span className="font-mono">{expectedAspectRatio}</span>
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {onReconcile && (
              <Button size="sm" variant="secondary" onClick={handleReconcile} disabled={reconciling}>
                {reconciling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Riconcilia progetto"}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
              {open ? "Nascondi" : "Mostra"}
            </Button>
            <Button size="sm" onClick={runChecks} disabled={running}>
              {running ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  {completed}/{rows.length}
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                  Esegui controlli
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3">
          {checks.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <SummaryTile label="Video rotti" value={summary.videoBroken} tone={summary.videoBroken ? "destructive" : "ok"} />
              <SummaryTile label="Formato non conforme" value={summary.ratioMismatch} tone={summary.ratioMismatch ? "warning" : "ok"} />
              <SummaryTile label="Audio mancante" value={summary.audioMissing} tone={summary.audioMissing ? "warning" : "ok"} />
              <SummaryTile label="SFX mancante" value={summary.sfxMissing} tone="muted" />
            </div>
          )}
          <div className="space-y-1.5">
            {rows.map((row) => (
              <div
                key={row.sceneNumber}
                className="flex items-center gap-2 text-xs p-2 rounded-md border bg-background/40"
              >
                <Badge variant="outline" className="h-5 px-1.5 font-mono">
                  S{row.sceneNumber}
                </Badge>
                <StatusPill
                  icon={<Film className="w-3 h-3" />}
                  label={
                    row.videoUrl
                      ? row.videoOk === null
                        ? "Video: da controllare"
                        : row.videoOk
                          ? `Video OK${row.videoSize ? ` · ${(row.videoSize / 1024 / 1024).toFixed(1)} MB` : ""}`
                          : `Video KO${row.error ? ` · ${row.error}` : ""}`
                      : "Nessun video"
                  }
                  tone={row.videoOk === null ? "muted" : row.videoOk ? "ok" : "destructive"}
                />
                {row.videoUrl && (
                  <StatusPill
                    label={
                      row.detectedRatio
                        ? `${row.detectedRatio}${row.videoWidth && row.videoHeight ? ` (${row.videoWidth}×${row.videoHeight})` : ""}`
                        : row.videoOk === null
                          ? "ratio: ?"
                          : "ratio sconosciuto"
                    }
                    tone={
                      row.ratioMatchesExpected === null
                        ? "muted"
                        : row.ratioMatchesExpected
                          ? "ok"
                          : "warning"
                    }
                  />
                )}
                <StatusPill
                  icon={<Volume2 className="w-3 h-3" />}
                  label={
                    row.audioUrl
                      ? row.audioOk === null
                        ? "Audio: ?"
                        : row.audioOk
                          ? "Audio OK"
                          : "Audio KO"
                      : "Audio mancante"
                  }
                  tone={!row.audioUrl ? "warning" : row.audioOk === false ? "destructive" : row.audioOk ? "ok" : "muted"}
                />
                <StatusPill
                  icon={<Music2 className="w-3 h-3" />}
                  label={
                    row.sfxUrl
                      ? row.sfxOk === null
                        ? "SFX: ?"
                        : row.sfxOk
                          ? "SFX OK"
                          : "SFX KO"
                      : "SFX —"
                  }
                  tone={!row.sfxUrl ? "muted" : row.sfxOk === false ? "destructive" : row.sfxOk ? "ok" : "muted"}
                />
                <span className="ml-auto text-[10px] text-muted-foreground capitalize">
                  {row.videoStatus || "idle"}
                </span>
              </div>
            ))}
          </div>
          {!checks.length && (
            <p className="text-xs text-muted-foreground">
              Premi "Esegui controlli" per verificare ogni scena (HEAD request + probe metadata video).
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
};

const SummaryTile = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "ok" | "warning" | "destructive" | "muted";
}) => (
  <div
    className={cn(
      "rounded-md border p-2",
      tone === "destructive" && "border-destructive/40 bg-destructive/5",
      tone === "warning" && "border-amber-500/40 bg-amber-500/5",
      tone === "ok" && "border-green-500/30 bg-green-500/5",
      tone === "muted" && "border-border bg-muted/30"
    )}
  >
    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className="text-base font-semibold">{value}</div>
  </div>
);

const StatusPill = ({
  icon,
  label,
  tone,
}: {
  icon?: React.ReactNode;
  label: string;
  tone: "ok" | "warning" | "destructive" | "muted";
}) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border",
      tone === "ok" && "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-300",
      tone === "warning" && "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      tone === "destructive" && "border-destructive/40 bg-destructive/10 text-destructive",
      tone === "muted" && "border-border bg-muted/40 text-muted-foreground"
    )}
  >
    {icon}
    {tone === "ok" ? <CheckCircle2 className="w-3 h-3" /> : tone === "destructive" ? <XCircle className="w-3 h-3" /> : tone === "warning" ? <AlertTriangle className="w-3 h-3" /> : null}
    <span>{label}</span>
  </span>
);
