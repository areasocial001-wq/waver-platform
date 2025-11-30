import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Video, Mic, BookOpen, MessageSquare, TrendingUp, Camera } from "lucide-react";

export interface ScenePreset {
  id: string;
  name: string;
  icon: any;
  description: string;
  cameraMovement: string;
  composition: string;
  audioType: string;
  audioSuggestion: string;
  promptGuidance: string;
}

export const SCENE_PRESETS: ScenePreset[] = [
  {
    id: "none",
    name: "Personalizzato",
    icon: Camera,
    description: "Configura manualmente tutti i parametri",
    cameraMovement: "none",
    composition: "medium",
    audioType: "none",
    audioSuggestion: "",
    promptGuidance: ""
  },
  {
    id: "interview",
    name: "Intervista",
    icon: MessageSquare,
    description: "Perfetto per interviste e conversazioni",
    cameraMovement: "none",
    composition: "medium",
    audioType: "dialogue",
    audioSuggestion: "Conversation between interviewer and guest",
    promptGuidance: "Due persone sedute, conversazione professionale, lighting naturale"
  },
  {
    id: "tutorial",
    name: "Tutorial",
    icon: BookOpen,
    description: "Ideale per video educativi e how-to",
    cameraMovement: "dolly_in",
    composition: "close",
    audioType: "dialogue",
    audioSuggestion: "Clear instructional voice explaining the process",
    promptGuidance: "Primo piano dell'istruttore che spiega, gesticola e mostra qualcosa"
  },
  {
    id: "vlog",
    name: "Vlog",
    icon: Video,
    description: "Stile personale e coinvolgente",
    cameraMovement: "tracking",
    composition: "medium",
    audioType: "dialogue",
    audioSuggestion: "Friendly casual speaking directly to camera",
    promptGuidance: "Persona che parla alla camera in modo informale, sfondo interessante"
  },
  {
    id: "presentation",
    name: "Presentazione",
    icon: TrendingUp,
    description: "Business e presentazioni professionali",
    cameraMovement: "pan_right",
    composition: "wide",
    audioType: "dialogue",
    audioSuggestion: "Professional presentation voice with confidence",
    promptGuidance: "Speaker professionale con slides o materiale visivo, ambiente business"
  },
  {
    id: "podcast",
    name: "Podcast Video",
    icon: Mic,
    description: "Formato podcast con visuals",
    cameraMovement: "none",
    composition: "medium",
    audioType: "dialogue",
    audioSuggestion: "Engaging podcast conversation with multiple speakers",
    promptGuidance: "Due o più persone con microfoni, conversazione rilassata, setup podcast"
  },
  {
    id: "product_review",
    name: "Product Review",
    icon: Camera,
    description: "Recensioni prodotto dettagliate",
    cameraMovement: "dolly_in",
    composition: "close",
    audioType: "dialogue",
    audioSuggestion: "Enthusiastic product review commentary",
    promptGuidance: "Persona che mostra e recensisce un prodotto, primo piano sul prodotto"
  }
];

interface ScenePresetsProps {
  value: string;
  onChange: (preset: ScenePreset) => void;
}

export const ScenePresets = ({ value, onChange }: ScenePresetsProps) => {
  const handlePresetChange = (presetId: string) => {
    const preset = SCENE_PRESETS.find(p => p.id === presetId);
    if (preset) {
      onChange(preset);
    }
  };

  return (
    <div className="space-y-4 p-4 rounded-lg bg-primary/10 border border-primary/30">
      <div className="flex items-center gap-2 mb-2">
        <Video className="w-5 h-5 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">
          🎬 Preset Scene
        </h3>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="scene-preset">Tipo di Scena</Label>
        <Select value={value} onValueChange={handlePresetChange}>
          <SelectTrigger id="scene-preset">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SCENE_PRESETS.map((preset) => {
              const Icon = preset.icon;
              return (
                <SelectItem key={preset.id} value={preset.id}>
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    <div>
                      <div className="font-medium">{preset.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {preset.description}
                      </div>
                    </div>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {value !== "none" && (
        <div className="p-3 rounded-md bg-background/50 border border-border">
          <p className="text-xs text-muted-foreground mb-2">
            <strong>Configurazione automatica:</strong>
          </p>
          {(() => {
            const preset = SCENE_PRESETS.find(p => p.id === value);
            if (!preset) return null;
            
            return (
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Camera:</span>
                  <span className="font-medium">
                    {preset.cameraMovement === "none" ? "Statico" : 
                     preset.cameraMovement.replace("_", " ")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Inquadratura:</span>
                  <span className="font-medium capitalize">
                    {preset.composition.replace("_", " ")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Audio:</span>
                  <span className="font-medium">
                    {preset.audioType === "none" ? "Nessuno" : 
                     preset.audioType === "dialogue" ? "Dialogo" :
                     preset.audioType === "sfx" ? "SFX" : "Ambient"}
                  </span>
                </div>
                {preset.promptGuidance && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <p className="text-muted-foreground italic">
                      💡 {preset.promptGuidance}
                    </p>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
