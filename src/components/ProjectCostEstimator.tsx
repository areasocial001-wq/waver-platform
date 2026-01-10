import React, { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Calculator, Music, Film, Mic, Volume2, DollarSign, Info, TrendingDown } from "lucide-react";
import { useProviderPreferences } from "@/hooks/useProviderPreferences";
import { PROVIDERS, OperationType } from "@/lib/providerConfig";

interface OperationCount {
  video_clips: number;
  music_tracks: number;
  sound_effects: number;
  voiceovers: number;
  voiceover_characters: number;
}

interface ProjectCostEstimatorProps {
  operations: OperationCount;
  className?: string;
  compact?: boolean;
}

// Price per unit by provider (in USD)
const PROVIDER_PRICES: Record<string, Record<OperationType, number>> = {
  aiml: {
    music_generation: 0.45, // per track
    sound_effects: 0.05, // per effect
    text_to_speech: 0.00035, // per character
    speech_to_text: 0.006, // per minute
    image_generation: 0.05, // per image
    video_generation: 0.65, // per 5s video
    chat_completion: 0.01, // per 1K tokens
  },
  piapi: {
    music_generation: 0.20,
    sound_effects: 0.03,
    text_to_speech: 0.0003,
    speech_to_text: 0.005,
    image_generation: 0.03,
    video_generation: 1.0,
    chat_completion: 0.008,
  },
  elevenlabs: {
    music_generation: 0.30, // per minute
    sound_effects: 0.10,
    text_to_speech: 0.0003, // per character
    speech_to_text: 0.0,
    image_generation: 0.0,
    video_generation: 0.0,
    chat_completion: 0.0,
  },
};

const OPERATION_ICONS: Record<string, React.ReactNode> = {
  video: <Film className="h-4 w-4" />,
  music: <Music className="h-4 w-4" />,
  sfx: <Volume2 className="h-4 w-4" />,
  tts: <Mic className="h-4 w-4" />,
};

export function ProjectCostEstimator({
  operations,
  className = "",
  compact = false,
}: ProjectCostEstimatorProps) {
  const { getEffectiveProvider } = useProviderPreferences();

  const costs = useMemo(() => {
    const videoProvider = getEffectiveProvider("video_generation");
    const musicProvider = getEffectiveProvider("music_generation");
    const sfxProvider = getEffectiveProvider("sound_effects");
    const ttsProvider = getEffectiveProvider("text_to_speech");

    const videoPrice = PROVIDER_PRICES[videoProvider]?.video_generation || 0.5;
    const musicPrice = PROVIDER_PRICES[musicProvider]?.music_generation || 0.3;
    const sfxPrice = PROVIDER_PRICES[sfxProvider]?.sound_effects || 0.05;
    const ttsPrice = PROVIDER_PRICES[ttsProvider]?.text_to_speech || 0.0003;

    const videoCost = operations.video_clips * videoPrice;
    const musicCost = operations.music_tracks * musicPrice;
    const sfxCost = operations.sound_effects * sfxPrice;
    const ttsCost = operations.voiceover_characters * ttsPrice;

    const total = videoCost + musicCost + sfxCost + ttsCost;

    // Calculate potential savings with cheapest provider
    const cheapestVideoPrice = Math.min(
      PROVIDER_PRICES.aiml.video_generation,
      PROVIDER_PRICES.piapi.video_generation
    );
    const cheapestMusicPrice = Math.min(
      PROVIDER_PRICES.aiml.music_generation,
      PROVIDER_PRICES.piapi.music_generation,
      PROVIDER_PRICES.elevenlabs.music_generation
    );
    const cheapestSfxPrice = Math.min(
      PROVIDER_PRICES.aiml.sound_effects,
      PROVIDER_PRICES.piapi.sound_effects,
      PROVIDER_PRICES.elevenlabs.sound_effects
    );
    const cheapestTtsPrice = Math.min(
      PROVIDER_PRICES.aiml.text_to_speech,
      PROVIDER_PRICES.piapi.text_to_speech,
      PROVIDER_PRICES.elevenlabs.text_to_speech
    );

    const cheapestTotal =
      operations.video_clips * cheapestVideoPrice +
      operations.music_tracks * cheapestMusicPrice +
      operations.sound_effects * cheapestSfxPrice +
      operations.voiceover_characters * cheapestTtsPrice;

    const potentialSavings = total - cheapestTotal;

    return {
      breakdown: [
        {
          label: "Video",
          icon: OPERATION_ICONS.video,
          count: operations.video_clips,
          unit: "clip",
          unitPrice: videoPrice,
          total: videoCost,
          provider: PROVIDERS[videoProvider],
        },
        {
          label: "Musica",
          icon: OPERATION_ICONS.music,
          count: operations.music_tracks,
          unit: "tracce",
          unitPrice: musicPrice,
          total: musicCost,
          provider: PROVIDERS[musicProvider],
        },
        {
          label: "Effetti Sonori",
          icon: OPERATION_ICONS.sfx,
          count: operations.sound_effects,
          unit: "effetti",
          unitPrice: sfxPrice,
          total: sfxCost,
          provider: PROVIDERS[sfxProvider],
        },
        {
          label: "Voiceover",
          icon: OPERATION_ICONS.tts,
          count: operations.voiceover_characters,
          unit: "caratteri",
          unitPrice: ttsPrice,
          total: ttsCost,
          provider: PROVIDERS[ttsProvider],
        },
      ],
      total,
      potentialSavings,
    };
  }, [operations, getEffectiveProvider]);

  const formatPrice = (price: number) => {
    if (price < 0.01) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(2)}`;
  };

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={`gap-1.5 cursor-default ${className}`}
            >
              <Calculator className="h-3 w-3" />
              <span className="font-semibold">{formatPrice(costs.total)}</span>
              <span className="text-muted-foreground">stima</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs p-3">
            <div className="space-y-2">
              <p className="font-medium text-sm">Stima Costi Progetto</p>
              {costs.breakdown
                .filter((item) => item.count > 0)
                .map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      {item.label} ({item.count})
                    </span>
                    <span>{formatPrice(item.total)}</span>
                  </div>
                ))}
              <Separator className="my-1" />
              <div className="flex justify-between font-medium">
                <span>Totale</span>
                <span>{formatPrice(costs.total)}</span>
              </div>
              {costs.potentialSavings > 0.01 && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <TrendingDown className="h-3 w-3" />
                  Risparmio potenziale: {formatPrice(costs.potentialSavings)}
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Stima Costi Progetto</CardTitle>
        </div>
        <CardDescription className="text-xs">
          Basato sui provider attualmente selezionati
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {costs.breakdown
          .filter((item) => item.count > 0)
          .map((item, idx) => (
            <div key={idx} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-muted">{item.icon}</div>
                  <span>{item.label}</span>
                  <Badge variant="secondary" className="text-xs">
                    {item.provider.logo} {item.provider.name.split(" ")[0]}
                  </Badge>
                </div>
                <span className="font-medium">{formatPrice(item.total)}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground pl-8">
                <span>
                  {item.count} {item.unit} × {formatPrice(item.unitPrice)}/unità
                </span>
              </div>
            </div>
          ))}

        <Separator />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <span className="font-semibold">Totale Stimato</span>
          </div>
          <span className="text-xl font-bold text-primary">
            {formatPrice(costs.total)}
          </span>
        </div>

        {costs.potentialSavings > 0.01 && (
          <div className="flex items-start gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
            <TrendingDown className="h-4 w-4 text-green-600 mt-0.5" />
            <div className="text-xs">
              <p className="font-medium text-green-700">
                Risparmio potenziale: {formatPrice(costs.potentialSavings)}
              </p>
              <p className="text-green-600/80">
                Cambiando ai provider più economici
              </p>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          <p>I costi sono stime basate sui prezzi pubblicati. I costi reali possono variare.</p>
        </div>
      </CardContent>
    </Card>
  );
}
