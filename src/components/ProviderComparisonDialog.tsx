import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, Star, DollarSign, GitCompare, Check, Clock, Film, Music } from "lucide-react";

interface ProviderInfo {
  name: string;
  color: string;
  speed: 1 | 2 | 3;
  quality: 1 | 2 | 3;
  cost: 1 | 2 | 3;
  features: string[];
}

interface ProviderComparisonDialogProps {
  providers: Record<string, ProviderInfo>;
  selectedProvider: string;
  onSelectProvider: (provider: string) => void;
  durations: Record<string, { value: string; label: string }[]>;
  resolutions: Record<string, { value: string; label: string }[]>;
}

const RatingBar = ({ value, max = 3, color }: { value: number; max?: number; color: string }) => (
  <div className="flex gap-1">
    {Array.from({ length: max }).map((_, i) => (
      <div
        key={i}
        className={`h-2 w-4 rounded-sm ${i < value ? color : "bg-muted"}`}
      />
    ))}
  </div>
);

const getSpeedLabel = (speed: number) => {
  if (speed === 1) return "Lento";
  if (speed === 2) return "Medio";
  return "Veloce";
};

const getQualityLabel = (quality: number) => {
  if (quality === 1) return "Base";
  if (quality === 2) return "Buona";
  return "Eccellente";
};

const getCostLabel = (cost: number) => {
  if (cost === 1) return "Economico";
  if (cost === 2) return "Medio";
  return "Premium";
};

export const ProviderComparisonDialog = ({
  providers,
  selectedProvider,
  onSelectProvider,
  durations,
  resolutions,
}: ProviderComparisonDialogProps) => {
  const providerKeys = Object.keys(providers).filter(k => k !== "auto");

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <GitCompare className="w-4 h-4" />
          Confronta Provider
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="w-5 h-5" />
            Confronto Provider Video AI
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Provider</th>
                <th className="text-center py-3 px-2 font-medium text-muted-foreground">
                  <div className="flex items-center justify-center gap-1">
                    <Zap className="w-3 h-3" />
                    Velocità
                  </div>
                </th>
                <th className="text-center py-3 px-2 font-medium text-muted-foreground">
                  <div className="flex items-center justify-center gap-1">
                    <Star className="w-3 h-3" />
                    Qualità
                  </div>
                </th>
                <th className="text-center py-3 px-2 font-medium text-muted-foreground">
                  <div className="flex items-center justify-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    Costo
                  </div>
                </th>
                <th className="text-center py-3 px-2 font-medium text-muted-foreground">
                  <div className="flex items-center justify-center gap-1">
                    <Clock className="w-3 h-3" />
                    Durate
                  </div>
                </th>
                <th className="text-center py-3 px-2 font-medium text-muted-foreground">
                  <div className="flex items-center justify-center gap-1">
                    <Film className="w-3 h-3" />
                    Risoluzioni
                  </div>
                </th>
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Caratteristiche</th>
                <th className="text-center py-3 px-2 font-medium text-muted-foreground">Azione</th>
              </tr>
            </thead>
            <tbody>
              {providerKeys.map((key) => {
                const provider = providers[key];
                const providerDurations = durations[key] || durations.auto;
                const providerResolutions = resolutions[key] || resolutions.auto;
                const isSelected = selectedProvider === key;

                return (
                  <tr
                    key={key}
                    className={`border-b transition-colors ${
                      isSelected ? "bg-primary/5" : "hover:bg-muted/50"
                    }`}
                  >
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${provider.color}`} />
                        <span className="font-medium">{provider.name}</span>
                        {isSelected && (
                          <Badge variant="default" className="text-xs">
                            Attivo
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex flex-col items-center gap-1">
                        <RatingBar value={provider.speed} color="bg-yellow-500" />
                        <span className="text-xs text-muted-foreground">
                          {getSpeedLabel(provider.speed)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex flex-col items-center gap-1">
                        <RatingBar value={provider.quality} color="bg-blue-500" />
                        <span className="text-xs text-muted-foreground">
                          {getQualityLabel(provider.quality)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex flex-col items-center gap-1">
                        <RatingBar value={provider.cost} color="bg-green-500" />
                        <span className="text-xs text-muted-foreground">
                          {getCostLabel(provider.cost)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <div className="flex flex-wrap justify-center gap-1">
                        {providerDurations.map((d) => (
                          <Badge key={d.value} variant="outline" className="text-xs">
                            {d.value}s
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <div className="flex flex-wrap justify-center gap-1">
                        {providerResolutions.map((r) => (
                          <Badge key={r.value} variant="outline" className="text-xs">
                            {r.value}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex flex-wrap gap-1">
                        {provider.features.map((feature, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {feature}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <Button
                        size="sm"
                        variant={isSelected ? "default" : "outline"}
                        onClick={() => onSelectProvider(key)}
                        className="gap-1"
                      >
                        {isSelected ? (
                          <>
                            <Check className="w-3 h-3" />
                            Selezionato
                          </>
                        ) : (
                          "Seleziona"
                        )}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 p-4 rounded-lg bg-muted/50">
          <h4 className="font-medium mb-2">Legenda</h4>
          <div className="grid grid-cols-3 gap-4 text-sm text-muted-foreground">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-yellow-500" />
                <span className="font-medium">Velocità</span>
              </div>
              <p className="text-xs">Tempo di generazione del video</p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Star className="w-4 h-4 text-blue-500" />
                <span className="font-medium">Qualità</span>
              </div>
              <p className="text-xs">Qualità visiva del risultato</p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-green-500" />
                <span className="font-medium">Costo</span>
              </div>
              <p className="text-xs">Costo per generazione</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
