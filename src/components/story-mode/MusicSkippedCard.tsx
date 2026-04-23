import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2, Music } from "lucide-react";

export interface MusicSkipState {
  /** Why the music was skipped (machine-readable). */
  reason: string;
  /** Human-readable explanation, in italiano. */
  message: string;
  /** When it happened (ms epoch). */
  at: number;
}

interface MusicSkippedCardProps {
  state: MusicSkipState | null;
  retrying: boolean;
  onRetry: () => void;
}

/**
 * Persistent banner shown on the Story Mode "complete" screen when the
 * background soundtrack was skipped (most commonly because the ElevenLabs
 * plan's 2-concurrent-request cap was hit). Lets the user trigger ONLY a
 * music regeneration without re-running the entire pipeline.
 */
export const MusicSkippedCard = ({ state, retrying, onRetry }: MusicSkippedCardProps) => {
  if (!state) return null;

  return (
    <Card className="border-amber-500/40 bg-amber-500/5 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-amber-500/20 p-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
        </div>
        <div className="flex-1 space-y-2">
          <div>
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Music className="h-3.5 w-3.5" />
              Colonna sonora saltata
            </h4>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {state.message}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground/70">
              Motivo: <code className="font-mono">{state.reason}</code>
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={onRetry}
            disabled={retrying}
            className="border-amber-500/40 hover:bg-amber-500/10"
          >
            {retrying ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Riprovo solo la musica…
              </>
            ) : (
              <>
                <Music className="mr-2 h-3.5 w-3.5" />
                Riprova solo la musica
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
};
