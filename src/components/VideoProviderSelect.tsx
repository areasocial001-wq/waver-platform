import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Clock, Zap, Star, DollarSign } from "lucide-react";
import { 
  VIDEO_PROVIDERS, 
  VideoProviderType, 
  PROVIDER_DISPLAY_ORDER,
  getGroupLabel
} from "@/lib/videoProviderConfig";

interface VideoProviderSelectProps {
  value: VideoProviderType;
  onValueChange: (value: VideoProviderType) => void;
  filterType?: 'text_to_video' | 'image_to_video';
  showDetails?: boolean;
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
  className = ''
}: VideoProviderSelectProps) {
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
                return (
                  <SelectItem key={id} value={id}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${provider.color}`} />
                      <span>{provider.name}</span>
                      {provider.features.length > 0 && (
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
        </div>
      )}
    </div>
  );
}
