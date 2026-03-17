import { useMemo } from "react";
import { calculateSplitPlan } from "@/hooks/useAutoSplitGeneration";
import { VideoProviderType } from "@/lib/videoProviderConfig";
import { Scissors, Image, ArrowRight, Sparkles, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SplitPlanPreviewProps {
  provider: VideoProviderType;
  requestedDuration: number;
}

/** Shows split plan info before generation (e.g. "3 clip × 8s = 24s") */
export function SplitPlanPreview({ provider, requestedDuration }: SplitPlanPreviewProps) {
  const plan = useMemo(
    () => calculateSplitPlan(provider, requestedDuration),
    [provider, requestedDuration]
  );

  if (!plan.needed) return null;

  return (
    <div className="flex items-center gap-2 p-2.5 rounded-lg border border-accent/30 bg-accent/5">
      <Scissors className="w-4 h-4 text-accent shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          Auto-split: {plan.clipCount} clip × {plan.clipDuration}s = {plan.totalDuration}s
        </p>
        <p className="text-xs text-muted-foreground">
          {plan.totalDuration > requestedDuration 
            ? `Durata effettiva ${plan.totalDuration}s (arrotondata da ${requestedDuration}s)`
            : `I clip verranno generati in sequenza e concatenati automaticamente`
          }
        </p>
      </div>
      <Badge variant="secondary" className="shrink-0 text-xs">
        {plan.clipCount} clip
      </Badge>
    </div>
  );
}

interface AutoSplitProgressProps {
  currentClip: number;
  totalClips: number;
  phase: string;
  clipVideoUrls: string[];
  continuityFrames: string[];
  accentColor?: "accent" | "primary";
}

/** Shows progress + extracted continuity frames during auto-split generation */
export function AutoSplitProgress({
  currentClip,
  totalClips,
  phase,
  clipVideoUrls,
  continuityFrames,
  accentColor = "accent",
}: AutoSplitProgressProps) {
  const colorClass = accentColor === "primary" ? "primary" : "accent";

  return (
    <div className={`p-3 rounded-lg border border-${colorClass}/30 bg-${colorClass}/5 space-y-3`}>
      {/* Progress header */}
      <div className="flex items-center gap-2">
        {phase === "extracting_frame" ? (
          <Image className={`w-4 h-4 animate-pulse text-${colorClass}`} />
        ) : (
          <Sparkles className={`w-4 h-4 animate-spin text-${colorClass}`} />
        )}
        <span className="text-sm font-medium">
          Auto-split: clip {currentClip}/{totalClips}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className={`bg-${colorClass} h-2 rounded-full transition-all duration-500`}
          style={{ width: `${(currentClip / totalClips) * 100}%` }}
        />
      </div>

      {/* Phase label */}
      <p className="text-xs text-muted-foreground">
        {phase === "generating" && "Generazione in corso..."}
        {phase === "waiting" && "Attesa completamento..."}
        {phase === "extracting_frame" && "Estrazione frame di continuità..."}
        {phase === "concatenating" && "Concatenazione clip..."}
      </p>

      {/* Continuity frames timeline */}
      {continuityFrames.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Image className="w-3 h-3" />
            Frame di continuità estratti
          </p>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {Array.from({ length: totalClips }).map((_, idx) => {
              const frameAfterClip = continuityFrames[idx];
              const isCompleted = idx < clipVideoUrls.length;
              const isCurrent = idx + 1 === currentClip;

              return (
                <div key={idx} className="flex items-center gap-1 shrink-0">
                  {/* Clip indicator */}
                  <div
                    className={`w-12 h-8 rounded border flex items-center justify-center text-[10px] font-mono ${
                      isCompleted
                        ? `border-${colorClass} bg-${colorClass}/10 text-${colorClass}`
                        : isCurrent
                        ? `border-${colorClass}/50 bg-${colorClass}/5 text-${colorClass} animate-pulse`
                        : "border-border bg-muted/30 text-muted-foreground"
                    }`}
                  >
                    {isCurrent && !isCompleted ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      `C${idx + 1}`
                    )}
                  </div>

                  {/* Continuity frame between clips */}
                  {idx < totalClips - 1 && (
                    <>
                      <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                      {frameAfterClip ? (
                        <img
                          src={frameAfterClip}
                          alt={`Frame continuità ${idx + 1}→${idx + 2}`}
                          className={`w-14 h-8 rounded border-2 border-${colorClass}/50 object-cover`}
                          title={`Ultimo frame clip ${idx + 1} → inizio clip ${idx + 2}`}
                        />
                      ) : (
                        <div className="w-14 h-8 rounded border border-dashed border-muted-foreground/30 flex items-center justify-center">
                          <span className="text-[8px] text-muted-foreground">—</span>
                        </div>
                      )}
                      <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
