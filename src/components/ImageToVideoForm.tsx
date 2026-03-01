import { useState, useEffect, useMemo } from "react";
import { useAutoSplitGeneration, calculateSplitPlan } from "@/hooks/useAutoSplitGeneration";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Sparkles, X, Info, ArrowRight, Wand2, Plus, ImageIcon, Video } from "lucide-react";
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
import { AutoCorrectionBadge } from "@/components/AutoCorrectionBadge";
import { PromptSafetyChecker } from "@/components/PromptSafetyChecker";
import { PromptBuilderWizard } from "@/components/PromptBuilderWizard";
import { resolveAimlModelId } from "@/lib/aimlModelIds";
import { Badge } from "@/components/ui/badge";
import { PromptTemplatesLibrary } from "@/components/PromptTemplatesLibrary";

export const ImageToVideoForm = () => {
  const [startImage, setStartImage] = useState<File | null>(null);
  const [startImagePreview, setStartImagePreview] = useState<string>("");
  const [endImage, setEndImage] = useState<File | null>(null);
  const [endImagePreview, setEndImagePreview] = useState<string>("");
  // Multiple reference images for Veo 3.1 reference-to-video
  const [referenceImages, setReferenceImages] = useState<{ file: File; preview: string }[]>([]);
  // Reference video for Runway Act Two
  const [referenceVideo, setReferenceVideo] = useState<File | null>(null);
  const [referenceVideoPreview, setReferenceVideoPreview] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState<number>(6);
  const [resolution, setResolution] = useState("720p");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [motion, setMotion] = useState("medium");
  const [cameraMovement, setCameraMovement] = useState<string>("none");
  const [composition, setComposition] = useState<string>("medium");
  const [audioType, setAudioType] = useState<string>("none");
  const [audioPrompt, setAudioPrompt] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<string>("none");
  const { state: splitState, runSplitGeneration } = useAutoSplitGeneration();
  const [isLoading, setIsLoading] = useState(false);
  const [preferredProvider, setPreferredProvider] = useProviderPreference("auto");
  
  // Track original values before auto-correction for warning display
  const [originalDuration, setOriginalDuration] = useState<number | null>(null);
  const [originalResolution, setOriginalResolution] = useState<string | null>(null);
  const [originalAspectRatio, setOriginalAspectRatio] = useState<string | null>(null);

  // Fetch API key status from backend
  const { status: apiKeyStatus } = useApiKeyStatus();

  // Provider corrente
  const currentProvider = VIDEO_PROVIDERS[preferredProvider as VideoProviderType] || VIDEO_PROVIDERS.auto;

  // Get model capabilities for the current provider
  const { 
    supportsEndFrame, 
    requiresEndFrame,
    durationOptions,
    resolutionOptions,
    aspectRatioOptions,
    getValidDuration,
    getValidResolution,
    defaultDuration,
    defaultResolution,
    defaultAspectRatio
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

  // Aggiorna durata, resolution e aspect ratio quando cambia il provider
  useEffect(() => {
    // Skip auto-correction if user selected an auto-split extended duration
    const maxNative = Math.max(...durationOptions.map(d => d.value));
    const isAutoSplitDuration = duration > maxNative;

    if (!isAutoSplitDuration) {
      const validDuration = getValidDuration(duration);
      if (validDuration !== duration) {
        setOriginalDuration(duration);
        setDuration(validDuration);
        toast.info("Durata adattata", {
          description: `Il provider supporta ${validDuration}s`
        });
      } else {
        setOriginalDuration(null);
      }
    } else {
      setOriginalDuration(null);
    }
    
    const validResolution = getValidResolution(resolution);
    if (validResolution !== resolution) {
      setOriginalResolution(resolution);
      setResolution(validResolution);
    } else {
      setOriginalResolution(null);
    }
    
    // Adjust aspect ratio if not supported
    if (aspectRatioOptions) {
      const validRatios = aspectRatioOptions.map(r => r.value);
      if (!validRatios.includes(aspectRatio)) {
        setOriginalAspectRatio(aspectRatio);
        setAspectRatio(defaultAspectRatio || validRatios[0]);
      } else {
        setOriginalAspectRatio(null);
      }
    } else {
      setOriginalAspectRatio(null);
    }
  }, [preferredProvider, getValidDuration, getValidResolution, duration, resolution, aspectRatio, aspectRatioOptions, defaultAspectRatio, durationOptions]);

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

  // Handle reference image upload for Veo 3.1 reference-to-video
  const handleReferenceImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const maxImages = 5; // Limit to 5 reference images
    const currentCount = referenceImages.length;
    const availableSlots = maxImages - currentCount;

    if (availableSlots <= 0) {
      toast.error("Massimo 5 immagini di riferimento");
      return;
    }

    const filesToProcess = Array.from(files).slice(0, availableSlots);
    toast.info(`Ottimizzazione ${filesToProcess.length} immagini...`);

    const newImages: { file: File; preview: string }[] = [];
    for (const file of filesToProcess) {
      if (!file.type.startsWith('image/')) continue;
      try {
        const compressedImage = await compressImage(file, 1280, 0.85);
        newImages.push({ file, preview: compressedImage });
      } catch (error) {
        console.error("Error compressing reference image:", error);
      }
    }

    setReferenceImages([...referenceImages, ...newImages]);
    toast.success(`${newImages.length} immagini di riferimento caricate`);
  };

  const removeReferenceImage = (index: number) => {
    setReferenceImages(referenceImages.filter((_, i) => i !== index));
  };

  // Check if current provider supports reference images (Veo 3.1 reference-to-video)
  const supportsReferenceImages = currentProvider.modelId === 'google/veo-3.1-reference-to-video';

  // Check if current provider is Runway Act Two (needs reference video)
  const isRunwayActTwo = preferredProvider === 'aiml-runway-act-two';

  const handleReferenceVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      toast.error("Seleziona un file video valido (MP4, MOV, WEBM)");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error("Il video di riferimento non può superare i 50 MB");
      return;
    }
    setReferenceVideo(file);
    const url = URL.createObjectURL(file);
    setReferenceVideoPreview(url);
    toast.success("Video di riferimento caricato");
  };

  const removeReferenceVideo = () => {
    if (referenceVideoPreview) URL.revokeObjectURL(referenceVideoPreview);
    setReferenceVideo(null);
    setReferenceVideoPreview("");
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

    // Validate reference video for Runway Act Two
    if (isRunwayActTwo && !referenceVideo) {
      toast.error("Video di riferimento obbligatorio", {
        description: "Runway Act Two richiede un video di riferimento per il performance transfer."
      });
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
          duration: duration,
          motion_intensity: motion,
          resolution: resolution,
          image_name: isSequential ? `${startImage.name} → ${endImage.name}` : startImage.name,
          image_url: startImagePreview,
          status: "processing"
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Check if auto-split is needed (duration exceeds provider max)
      const splitPlan = calculateSplitPlan(preferredProvider as VideoProviderType, duration);

      if (splitPlan.needed && !isSequential) {
        // Auto-split: generate N clips sequentially and concatenate
        await supabase.from("video_generations").delete().eq("id", generationData.id);

        const result = await runSplitGeneration({
          plan: splitPlan,
          userId: user.id,
          type: "image_to_video",
          prompt: cinematicPrompt,
          resolution,
          aspectRatio,
          preferredProvider,
          startImage: startImagePreview,
        });

        if (result.success) {
          toast.success("Video generato con successo!", {
            description: `${splitPlan.clipCount} clip concatenate. Vai allo storico.`
          });
          setStartImage(null);
          setStartImagePreview("");
          setPrompt("");
        }
        return;
      }

      toast.success("Generazione video avviata!", {
        description: isSequential 
          ? "Creazione video sequenziale tra i due frame..." 
          : "Il video verrà generato. Attendi qualche istante..."
      });

      // Generate video synchronously; backend resolves the exact model by provider + mode (I2V/T2V)
      const requestBody: any = {
        type: "image_to_video",
        prompt: cinematicPrompt,
        start_image: startImagePreview,
        duration: duration,
        resolution: resolution,
        aspect_ratio: aspectRatio,
        generationId: generationData.id,
        preferredProvider: preferredProvider !== "auto" ? preferredProvider : undefined,
      };

      // Add end image if provided
      if (isSequential) {
        requestBody.end_image = endImagePreview;
      }

      // Add reference images for Veo 3.1 reference-to-video
      if (supportsReferenceImages && referenceImages.length > 0) {
        requestBody.reference_images = referenceImages.map(img => img.preview);
      }

      // Add reference video for Runway Act Two (as base64 data URL)
      if (isRunwayActTwo && referenceVideo) {
        const videoBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(referenceVideo);
        });
        requestBody.reference_video = videoBase64;
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
      setReferenceImages([]);
      removeReferenceVideo();
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
        {/* Debug badge: resolved AIML model ID */}
        {(() => {
          const resolved = resolveAimlModelId(preferredProvider, 'image_to_video');
          if (!resolved) return null;
          return (
            <Badge variant="outline" className="mt-1.5 text-[10px] font-mono text-muted-foreground border-muted gap-1">
              🔧 Backend model: <span className="text-foreground">{resolved}</span>
              <span className="ml-1 text-primary">(I2V)</span>
            </Badge>
          );
        })()}
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
                  Seleziona Luma Ray, PixVerse, Framepack o Veo 3.1
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reference Video for Runway Act Two */}
      {isRunwayActTwo && (
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Video className="w-4 h-4" />
            Video di Riferimento (Obbligatorio)
            <span className="text-xs text-destructive font-medium">*</span>
          </Label>
          
          <div className="flex items-start gap-2 p-3 rounded-lg bg-accent/5 border border-accent/20">
            <Info className="w-4 h-4 mt-0.5 text-accent shrink-0" />
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Runway Act Two – Performance Transfer:</span>{" "}
              Carica un video con i movimenti/espressioni che vuoi trasferire sul personaggio dell'immagine.
            </div>
          </div>

          {!referenceVideoPreview ? (
            <div className="border-2 border-dashed border-primary/50 rounded-lg p-6 text-center hover:border-primary transition-colors">
              <input
                type="file"
                id="reference-video-upload"
                className="hidden"
                accept="video/*"
                onChange={handleReferenceVideoUpload}
              />
              <label
                htmlFor="reference-video-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <Video className="w-10 h-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Carica video di riferimento
                </p>
                <p className="text-xs text-muted-foreground">
                  MP4, MOV o WEBM (max 50 MB)
                </p>
              </label>
            </div>
          ) : (
            <div className="relative rounded-lg overflow-hidden border border-border">
              <video
                src={referenceVideoPreview}
                controls
                className="w-full max-h-64 bg-muted"
              />
              <button
                onClick={removeReferenceVideo}
                className="absolute top-2 right-2 p-2 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

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

      {/* Reference Images for Veo 3.1 reference-to-video */}
      {supportsReferenceImages && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Immagini di Riferimento (max 5)
            </Label>
            <span className="text-xs text-muted-foreground">
              {referenceImages.length}/5 immagini
            </span>
          </div>
          
          <div className="flex items-start gap-2 p-3 rounded-lg bg-accent/5 border border-accent/20">
            <Info className="w-4 h-4 mt-0.5 text-accent shrink-0" />
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Veo 3.1 Reference-to-Video:</span>{" "}
              Carica più immagini di riferimento per guidare la generazione del video con maggiore coerenza visiva.
            </div>
          </div>

          <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
            {referenceImages.map((img, index) => (
              <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-border group">
                <img
                  src={img.preview}
                  alt={`Reference ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => removeReferenceImage(index)}
                  className="absolute top-1 right-1 p-1 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
                <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-background/80 text-[10px] font-medium">
                  #{index + 1}
                </div>
              </div>
            ))}
            
            {referenceImages.length < 5 && (
              <div className="aspect-square">
                <input
                  type="file"
                  id="reference-images-upload"
                  className="hidden"
                  accept="image/*"
                  multiple
                  onChange={handleReferenceImageUpload}
                />
                <label
                  htmlFor="reference-images-upload"
                  className="w-full h-full border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-accent/50 transition-colors"
                >
                  <Plus className="w-6 h-6 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Aggiungi</span>
                </label>
              </div>
            )}
          </div>
        </div>
      )}

      <ScenePresets value={selectedPreset} onChange={handlePresetChange} />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="i2v-prompt">
            {endImage ? "Descrizione della Transizione (Opzionale)" : "Descrizione del Movimento (Opzionale)"}
          </Label>
          <div className="flex items-center gap-1.5">
            <PromptTemplatesLibrary 
              currentPrompt={prompt}
              onApplyTemplate={(p) => setPrompt(p)}
            />
            <PromptBuilderWizard 
              onPromptGenerated={(generatedPrompt) => setPrompt(generatedPrompt)}
              trigger={
                <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs">
                  <Wand2 className="h-3.5 w-3.5" />
                  Wizard
                </Button>
              }
            />
          </div>
        </div>
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

      {/* Prompt Safety Checker */}
      <PromptSafetyChecker 
        prompt={prompt} 
        onAcceptRewrite={(newPrompt) => setPrompt(newPrompt)}
      />

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
          <div className="flex items-center gap-2">
            <Label htmlFor="i2v-duration">Durata</Label>
            {originalDuration !== null && (
              <AutoCorrectionBadge
                originalValue={`${originalDuration}s`}
                correctedValue={`${duration}s`}
                label="Durata"
              />
            )}
          </div>
          <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
            <SelectTrigger id="i2v-duration">
              <SelectValue placeholder="Seleziona durata" />
            </SelectTrigger>
            <SelectContent>
              {durationOptions.map((d) => (
                <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
              ))}
              {/* Auto-split extended durations */}
              {(() => {
                const maxNative = Math.max(...durationOptions.map(d => d.value));
                const extendedDurations = [10, 15, 20].filter(d => d > maxNative);
                return extendedDurations.map(d => (
                  <SelectItem key={`split-${d}`} value={String(d)}>
                    {d}s ⚡ auto-split ({Math.ceil(d / maxNative)}x{maxNative}s)
                  </SelectItem>
                ));
              })()}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="i2v-resolution">Risoluzione</Label>
            {originalResolution !== null && (
              <AutoCorrectionBadge
                originalValue={originalResolution}
                correctedValue={resolution}
                label="Risoluzione"
              />
            )}
          </div>
          <Select value={resolution} onValueChange={setResolution}>
            <SelectTrigger id="i2v-resolution">
              <SelectValue placeholder="Seleziona risoluzione" />
            </SelectTrigger>
            <SelectContent>
              {resolutionOptions.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="motion">Intensità Movimento</Label>
          <Select value={motion} onValueChange={setMotion}>
            <SelectTrigger id="motion">
              <SelectValue placeholder="Seleziona intensità" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Bassa</SelectItem>
              <SelectItem value="medium">Media</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Aspect Ratio Selector - Only show if provider supports it */}
      {aspectRatioOptions && aspectRatioOptions.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="aspect-ratio">Aspect Ratio</Label>
          <Select value={aspectRatio} onValueChange={setAspectRatio}>
            <SelectTrigger id="aspect-ratio">
              <SelectValue placeholder="Seleziona aspect ratio" />
            </SelectTrigger>
            <SelectContent>
              {aspectRatioOptions.map((ar) => (
                <SelectItem key={ar.value} value={ar.value}>{ar.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Auto-split progress indicator */}
      {splitState.isSplitting && (
        <div className="p-3 rounded-lg border border-accent/30 bg-accent/5">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 animate-spin text-accent" />
            <span className="text-sm font-medium">
              Auto-split: clip {splitState.currentClip}/{splitState.totalClips}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-accent h-2 rounded-full transition-all duration-500"
              style={{ width: `${(splitState.currentClip / splitState.totalClips) * 100}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {splitState.phase === "generating" && "Generazione in corso..."}
            {splitState.phase === "waiting" && "Attesa completamento..."}
            {splitState.phase === "concatenating" && "Concatenazione clip..."}
          </p>
        </div>
      )}

      <Button 
        onClick={handleGenerate}
        disabled={isLoading || splitState.isSplitting || !startImage || (requiresEndFrame && !endImage)}
        className="w-full bg-gradient-accent text-accent-foreground hover:opacity-90 shadow-glow-accent transition-all duration-300"
        size="lg"
      >
        <Sparkles className="w-5 h-5 mr-2" />
        {splitState.isSplitting 
          ? `Auto-split ${splitState.currentClip}/${splitState.totalClips}...`
          : isLoading 
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
              <span className="text-muted-foreground">Risoluzione:</span>
              <span className="font-medium">{resolution}</span>
            </div>
            {aspectRatioOptions && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Aspect Ratio:</span>
                <span className="font-medium">{aspectRatio}</span>
              </div>
            )}
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
