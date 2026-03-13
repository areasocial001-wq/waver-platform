import { useState, useEffect, useMemo, useRef } from "react";
import { useVoiceOptions, SUPPORTED_LANGUAGES } from "@/hooks/useVoiceOptions";
import { useAutoSplitGeneration, calculateSplitPlan } from "@/hooks/useAutoSplitGeneration";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Wallet, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { PromptTemplatesLibrary } from "@/components/PromptTemplatesLibrary";
interface PiAPIBalance {
  credits: number;
  equivalent_in_usd: number;
  account_name: string;
}

// Lista delle API key mancanti che richiedono configurazione
const REQUIRED_API_KEYS: Record<string, string> = {
  'GOOGLE_AI_API_KEY': 'Google AI',
  'PIAPI_API_KEY': 'PiAPI',
  'AIML_API_KEY': 'AI/ML API',
  'FREEPIK_API_KEY': 'Freepik',
  'LTX_API_KEY': 'LTX Video',
};

export const TextToVideoForm = () => {
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(6);
  const [resolution, setResolution] = useState("720p");
  const [cameraMovement, setCameraMovement] = useState<string>("none");
  const [composition, setComposition] = useState<string>("medium");
  const [audioType, setAudioType] = useState<string>("none");
  const [selectedVoiceId, setSelectedVoiceId] = useState("EXAVITQu4vr4xnSDxMaL");
  const [selectedLanguage, setSelectedLanguage] = useState("it");
  const { voiceOptions, hasClonedVoices } = useVoiceOptions();
  const [piapiBalance, setPiapiBalance] = useState<PiAPIBalance | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [audioPrompt, setAudioPrompt] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<string>("none");
  const [preferredProvider, setPreferredProvider] = useProviderPreference("auto");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [generateAudio, setGenerateAudio] = useState(true);
  const [videoTitle, setVideoTitle] = useState("");
  const { state: splitState, runSplitGeneration } = useAutoSplitGeneration();
  const [isLoading, setIsLoading] = useState(false);
  
  // Track original values before auto-correction for warning display
  const [originalDuration, setOriginalDuration] = useState<number | null>(null);
  const [originalResolution, setOriginalResolution] = useState<string | null>(null);
  const [originalAspectRatio, setOriginalAspectRatio] = useState<string | null>(null);

  // Fetch API key status from backend
  const { status: apiKeyStatus } = useApiKeyStatus();

  // Use model capabilities hook for validated constraints
  const capabilities = useModelCapabilities(preferredProvider as VideoProviderType);

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

  // Provider corrente
  const currentProvider = VIDEO_PROVIDERS[preferredProvider as VideoProviderType] || VIDEO_PROVIDERS.auto;

  // Check if API key is missing for selected provider based on actual backend status
  const isMissingAimlKey = currentProvider.group === 'aiml' && !apiKeyStatus.hasAIMLKey;

  // Auto-adjust form values when provider changes using capability constraints
  useEffect(() => {
    // Validate and adjust duration (skip if auto-split extended duration)
    const maxNative = Math.max(...capabilities.durationOptions.map(d => d.value));
    const isAutoSplitDuration = duration > maxNative;
    
    if (!isAutoSplitDuration) {
      const validDuration = capabilities.getValidDuration(duration);
      if (validDuration !== duration) {
        setOriginalDuration(duration);
        setDuration(validDuration);
        toast.info(`Durata adattata a ${validDuration}s per ${currentProvider.shortName}`);
      } else {
        setOriginalDuration(null);
      }
    } else {
      setOriginalDuration(null);
    }
    
    // Validate and adjust resolution
    const validResolution = capabilities.getValidResolution(resolution);
    if (validResolution !== resolution) {
      setOriginalResolution(resolution);
      setResolution(validResolution);
    } else {
      setOriginalResolution(null);
    }
    
    // Validate and adjust aspect ratio
    if (capabilities.aspectRatioOptions && aspectRatio) {
      const validRatios = capabilities.aspectRatioOptions.map(r => r.value);
      if (!validRatios.includes(aspectRatio)) {
        const newRatio = capabilities.defaultAspectRatio || validRatios[0];
        setAspectRatio(newRatio);
      }
    }
  }, [preferredProvider, capabilities]);

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

      // Translate prompt to English for better results (keeping dialogue in original language)
      let translatedPrompt = cinematicPrompt;
      if (preferredProvider === "google-veo" || preferredProvider === "piapi-veo3" || preferredProvider === "auto") {
        try {
          toast.info("Traduzione prompt in inglese...", { duration: 2000 });
          const { data: translateData, error: translateError } = await supabase.functions.invoke('translate-prompt', {
            body: { prompt: cinematicPrompt, dialogueText, title: videoTitle || undefined }
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
          duration: duration,
          resolution: resolution,
          status: "processing",
          voice_settings: audioType === "dialogue" ? { voiceId: selectedVoiceId, language: selectedLanguage } : null,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Check if auto-split is needed (duration exceeds provider max)
      const splitPlan = calculateSplitPlan(preferredProvider as VideoProviderType, duration);

      if (splitPlan.needed) {
        // Auto-split: generate N clips sequentially and concatenate
        // Cancel the single-generation DB entry since split will create its own
        await supabase.from("video_generations").delete().eq("id", generationData.id);

        const result = await runSplitGeneration({
          plan: splitPlan,
          userId: user.id,
          type: "text_to_video",
          prompt: translatedPrompt,
          originalPrompt,
          resolution,
          aspectRatio,
          preferredProvider,
          modelId: currentProvider.modelId,
          generateAudio,
        });

        if (result.success) {
          toast.success("Video generato con successo!", {
            description: `${splitPlan.clipCount} clip concatenate. Vai allo storico.`
          });
          setPrompt("");
        }
        return;
      }

      toast.success("Generazione video avviata!", {
        description: "Il video verrà generato. Attendi qualche istante..."
      });

      // Generate video synchronously - include modelId for AI/ML API providers
      const { data, error } = await supabase.functions
        .invoke("generate-video", {
          body: {
            type: "text_to_video",
            prompt: translatedPrompt,
            duration: duration,
            resolution: resolution,
            aspect_ratio: (preferredProvider === "google-veo" || preferredProvider === "piapi-sora2" || preferredProvider === "piapi-veo3") ? aspectRatio : undefined,
            generate_audio: (preferredProvider === "google-veo" || preferredProvider === "piapi-veo3") ? generateAudio : undefined,
            generationId: generationData.id,
            preferredProvider: preferredProvider !== "auto" ? preferredProvider : undefined,
            modelId: currentProvider.modelId, // Pass model ID for AI/ML API
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
          filterType="text_to_video"
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

      <ScenePresets value={selectedPreset} onChange={handlePresetChange} />

      {/* Video Title (optional) */}
      <div className="space-y-2">
        <Label htmlFor="video-title">Titolo Video (opzionale)</Label>
        <Input
          id="video-title"
          placeholder="Es: La notte dei ricordi, Scena 1..."
          value={videoTitle}
          onChange={(e) => setVideoTitle(e.target.value)}
          className="bg-background"
        />
        <p className="text-xs text-muted-foreground">
          Il titolo verrà preservato nella lingua originale durante la traduzione
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="prompt">Descrizione del Video</Label>
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
          <>
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
                {audioType === "dialogue" && "Il dialogo verrà generato con la voce ElevenLabs selezionata"}
                {audioType === "sfx" && "Descrivi gli effetti sonori che vuoi sentire"}
                {audioType === "ambient" && "Descrivi l'atmosfera sonora di fondo"}
              </p>
            </div>

            {audioType === "dialogue" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="t2v-voice">Voce</Label>
                  <Select value={selectedVoiceId} onValueChange={setSelectedVoiceId}>
                    <SelectTrigger id="t2v-voice">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {hasClonedVoices && (
                        <>
                          <div className="px-2 py-1.5 text-xs font-semibold text-primary">
                            Voci Clonate
                          </div>
                          {voiceOptions.filter(v => v.isCloned).map((voice) => (
                            <SelectItem key={voice.id} value={voice.id}>
                              <span className="text-primary">{voice.name}</span>
                            </SelectItem>
                          ))}
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                            Voci Standard
                          </div>
                        </>
                      )}
                      {voiceOptions.filter(v => !v.isCloned).map((voice) => (
                        <SelectItem key={voice.id} value={voice.id}>
                          {voice.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="t2v-lang">Lingua</Label>
                  <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                    <SelectTrigger id="t2v-lang">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_LANGUAGES.map((lang) => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.flag} {lang.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </>
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
          <div className="flex items-center gap-2">
            <Label htmlFor="duration">Durata</Label>
            {originalDuration !== null && (
              <AutoCorrectionBadge
                originalValue={`${originalDuration}s`}
                correctedValue={`${duration}s`}
                label="Durata"
              />
            )}
          </div>
          <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
            <SelectTrigger id="duration">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {capabilities.durationOptions.map((d) => (
                <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
              ))}
              {/* Auto-split extended durations */}
              {(() => {
                const maxNative = Math.max(...capabilities.durationOptions.map(d => d.value));
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
            <Label htmlFor="resolution">Risoluzione</Label>
            {originalResolution !== null && (
              <AutoCorrectionBadge
                originalValue={originalResolution}
                correctedValue={resolution}
                label="Risoluzione"
              />
            )}
          </div>
          <Select value={resolution} onValueChange={setResolution}>
            <SelectTrigger id="resolution">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {capabilities.resolutionOptions.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Aspect Ratio for providers that support it */}
        {capabilities.aspectRatioOptions && capabilities.aspectRatioOptions.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="aspect-ratio">Aspect Ratio</Label>
            <Select value={aspectRatio} onValueChange={setAspectRatio}>
              <SelectTrigger id="aspect-ratio">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {capabilities.aspectRatioOptions.map((ar) => (
                  <SelectItem key={ar.value} value={ar.value}>{ar.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Generate Audio toggle for providers that support it */}
        {capabilities.supportsAudio && (
          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
            <div className="space-y-0.5">
              <Label htmlFor="generate-audio" className="text-sm font-medium">Genera Audio</Label>
              <p className="text-xs text-muted-foreground">{currentProvider.name} può generare audio sincronizzato</p>
            </div>
            <Switch
              id="generate-audio"
              checked={generateAudio}
              onCheckedChange={setGenerateAudio}
            />
          </div>
        )}
      </div>

      {/* Auto-split progress indicator */}
      {splitState.isSplitting && (
        <div className="p-3 rounded-lg border border-primary/30 bg-primary/5">
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw className="w-4 h-4 animate-spin text-primary" />
            <span className="text-sm font-medium">
              Auto-split: clip {splitState.currentClip}/{splitState.totalClips}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-500"
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
        disabled={isLoading || splitState.isSplitting || !prompt.trim()}
        className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow-primary transition-all duration-300"
        size="lg"
      >
        <Sparkles className="w-5 h-5 mr-2" />
        {splitState.isSplitting 
          ? `Auto-split ${splitState.currentClip}/${splitState.totalClips}...`
          : isLoading ? "Preparazione..." : "Genera Video"
        }
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
          {(preferredProvider === "piapi-sora2" || preferredProvider === "piapi-veo3") && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Aspect Ratio:</span>
              <span className="font-medium">{aspectRatio}</span>
            </div>
          )}
          {preferredProvider === "piapi-veo3" && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Audio generato:</span>
              <span className="font-medium">{generateAudio ? "Sì" : "No"}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Caratteri prompt:</span>
            <span className="font-medium">{prompt.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
