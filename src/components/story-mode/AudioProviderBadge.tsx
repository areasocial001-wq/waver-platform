import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Mic, Music, Volume2, Sparkles, Zap, Bot } from "lucide-react";

export type AudioOp = "tts" | "music" | "sfx";
export type AudioProvider = "elevenlabs" | "aiml" | "openai" | "inworld";

export interface AudioProviderState {
  /** Operation that produced the audio. */
  op: AudioOp;
  /** Which provider actually generated it. */
  provider: AudioProvider;
  /** True if AIML kicked in because ElevenLabs failed. */
  fallbackUsed: boolean;
  /** Why the fallback was used (machine-readable), if any. */
  reason?: string;
  /** When the audio was produced (ms epoch). */
  at: number;
}

const OP_META: Record<AudioOp, { label: string; icon: JSX.Element }> = {
  tts: { label: "Voce narrante", icon: <Mic className="h-3 w-3" /> },
  music: { label: "Colonna sonora", icon: <Music className="h-3 w-3" /> },
  sfx: { label: "Effetti sonori", icon: <Volume2 className="h-3 w-3" /> },
};

const PROVIDER_META: Record<AudioProvider, {
  name: string;
  short: string;
  icon: JSX.Element;
  classes: string;
}> = {
  elevenlabs: {
    name: "Provider primario",
    short: "Primario",
    icon: <Sparkles className="h-3 w-3" />,
    classes: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  },
  aiml: {
    name: "AI/ML API (fallback)",
    short: "AI/ML",
    icon: <Zap className="h-3 w-3" />,
    classes: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  },
  openai: {
    name: "OpenAI (fallback)",
    short: "OpenAI",
    icon: <Zap className="h-3 w-3" />,
    classes: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  },
  inworld: {
    name: "Inworld TTS",
    short: "Inworld",
    icon: <Bot className="h-3 w-3" />,
    classes: "border-violet-500/40 bg-violet-500/10 text-violet-300",
  },
};

interface Props {
  state: AudioProviderState | null;
  className?: string;
}

/**
 * Compact badge showing which provider produced the most recent audio
 * (ElevenLabs primary vs AI/ML API fallback). Lives next to the audio
 * preview so the user can immediately see when the backup is active.
 */
export const AudioProviderBadge = ({ state, className = "" }: Props) => {
  if (!state) return null;
  const op = OP_META[state.op];
  const prov = PROVIDER_META[state.provider];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium ${prov.classes} ${className}`}
          >
            {op.icon}
            <span className="text-muted-foreground">→</span>
            {prov.icon}
            <span>{prov.short}</span>
            {state.fallbackUsed && (
              <span className="ml-1 rounded bg-amber-500/20 px-1 text-[10px] uppercase tracking-wide">
                fallback
              </span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[260px]">
          <div className="space-y-1">
            <p className="font-medium">{op.label}</p>
            <p className="text-xs text-muted-foreground">
              Provider attivo: <span className="text-foreground">{prov.name}</span>
            </p>
            {state.fallbackUsed && (
              <p className="text-xs text-amber-400">
                Provider primario non disponibile{state.reason ? ` (${state.reason})` : ""}.
                Audio prodotto dal provider di backup.
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
