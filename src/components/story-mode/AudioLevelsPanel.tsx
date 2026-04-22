import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Activity, Mic, Wind, Music, RefreshCw, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * AudioLevelsPanel
 * ────────────────
 * For the most-recently-updated Story Mode project, decode every audio asset
 * (voice / sfx / music) with the Web Audio API and compute RMS + peak in dBFS.
 *
 * Helps explain WHY the SFX feel too loud or WHY the music seems missing
 * from the final render: if music RMS is < -40 dBFS, it'll be inaudible
 * under the voice no matter the volume slider.
 */

interface AssetLevel {
  url: string;
  type: "voice" | "ambience" | "music";
  sceneNumber?: number;
  rmsDb?: number;
  peakDb?: number;
  durationSec?: number;
  status: "idle" | "loading" | "ok" | "error";
  error?: string;
}

interface ProjectShape {
  id: string;
  title: string;
  scenes: Array<{
    sceneNumber?: number;
    audioUrl?: string;
    sfxUrl?: string;
  }>;
  background_music_url: string | null;
}

const linearToDb = (v: number) => (v <= 1e-7 ? -Infinity : 20 * Math.log10(v));

const computeLevels = async (url: string, ctx: AudioContext): Promise<{ rmsDb: number; peakDb: number; durationSec: number }> => {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  const audio = await ctx.decodeAudioData(buf);
  const ch0 = audio.getChannelData(0);
  let sumSq = 0;
  let peak = 0;
  // Sample at most 200k frames for speed
  const stride = Math.max(1, Math.floor(ch0.length / 200_000));
  let n = 0;
  for (let i = 0; i < ch0.length; i += stride) {
    const v = ch0[i];
    const a = Math.abs(v);
    if (a > peak) peak = a;
    sumSq += v * v;
    n++;
  }
  const rms = Math.sqrt(sumSq / Math.max(1, n));
  return { rmsDb: linearToDb(rms), peakDb: linearToDb(peak), durationSec: audio.duration };
};

const dbBadgeColor = (db: number | undefined): string => {
  if (db === undefined || !Number.isFinite(db)) return "bg-muted text-muted-foreground";
  if (db > -6) return "bg-red-500/20 text-red-400 border-red-500/40";
  if (db > -14) return "bg-orange-500/20 text-orange-400 border-orange-500/40";
  if (db > -24) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
  return "bg-blue-500/20 text-blue-400 border-blue-500/40";
};

const isUsableUrl = (u?: string | null): u is string =>
  !!u && !u.startsWith("blob:") && !u.startsWith("data:");

export const AudioLevelsPanel: React.FC = () => {
  const [project, setProject] = useState<ProjectShape | null>(null);
  const [loading, setLoading] = useState(false);
  const [levels, setLevels] = useState<AssetLevel[]>([]);

  const loadProject = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setProject(null);
        return;
      }
      const { data, error } = await (supabase as any)
        .from("story_mode_projects")
        .select("id,title,scenes,background_music_url,updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !data) {
        setProject(null);
        return;
      }
      setProject(data as ProjectShape);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadProject(); }, [loadProject]);

  const analyse = useCallback(async () => {
    if (!project) return;
    const items: AssetLevel[] = [];
    for (const s of project.scenes ?? []) {
      if (isUsableUrl(s.audioUrl)) {
        items.push({ url: s.audioUrl, type: "voice", sceneNumber: s.sceneNumber, status: "idle" });
      }
      if (isUsableUrl(s.sfxUrl)) {
        items.push({ url: s.sfxUrl, type: "ambience", sceneNumber: s.sceneNumber, status: "idle" });
      }
    }
    if (isUsableUrl(project.background_music_url)) {
      items.push({ url: project.background_music_url, type: "music", status: "idle" });
    }
    setLevels(items);

    const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    const ctx = new Ctx();
    try {
      for (let i = 0; i < items.length; i++) {
        setLevels((prev) => prev.map((p, idx) => idx === i ? { ...p, status: "loading" } : p));
        try {
          const r = await computeLevels(items[i].url, ctx);
          setLevels((prev) => prev.map((p, idx) => idx === i ? { ...p, ...r, status: "ok" } : p));
        } catch (err: any) {
          setLevels((prev) => prev.map((p, idx) => idx === i ? { ...p, status: "error", error: err?.message || "decode failed" } : p));
        }
      }
    } finally {
      void ctx.close();
    }
  }, [project]);

  const grouped = {
    voice: levels.filter((l) => l.type === "voice"),
    ambience: levels.filter((l) => l.type === "ambience"),
    music: levels.filter((l) => l.type === "music"),
  };

  const summary = (arr: AssetLevel[]) => {
    const valid = arr.filter((a) => a.status === "ok" && Number.isFinite(a.rmsDb || NaN));
    if (valid.length === 0) return null;
    const avg = valid.reduce((s, a) => s + (a.rmsDb || 0), 0) / valid.length;
    return avg;
  };

  const voiceAvg = summary(grouped.voice);
  const ambAvg = summary(grouped.ambience);
  const musicAvg = summary(grouped.music);

  const diagnose = (): string[] => {
    const out: string[] = [];
    if (voiceAvg !== null && ambAvg !== null && voiceAvg !== undefined && ambAvg !== undefined) {
      if (ambAvg > voiceAvg - 6) {
        out.push(`Ambience troppo forte: in media solo ${(voiceAvg - ambAvg).toFixed(1)} dB sotto la voce. Consigliato ≥ 12 dB.`);
      }
    }
    if (musicAvg !== null && musicAvg !== undefined && musicAvg < -40) {
      out.push(`Musica molto bassa (${musicAvg.toFixed(1)} dBFS RMS): potrebbe risultare inudibile sotto la voce.`);
    }
    if (musicAvg === null && grouped.music.length === 0) {
      out.push("Nessuna traccia musicale trovata sul progetto: la generazione potrebbe non essere mai stata salvata.");
    }
    return out;
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" /> Livelli RMS / Peak per scena
          </CardTitle>
          <CardDescription>
            Analizza voce, ambience e musica del progetto più recente per capire perché un layer
            sovrasta gli altri o sembra mancare.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadProject} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4 mr-1", loading && "animate-spin")} /> Ricarica
          </Button>
          <Button size="sm" onClick={analyse} disabled={!project || loading}>
            <Activity className="w-4 h-4 mr-1" /> Analizza livelli
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!project && !loading && (
          <p className="text-sm text-muted-foreground">Nessun progetto Story Mode trovato.</p>
        )}

        {project && (
          <p className="text-xs text-muted-foreground truncate">
            Progetto: <span className="font-mono text-foreground">{project.title || project.id}</span>
          </p>
        )}

        {levels.length === 0 && project && (
          <p className="text-xs text-muted-foreground">
            Premi <strong>Analizza livelli</strong> per scaricare e decodificare ogni MP3.
          </p>
        )}

        {/* Aggregate row */}
        {levels.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            <Aggregate icon={<Mic className="w-3.5 h-3.5" />} label="Voce" db={voiceAvg ?? undefined} />
            <Aggregate icon={<Wind className="w-3.5 h-3.5" />} label="Ambience" db={ambAvg ?? undefined} />
            <Aggregate icon={<Music className="w-3.5 h-3.5" />} label="Musica" db={musicAvg ?? undefined} />
          </div>
        )}

        {/* Per-asset list */}
        {levels.length > 0 && (
          <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
            {levels.map((l, i) => (
              <div key={i} className="flex items-center gap-2 text-xs p-2 rounded border bg-muted/10">
                {l.type === "voice" && <Mic className="w-3.5 h-3.5 text-primary" />}
                {l.type === "ambience" && <Wind className="w-3.5 h-3.5 text-blue-400" />}
                {l.type === "music" && <Music className="w-3.5 h-3.5 text-green-400" />}
                {l.sceneNumber !== undefined && (
                  <span className="font-mono text-muted-foreground shrink-0">#{l.sceneNumber}</span>
                )}
                <Badge variant="outline" className="text-[9px] capitalize shrink-0">{l.type}</Badge>
                {l.status === "loading" && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                {l.status === "ok" && (
                  <>
                    <span className={cn("px-1.5 py-0.5 rounded text-[10px] border tabular-nums", dbBadgeColor(l.rmsDb))}>
                      RMS {Number.isFinite(l.rmsDb!) ? l.rmsDb!.toFixed(1) : "—"} dBFS
                    </span>
                    <span className={cn("px-1.5 py-0.5 rounded text-[10px] border tabular-nums", dbBadgeColor(l.peakDb))}>
                      Peak {Number.isFinite(l.peakDb!) ? l.peakDb!.toFixed(1) : "—"} dBFS
                    </span>
                    <span className="text-muted-foreground tabular-nums">{l.durationSec?.toFixed(1)}s</span>
                  </>
                )}
                {l.status === "error" && (
                  <span className="text-red-400 truncate flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {l.error}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Diagnostics */}
        {levels.length > 0 && (() => {
          const issues = diagnose();
          if (issues.length === 0) return (
            <p className="text-xs text-emerald-400">✅ Nessuno squilibrio evidente tra voce, ambience e musica.</p>
          );
          return (
            <div className="p-3 rounded border border-orange-500/40 bg-orange-500/5 space-y-1">
              <p className="text-xs font-medium text-orange-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Diagnosi automatica
              </p>
              <ul className="text-[11px] text-muted-foreground space-y-0.5 list-disc pl-4">
                {issues.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
};

const Aggregate: React.FC<{ icon: React.ReactNode; label: string; db?: number }> = ({ icon, label, db }) => (
  <div className="p-2 rounded border bg-muted/20 text-center">
    <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
      {icon} {label}
    </div>
    <div className={cn("text-sm font-mono mt-1", db === undefined ? "text-muted-foreground" : "")}>
      {db === undefined ? "—" : `${db.toFixed(1)} dBFS`}
    </div>
  </div>
);
