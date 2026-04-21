import { useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ShieldCheck, AlertTriangle, Film, RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StoryScene } from "./types";
import type { BatchProgress } from "./PreFlightAudioPanel";

export interface ProblematicVideoItem {
  sceneIndex: number;
  sceneNumber: number;
  /** Why we flag this scene — drives tooltip + summary line */
  reasons: VideoIssue[];
}

export type VideoIssue = "missing" | "blob" | "aspect" | "format";

const REASON_LABEL: Record<VideoIssue, string> = {
  missing: "video assente",
  blob: "URL scaduto (blob)",
  aspect: "aspect ratio errato",
  format: "formato non supportato",
};

interface PreFlightVideoPanelProps {
  scenes: StoryScene[];
  /** Expected aspect ratio from input, e.g. "16:9" — used only for display */
  expectedAspect?: string;
  onRegenerateProblematic?: (items: ProblematicVideoItem[]) => void | Promise<void>;
  progress?: BatchProgress | null;
}

const SUPPORTED_FORMATS = ["mp4", "mov", "webm", "m4v"];

const detectFormatIssue = (url?: string | null): boolean => {
  if (!url) return false;
  if (url.startsWith("blob:") || url.startsWith("data:")) return false;
  // Strip query string before checking extension
  const clean = url.split("?")[0].toLowerCase();
  const ext = clean.split(".").pop() || "";
  // Only flag if there is a clear extension AND it's not in the supported list
  if (!ext || ext.length > 5) return false;
  return !SUPPORTED_FORMATS.includes(ext);
};

/**
 * Pre-flight check for video clips. Detects:
 *  - missing videos on completed scenes
 *  - blob: URLs (server can't reach them — would silently break the render)
 *  - aspect ratio mismatch (already measured client-side)
 *  - unsupported file format
 */
export const PreFlightVideoPanel = ({
  scenes,
  expectedAspect,
  onRegenerateProblematic,
  progress,
}: PreFlightVideoPanelProps) => {
  const items = useMemo<ProblematicVideoItem[]>(() => {
    const out: ProblematicVideoItem[] = [];
    scenes.forEach((s, i) => {
      const reasons: VideoIssue[] = [];
      // Only flag scenes the user expects to have a video (status completed OR has a URL slot)
      const isExpected = s.videoStatus === "completed" || !!s.videoUrl;
      if (!isExpected) return;

      if (!s.videoUrl) reasons.push("missing");
      else if (s.videoUrl.startsWith("blob:")) reasons.push("blob");
      if (s.videoAspectWarning) reasons.push("aspect");
      if (s.videoUrl && detectFormatIssue(s.videoUrl)) reasons.push("format");

      if (reasons.length > 0) {
        out.push({ sceneIndex: i, sceneNumber: s.sceneNumber, reasons });
      }
    });
    return out;
  }, [scenes]);

  // Auto-trigger regeneration if blob URLs are detected on mount
  useEffect(() => {
    const blobItems = items.filter(i => i.reasons.includes("blob"));
    if (blobItems.length > 0 && onRegenerateProblematic) {
      onRegenerateProblematic(blobItems);
    }
  }, []); // Run once on mount

  const completedCount = scenes.filter(s => s.videoStatus === "completed" && s.videoUrl).length;
  const blockingCount = items.filter(i =>
    i.reasons.includes("missing") || i.reasons.includes("blob") || i.reasons.includes("format")
  ).length;
  const warningCount = items.length - blockingCount;
  const allOk = items.length === 0 && completedCount > 0;
  const noVideosYet = completedCount === 0;

  // Don't render the panel until at least one video exists — keeps the review step clean
  if (noVideosYet) return null;

  const canRegenerate = items.length > 0 && !!onRegenerateProblematic;

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
          <Film className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm font-medium">Pre-flight video</p>
          {blockingCount > 0 && (
            <Badge variant="destructive" className="text-[10px]">{blockingCount} bloccanti</Badge>
          )}
          {warningCount > 0 && (
            <Badge variant="outline" className="text-[10px] border-yellow-500/40 text-yellow-500">{warningCount} avvisi</Badge>
          )}
          {allOk && (
            <Badge className="text-[10px] bg-green-500/15 text-green-500 border-green-500/30">
              {completedCount} clip OK
            </Badge>
          )}
          {expectedAspect && (
            <span className="ml-auto text-[11px] text-muted-foreground font-mono">{expectedAspect}</span>
          )}
        </div>

        {!allOk && items.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {blockingCount > 0
              ? "Alcuni video non sono usabili dal server: rigenerali prima del render."
              : "Alcuni video hanno warning ma il render può procedere."}
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
              {items.length} video problematici rilevati
            </p>
            <Button
              size="sm"
              variant={blockingCount > 0 ? "destructive" : "outline"}
              onClick={() => onRegenerateProblematic?.(items)}
              className="h-7 text-xs"
            >
              <RefreshCw className="w-3 h-3 mr-1.5" />Rigenera video problematici
            </Button>
          </div>
        )}

        {items.length > 0 && !progress && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 pt-1">
            {items.map(it => (
              <div
                key={it.sceneIndex}
                className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded border border-border/40 bg-background/30"
                title={it.reasons.map(r => REASON_LABEL[r]).join(" · ")}
              >
                <span className="font-mono text-foreground shrink-0">#{it.sceneNumber}</span>
                <span className="text-muted-foreground truncate">
                  {it.reasons.map(r => REASON_LABEL[r]).join(", ")}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

/** Pure helper used to disable the render button when video assets are unusable. */
export const computeVideoPreFlight = (scenes: StoryScene[]): { ok: boolean; blockingCount: number } => {
  let blockingCount = 0;
  scenes.forEach(s => {
    const isExpected = s.videoStatus === "completed" || !!s.videoUrl;
    if (!isExpected) return;
    if (!s.videoUrl) blockingCount++;
    else if (s.videoUrl.startsWith("blob:")) blockingCount++;
    else if (detectFormatIssue(s.videoUrl)) blockingCount++;
  });
  return { ok: blockingCount === 0, blockingCount };
};
