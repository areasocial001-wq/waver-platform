import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Sparkles, X, Info, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ScenePresets, SCENE_PRESETS, ScenePreset } from "@/components/ScenePresets";
import { ProviderComparisonDialog } from "@/components/ProviderComparisonDialog";
import { useProviderPreference } from "@/hooks/useProviderPreference";
import { VideoProviderSelect } from "@/components/VideoProviderSelect";
import { ApiKeyMissingBanner } from "@/components/ApiKeyMissingBanner";
import { VIDEO_PROVIDERS, VideoProviderType } from "@/lib/videoProviderConfig";
import { useApiKeyStatus } from "@/hooks/useApiKeyStatus";
import { useModelCapabilities } from "@/hooks/useModelCapabilities";

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

  // Fetch API key status from backend
  const { status: apiKeyStatus } = useApiKeyStatus();

  // Provider corrente
  const currentProvider = VIDEO_PROVIDERS[preferredProvider as VideoProviderType] || VIDEO_PROVIDERS.auto;

  // Get model capabilities for the current provider
  const { 
    supportsEndFrame, 
    requiresEndFrame,
    durationOptions,
    getValidDuration,
    defaultDuration
  } = useModelCapabilities(preferredProvider as VideoProviderType);

  // Check if API key is missing for selected provider based on actual backend status
  const isMissingAimlKey = currentProvider.group === 'aiml' && !apiKeyStatus.hasAIMLKey;

  // Clear end image if provider doesn't support end frames
  useEffect(() => {
    if (!supportsEndFrame && endImage) {
      setEndImage(null);
      setEndImagePreview("");
      toast.info("End frame rimosso", {
        description: "Il provider selezionato non supporta keyframes."
      });
    }
  }, [supportsEndFrame, endImage]);

  // Aggiorna durata quando cambia il provider
  useEffect(() => {
    const validDuration = getValidDuration(parseInt(duration));
    if (validDuration.toString() !== duration) {
      setDuration(validDuration.toString());
      toast.info("Durata adattata", {
        description: `Il provider supporta ${validDuration}s`
      });
    }
  }, [preferredProvider, getValidDuration, duration]);

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

    // Validate end frame for transition models
    if (requiresEndFrame && !endImage) {
      toast.error("End frame obbligatorio", {
        description: "Questo modello richiede sia start che end frame per la transizione."
      });
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

      // Generate video synchronously - include modelId for AI/ML API providers
      const requestBody: any = {
        type: "image_to_video",
        prompt: cinematicPrompt,
        start_image: startImagePreview,
        duration: parseInt(duration),
        generationId: generationData.id,
        preferredProvider: preferredProvider !== "auto" ? preferredProvider : undefined,
        modelId: currentProvider.modelId, // Pass model ID for AI/ML API
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
      {/* Provider Selection with VideoProviderSelect */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Provider AI</Label>
          <ProviderComparisonDialog
            providers={Object.fromEntries(
              Object.entries(VIDEO_PROVIDERS).map(([k, v]) => [k, {
                name: v.name,
                color: v.color,
                speed: v.speed,
                quality: v.quality,
                cost: v.cost,
                features: v.features,
                estimatedTime: v.estimatedTime,
                fallbackOrder: v.fallbackOrder,
              }])
            )}
            selectedProvider={preferredProvider}
            onSelectProvider={setPreferredProvider}
            durations={Object.fromEntries(
              Object.entries(VIDEO_PROVIDERS).map(([k, v]) => [k, v.durations])
            )}
            resolutions={Object.fromEntries(
              Object.entries(VIDEO_PROVIDERS).map(([k, v]) => [k, v.resolutions])
            )}
          />
        </div>
        <VideoProviderSelect
          value={preferredProvider as VideoProviderType}
          onValueChange={(v) => setPreferredProvider(v)}
          filterType="image_to_video"
          showDetails={true}
        />
      </div>

      {/* API Key Missing Banner */}
      {isMissingAimlKey && (
        <ApiKeyMissingBanner
          apiName="AI/ML API"
          description="Per usare i modelli AI/ML (Runway, Kling, Veo) configura la chiave API"
        />
      )}

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

        {/* End Frame - Only show if provider supports keyframes */}
        {supportsEndFrame ? (
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              End Frame {requiresEndFrame ? "(Obbligatorio)" : "(Opzionale)"}
              {requiresEndFrame && (
                <span className="text-xs text-destructive font-medium">*</span>
              )}
            </Label>
            {!endImagePreview ? (
              <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                requiresEndFrame ? "border-primary/50 hover:border-primary" : "border-border hover:border-accent/50"
              }`}>
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
                  <div className="flex items-center gap-2">
                    <Upload className="w-8 h-8 text-muted-foreground" />
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    <Upload className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {requiresEndFrame ? "Carica end frame (richiesto)" : "Carica end frame"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {requiresEndFrame 
                      ? "Transizione tra due frame" 
                      : "Per video keyframe start→end"
                    }
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
        ) : (
          <div className="space-y-2">
            <Label className="text-muted-foreground">End Frame</Label>
            <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center bg-muted/30">
              <div className="flex flex-col items-center gap-2 opacity-50">
                <Upload className="w-10 h-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Non supportato
                </p>
                <p className="text-xs text-muted-foreground">
                  Seleziona Luma Ray, PixVerse o Veo 3.1
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Keyframe-capable provider info */}
      {supportsEndFrame && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <Info className="w-4 h-4 mt-0.5 text-primary shrink-0" />
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Modalità Keyframe attiva:</span>{" "}
            {requiresEndFrame 
              ? "Questo modello crea transizioni fluide tra due frame. Carica entrambe le immagini."
              : "Puoi caricare un end frame opzionale per controllare dove termina il video."
            }
          </div>
        </div>
      )}

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
              {currentProvider.durations.map((d) => (
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
              {currentProvider.resolutions.map((r) => (
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
        disabled={isLoading || !startImage || (requiresEndFrame && !endImage)}
        className="w-full bg-gradient-accent text-accent-foreground hover:opacity-90 shadow-glow-accent transition-all duration-300"
        size="lg"
      >
        <Sparkles className="w-5 h-5 mr-2" />
        {isLoading 
          ? "Preparazione..." 
          : requiresEndFrame && !endImage
            ? "Carica entrambi i frame"
            : endImage 
              ? "Genera Video Keyframe" 
              : "Genera Video da Immagine"
        }
      </Button>

      {startImage && (
        <div className="p-4 rounded-lg bg-muted/30 border border-border">
          <p className="text-sm text-muted-foreground mb-2">
            <strong>Parametri selezionati:</strong>
          </p>
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Modalità:</span>
              <span className="font-medium">
                {supportsEndFrame && endImage 
                  ? "Keyframe (Start→End)" 
                  : endImage 
                    ? "Transizione Sequenziale" 
                    : "Animazione Singola"
                }
              </span>
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
            {supportsEndFrame && !endImage && (
              <div className="flex justify-between text-muted-foreground/70 italic">
                <span>End Frame:</span>
                <span>Non impostato (opzionale)</span>
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
