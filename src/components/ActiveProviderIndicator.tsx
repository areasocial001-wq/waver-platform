import React from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useProviderPreferences } from "@/hooks/useProviderPreferences";
import { PROVIDERS, OperationType } from "@/lib/providerConfig";
import { Music, Film, Image, Mic, Volume2 } from "lucide-react";

interface ActiveProviderIndicatorProps {
  className?: string;
  showAll?: boolean;
  operations?: OperationType[];
}

const OPERATION_ICONS: Record<OperationType, React.ReactNode> = {
  music_generation: <Music className="h-3 w-3" />,
  sound_effects: <Volume2 className="h-3 w-3" />,
  text_to_speech: <Mic className="h-3 w-3" />,
  speech_to_text: <Mic className="h-3 w-3" />,
  image_generation: <Image className="h-3 w-3" />,
  video_generation: <Film className="h-3 w-3" />,
  chat_completion: <Mic className="h-3 w-3" />,
};

const OPERATION_LABELS: Record<OperationType, string> = {
  music_generation: "Musica",
  sound_effects: "SFX",
  text_to_speech: "TTS",
  speech_to_text: "STT",
  image_generation: "Immagini",
  video_generation: "Video",
  chat_completion: "Chat",
};

export function ActiveProviderIndicator({ 
  className = "", 
  showAll = false,
  operations = ['music_generation', 'video_generation', 'text_to_speech', 'sound_effects']
}: ActiveProviderIndicatorProps) {
  const { getEffectiveProvider, preferences } = useProviderPreferences();

  const displayOperations = showAll 
    ? Object.keys(OPERATION_ICONS) as OperationType[]
    : operations;

  return (
    <TooltipProvider>
      <div className={`flex flex-wrap gap-1.5 ${className}`}>
        {displayOperations.map((operation) => {
          const effectiveProvider = getEffectiveProvider(operation);
          const provider = PROVIDERS[effectiveProvider];
          const isAuto = preferences[operation] === 'auto';

          return (
            <Tooltip key={operation}>
              <TooltipTrigger asChild>
                <Badge 
                  variant="outline" 
                  className={`text-xs px-2 py-0.5 flex items-center gap-1.5 cursor-default transition-colors
                    ${isAuto ? 'border-dashed' : 'border-solid'}
                    hover:bg-muted/50
                  `}
                >
                  {OPERATION_ICONS[operation]}
                  <span className="font-medium">{OPERATION_LABELS[operation]}</span>
                  <span className="text-muted-foreground">→</span>
                  <span>{provider.logo}</span>
                  <span className="text-muted-foreground text-[10px]">
                    {provider.name.split(' ')[0]}
                  </span>
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[200px]">
                <div className="space-y-1">
                  <p className="font-medium">{OPERATION_LABELS[operation]}</p>
                  <p className="text-xs text-muted-foreground">
                    Provider: <span className="text-foreground">{provider.name}</span>
                  </p>
                  {isAuto && (
                    <p className="text-xs text-primary">
                      Selezionato automaticamente
                    </p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
