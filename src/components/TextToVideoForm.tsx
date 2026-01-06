import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, AlertCircle, Zap, Star, DollarSign, Clock, Wallet, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ScenePresets, SCENE_PRESETS, ScenePreset } from "@/components/ScenePresets";
import { ProviderComparisonDialog } from "@/components/ProviderComparisonDialog";
import { useProviderPreference } from "@/hooks/useProviderPreference";

interface PiAPIBalance {
  credits: number;
  equivalent_in_usd: number;
  account_name: string;
}
// Durate supportate per ogni provider
const PROVIDER_DURATIONS: Record<string, { value: string; label: string }[]> = {
  auto: [
    { value: "5", label: "5 secondi" },
    { value: "10", label: "10 secondi" },
  ],
  "piapi-kling-2.5": [
    { value: "5", label: "5 secondi" },
    { value: "10", label: "10 secondi" },
  ],
  "piapi-kling-2.6": [
    { value: "5", label: "5 secondi" },
    { value: "10", label: "10 secondi" },
  ],
  "piapi-hailuo": [
    { value: "4", label: "4 secondi" },
    { value: "6", label: "6 secondi" },
  ],
  "piapi-luma": [
    { value: "5", label: "5 secondi" },
  ],
  "piapi-wan": [
    { value: "5", label: "5 secondi" },
  ],
  "piapi-hunyuan": [
    { value: "5", label: "5 secondi" },
  ],
  "piapi-veo3": [
    { value: "4", label: "4 secondi" },
    { value: "6", label: "6 secondi" },
    { value: "8", label: "8 secondi" },
  ],
  "piapi-sora2": [
    { value: "5", label: "5 secondi" },
    { value: "10", label: "10 secondi" },
    { value: "15", label: "15 secondi" },
    { value: "20", label: "20 secondi" },
  ],
};

// Risoluzioni supportate per ogni provider
const PROVIDER_RESOLUTIONS: Record<string, { value: string; label: string }[]> = {
  auto: [
    { value: "720p", label: "720p (HD)" },
    { value: "1080p", label: "1080p (Full HD)" },
  ],
  "piapi-kling-2.5": [
    { value: "720p", label: "720p (HD)" },
    { value: "1080p", label: "1080p (Full HD)" },
  ],
  "piapi-kling-2.6": [
    { value: "720p", label: "720p (HD)" },
    { value: "1080p", label: "1080p (Full HD)" },
  ],
  "piapi-hailuo": [
    { value: "720p", label: "720p (HD)" },
    { value: "1080p", label: "1080p (Full HD)" },
  ],
  "piapi-luma": [
    { value: "720p", label: "720p (HD)" },
  ],
  "piapi-wan": [
    { value: "480p", label: "480p (Standard)" },
    { value: "720p", label: "720p (HD)" },
  ],
  "piapi-hunyuan": [
    { value: "720p", label: "720p (HD)" },
    { value: "1080p", label: "1080p (Full HD)" },
  ],
  "piapi-veo3": [
    { value: "720p", label: "720p (HD)" },
    { value: "1080p", label: "1080p (Full HD)" },
  ],
  "piapi-sora2": [
    { value: "720p", label: "720p (HD)" },
    { value: "1080p", label: "1080p (Full HD)" },
    { value: "4k", label: "4K (Ultra HD)" },
  ],
};

// Caratteristiche dei provider
interface ProviderInfo {
  name: string;
  color: string;
  speed: 1 | 2 | 3; // 1=lento, 2=medio, 3=veloce
  quality: 1 | 2 | 3; // 1=base, 2=buona, 3=eccellente
  cost: 1 | 2 | 3; // 1=economico, 2=medio, 3=costoso
  features: string[];
  estimatedTime: string; // Stima tempo in minuti
  fallbackOrder: string[]; // Provider di fallback in ordine di priorità
}

const PROVIDER_INFO: Record<string, ProviderInfo> = {
  auto: { name: "Auto", color: "bg-accent", speed: 2, quality: 3, cost: 2, features: ["Selezione automatica", "Fallback auto"], estimatedTime: "2-5 min", fallbackOrder: ["piapi-kling-2.5", "piapi-veo3", "piapi-hailuo"] },
  "piapi-kling-2.5": { name: "Kling 2.5", color: "bg-orange-500", speed: 2, quality: 3, cost: 2, features: ["Ottimo rapporto Q/P"], estimatedTime: "2-4 min", fallbackOrder: ["piapi-kling-2.6", "piapi-hailuo"] },
  "piapi-kling-2.6": { name: "Kling 2.6", color: "bg-orange-600", speed: 2, quality: 3, cost: 2, features: ["Motion control", "Nuovo"], estimatedTime: "2-4 min", fallbackOrder: ["piapi-kling-2.5", "piapi-hailuo"] },
  "piapi-hailuo": { name: "Hailuo", color: "bg-pink-500", speed: 3, quality: 2, cost: 1, features: ["Veloce", "Economico"], estimatedTime: "1-2 min", fallbackOrder: ["piapi-wan", "piapi-kling-2.5"] },
  "piapi-luma": { name: "Luma", color: "bg-cyan-500", speed: 2, quality: 3, cost: 2, features: ["Cinematico"], estimatedTime: "2-4 min", fallbackOrder: ["piapi-kling-2.5", "piapi-hailuo"] },
  "piapi-wan": { name: "Wan", color: "bg-violet-500", speed: 2, quality: 2, cost: 1, features: ["Scene naturali"], estimatedTime: "2-3 min", fallbackOrder: ["piapi-hailuo", "piapi-kling-2.5"] },
  "piapi-hunyuan": { name: "Hunyuan", color: "bg-amber-500", speed: 2, quality: 3, cost: 2, features: ["Volti realistici"], estimatedTime: "2-4 min", fallbackOrder: ["piapi-kling-2.5", "piapi-hailuo"] },
  "piapi-veo3": { name: "Veo 3", color: "bg-emerald-500", speed: 2, quality: 3, cost: 2, features: ["Audio sync", "Alta qualità"], estimatedTime: "3-5 min", fallbackOrder: ["piapi-kling-2.5", "piapi-hailuo"] },
  "piapi-sora2": { name: "Sora 2", color: "bg-red-500", speed: 1, quality: 3, cost: 3, features: ["OpenAI", "Fino a 20s"], estimatedTime: "5-10 min", fallbackOrder: ["piapi-kling-2.5", "piapi-veo3"] },
};

const RatingDots = ({ value, max = 3, color }: { value: number; max?: number; color: string }) => (
  <div className="flex gap-0.5">
    {Array.from({ length: max }).map((_, i) => (
      <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < value ? color : "bg-muted-foreground/30"}`} />
    ))}
  </div>
);

export const TextToVideoForm = () => {
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState("6");
  const [resolution, setResolution] = useState("720p");
  const [cameraMovement, setCameraMovement] = useState<string>("none");
  const [composition, setComposition] = useState<string>("medium");
  const [audioType, setAudioType] = useState<string>("none");
  const [piapiBalance, setPiapiBalance] = useState<PiAPIBalance | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [audioPrompt, setAudioPrompt] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<string>("none");
  const [preferredProvider, setPreferredProvider] = useProviderPreference("auto");
  const [isLoading, setIsLoading] = useState(false);

  // Fetch PiAPI balance on mount and when provider changes
  const fetchPiapiBalance = async () => {
    setIsLoadingBalance(true);
    try {
      const { data, error } = await supabase.functions.invoke('piapi-balance');
      if (error) throw error;
      setPiapiBalance(data);
    } catch (error) {
      console.error("Error fetching PiAPI balance:", error);
      setPiapiBalance(null);
    } finally {
      setIsLoadingBalance(false);
    }
  };

  useEffect(() => {
    // Only fetch balance if using a PiAPI provider
    if (preferredProvider.startsWith('piapi-') || preferredProvider === 'auto') {
      fetchPiapiBalance();
    }
  }, []);

  // Aggiorna durata e risoluzione quando cambia il provider
  useEffect(() => {
    const availableDurations = PROVIDER_DURATIONS[preferredProvider] || PROVIDER_DURATIONS.auto;
    const currentDurationValid = availableDurations.some(d => d.value === duration);
    if (!currentDurationValid) {
      setDuration(availableDurations[0].value);
    }
    
    const availableResolutions = PROVIDER_RESOLUTIONS[preferredProvider] || PROVIDER_RESOLUTIONS.auto;
    const currentResolutionValid = availableResolutions.some(r => r.value === resolution);
    if (!currentResolutionValid) {
      setResolution(availableResolutions[0].value);
    }
  }, [preferredProvider]);

  const handlePresetChange = (preset: ScenePreset) => {
    setSelectedPreset(preset.id);
    setCameraMovement(preset.cameraMovement);
    setComposition(preset.composition);
    setAudioType(preset.audioType);
    
    // Auto-fill audio prompt if preset has suggestion
    if (preset.audioSuggestion && !audioPrompt) {
      setAudioPrompt(preset.audioSuggestion);
    }
    
    // Show guidance in toast
    if (preset.promptGuidance) {
      toast.info("Suggerimento preset", {
        description: preset.promptGuidance
      });
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Inserisci una descrizione per il video");
      return;
    }

    setIsLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Devi effettuare l'accesso");
        setIsLoading(false);
        return;
      }

      // Build cinematic prompt with camera controls
      let cinematicPrompt = "";
      
      // Add camera movement
      if (cameraMovement !== "none") {
        const cameraMovements = {
          "dolly_in": "Slow dolly in shot, camera smoothly pushes toward the subject",
          "dolly_out": "Slow dolly out shot, camera smoothly pulls away from the subject",
          "tracking": "Smooth tracking shot following the subject's movement",
          "crane_up": "Crane shot ascending upward revealing the scene from above",
          "crane_down": "Crane shot descending from above down to the subject",
          "pan_left": "Slow pan left across the scene",
          "pan_right": "Slow pan right across the scene",
          "aerial": "Aerial view, high angle perspective looking down",
          "pov": "POV shot, first person perspective",
          "orbit": "Orbital camera movement circling around the subject"
        };
        cinematicPrompt += cameraMovements[cameraMovement] + ", ";
      }
      
      // Add composition style
      const compositionStyles = {
        "extreme_close": "Extreme close-up shot",
        "close": "Close-up shot",
        "medium": "Medium shot",
        "wide": "Wide shot",
        "extreme_wide": "Extreme wide shot establishing the full scene"
      };
      cinematicPrompt += compositionStyles[composition] + ", ";
      
      // Add user prompt
      cinematicPrompt += prompt;
      
      // Store dialogue separately for TTS processing
      let dialogueText = "";
      
      // Add audio generation instructions
      if (audioType !== "none" && audioPrompt) {
        cinematicPrompt += ". ";
        
        switch (audioType) {
          case "dialogue":
            // Store dialogue for separate TTS generation
            dialogueText = audioPrompt;
            // Use quotation marks for dialogue as per Veo 3.1 best practices
            cinematicPrompt += `Dialogue: "${audioPrompt}"`;
            break;
          case "sfx":
            // Describe sound effects clearly
            cinematicPrompt += `SFX: ${audioPrompt}`;
            break;
          case "ambient":
            // Define background soundscape
            cinematicPrompt += `Ambient noise: ${audioPrompt}`;
            break;
        }
      }

      // Store original prompt before translation
      const originalPrompt = cinematicPrompt;

      // Translate prompt to English for better Veo3 results (keeping dialogue in original language)
      let translatedPrompt = cinematicPrompt;
      if (preferredProvider === "piapi-veo3" || preferredProvider === "auto") {
        try {
          toast.info("Traduzione prompt in inglese...", { duration: 2000 });
          const { data: translateData, error: translateError } = await supabase.functions.invoke('translate-prompt', {
            body: { prompt: cinematicPrompt, dialogueText }
          });
          
          if (!translateError && translateData?.translatedPrompt) {
            translatedPrompt = translateData.translatedPrompt;
            console.log("Prompt tradotto:", translatedPrompt);
          }
        } catch (translateErr) {
          console.warn("Translation failed, using original prompt:", translateErr);
        }
      }

      // Save to database first
      const { data: generationData, error: dbError } = await supabase
        .from("video_generations")
        .insert({
          user_id: user.id,
          type: "text_to_video",
          prompt: translatedPrompt,
          original_prompt: originalPrompt,
          dialogue_text: dialogueText || null,
          duration: parseInt(duration),
          resolution: resolution,
          status: "processing"
        })
        .select()
        .single();

      if (dbError) throw dbError;

      toast.success("Generazione video avviata!", {
        description: "Il video verrà generato. Attendi qualche istante..."
      });

      // Generate video synchronously
      const { data, error } = await supabase.functions
        .invoke("generate-video", {
          body: {
            type: "text_to_video",
            prompt: translatedPrompt,
            duration: parseInt(duration),
            generationId: generationData.id,
            preferredProvider: preferredProvider !== "auto" ? preferredProvider : undefined
          }
        });

      if (error) {
        console.error("Error generating video:", error);
        
        // Check for specific error types
        const errorMessage = error.message || String(error);
        let userMessage = "Errore nella generazione del video";
        
        if (errorMessage.includes("429") || errorMessage.includes("quota") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
          userMessage = "Quota API Google esaurita. Riprova più tardi o verifica il tuo piano Google AI.";
        } else if (errorMessage.includes("401") || errorMessage.includes("unauthorized")) {
          userMessage = "Errore di autenticazione API. Verifica la configurazione.";
        } else if (errorMessage.includes("timeout")) {
          userMessage = "Timeout durante la generazione. Riprova.";
        }
        
        await supabase
          .from("video_generations")
          .update({ 
            status: "failed", 
            error_message: errorMessage 
          })
          .eq("id", generationData.id);
        
        toast.error(userMessage, {
          description: errorMessage.includes("429") ? "La generazione video richiede crediti API Google." : undefined
        });
        return;
      }

      toast.success("Video generato con successo!", {
        description: "Vai allo storico per vedere il tuo video."
      });
      
      setPrompt("");
    } catch (error) {
      console.error("Error saving generation:", error);
      toast.error("Errore nel salvare i parametri");
    } finally {
      setIsLoading(false);
    }
  };

  const examplePrompts = [
    "Un gatto bianco siamese che gioca con un gomitolo rosso",
    "Tramonto sul mare con onde che si infrangono sulla spiaggia",
    "Una città futuristica di notte con luci al neon",
  ];

  return (
    <div className="space-y-6">
      {/* PiAPI Balance Alert */}
      {(preferredProvider.startsWith('piapi-') || preferredProvider === 'auto') && (
        <Alert className={`border ${piapiBalance && piapiBalance.equivalent_in_usd < 1 ? 'border-destructive/50 bg-destructive/10' : 'border-green-500/30 bg-green-500/5'}`}>
          <Wallet className={`h-4 w-4 ${piapiBalance && piapiBalance.equivalent_in_usd < 1 ? 'text-destructive' : 'text-green-500'}`} />
          <AlertDescription className="flex items-center justify-between w-full">
            <span>
              {isLoadingBalance ? (
                "Caricamento saldo..."
              ) : piapiBalance ? (
                <>
                  <strong>Saldo PiAPI:</strong> ${piapiBalance.equivalent_in_usd.toFixed(2)} USD ({piapiBalance.credits.toLocaleString()} crediti)
                  {piapiBalance.equivalent_in_usd < 1 && (
                    <span className="text-destructive ml-2">⚠️ Crediti insufficienti!</span>
                  )}
                </>
              ) : (
                "Impossibile verificare il saldo"
              )}
            </span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={fetchPiapiBalance} 
              disabled={isLoadingBalance}
              className="h-6 px-2"
            >
              <RefreshCw className={`h-3 w-3 ${isLoadingBalance ? 'animate-spin' : ''}`} />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Alert className="border-primary/30 bg-primary/5">
        <AlertCircle className="h-4 w-4 text-primary" />
        <AlertDescription>
          Genera video ad alta qualità usando vari modelli AI. 
          La generazione richiede qualche minuto.
        </AlertDescription>
      </Alert>

      {/* Provider Selection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Provider AI</Label>
          <ProviderComparisonDialog
            providers={PROVIDER_INFO}
            selectedProvider={preferredProvider}
            onSelectProvider={setPreferredProvider}
            durations={PROVIDER_DURATIONS}
            resolutions={PROVIDER_RESOLUTIONS}
          />
        </div>
        <Select value={preferredProvider} onValueChange={setPreferredProvider}>
          <SelectTrigger>
            <SelectValue placeholder="Seleziona provider" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" />
                <span>Auto (migliore disponibile)</span>
              </div>
            </SelectItem>
            <SelectItem value="piapi-veo3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Veo 3 (Alta qualità)</span>
              </div>
            </SelectItem>
            <SelectItem value="piapi-kling-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                <span>PiAPI Kling 2.5</span>
              </div>
            </SelectItem>
            <SelectItem value="piapi-kling-2.6">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-600" />
                <span>PiAPI Kling 2.6</span>
              </div>
            </SelectItem>
            <SelectItem value="piapi-hailuo">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-pink-500" />
                <span>PiAPI Hailuo</span>
              </div>
            </SelectItem>
            <SelectItem value="piapi-luma">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-500" />
                <span>PiAPI Luma</span>
              </div>
            </SelectItem>
            <SelectItem value="piapi-wan">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-violet-500" />
                <span>PiAPI Wan</span>
              </div>
            </SelectItem>
            <SelectItem value="piapi-hunyuan">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>PiAPI Hunyuan</span>
              </div>
            </SelectItem>
            <SelectItem value="piapi-sora2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span>PiAPI Sora 2</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        
        {/* Provider Info Badges */}
        {PROVIDER_INFO[preferredProvider] && (
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <div className="flex items-center gap-1.5 text-xs">
              <Zap className="w-3 h-3 text-yellow-500" />
              <span className="text-muted-foreground">Velocità:</span>
              <RatingDots value={PROVIDER_INFO[preferredProvider].speed} color="bg-yellow-500" />
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <Star className="w-3 h-3 text-blue-500" />
              <span className="text-muted-foreground">Qualità:</span>
              <RatingDots value={PROVIDER_INFO[preferredProvider].quality} color="bg-blue-500" />
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <DollarSign className="w-3 h-3 text-green-500" />
              <span className="text-muted-foreground">Costo:</span>
              <RatingDots value={PROVIDER_INFO[preferredProvider].cost} color="bg-green-500" />
            </div>
            <div className="flex items-center gap-1.5 text-xs border-l pl-3">
              <Clock className="w-3 h-3 text-purple-500" />
              <span className="text-muted-foreground">Tempo stimato:</span>
              <span className="font-medium text-purple-600">{PROVIDER_INFO[preferredProvider].estimatedTime}</span>
            </div>
          </div>
        )}
        
        {/* Feature badges + Fallback info */}
        {PROVIDER_INFO[preferredProvider] && (
          <div className="flex flex-wrap gap-1 mt-2">
            {PROVIDER_INFO[preferredProvider].features.map((feature, i) => (
              <Badge key={i} variant="secondary" className="text-xs px-2 py-0">
                {feature}
              </Badge>
            ))}
            {PROVIDER_INFO[preferredProvider].fallbackOrder.length > 0 && (
              <Badge variant="outline" className="text-xs px-2 py-0 border-dashed">
                Fallback: {PROVIDER_INFO[preferredProvider].fallbackOrder.slice(0, 2).map(p => PROVIDER_INFO[p]?.name || p).join(" → ")}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* API Indicator */}
      <div className={`flex items-center gap-3 p-3 rounded-lg border ${
        PROVIDER_INFO[preferredProvider]?.color ? `${PROVIDER_INFO[preferredProvider].color}/10 border-current/30` :
        preferredProvider?.startsWith("piapi-") ? "bg-orange-500/10 border-orange-500/30" :
        "bg-emerald-500/10 border-emerald-500/30"
      }`}>
        <div className={`w-3 h-3 rounded-full animate-pulse ${
          PROVIDER_INFO[preferredProvider]?.color || (preferredProvider?.startsWith("piapi-") ? "bg-orange-500" : "bg-emerald-500")
        }`} />
        <div className="flex-1">
          <p className="text-sm font-medium">
            {PROVIDER_INFO[preferredProvider]?.name || 
             (preferredProvider?.startsWith("piapi-") 
              ? `PiAPI ${preferredProvider.replace("piapi-", "").toUpperCase()}` 
              : preferredProvider === "veo" ? "Google Veo 3.1" : "Auto")}
          </p>
          <p className="text-xs text-muted-foreground">
            {preferredProvider?.startsWith("piapi-") 
              ? "Video generation via PiAPI gateway" 
              : "Google Veo con audio sincronizzato"}
          </p>
        </div>
      </div>

      <ScenePresets value={selectedPreset} onChange={handlePresetChange} />

      <div className="space-y-2">
        <Label htmlFor="prompt">Descrizione del Video</Label>
        <Textarea
          id="prompt"
          placeholder="Descrivi il video che vuoi creare in dettaglio..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="min-h-[120px] resize-none"
        />
        <p className="text-xs text-muted-foreground">
          Esempi di prompt:
        </p>
        <div className="flex flex-wrap gap-2">
          {examplePrompts.map((example, index) => (
            <button
              key={index}
              onClick={() => setPrompt(example)}
              className="text-xs px-3 py-1 rounded-full bg-muted hover:bg-muted/80 transition-colors"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 p-4 rounded-lg bg-accent/10 border border-accent/30">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          🔊 Audio Sincronizzato (Opzionale)
        </h3>
        
        <div className="space-y-2">
          <Label htmlFor="t2v-audio-type">Tipo Audio</Label>
          <Select value={audioType} onValueChange={setAudioType}>
            <SelectTrigger id="t2v-audio-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nessuno</SelectItem>
              <SelectItem value="dialogue">Dialogo - Parole parlate</SelectItem>
              <SelectItem value="sfx">SFX - Effetti sonori</SelectItem>
              <SelectItem value="ambient">Ambient - Suoni ambientali</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {audioType !== "none" && (
          <div className="space-y-2">
            <Label htmlFor="t2v-audio-prompt">
              {audioType === "dialogue" ? "Testo del Dialogo" : 
               audioType === "sfx" ? "Descrizione Effetti" : 
               "Descrizione Ambiente Sonoro"}
            </Label>
            <Textarea
              id="t2v-audio-prompt"
              placeholder={
                audioType === "dialogue" ? "Es: Hello, welcome to my channel" :
                audioType === "sfx" ? "Es: thunder cracks in the distance, footsteps on wet pavement" :
                "Es: the quiet hum of a starship bridge, distant traffic noise"
              }
              value={audioPrompt}
              onChange={(e) => setAudioPrompt(e.target.value)}
              className="min-h-[80px] resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {audioType === "dialogue" && "Veo 3.1 genererà il dialogo parlato sincronizzato con il video"}
              {audioType === "sfx" && "Descrivi gli effetti sonori che vuoi sentire"}
              {audioType === "ambient" && "Descrivi l'atmosfera sonora di fondo"}
            </p>
          </div>
        )}
      </div>

      <div className="space-y-4 p-4 rounded-lg bg-muted/30 border border-border">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          🎬 Controlli Cinematografici
        </h3>
        
        <div className="space-y-2">
          <Label htmlFor="t2v-camera-movement">Movimento Camera</Label>
          <Select value={cameraMovement} onValueChange={setCameraMovement}>
            <SelectTrigger id="t2v-camera-movement">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nessuno (Statico)</SelectItem>
              <SelectItem value="dolly_in">Dolly In - Avvicinamento</SelectItem>
              <SelectItem value="dolly_out">Dolly Out - Allontanamento</SelectItem>
              <SelectItem value="tracking">Tracking - Segui soggetto</SelectItem>
              <SelectItem value="crane_up">Crane Up - Gru verso l'alto</SelectItem>
              <SelectItem value="crane_down">Crane Down - Gru verso il basso</SelectItem>
              <SelectItem value="pan_left">Pan Left - Panoramica sinistra</SelectItem>
              <SelectItem value="pan_right">Pan Right - Panoramica destra</SelectItem>
              <SelectItem value="aerial">Aerial - Vista aerea</SelectItem>
              <SelectItem value="pov">POV - Prima persona</SelectItem>
              <SelectItem value="orbit">Orbit - Rotazione circolare</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="t2v-composition">Inquadratura</Label>
          <Select value={composition} onValueChange={setComposition}>
            <SelectTrigger id="t2v-composition">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="extreme_close">Extreme Close-up - Dettaglio estremo</SelectItem>
              <SelectItem value="close">Close-up - Primo piano</SelectItem>
              <SelectItem value="medium">Medium Shot - Piano medio</SelectItem>
              <SelectItem value="wide">Wide Shot - Campo largo</SelectItem>
              <SelectItem value="extreme_wide">Extreme Wide - Campo lunghissimo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="duration">Durata</Label>
          <Select value={duration} onValueChange={setDuration}>
            <SelectTrigger id="duration">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(PROVIDER_DURATIONS[preferredProvider] || PROVIDER_DURATIONS.auto).map((d) => (
                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="resolution">Risoluzione</Label>
          <Select value={resolution} onValueChange={setResolution}>
            <SelectTrigger id="resolution">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(PROVIDER_RESOLUTIONS[preferredProvider] || PROVIDER_RESOLUTIONS.auto).map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button 
        onClick={handleGenerate}
        disabled={isLoading || !prompt.trim()}
        className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow-primary transition-all duration-300"
        size="lg"
      >
        <Sparkles className="w-5 h-5 mr-2" />
        {isLoading ? "Preparazione..." : "Genera Video"}
      </Button>

      <div className="p-4 rounded-lg bg-muted/30 border border-border">
        <p className="text-sm text-muted-foreground mb-2">
          <strong>Parametri selezionati:</strong>
        </p>
        <div className="text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Durata:</span>
            <span className="font-medium">{duration}s</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Risoluzione:</span>
            <span className="font-medium">{resolution}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Caratteri prompt:</span>
            <span className="font-medium">{prompt.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
