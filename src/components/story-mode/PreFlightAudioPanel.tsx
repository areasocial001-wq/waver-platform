import { useMemo, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ShieldCheck, AlertTriangle, Mic, Music, Volume2, Sparkles, Check, X, RefreshCw, Loader2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StoryScene } from "./types";
import { measureAndValidateAudioDuration } from "@/lib/aspectRatioCheck";

/** Called once per scene when we measure narration audio duration — wizard persists it on the scene. */
export interface MeasuredAudioDuration {
  sceneIndex: number;
  measured: number;
  expected: number;
  mismatch: boolean;
  warning?: string;
}

export interface BatchProgress {
  current: number;
  total: number;
  label: string;
}

interface PreFlightAudioPanelProps {
  scenes: StoryScene[];
  backgroundMusicUrl: string | null;
  /** Called when user clicks "Rigenera audio scaduti". Receives the list of items to regenerate. */
  onRegenerateExpired?: (items: ExpiredAudioItem[]) => void | Promise<void>;
  /** When set, shows a detailed progress bar instead of the regenerate button */
  progress?: BatchProgress | null;
  /** Called when client-side narration duration measurement finishes for a scene. */
  onAudioDurationMeasured?: (result: MeasuredAudioDuration) => void;
}

export interface ExpiredAudioItem {
  type: "audio" | "sfx" | "music";
  /** Index in scenes[] (-1 for global music) */
  sceneIndex: number;
  /** Display number for the scene (0 for music) */
  sceneNumber: number;
}

export interface PreFlightResult {
  ok: boolean;
  blockingCount: number;
  warningCount: number;
}

/**
 * Returns true when an asset URL exists AND is reachable from the server.
 * blob: URLs are local-only and will be silently skipped by Shotstack.
 */
const isServerReachable = (url?: string | null): boolean => {
  if (!url) return false;
  if (url.startsWith("blob:")) return false;
  if (url.startsWith("data:") && url.length > 1024 * 500) return false; // huge inline asset
  return true;
};

type AudioState = "ok" | "missing" | "blob" | "n/a";

const stateOf = (url?: string | null, required = true): AudioState => {
  if (!url) return required ? "missing" : "n/a";
  if (url.startsWith("blob:")) return "blob";
  return "ok";
};

const STATE_LABEL: Record<AudioState, string> = {
  ok: "OK",
  missing: "Mancante",
  blob: "Scaduto (blob)",
  "n/a": "—",
};

const STATE_CLASS: Record<AudioState, string> = {
  ok: "text-green-500",
  missing: "text-destructive",
  blob: "text-orange-400",
  "n/a": "text-muted-foreground/60",
};

/**
 * Pre-flight check shown above the "Avvia Produzione" button. Surfaces:
 *  - per-scene narration / SFX / music readability (no blob:, no missing)
 *  - blocking count vs. warning count
 *
 * Caller uses the returned `ok` flag to enable/disable the render button.
 */
export const PreFlightAudioPanel = ({ scenes, backgroundMusicUrl, onRegenerateExpired, progress, onAudioDurationMeasured }: PreFlightAudioPanelProps) => {
  const rows = useMemo(() => scenes.map((s, i) => {
    const narration = stateOf(s.audioUrl, true);
    const sfx = stateOf(s.sfxUrl, !!s.sfxPrompt);
    return {
      idx: i,
      sceneNumber: s.sceneNumber,
      narration,
      sfx,
      hasDurationWarning: !!s.audioDurationWarning,
      audioDuration: s.audioDuration,
      sceneDuration: s.duration,
    };
  }), [scenes]);

  const music = stateOf(backgroundMusicUrl, true);

  // Lazily measure real narration duration for each scene with a server-reachable audio URL.
  const measuredRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!onAudioDurationMeasured) return;
    let cancelled = false;
    (async () => {
      for (let i = 0; i < scenes.length; i++) {
        const s = scenes[i];
        if (!s.audioUrl || s.audioUrl.startsWith("blob:")) continue;
        if (s.audioDuration !== undefined) continue;
        const key = `${i}|${s.audioUrl}`;
        if (measuredRef.current.has(key)) continue;
        measuredRef.current.add(key);
        const r = await measureAndValidateAudioDuration(s.audioUrl, s.duration).catch(() => null);
        if (cancelled || !r) continue;
        onAudioDurationMeasured({
          sceneIndex: i,
          measured: r.measured,
          expected: r.expected,
          mismatch: r.mismatch,
          warning: r.warning,
        });
      }
    })();
    return () => { cancelled = true; };
  }, [scenes, onAudioDurationMeasured]);

  // Blocking = blob URLs (silently skipped server-side, ruin the final video).
  // Missing narration is also blocking — without voice the project is broken.
  // Audio LONGER than scene duration is also blocking — voice gets cut off.
  const durationOverflowCount = rows.filter(r => r.hasDurationWarning).length;
  const blockingCount =
    rows.filter(r => r.narration === "blob" || r.narration === "missing").length +
    rows.filter(r => r.sfx === "blob").length +
    durationOverflowCount +
    (music === "blob" ? 1 : 0);

  const warningCount =
    rows.filter(r => r.sfx === "missing").length +
    (music === "missing" ? 1 : 0);

  const allOk = blockingCount === 0 && warningCount === 0;

  // Items that can be auto-regenerated: anything that's blob: (expired) or missing narration.
  const expiredItems = useMemo<ExpiredAudioItem[]>(() => {
    const list: ExpiredAudioItem[] = [];
    scenes.forEach((s, i) => {
      if (s.audioUrl?.startsWith("blob:") || (!s.audioUrl && s.narration)) {
        list.push({ type: "audio", sceneIndex: i, sceneNumber: s.sceneNumber });
      }
      if (s.sfxUrl?.startsWith("blob:")) {
        list.push({ type: "sfx", sceneIndex: i, sceneNumber: s.sceneNumber });
      }
    });
    if (backgroundMusicUrl?.startsWith("blob:")) {
      list.push({ type: "music", sceneIndex: -1, sceneNumber: 0 });
    }
    return list;
  }, [scenes, backgroundMusicUrl]);

  const canRegenerate = expiredItems.length > 0 && !!onRegenerateExpired;

  return (
    <Card className={cn(
      "border",
      allOk ? "border-green-500/30 bg-green-500/5"
        : blockingCount > 0 ? "border-destructive/40 bg-destructive/5"
        : "border-yellow-500/30 bg-yellow-500/5",
    )}>
      <CardContent className="py-3 px-4 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          {allOk ? (
            <ShieldCheck className="w-4 h-4 text-green-500" />
          ) : (
            <AlertTriangle className={cn("w-4 h-4", blockingCount > 0 ? "text-destructive" : "text-yellow-400")} />
          )}
          <p className="text-sm font-medium">
            Pre-flight audio
          </p>
          {blockingCount > 0 && (
            <Badge variant="destructive" className="text-[10px]">{blockingCount} bloccanti</Badge>
          )}
          {warningCount > 0 && (
            <Badge variant="outline" className="text-[10px] border-yellow-500/40 text-yellow-500">{warningCount} avvisi</Badge>
          )}
          {allOk && (
            <Badge className="text-[10px] bg-green-500/15 text-green-500 border-green-500/30">Tutto pronto</Badge>
          )}
          <div className="ml-auto flex items-center gap-1.5 text-[11px]">
            <Music className={cn("w-3 h-3", STATE_CLASS[music])} />
            <span className={STATE_CLASS[music]}>Musica · {STATE_LABEL[music]}</span>
          </div>
        </div>

        {!allOk && (
          <p className="text-xs text-muted-foreground">
            {blockingCount > 0
              ? "Asset audio non raggiungibili dal server: rigenerali prima del render altrimenti il video finale sarà incompleto."
              : "Alcune scene non hanno SFX configurato — il video verrà comunque generato senza."}
          </p>
        )}

        {progress && progress.total > 0 && (
          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                {progress.label}
              </span>
              <span className="font-mono text-muted-foreground">
                {progress.current}/{progress.total}
              </span>
            </div>
            <Progress value={(progress.current / Math.max(progress.total, 1)) * 100} className="h-1.5" />
          </div>
        )}

        {canRegenerate && !progress && (
          <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
            <p className="text-[11px] text-muted-foreground">
              {expiredItems.length} asset audio scaduti o mancanti rilevati
              {" · "}
              {expiredItems.filter(i => i.type === "audio").length > 0 && `voci: ${expiredItems.filter(i => i.type === "audio").length}`}
              {expiredItems.filter(i => i.type === "sfx").length > 0 && ` · SFX: ${expiredItems.filter(i => i.type === "sfx").length}`}
              {expiredItems.some(i => i.type === "music") && ` · musica`}
            </p>
            <Button
              size="sm"
              variant={blockingCount > 0 ? "destructive" : "outline"}
              onClick={() => onRegenerateExpired?.(expiredItems)}
              className="h-7 text-xs"
            >
              <RefreshCw className="w-3 h-3 mr-1.5" />Rigenera audio scaduti
            </Button>
          </div>
        )}

        {/* Compact per-scene grid, only when there are issues */}
        {!allOk && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 pt-1">
            {rows
              .filter(r => r.narration !== "ok" || r.sfx === "blob" || r.sfx === "missing")
              .map(r => (
                <div
                  key={r.idx}
                  className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded border border-border/40 bg-background/30"
                >
                  <span className="font-mono text-foreground shrink-0">#{r.sceneNumber}</span>
                  <span className={cn("flex items-center gap-0.5", STATE_CLASS[r.narration])} title={`Narrazione: ${STATE_LABEL[r.narration]}`}>
                    <Mic className="w-2.5 h-2.5" />
                    {r.narration === "ok" ? <Check className="w-2.5 h-2.5" /> : <X className="w-2.5 h-2.5" />}
                  </span>
                  <span className={cn("flex items-center gap-0.5", STATE_CLASS[r.sfx])} title={`SFX: ${STATE_LABEL[r.sfx]}`}>
                    <Sparkles className="w-2.5 h-2.5" />
                    {r.sfx === "ok" ? <Check className="w-2.5 h-2.5" /> : r.sfx === "n/a" ? "—" : <X className="w-2.5 h-2.5" />}
                  </span>
                </div>
              ))
            }
          </div>
        )}
      </CardContent>
    </Card>
  );
};

/** Pure helper used by StoryModeWizard to disable the render button. */
export const computePreFlight = (
  scenes: StoryScene[],
  backgroundMusicUrl: string | null,
): PreFlightResult => {
  const blockingCount =
    scenes.filter(s => !isServerReachable(s.audioUrl)).length +
    scenes.filter(s => !!s.sfxUrl && s.sfxUrl.startsWith("blob:")).length +
    (backgroundMusicUrl?.startsWith("blob:") ? 1 : 0);

  const warningCount =
    scenes.filter(s => !!s.sfxPrompt && !s.sfxUrl).length +
    (!backgroundMusicUrl ? 1 : 0);

  return {
    ok: blockingCount === 0,
    blockingCount,
    warningCount,
  };
};
