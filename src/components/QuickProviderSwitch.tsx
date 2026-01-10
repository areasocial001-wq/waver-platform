import React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Settings2, Music, Film, Mic, Volume2, Zap } from "lucide-react";
import { useProviderPreferences } from "@/hooks/useProviderPreferences";
import {
  PROVIDERS,
  OperationType,
  ProviderType,
  getProvidersForOperation,
} from "@/lib/providerConfig";
import { toast } from "sonner";

interface QuickProviderSwitchProps {
  operations?: OperationType[];
  trigger?: React.ReactNode;
}

const OPERATION_CONFIG: Record<OperationType, { label: string; icon: React.ReactNode }> = {
  music_generation: { label: "Musica", icon: <Music className="h-4 w-4" /> },
  sound_effects: { label: "Effetti Sonori", icon: <Volume2 className="h-4 w-4" /> },
  text_to_speech: { label: "Text-to-Speech", icon: <Mic className="h-4 w-4" /> },
  speech_to_text: { label: "Speech-to-Text", icon: <Mic className="h-4 w-4" /> },
  image_generation: { label: "Immagini", icon: <Zap className="h-4 w-4" /> },
  video_generation: { label: "Video", icon: <Film className="h-4 w-4" /> },
  chat_completion: { label: "Chat AI", icon: <Zap className="h-4 w-4" /> },
};

export function QuickProviderSwitch({
  operations = ["video_generation", "music_generation", "sound_effects", "text_to_speech"],
  trigger,
}: QuickProviderSwitchProps) {
  const { preferences, setProviderForOperation, getEffectiveProvider } = useProviderPreferences();
  const [open, setOpen] = React.useState(false);

  const handleProviderChange = (operation: OperationType, provider: ProviderType) => {
    setProviderForOperation(operation, provider);
    const providerInfo = PROVIDERS[provider];
    toast.success(`Provider ${OPERATION_CONFIG[operation].label}: ${providerInfo.name}`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">Cambia Provider</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Cambio Rapido Provider
          </DialogTitle>
          <DialogDescription>
            Cambia velocemente i provider AI per questo progetto senza uscire dall'editor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {operations.map((operation) => {
            const config = OPERATION_CONFIG[operation];
            const availableProviders = getProvidersForOperation(operation);
            const currentProvider = preferences[operation];
            const effectiveProvider = getEffectiveProvider(operation);

            return (
              <div key={operation} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                      {config.icon}
                    </div>
                    <span className="font-medium text-sm">{config.label}</span>
                  </div>
                  {currentProvider === "auto" && (
                    <Badge variant="outline" className="text-xs border-dashed">
                      Auto → {PROVIDERS[effectiveProvider].name}
                    </Badge>
                  )}
                </div>

                <Select
                  value={currentProvider}
                  onValueChange={(value) =>
                    handleProviderChange(operation, value as ProviderType)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        <span>{PROVIDERS[currentProvider].logo}</span>
                        <span>{PROVIDERS[currentProvider].name}</span>
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {availableProviders.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        <div className="flex items-center gap-2">
                          <span>{provider.logo}</span>
                          <span>{provider.name}</span>
                          {provider.id === "auto" && (
                            <Badge variant="secondary" className="text-[10px] ml-1">
                              Consigliato
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>

        <Separator />

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
          <span>Le modifiche sono applicate immediatamente</span>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Chiudi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
