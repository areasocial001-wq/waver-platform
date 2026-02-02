import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Clock, Zap, Star, DollarSign, Info, Timer, Maximize2, Image, Film, Layers } from "lucide-react";
import { 
  VIDEO_PROVIDERS, 
  VideoProviderType, 
  PROVIDER_DISPLAY_ORDER,
  getGroupLabel
} from "@/lib/videoProviderConfig";
import { getModelCapabilities } from "@/lib/modelCapabilities";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface VideoProviderSelectProps {
  value: VideoProviderType;
  onValueChange: (value: VideoProviderType) => void;
  filterType?: 'text_to_video' | 'image_to_video';
  showDetails?: boolean;
  showCapabilities?: boolean;
  className?: string;
}

const RatingDots = ({ value, max = 3, color }: { value: number; max?: number; color: string }) => (
  <div className="flex gap-0.5">
    {Array.from({ length: max }).map((_, i) => (
      <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < value ? color : "bg-muted-foreground/30"}`} />
    ))}
  </div>
);

export function VideoProviderSelect({ 
  value, 
  onValueChange, 
  filterType,
  showDetails = true,
  showCapabilities = true,
  className = ''
}: VideoProviderSelectProps) {
  const capabilities = getModelCapabilities(value);
  // Filtra provider in base al tipo
  const filteredProviders = PROVIDER_DISPLAY_ORDER.filter(id => {
    const provider = VIDEO_PROVIDERS[id];
    if (!filterType) return true;
    return filterType === 'text_to_video' 
      ? provider.supportsTextToVideo 
      : provider.supportsImageToVideo;
  });

  // Raggruppa provider
  const groupedProviders = filteredProviders.reduce((acc, id) => {
    const provider = VIDEO_PROVIDERS[id];
    const group = provider.group;
    if (!acc[group]) acc[group] = [];
    acc[group].push(id);
    return acc;
  }, {} as Record<string, VideoProviderType[]>);

  const currentProvider = VIDEO_PROVIDERS[value];

  return (
    <div className={`space-y-2 ${className}`}>
      <Select value={value} onValueChange={(v) => onValueChange(v as VideoProviderType)}>
        <SelectTrigger className="w-full">
          <SelectValue>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${currentProvider?.color || 'bg-accent'}`} />
              <span>{currentProvider?.name || 'Seleziona provider'}</span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-80">
          {Object.entries(groupedProviders).map(([group, providerIds]) => (
            <div key={group}>
              {group !== 'auto' && (
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {getGroupLabel(group as any)}
                </div>
              )}
              {providerIds.map(id => {
                const provider = VIDEO_PROVIDERS[id];
                const providerCaps = getModelCapabilities(id);
                return (
                  <SelectItem key={id} value={id}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${provider.color}`} />
                      <span>{provider.name}</span>
                      {providerCaps.supportsEndFrame && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-purple-500/20 text-purple-400 border-purple-500/30">
                          <Layers className="w-2.5 h-2.5 mr-0.5" />
                          Interp
                        </Badge>
                      )}
                      {provider.features.length > 0 && !providerCaps.supportsEndFrame && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1">
                          {provider.features[0]}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                );
              })}
            </div>
          ))}
        </SelectContent>
      </Select>

      {/* Dettagli provider selezionato */}
      {showDetails && currentProvider && value !== 'auto' && (
        <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">{currentProvider.name}</span>
            <Badge variant="outline" className={`${currentProvider.badgeColor} ${currentProvider.textColor} border-0 text-xs`}>
              {currentProvider.estimatedTime}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-3">{currentProvider.description}</p>
          
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <Zap className="w-3 h-3 mx-auto mb-1 text-muted-foreground" />
              <p className="text-[10px] text-muted-foreground mb-1">Velocità</p>
              <RatingDots value={currentProvider.speed} color="bg-blue-500" />
            </div>
            <div className="text-center">
              <Star className="w-3 h-3 mx-auto mb-1 text-muted-foreground" />
              <p className="text-[10px] text-muted-foreground mb-1">Qualità</p>
              <RatingDots value={currentProvider.quality} color="bg-yellow-500" />
            </div>
            <div className="text-center">
              <DollarSign className="w-3 h-3 mx-auto mb-1 text-muted-foreground" />
              <p className="text-[10px] text-muted-foreground mb-1">Costo</p>
              <RatingDots value={currentProvider.cost} color="bg-green-500" />
            </div>
          </div>

          {currentProvider.features.length > 1 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {currentProvider.features.slice(0, 4).map((feature, i) => (
                <Badge key={i} variant="secondary" className="text-[10px]">
                  {feature}
                </Badge>
              ))}
            </div>
          )}

          {/* Model Capabilities Info */}
          {showCapabilities && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <TooltipProvider>
                <div className="flex items-center gap-1 mb-2">
                  <Info className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                    Limiti modello
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {/* Durations */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5 p-1.5 rounded bg-background/50 cursor-help">
                        <Timer className="w-3 h-3 text-blue-500" />
                        <span className="text-[10px] text-muted-foreground">
                          {capabilities.durations.map(d => `${d.value}s`).join(', ')}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p className="text-xs font-medium mb-1">Durate supportate</p>
                      <p className="text-xs text-muted-foreground">
                        Questo modello supporta solo le durate elencate. Valori diversi verranno automaticamente corretti.
                      </p>
                    </TooltipContent>
                  </Tooltip>

                  {/* Resolutions */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5 p-1.5 rounded bg-background/50 cursor-help">
                        <Maximize2 className="w-3 h-3 text-green-500" />
                        <span className="text-[10px] text-muted-foreground">
                          {capabilities.resolutions.map(r => r.value).join(', ')}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p className="text-xs font-medium mb-1">Risoluzioni supportate</p>
                      <p className="text-xs text-muted-foreground">
                        Le risoluzioni disponibili per questo modello.
                      </p>
                    </TooltipContent>
                  </Tooltip>

                  {/* Aspect Ratios (if available) */}
                  {capabilities.aspectRatios && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1.5 p-1.5 rounded bg-background/50 cursor-help">
                          <Film className="w-3 h-3 text-purple-500" />
                          <span className="text-[10px] text-muted-foreground truncate">
                            {capabilities.aspectRatios.slice(0, 3).map(a => a.value).join(', ')}
                            {capabilities.aspectRatios.length > 3 && '...'}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p className="text-xs font-medium mb-1">Aspect Ratio supportati</p>
                        <p className="text-xs text-muted-foreground">
                          {capabilities.aspectRatios.map(a => a.label).join(', ')}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {/* Input Types */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5 p-1.5 rounded bg-background/50 cursor-help">
                        <Image className="w-3 h-3 text-orange-500" />
                        <span className="text-[10px] text-muted-foreground">
                          {[
                            capabilities.supportsTextToVideo && 'T2V',
                            capabilities.supportsImageToVideo && 'I2V',
                            capabilities.supportsEndFrame && 'Interp',
                          ].filter(Boolean).join(', ')}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p className="text-xs font-medium mb-1">Modalità input</p>
                      <div className="text-xs text-muted-foreground space-y-1">
                        {capabilities.supportsTextToVideo && <p>• T2V: Testo a Video</p>}
                        {capabilities.supportsImageToVideo && <p>• I2V: Immagine a Video</p>}
                        {capabilities.supportsEndFrame && (
                          <p className="text-purple-400">• Interp: Interpolazione frame (start→end)</p>
                        )}
                        {capabilities.requiresEndFrame && <p>• Richiede frame iniziale e finale</p>}
                        {capabilities.supportsMotionControl && <p>• Motion Control disponibile</p>}
                        {capabilities.supportsAudio && <p>• Genera audio</p>}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
