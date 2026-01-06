import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Sparkles, X, AlertCircle, Zap, Star, DollarSign, Clock } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ScenePresets, SCENE_PRESETS, ScenePreset } from "@/components/ScenePresets";
import { ProviderComparisonDialog } from "@/components/ProviderComparisonDialog";
import { useProviderPreference } from "@/hooks/useProviderPreference";

// Durate supportate per ogni provider
const PROVIDER_DURATIONS: Record<string, { value: string; label: string }[]> = {
  auto: [
    { value: "4", label: "4 secondi" },
    { value: "6", label: "6 secondi" },
    { value: "8", label: "8 secondi" },
  ],
  veo: [
    { value: "4", label: "4 secondi" },
    { value: "6", label: "6 secondi" },
    { value: "8", label: "8 secondi" },
  ],
  "piapi-kling-2.1": [
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
  "piapi-skyreels": [
    { value: "5", label: "5 secondi" },
  ],
  "piapi-framepack": [
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
  freepik: [
    { value: "5", label: "5 secondi" },
  ],
};

// Risoluzioni supportate per ogni provider
const PROVIDER_RESOLUTIONS: Record<string, { value: string; label: string }[]> = {
  auto: [
    { value: "720p", label: "720p (HD)" },
    { value: "1080p", label: "1080p (Full HD)" },
  ],
  veo: [
    { value: "480p", label: "480p (Standard)" },
    { value: "720p", label: "720p (HD)" },
    { value: "1080p", label: "1080p (Full HD)" },
  ],
  "piapi-kling-2.1": [
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
  "piapi-skyreels": [
    { value: "720p", label: "720p (HD)" },
  ],
  "piapi-framepack": [
    { value: "720p", label: "720p (HD)" },
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
  freepik: [
    { value: "720p", label: "720p (HD)" },
  ],
};

// Caratteristiche dei provider
interface ProviderInfo {
  name: string;
  color: string;
  speed: 1 | 2 | 3;
  quality: 1 | 2 | 3;
  cost: 1 | 2 | 3;
  features: string[];
  estimatedTime: string;
  fallbackOrder: string[];
}

const PROVIDER_INFO: Record<string, ProviderInfo> = {
  auto: { name: "Auto", color: "bg-accent", speed: 2, quality: 3, cost: 2, features: ["Selezione automatica", "Fallback auto"], estimatedTime: "2-5 min", fallbackOrder: ["veo", "piapi-kling-2.5", "piapi-hailuo"] },
  veo: { name: "Google Veo 3.1", color: "bg-emerald-500", speed: 2, quality: 3, cost: 3, features: ["Audio sync", "Alta qualità"], estimatedTime: "3-5 min", fallbackOrder: ["piapi-kling-2.5", "piapi-hailuo"] },
  "piapi-kling-2.1": { name: "Kling 2.1", color: "bg-orange-400", speed: 2, quality: 2, cost: 1, features: ["Economico"], estimatedTime: "2-3 min", fallbackOrder: ["piapi-kling-2.5", "piapi-hailuo"] },
  "piapi-kling-2.5": { name: "Kling 2.5", color: "bg-orange-500", speed: 2, quality: 3, cost: 2, features: ["Ottimo rapporto Q/P"], estimatedTime: "2-4 min", fallbackOrder: ["piapi-kling-2.6", "piapi-hailuo"] },
  "piapi-kling-2.6": { name: "Kling 2.6", color: "bg-orange-600", speed: 2, quality: 3, cost: 2, features: ["Motion control", "Nuovo"], estimatedTime: "2-4 min", fallbackOrder: ["piapi-kling-2.5", "piapi-hailuo"] },
  "piapi-hailuo": { name: "Hailuo", color: "bg-pink-500", speed: 3, quality: 2, cost: 1, features: ["Veloce", "Economico"], estimatedTime: "1-2 min", fallbackOrder: ["piapi-wan", "piapi-kling-2.5"] },
  "piapi-luma": { name: "Luma", color: "bg-cyan-500", speed: 2, quality: 3, cost: 2, features: ["Cinematico"], estimatedTime: "2-4 min", fallbackOrder: ["piapi-kling-2.5", "piapi-hailuo"] },
  "piapi-wan": { name: "Wan", color: "bg-violet-500", speed: 2, quality: 2, cost: 1, features: ["Scene naturali"], estimatedTime: "2-3 min", fallbackOrder: ["piapi-hailuo", "piapi-kling-2.5"] },
  "piapi-hunyuan": { name: "Hunyuan", color: "bg-amber-500", speed: 2, quality: 3, cost: 2, features: ["Volti realistici"], estimatedTime: "2-4 min", fallbackOrder: ["piapi-kling-2.5", "piapi-hailuo"] },
  "piapi-skyreels": { name: "Skyreels", color: "bg-indigo-500", speed: 2, quality: 2, cost: 1, features: ["Effetti speciali"], estimatedTime: "2-3 min", fallbackOrder: ["piapi-hailuo", "piapi-wan"] },
  "piapi-framepack": { name: "Framepack", color: "bg-teal-500", speed: 3, quality: 2, cost: 1, features: ["Interpolazione"], estimatedTime: "1-2 min", fallbackOrder: ["piapi-hailuo", "piapi-wan"] },
  "piapi-veo3": { name: "Veo 3 (PiAPI)", color: "bg-green-500", speed: 2, quality: 3, cost: 2, features: ["Via gateway"], estimatedTime: "3-5 min", fallbackOrder: ["piapi-kling-2.5", "piapi-hailuo"] },
  "piapi-sora2": { name: "Sora 2", color: "bg-red-500", speed: 1, quality: 3, cost: 3, features: ["OpenAI", "Fino a 20s"], estimatedTime: "5-10 min", fallbackOrder: ["piapi-kling-2.5", "veo"] },
  freepik: { name: "Freepik MiniMax", color: "bg-blue-500", speed: 3, quality: 2, cost: 1, features: ["Veloce", "Transizioni"], estimatedTime: "1-2 min", fallbackOrder: ["piapi-hailuo", "piapi-kling-2.5"] },
};

const RatingDots = ({ value, max = 3, color }: { value: number; max?: number; color: string }) => (
  <div className="flex gap-0.5">
    {Array.from({ length: max }).map((_, i) => (
      <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < value ? color : "bg-muted-foreground/30"}`} />
    ))}
  </div>
);

export const ImageToVideoForm = () => {
  const [startImage, setStartImage] = useState<File | null>(null);
  const [startImagePreview, setStartImagePreview] = useState<string>("");
  const [endImage, setEndImage] = useState<File | null>(null);
  const [endImagePreview, setEndImagePreview] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState("6");
  const [motion, setMotion] = useState("medium");
  const [cameraMovement, setCameraMovement] = useState<string>("none");
  const [composition, setComposition] = useState<string>("medium");
  const [audioType, setAudioType] = useState<string>("none");
  const [audioPrompt, setAudioPrompt] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<string>("none");
  const [isLoading, setIsLoading] = useState(false);
  const [preferredProvider, setPreferredProvider] = useProviderPreference("auto");

  // Aggiorna durata e risoluzione quando cambia il provider
  useEffect(() => {
    const availableDurations = PROVIDER_DURATIONS[preferredProvider] || PROVIDER_DURATIONS.auto;
    const currentDurationValid = availableDurations.some(d => d.value === duration);
    if (!currentDurationValid) {
      setDuration(availableDurations[0].value);
    }
  }, [preferredProvider]);

  // Compress and resize image to prevent Out of Memory errors and PiAPI size limits
  const compressImage = (file: File, maxWidth: number = 1024, quality: number = 0.6): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        
        // Scale down if larger than maxWidth
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to JPEG for smaller file size
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      reader.onerror = () => reject(new Error('Failed to read file'));
      
      reader.readAsDataURL(file);
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'start' | 'end') => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error("Seleziona un file immagine valido");
        return;
      }
      
      try {
        toast.info("Ottimizzazione immagine in corso...");
        const compressedImage = await compressImage(file, 1280, 0.85);
        
        if (type === 'start') {
          setStartImage(file);
          setStartImagePreview(compressedImage);
        } else {
          setEndImage(file);
          setEndImagePreview(compressedImage);
        }
        
        toast.success(`${type === 'start' ? 'Start' : 'End'} frame caricato con successo`);
      } catch (error) {
        console.error("Error compressing image:", error);
        toast.error("Errore nell'ottimizzazione dell'immagine");
      }
    }
  };

  const removeImage = (type: 'start' | 'end') => {
    if (type === 'start') {
      setStartImage(null);
      setStartImagePreview("");
    } else {
      setEndImage(null);
      setEndImagePreview("");
    }
  };

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
    if (!startImage) {
      toast.error("Carica almeno lo start frame per procedere");
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

      const isSequential = !!endImage;
      
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
      const userPrompt = prompt || (isSequential ? "smooth transition between frames" : "animate this image");
      cinematicPrompt += userPrompt;
      
      // Add audio generation instructions
      if (audioType !== "none" && audioPrompt) {
        cinematicPrompt += ". ";
        
        switch (audioType) {
          case "dialogue":
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
      
      const description = isSequential 
        ? `Sequential video: ${cinematicPrompt}` 
        : cinematicPrompt;

      // Save to database first
      const { data: generationData, error: dbError } = await supabase
        .from("video_generations")
        .insert({
          user_id: user.id,
          type: "image_to_video",
          prompt: description,
          duration: parseInt(duration),
          motion_intensity: motion,
          image_name: isSequential ? `${startImage.name} → ${endImage.name}` : startImage.name,
          image_url: startImagePreview,
          status: "processing"
        })
        .select()
        .single();

      if (dbError) throw dbError;

      toast.success("Generazione video avviata!", {
        description: isSequential 
          ? "Creazione video sequenziale tra i due frame..." 
          : "Il video verrà generato. Attendi qualche istante..."
      });

      // Generate video synchronously
      const requestBody: any = {
        type: "image_to_video",
        prompt: cinematicPrompt,
        start_image: startImagePreview,
        duration: parseInt(duration),
        generationId: generationData.id,
        preferredProvider: preferredProvider !== "auto" ? preferredProvider : undefined
      };

      // Add end image if provided
      if (isSequential) {
        requestBody.end_image = endImagePreview;
      }

      const { data, error } = await supabase.functions
        .invoke("generate-video", {
          body: requestBody
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
      
      setStartImage(null);
      setStartImagePreview("");
      setEndImage(null);
      setEndImagePreview("");
      setPrompt("");
    } catch (error) {
      console.error("Error saving generation:", error);
      toast.error("Errore nel salvare i parametri");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Alert className="border-accent/30 bg-accent/5">
        <AlertCircle className="h-4 w-4 text-accent" />
        <AlertDescription>
          Anima le tue immagini usando Google Veo 3.1. Carica solo lo start frame per animazione singola, 
          oppure start + end frame per creare una transizione video sequenziale fluida tra due immagini.
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
            <SelectItem value="veo">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Google Veo 3.1</span>
              </div>
            </SelectItem>
            <SelectItem value="piapi-kling-2.1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                <span>PiAPI Kling 2.1</span>
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
            <SelectItem value="piapi-skyreels">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                <span>PiAPI Skyreels</span>
              </div>
            </SelectItem>
            <SelectItem value="piapi-framepack">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-500" />
                <span>PiAPI Framepack</span>
              </div>
            </SelectItem>
            <SelectItem value="piapi-veo3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span>PiAPI Veo 3.1</span>
              </div>
            </SelectItem>
            <SelectItem value="piapi-sora2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span>PiAPI Sora 2</span>
              </div>
            </SelectItem>
            <SelectItem value="freepik">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span>Freepik MiniMax</span>
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
        "bg-emerald-500/10 border-emerald-500/30"
      }`}>
        <div className={`w-3 h-3 rounded-full animate-pulse ${
          PROVIDER_INFO[preferredProvider]?.color || "bg-emerald-500"
        }`} />
        <div className="flex-1">
          <p className="text-sm font-medium">
            {PROVIDER_INFO[preferredProvider]?.name || "Auto"}
          </p>
          <p className="text-xs text-muted-foreground">
            {preferredProvider?.startsWith("piapi-") 
              ? "Video generation via PiAPI gateway" 
              : preferredProvider === "freepik" ? "Transizioni sequenziali veloci"
              : "Google Veo con audio sincronizzato"}
          </p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
          PROVIDER_INFO[preferredProvider]?.color ? `${PROVIDER_INFO[preferredProvider].color}/20` : "bg-emerald-500/20"
        } text-foreground`}>
          {preferredProvider !== "auto" ? PROVIDER_INFO[preferredProvider]?.name : "AUTO"}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Start Frame (Obbligatorio)</Label>
          {!startImagePreview ? (
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-accent/50 transition-colors">
              <input
                type="file"
                id="start-image-upload"
                className="hidden"
                accept="image/*"
                onChange={(e) => handleImageChange(e, 'start')}
              />
              <label
                htmlFor="start-image-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <Upload className="w-10 h-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Carica start frame
                </p>
                <p className="text-xs text-muted-foreground">
                  PNG, JPG o WEBP
                </p>
              </label>
            </div>
          ) : (
            <div className="relative rounded-lg overflow-hidden border border-border">
              <img
                src={startImagePreview}
                alt="Start Frame"
                className="w-full h-auto max-h-64 object-contain bg-muted"
              />
              <button
                onClick={() => removeImage('start')}
                className="absolute top-2 right-2 p-2 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>End Frame (Opzionale)</Label>
          {!endImagePreview ? (
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-accent/50 transition-colors">
              <input
                type="file"
                id="end-image-upload"
                className="hidden"
                accept="image/*"
                onChange={(e) => handleImageChange(e, 'end')}
              />
              <label
                htmlFor="end-image-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <Upload className="w-10 h-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Carica end frame
                </p>
                <p className="text-xs text-muted-foreground">
                  Per transizione sequenziale
                </p>
              </label>
            </div>
          ) : (
            <div className="relative rounded-lg overflow-hidden border border-border">
              <img
                src={endImagePreview}
                alt="End Frame"
                className="w-full h-auto max-h-64 object-contain bg-muted"
              />
              <button
                onClick={() => removeImage('end')}
                className="absolute top-2 right-2 p-2 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      <ScenePresets value={selectedPreset} onChange={handlePresetChange} />

      <div className="space-y-2">
        <Label htmlFor="i2v-prompt">
          {endImage ? "Descrizione della Transizione (Opzionale)" : "Descrizione del Movimento (Opzionale)"}
        </Label>
        <Textarea
          id="i2v-prompt"
          placeholder={
            endImage 
              ? "Descrivi come vuoi che avvenga la transizione tra i due frame..."
              : "Descrivi come vuoi che l'immagine si animi..."
          }
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="min-h-[100px] resize-none"
        />
        <p className="text-xs text-muted-foreground">
          {endImage 
            ? "Esempio: 'smooth camera movement from first to second scene'"
            : "Esempio: 'La persona si muove lentamente verso la camera'"
          }
        </p>
      </div>

      <div className="space-y-4 p-4 rounded-lg bg-accent/10 border border-accent/30">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          🔊 Audio Sincronizzato (Opzionale)
        </h3>
        
        <div className="space-y-2">
          <Label htmlFor="audio-type">Tipo Audio</Label>
          <Select value={audioType} onValueChange={setAudioType}>
            <SelectTrigger id="audio-type">
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
            <Label htmlFor="audio-prompt">
              {audioType === "dialogue" ? "Testo del Dialogo" : 
               audioType === "sfx" ? "Descrizione Effetti" : 
               "Descrizione Ambiente Sonoro"}
            </Label>
            <Textarea
              id="audio-prompt"
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
          <Label htmlFor="camera-movement">Movimento Camera</Label>
          <Select value={cameraMovement} onValueChange={setCameraMovement}>
            <SelectTrigger id="camera-movement">
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
          <Label htmlFor="composition">Inquadratura</Label>
          <Select value={composition} onValueChange={setComposition}>
            <SelectTrigger id="composition">
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="i2v-duration">Durata</Label>
          <Select value={duration} onValueChange={setDuration}>
            <SelectTrigger id="i2v-duration">
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
          <Label htmlFor="i2v-resolution">Risoluzione</Label>
          <Select value={motion} onValueChange={setMotion}>
            <SelectTrigger id="i2v-resolution">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(PROVIDER_RESOLUTIONS[preferredProvider] || PROVIDER_RESOLUTIONS.auto).map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="motion">Intensità Movimento</Label>
          <Select value={motion} onValueChange={setMotion}>
            <SelectTrigger id="motion">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Bassa</SelectItem>
              <SelectItem value="medium">Media</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button 
        onClick={handleGenerate}
        disabled={isLoading || !startImage}
        className="w-full bg-gradient-accent text-accent-foreground hover:opacity-90 shadow-glow-accent transition-all duration-300"
        size="lg"
      >
        <Sparkles className="w-5 h-5 mr-2" />
        {isLoading ? "Preparazione..." : endImage ? "Genera Video Sequenziale" : "Genera Video da Immagine"}
      </Button>

      {startImage && (
        <div className="p-4 rounded-lg bg-muted/30 border border-border">
          <p className="text-sm text-muted-foreground mb-2">
            <strong>Parametri selezionati:</strong>
          </p>
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Modalità:</span>
              <span className="font-medium">{endImage ? "Transizione Sequenziale" : "Animazione Singola"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Start Frame:</span>
              <span className="font-medium">{startImage.name}</span>
            </div>
            {endImage && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">End Frame:</span>
                <span className="font-medium">{endImage.name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Durata:</span>
              <span className="font-medium">{duration}s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Movimento:</span>
              <span className="font-medium capitalize">{motion}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
