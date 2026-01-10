import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Settings, RotateCcw, Zap, Music, Mic, Image, Film, MessageSquare, Volume2 } from "lucide-react";
import { useProviderPreferences } from "@/hooks/useProviderPreferences";
import { 
  PROVIDERS, 
  getProvidersForOperation, 
  OperationType,
  ProviderType 
} from "@/lib/providerConfig";

const OPERATION_CONFIG: Record<OperationType, { label: string; icon: React.ReactNode; description: string }> = {
  music_generation: {
    label: "Generazione Musica",
    icon: <Music className="h-4 w-4" />,
    description: "Crea colonne sonore e musica di sottofondo"
  },
  sound_effects: {
    label: "Effetti Sonori",
    icon: <Volume2 className="h-4 w-4" />,
    description: "Genera effetti sonori e transizioni audio"
  },
  text_to_speech: {
    label: "Text-to-Speech",
    icon: <Mic className="h-4 w-4" />,
    description: "Converti testo in voce parlata"
  },
  speech_to_text: {
    label: "Speech-to-Text",
    icon: <MessageSquare className="h-4 w-4" />,
    description: "Trascrivi audio in testo"
  },
  image_generation: {
    label: "Generazione Immagini",
    icon: <Image className="h-4 w-4" />,
    description: "Crea immagini da prompt testuali"
  },
  video_generation: {
    label: "Generazione Video",
    icon: <Film className="h-4 w-4" />,
    description: "Genera video da testo o immagini"
  },
  chat_completion: {
    label: "Chat AI",
    icon: <MessageSquare className="h-4 w-4" />,
    description: "Modelli di linguaggio per chat e completamenti"
  },
};

interface ProviderSettingsProps {
  className?: string;
}

export default function ProviderSettings({ className }: ProviderSettingsProps) {
  const { 
    preferences, 
    isLoading, 
    setProviderForOperation, 
    resetToDefaults,
    getEffectiveProvider 
  } = useProviderPreferences();

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center text-muted-foreground">
          Caricamento preferenze...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <CardTitle>Provider AI</CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={resetToDefaults}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
        <CardDescription>
          Scegli quale provider utilizzare per ogni tipo di operazione AI
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Provider Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(['aiml', 'piapi', 'elevenlabs'] as ProviderType[]).map((providerId) => {
            const provider = PROVIDERS[providerId];
            return (
              <div 
                key={providerId}
                className="p-3 rounded-lg border bg-muted/30 space-y-1"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{provider.logo}</span>
                  <span className="font-medium text-sm">{provider.name}</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {provider.description}
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {provider.supportedOperations.slice(0, 3).map((op) => (
                    <Badge key={op} variant="secondary" className="text-[10px] px-1.5 py-0">
                      {OPERATION_CONFIG[op]?.label.split(' ')[0]}
                    </Badge>
                  ))}
                  {provider.supportedOperations.length > 3 && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      +{provider.supportedOperations.length - 3}
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <Separator />

        {/* Operation-specific settings */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Configurazione per Operazione
          </h4>

          <div className="grid gap-4">
            {(Object.keys(OPERATION_CONFIG) as OperationType[]).map((operation) => {
              const config = OPERATION_CONFIG[operation];
              const availableProviders = getProvidersForOperation(operation);
              const currentValue = preferences[operation];
              const effectiveProvider = getEffectiveProvider(operation);

              return (
                <div 
                  key={operation}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-md bg-primary/10 text-primary">
                      {config.icon}
                    </div>
                    <div>
                      <Label className="font-medium">{config.label}</Label>
                      <p className="text-xs text-muted-foreground">{config.description}</p>
                      {currentValue === 'auto' && (
                        <p className="text-xs text-primary mt-1">
                          Auto → {PROVIDERS[effectiveProvider].name}
                        </p>
                      )}
                    </div>
                  </div>
                  <Select
                    value={currentValue}
                    onValueChange={(value) => setProviderForOperation(operation, value as ProviderType)}
                  >
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProviders.map((provider) => (
                        <SelectItem key={provider.id} value={provider.id}>
                          <div className="flex items-center gap-2">
                            <span>{provider.logo}</span>
                            <span>{provider.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
