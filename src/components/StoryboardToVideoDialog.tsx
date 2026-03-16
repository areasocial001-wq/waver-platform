import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Video, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface StoryboardPanel {
  id: string;
  imageUrl: string | null;
  caption: string;
  note?: string;
  characterIds?: string[];
}

interface CharacterRef {
  id: string;
  name: string;
  reference_images: string[];
}

interface StoryboardToVideoDialogProps {
  storyboardId: string;
  panels: StoryboardPanel[];
  characters?: CharacterRef[];
  onSuccess?: () => void;
}

export const StoryboardToVideoDialog = ({ storyboardId, panels, onSuccess }: StoryboardToVideoDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [startPanelIndex, setStartPanelIndex] = useState(0);
  const [endPanelIndex, setEndPanelIndex] = useState(Math.min(3, panels.length - 1));
  const [duration, setDuration] = useState<4 | 6 | 8>(6);
  const [cameraMovement, setCameraMovement] = useState("none");
  const [audioType, setAudioType] = useState<"none" | "dialogue" | "sfx" | "ambient">("none");
  const [audioPrompt, setAudioPrompt] = useState("");
  const [transitionPrompt, setTransitionPrompt] = useState("");
  const [transitionStyle, setTransitionStyle] = useState("smooth");
  const [transitionSpeed, setTransitionSpeed] = useState<"fast" | "normal" | "slow">("normal");
  const [videoProvider, setVideoProvider] = useState<string>("auto");

  const panelsWithImages = panels.filter(p => p.imageUrl);
  const selectedPanels = panelsWithImages.slice(startPanelIndex, endPanelIndex + 1);
  const transitionCount = Math.max(0, selectedPanels.length - 1);

  const handleGenerate = async () => {
    if (selectedPanels.length < 2) {
      toast.error("Seleziona almeno 2 pannelli con immagini");
      return;
    }

    if (selectedPanels.length > 8) {
      toast.error("Puoi selezionare massimo 8 pannelli");
      return;
    }

    setIsGenerating(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Create batch record
      const { data: batch, error: batchError } = await supabase
        .from("storyboard_video_batches")
        .insert({
          user_id: user.id,
          storyboard_id: storyboardId,
          status: "processing",
          total_videos: transitionCount,
          completed_videos: 0,
          duration,
          camera_movement: cameraMovement !== "none" ? cameraMovement : null,
          audio_type: audioType !== "none" ? audioType : null,
          audio_prompt: audioPrompt || null,
          transition_prompt: transitionPrompt || null,
          transition_style: transitionStyle,
          transition_speed: transitionSpeed,
        })
        .select()
        .single();

      if (batchError) throw batchError;

      // Generate video for each transition
      for (let i = 0; i < transitionCount; i++) {
        const startPanel = selectedPanels[i];
        const endPanel = selectedPanels[i + 1];

        // Create video generation record
        const { data: generation, error: genError } = await supabase
          .from("video_generations")
          .insert({
            user_id: user.id,
            type: "image_to_video",
            duration,
            status: "pending",
            image_url: startPanel.imageUrl,
            image_name: `Pannello ${startPanelIndex + i + 1}`,
            batch_id: batch.id,
            sequence_order: i,
            prompt: transitionPrompt || `Transizione dal pannello ${startPanelIndex + i + 1} al pannello ${startPanelIndex + i + 2}`,
          })
          .select()
          .single();

        if (genError) throw genError;

        // Build prompt with all parameters
        const selectedTransition = transitionTemplates.find(t => t.value === transitionStyle);
        let fullPrompt = transitionPrompt || selectedTransition?.description || `Smooth transition from scene ${i + 1} to scene ${i + 2}`;
        
        if (startPanel.caption) {
          fullPrompt += `. Starting scene: ${startPanel.caption}`;
        }
        if (endPanel.caption) {
          fullPrompt += `. Ending scene: ${endPanel.caption}`;
        }

        if (cameraMovement !== "none") {
          fullPrompt += `. Camera: ${cameraMovement}`;
        }

        // Add transition speed instruction
        if (transitionSpeed === "fast") {
          fullPrompt += `. Transition: quick, snappy, energetic pacing`;
        } else if (transitionSpeed === "slow") {
          fullPrompt += `. Transition: slow, gradual, smooth pacing`;
        }

        if (audioType !== "none" && audioPrompt) {
          if (audioType === "dialogue") {
            fullPrompt += `. Dialogue: "${audioPrompt}"`;
          } else if (audioType === "sfx") {
            fullPrompt += `. Sound effects: ${audioPrompt}`;
          } else if (audioType === "ambient") {
            fullPrompt += `. Ambient sound: ${audioPrompt}`;
          }
        }

        // Call edge function to generate video
        const { error: videoError } = await supabase.functions.invoke("generate-video", {
          body: {
            type: "image_to_video",
            duration,
            start_image: startPanel.imageUrl,
            end_image: endPanel.imageUrl, // Use end frame for transition
            prompt: fullPrompt,
            generationId: generation.id,
            preferredProvider: videoProvider !== "auto" ? videoProvider : undefined,
          },
        });

        if (videoError) {
          console.error(`Error generating video ${i}:`, videoError);
          await supabase
            .from("video_generations")
            .update({
              status: "failed",
              error_message: videoError.message,
            })
            .eq("id", generation.id);
        }
      }

      toast.success(`Generazione avviata! ${transitionCount} video in coda`);
      setIsOpen(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error generating videos:", error);
      toast.error("Errore nella generazione dei video");
    } finally {
      setIsGenerating(false);
    }
  };

  const cameraOptions = [
    { value: "none", label: "Nessun movimento" },
    { value: "dolly_in", label: "Dolly In - Avvicinamento" },
    { value: "dolly_out", label: "Dolly Out - Allontanamento" },
    { value: "tracking", label: "Tracking - Segui soggetto" },
    { value: "crane_up", label: "Crane Up - Movimento alto" },
    { value: "crane_down", label: "Crane Down - Movimento basso" },
    { value: "pan_left", label: "Pan Left - Panoramica sinistra" },
    { value: "pan_right", label: "Pan Right - Panoramica destra" },
    { value: "aerial", label: "Aerial - Vista aerea" },
    { value: "pov", label: "POV - Punto di vista" },
    { value: "orbit", label: "Orbit - Rotazione attorno" },
  ];

  const transitionTemplates = [
    { 
      value: "smooth", 
      label: "Smooth - Transizione fluida",
      description: "Smooth, seamless transition with natural motion blur and gradual transformation between scenes",
      icon: "🌊"
    },
    { 
      value: "fade", 
      label: "Fade - Dissolvenza",
      description: "Gradual fade transition with cross-dissolve effect, overlapping the end of first scene with beginning of second",
      icon: "🌫️"
    },
    { 
      value: "dissolve", 
      label: "Dissolve - Sovrapposizione",
      description: "Cinematic dissolve with temporal blending, elements from both scenes briefly visible simultaneously creating dream-like effect",
      icon: "✨"
    },
    { 
      value: "wipe", 
      label: "Wipe - Cancellazione direzionale",
      description: "Dynamic wipe transition where new scene progressively replaces old scene with visible edge moving across frame from left to right",
      icon: "↔️"
    },
    { 
      value: "zoom", 
      label: "Zoom - Ingrandimento/Riduzione",
      description: "Zoom transition with camera pushing into first scene then pulling back to reveal second scene, creating depth and spatial continuity",
      icon: "🔍"
    },
    { 
      value: "morph", 
      label: "Morph - Trasformazione organica",
      description: "Organic morphing transition where objects and shapes from first scene gradually transform into elements of second scene",
      icon: "🦋"
    },
    { 
      value: "push", 
      label: "Push - Spinta laterale",
      description: "Push transition where new scene slides in from right while pushing old scene out to left, maintaining spatial relationship",
      icon: "➡️"
    },
    { 
      value: "spin", 
      label: "Spin - Rotazione 3D",
      description: "3D spin transition with camera rotating around vertical axis, first scene on front face, second scene revealed on back",
      icon: "🌀"
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Video className="h-4 w-4" />
          Genera Video da Storyboard
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Genera Video Sequenziale</DialogTitle>
          <DialogDescription>
            Crea un video lungo con transizioni tra le immagini selezionate dello storyboard
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Panel Selection */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Selezione Pannelli</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Pannello Iniziale</Label>
                <Select value={startPanelIndex.toString()} onValueChange={(v) => setStartPanelIndex(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {panelsWithImages.map((panel, idx) => (
                      <SelectItem key={idx} value={idx.toString()}>
                        Pannello {idx + 1} {panel.caption ? `- ${panel.caption.slice(0, 30)}...` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pannello Finale</Label>
                <Select value={endPanelIndex.toString()} onValueChange={(v) => setEndPanelIndex(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {panelsWithImages.map((panel, idx) => (
                      <SelectItem 
                        key={idx} 
                        value={idx.toString()}
                        disabled={idx < startPanelIndex}
                      >
                        Pannello {idx + 1} {panel.caption ? `- ${panel.caption.slice(0, 30)}...` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Alert>
              <AlertDescription>
                Verranno generati {transitionCount} video di transizione tra {selectedPanels.length} pannelli selezionati.
              </AlertDescription>
            </Alert>

            {/* Image Preview Grid */}
            {selectedPanels.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Anteprima sequenza:</Label>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {selectedPanels.map((panel, idx) => (
                    <div key={panel.id} className="relative flex-shrink-0">
                      <div className="w-24 h-16 rounded-md overflow-hidden border border-border">
                        <img
                          src={panel.imageUrl || ""}
                          alt={`Frame ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full">
                        {startPanelIndex + idx + 1}
                      </div>
                      {idx < selectedPanels.length - 1 && (
                        <div className="absolute top-1/2 -right-2 -translate-y-1/2 text-muted-foreground text-xs">
                          →
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Video Provider */}
          <div className="space-y-2">
            <Label>Provider Video</Label>
            <Select value={videoProvider} onValueChange={setVideoProvider}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">🤖 Automatico (migliore disponibile)</SelectItem>
                
                {/* Google Veo */}
                <SelectItem value="google-veo">🌟 Google Veo 3.1 - Alta qualità, incluso</SelectItem>
                
                {/* AI/ML API Models */}
                <SelectItem value="aiml-runway">🎬 AI/ML: Runway Gen-3 Alpha Turbo</SelectItem>
                <SelectItem value="aiml-kling">🎬 AI/ML: Kling v1.6 Pro</SelectItem>
                <SelectItem value="aiml-veo">🎬 AI/ML: Google Veo 3.1</SelectItem>
                
                {/* PiAPI Models */}
                <SelectItem value="piapi-kling-2.6">🎥 PiAPI: Kling 2.6</SelectItem>
                <SelectItem value="piapi-kling-2.5">🎥 PiAPI: Kling 2.5</SelectItem>
                <SelectItem value="piapi-kling-2.1">🎥 PiAPI: Kling 2.1</SelectItem>
                <SelectItem value="piapi-hailuo">🎥 PiAPI: Hailuo</SelectItem>
                <SelectItem value="piapi-luma">🎥 PiAPI: Luma</SelectItem>
                <SelectItem value="piapi-wan">🎥 PiAPI: Wan</SelectItem>
                <SelectItem value="piapi-hunyuan">🎥 PiAPI: Hunyuan</SelectItem>
                <SelectItem value="piapi-veo3">🎥 PiAPI: Veo 3</SelectItem>
                <SelectItem value="piapi-sora2">🎥 PiAPI: Sora 2</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {videoProvider === "auto" 
                ? "Selezione automatica del miglior provider disponibile."
                : videoProvider === "google-veo" 
                  ? "Google Veo 3.1: Alta qualità, incluso con Lovable AI."
                  : videoProvider.startsWith("aiml-")
                    ? "AI/ML API: Gateway unificato per modelli video premium. Richiede AIML_API_KEY."
                    : "PiAPI: Accesso diretto ai modelli video più recenti. Richiede PIAPI_API_KEY."}
            </p>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label>Durata Transizioni</Label>
            <Select value={duration.toString()} onValueChange={(v) => setDuration(parseInt(v) as 4 | 6 | 8)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="4">4 secondi</SelectItem>
                <SelectItem value="6">6 secondi (consigliato)</SelectItem>
                <SelectItem value="8">8 secondi</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Transition Speed */}
          <div className="space-y-2">
            <Label>Velocità Transizione</Label>
            <Select value={transitionSpeed} onValueChange={(v) => setTransitionSpeed(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fast">⚡ Veloce - Transizioni rapide e dinamiche</SelectItem>
                <SelectItem value="normal">➡️ Normale - Velocità bilanciata</SelectItem>
                <SelectItem value="slow">🐌 Lento - Transizioni graduali e fluide</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Controlla la velocità del movimento durante le transizioni, indipendente dalla durata totale
            </p>
          </div>

          {/* Transition Style */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Stile Transizione</Label>
            <Select value={transitionStyle} onValueChange={setTransitionStyle}>
              <SelectTrigger className="h-auto min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {transitionTemplates.map((template) => (
                  <SelectItem key={template.value} value={template.value} className="cursor-pointer">
                    <div className="flex items-start gap-3 py-2">
                      <span className="text-2xl" style={{ lineHeight: 1 }}>{template.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{template.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {template.description.split(',')[0]}
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {transitionTemplates.find(t => t.value === transitionStyle)?.description}
            </p>
          </div>

          {/* Camera Movement */}
          <div className="space-y-2">
            <Label>Movimento Camera</Label>
            <Select value={cameraMovement} onValueChange={setCameraMovement}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {cameraOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Audio Settings */}
          <div className="space-y-2">
            <Label>Audio</Label>
            <Select value={audioType} onValueChange={(v) => setAudioType(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nessun audio</SelectItem>
                <SelectItem value="dialogue">Dialogo</SelectItem>
                <SelectItem value="sfx">Effetti sonori (SFX)</SelectItem>
                <SelectItem value="ambient">Audio ambientale</SelectItem>
              </SelectContent>
            </Select>
            {audioType !== "none" && (
              <Textarea
                value={audioPrompt}
                onChange={(e) => setAudioPrompt(e.target.value)}
                placeholder={
                  audioType === "dialogue" 
                    ? "Inserisci il dialogo che vuoi sentire..."
                    : audioType === "sfx"
                    ? "Descrivi gli effetti sonori (es: passi, porte, suoni ambiente)"
                    : "Descrivi l'atmosfera sonora (es: musica calma, rumore città)"
                }
                className="min-h-[80px]"
              />
            )}
          </div>

          {/* Transition Prompt */}
          <div className="space-y-2">
            <Label>Prompt Transizioni Personalizzato (Opzionale)</Label>
            <Textarea
              value={transitionPrompt}
              onChange={(e) => setTransitionPrompt(e.target.value)}
              placeholder="Personalizza ulteriormente le transizioni con istruzioni specifiche..."
              className="min-h-[100px]"
            />
            <p className="text-sm text-muted-foreground">
              Lascia vuoto per usare solo il template selezionato. Se compili questo campo, sovrascriverà il template di transizione.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isGenerating}>
              Annulla
            </Button>
            <Button onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generazione in corso...
                </>
              ) : (
                <>
                  <Video className="mr-2 h-4 w-4" />
                  Genera {transitionCount} Video
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
