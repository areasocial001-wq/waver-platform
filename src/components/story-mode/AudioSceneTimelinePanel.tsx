import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Activity, Mic, Wind, Sparkles, Music, RefreshCw, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { analyseAudioUrl, dbBadgeColor, lufsBadgeColor, isUsableUrl, type ChannelLevels } from "@/lib/audioLevels";
import { getAudioMix } from "@/lib/storyModeAudioMix";

/**
 * AudioSceneTimelinePanel
 * ────────────────────────
 * Builds a horizontal timeline of the most-recently-updated Story Mode project.
 * For every scene we measure RMS / peak / approx-LUFS of voice, ambience and SFX,
 * and we measure the global music track once. The bars are coloured by RMS level
 * (red >-6, orange >-14, green >-24, blue otherwise), so it is immediately
 * obvious which scene has too-loud SFX, missing music, or weak voice.
 */

interface SceneShape {
  sceneNumber?: number;
  audioUrl?: string;
  sfxUrl?: string;
  ambienceUrl?: string;
  duration?: number;
}

interface ProjectShape {
  id: string;
  title: string;
  scenes: SceneShape[];
  background_music_url: string | null;
}

type Channel = "voice" | "ambience" | "sfx" | "music";

interface CellLevels extends Partial<ChannelLevels> {
  status: "idle" | "loading" | "ok" | "error";
  error?: string;
}

type SceneRow = Record<Channel, CellLevels>;

const channelIcon = (c: Channel) => {
  switch (c) {
    case "voice": return <Mic className="w-3 h-3 text-primary" />;
    case "ambience": return <Wind className="w-3 h-3 text-blue-400" />;
    case "sfx": return <Sparkles className="w-3 h-3 text-yellow-400" />;
    case "music": return <Music className="w-3 h-3 text-green-400" />;
  }
};

const channelLabel: Record<Channel, string> = {
  voice: "Voce",
  ambience: "Ambience",
  sfx: "SFX",
  music: "Musica",
};

const empty: CellLevels = { status: "idle" };

export const AudioSceneTimelinePanel: React.FC = () => {
  const [project, setProject] = useState<ProjectShape | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [rows, setRows] = useState<SceneRow[]>([]);
  const [musicCell, setMusicCell] = useState<CellLevels>(empty);
  const lufsTarget = useMemo(() => getAudioMix().lufsTarget, []);

  const loadProject = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setProject(null); return; }
      const { data, error } = await (supabase as any)
        .from("story_mode_projects")
        .select("id,title,scenes,background_music_url,updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !data) { setProject(null); return; }
      setProject(data as ProjectShape);
      setRows([]);
      setMusicCell(empty);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadProject(); }, [loadProject]);

  const analyse = useCallback(async () => {
    if (!project) return;
    setAnalysing(true);
    try {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      const ctx = new Ctx();
      try {
        const initial: SceneRow[] = (project.scenes ?? []).map(() => ({
          voice: { ...empty }, ambience: { ...empty }, sfx: { ...empty }, music: { ...empty },
        }));
        setRows(initial);

        for (let i = 0; i < (project.scenes ?? []).length; i++) {
          const s = project.scenes[i];
          const tasks: Array<{ ch: Channel; url?: string }> = [
            { ch: "voice", url: s.audioUrl },
            { ch: "ambience", url: s.ambienceUrl },
            { ch: "sfx", url: s.sfxUrl },
          ];
          for (const t of tasks) {
            if (!isUsableUrl(t.url)) continue;
            setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, [t.ch]: { status: "loading" } } : r));
            try {
              const lvl = await analyseAudioUrl(t.url, ctx);
              setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, [t.ch]: { ...lvl, status: "ok" } } : r));
            } catch (err: any) {
              setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, [t.ch]: { status: "error", error: err?.message || "decode failed" } } : r));
            }
          }
        }

        if (isUsableUrl(project.background_music_url)) {
          setMusicCell({ status: "loading" });
          try {
            const lvl = await analyseAudioUrl(project.background_music_url, ctx);
            setMusicCell({ ...lvl, status: "ok" });
          } catch (err: any) {
            setMusicCell({ status: "error", error: err?.message || "decode failed" });
          }
        }
      } finally { void ctx.close(); }
    } finally { setAnalysing(false); }
  }, [project]);

  // Compute timeline geometry
  const sceneDurations = useMemo(() => {
    return (project?.scenes ?? []).map((s) => Math.max(1, Math.min(60, s.duration ?? 6)));
  }, [project]);
  const totalDuration = useMemo(() => sceneDurations.reduce((a, b) => a + b, 0) || 1, [sceneDurations]);

  const issues = useMemo(() => {
    const out: string[] = [];
    if (!rows.length) return out;
    rows.forEach((row, i) => {
      const sceneN = project?.scenes[i]?.sceneNumber ?? i + 1;
      if (row.voice.status === "ok" && row.ambience.status === "ok") {
        const dv = (row.voice.rmsDb ?? -Infinity) - (row.ambience.rmsDb ?? -Infinity);
        if (dv < 6 && Number.isFinite(dv)) {
          out.push(`Scena ${sceneN}: ambience troppo forte (solo ${dv.toFixed(1)} dB sotto la voce, consigliato ≥ 12).`);
        }
      }
      if (row.sfx.status === "ok" && row.voice.status === "ok") {
        const ds = (row.voice.rmsDb ?? -Infinity) - (row.sfx.rmsDb ?? -Infinity);
        if (ds < 3 && Number.isFinite(ds)) {
          out.push(`Scena ${sceneN}: SFX a livello voce (Δ ${ds.toFixed(1)} dB) — può sovrastare la narrazione.`);
        }
      }
    });
    if (musicCell.status === "ok" && Number.isFinite(musicCell.rmsDb ?? NaN) && (musicCell.rmsDb ?? 0) < -42) {
      out.push(`Musica molto bassa (${musicCell.rmsDb!.toFixed(1)} dBFS RMS): rischio di sparire sotto la voce.`);
    }
    if (musicCell.status === "idle") {
      out.push("Nessuna traccia musicale collegata al progetto.");
    }
    return out;
  }, [rows, musicCell, project]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" /> Timeline livelli per scena
          </CardTitle>
          <CardDescription>
            Visualizza RMS, peak e LUFS per voce, ambience, SFX e musica scena per scena —
            utile per capire perché la musica sparisce o gli SFX coprono il parlato.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadProject} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4 mr-1", loading && "animate-spin")} /> Ricarica
          </Button>
          <Button size="sm" onClick={analyse} disabled={!project || loading || analysing}>
            {analysing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Activity className="w-4 h-4 mr-1" />}
            Analizza timeline
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!project && !loading && (
          <p className="text-sm text-muted-foreground">Nessun progetto Story Mode trovato.</p>
        )}

        {project && (
          <p className="text-xs text-muted-foreground truncate">
            Progetto: <span className="font-mono text-foreground">{project.title || project.id}</span> ·
            {(project.scenes ?? []).length} scene · target {lufsTarget} LUFS
          </p>
        )}

        {rows.length > 0 && (
          <div className="space-y-2">
            {/* Scene number ruler */}
            <div className="flex h-5 rounded overflow-hidden border bg-muted/10 text-[10px]">
              {sceneDurations.map((d, i) => (
                <div
                  key={i}
                  className="flex items-center justify-center border-r last:border-r-0 text-muted-foreground font-mono"
                  style={{ width: `${(d / totalDuration) * 100}%` }}
                  title={`${d}s`}
                >
                  #{project?.scenes[i]?.sceneNumber ?? i + 1}
                </div>
              ))}
            </div>

            {/* Channel rows */}
            {(["voice", "ambience", "sfx"] as Channel[]).map((ch) => (
              <ChannelTimelineRow
                key={ch}
                channel={ch}
                rows={rows}
                sceneDurations={sceneDurations}
                totalDuration={totalDuration}
                lufsTarget={lufsTarget}
                project={project}
              />
            ))}

            {/* Music spans the full timeline */}
            <div className="flex items-center gap-2">
              <div className="w-20 shrink-0 flex items-center gap-1 text-xs text-muted-foreground">
                {channelIcon("music")} {channelLabel.music}
              </div>
              <div className="flex-1 h-7 rounded border bg-muted/10 relative overflow-hidden">
                <CellBar level={musicCell} fullWidth lufsTarget={lufsTarget} channel="music" />
              </div>
            </div>
          </div>
        )}

        {issues.length > 0 && (
          <div className="p-3 rounded border border-orange-500/40 bg-orange-500/5 space-y-1">
            <p className="text-xs font-medium text-orange-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Diagnosi
            </p>
            <ul className="text-[11px] text-muted-foreground space-y-0.5 list-disc pl-4">
              {issues.map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          </div>
        )}

        {rows.length === 0 && project && (
          <p className="text-xs text-muted-foreground">
            Premi <strong>Analizza timeline</strong> per scaricare e decodificare ogni MP3 per scena.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

const ChannelTimelineRow: React.FC<{
  channel: Channel;
  rows: SceneRow[];
  sceneDurations: number[];
  totalDuration: number;
  lufsTarget: number;
  project: ProjectShape | null;
}> = ({ channel, rows, sceneDurations, totalDuration, lufsTarget, project }) => (
  <div className="flex items-center gap-2">
    <div className="w-20 shrink-0 flex items-center gap-1 text-xs text-muted-foreground">
      {channelIcon(channel)} {channelLabel[channel]}
    </div>
    <div className="flex-1 flex h-7 rounded border bg-muted/10 overflow-hidden">
      {rows.map((row, i) => {
        const cell = row[channel];
        const sceneN = project?.scenes[i]?.sceneNumber ?? i + 1;
        const tooltip = cell.status === "ok"
          ? `Scena ${sceneN} • RMS ${cell.rmsDb?.toFixed(1)} dBFS · Peak ${cell.peakDb?.toFixed(1)} · ${Number.isFinite(cell.lufs ?? NaN) ? `${cell.lufs!.toFixed(1)} LUFS` : ""}`
          : cell.status === "error" ? `Scena ${sceneN}: ${cell.error}`
          : cell.status === "loading" ? `Scena ${sceneN}: analisi in corso…`
          : `Scena ${sceneN}: nessun asset`;
        return (
          <div
            key={i}
            className="border-r last:border-r-0 relative"
            style={{ width: `${(sceneDurations[i] / totalDuration) * 100}%` }}
            title={tooltip}
          >
            <CellBar level={cell} lufsTarget={lufsTarget} channel={channel} />
          </div>
        );
      })}
    </div>
  </div>
);

const CellBar: React.FC<{
  level: CellLevels;
  lufsTarget: number;
  channel: Channel;
  fullWidth?: boolean;
}> = ({ level, lufsTarget, channel }) => {
  if (level.status === "loading") {
    return <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">
      <Loader2 className="w-3 h-3 animate-spin" />
    </div>;
  }
  if (level.status === "error") {
    return <div className="w-full h-full bg-red-500/15 flex items-center justify-center text-[9px] text-red-400">
      err
    </div>;
  }
  if (level.status !== "ok" || !Number.isFinite(level.rmsDb ?? NaN)) {
    return <div className="w-full h-full bg-muted/30 flex items-center justify-center text-[9px] text-muted-foreground">—</div>;
  }
  // Map RMS (-60..0 dBFS) to bar height
  const rms = Math.max(-60, Math.min(0, level.rmsDb!));
  const heightPct = ((rms + 60) / 60) * 100;
  const colorClass = dbBadgeColor(rms).split(" ").find((c) => c.startsWith("bg-")) ?? "bg-emerald-500/40";
  const lufsClass = lufsBadgeColor(level.lufs, lufsTarget).split(" ").find((c) => c.startsWith("border-")) ?? "border-transparent";
  return (
    <div className={cn("absolute inset-x-0 bottom-0 border-t-2", colorClass, lufsClass)} style={{ height: `${heightPct}%` }}>
      <span className="sr-only">{channel} {rms.toFixed(1)} dBFS</span>
    </div>
  );
};
