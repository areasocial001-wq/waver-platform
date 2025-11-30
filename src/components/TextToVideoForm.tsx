import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";

export const TextToVideoForm = () => {
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState("6");
  const [resolution, setResolution] = useState("720p");
  const [cameraMovement, setCameraMovement] = useState<string>("none");
  const [composition, setComposition] = useState<string>("medium");
  const [audioType, setAudioType] = useState<string>("none");
  const [audioPrompt, setAudioPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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

      // Save to database first
      const { data: generationData, error: dbError } = await supabase
        .from("video_generations")
        .insert({
          user_id: user.id,
          type: "text_to_video",
          prompt: cinematicPrompt,
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
            prompt: cinematicPrompt,
            duration: parseInt(duration),
            generationId: generationData.id
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
      <Alert className="border-primary/30 bg-primary/5">
        <AlertCircle className="h-4 w-4 text-primary" />
        <AlertDescription>
          Genera video ad alta qualità usando Google Veo 3, il modello AI più avanzato per la generazione video. 
          La generazione richiede qualche minuto.
        </AlertDescription>
      </Alert>

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
              <SelectItem value="4">4 secondi</SelectItem>
              <SelectItem value="6">6 secondi</SelectItem>
              <SelectItem value="8">8 secondi</SelectItem>
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
              <SelectItem value="480p">480p (Standard)</SelectItem>
              <SelectItem value="720p">720p (HD)</SelectItem>
              <SelectItem value="1080p">1080p (Full HD)</SelectItem>
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
