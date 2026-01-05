import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Loader2, Music, Download, Play, Pause, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type AudioModel = "udio" | "diffrhythm" | "mmaudio" | "ace-step";

interface ModelConfig {
  id: AudioModel;
  name: string;
  description: string;
  maxDuration: number;
}

const AUDIO_MODELS: ModelConfig[] = [
  {
    id: "udio",
    name: "Udio",
    description: "Generazione musicale di alta qualità, ideale per canzoni complete",
    maxDuration: 180,
  },
  {
    id: "diffrhythm",
    name: "DiffRhythm",
    description: "Ritmi e beat elettronici, ottimo per musica EDM e Hip-Hop",
    maxDuration: 120,
  },
  {
    id: "mmaudio",
    name: "MMAudio",
    description: "Audio multimodale, buono per soundscape e ambienti",
    maxDuration: 60,
  },
  {
    id: "ace-step",
    name: "Ace Step",
    description: "Generazione veloce di brani musicali con stili diversi",
    maxDuration: 90,
  },
];

const STYLE_PRESETS = [
  { value: "", label: "Nessuno stile" },
  { value: "pop", label: "Pop" },
  { value: "rock", label: "Rock" },
  { value: "electronic", label: "Electronic/EDM" },
  { value: "hip-hop", label: "Hip-Hop" },
  { value: "jazz", label: "Jazz" },
  { value: "classical", label: "Classica" },
  { value: "ambient", label: "Ambient" },
  { value: "cinematic", label: "Cinematica" },
  { value: "lofi", label: "Lo-Fi" },
];

export function PiAPIAudioGenerator() {
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState<AudioModel>("udio");
  const [duration, setDuration] = useState(30);
  const [style, setStyle] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement>(null);

  const currentModel = AUDIO_MODELS.find(m => m.id === selectedModel)!;

  const pollTaskStatus = async (taskId: string): Promise<string | null> => {
    const maxAttempts = 60;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const { data, error } = await supabase.functions.invoke('piapi-audio', {
        body: { action: "status", taskId }
      });
      
      if (error) throw error;
      
      if (data.status === "completed") {
        return data.audioUrl;
      } else if (data.status === "failed") {
        throw new Error(data.error || "Generation failed");
      }
      
      attempts++;
    }
    
    throw new Error("Timeout: generation took too long");
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Inserisci una descrizione per la musica");
      return;
    }

    setIsGenerating(true);
    setAudioUrl(null);

    try {
      const { data, error } = await supabase.functions.invoke('piapi-audio', {
        body: {
          prompt,
          model: selectedModel,
          duration,
          style: style || undefined,
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setTaskId(data.taskId);
      toast.info("Generazione audio in corso...");

      const resultUrl = await pollTaskStatus(data.taskId);
      
      if (resultUrl) {
        setAudioUrl(resultUrl);
        toast.success("Audio generato con successo!");
      }
    } catch (error: any) {
      console.error("Audio generation error:", error);
      toast.error(error.message || "Errore durante la generazione");
    } finally {
      setIsGenerating(false);
      setTaskId(null);
    }
  };

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    
    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = `piapi-${selectedModel}-audio.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Audio scaricato!");
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Music className="w-5 h-5" />
          PIAPI Audio Generator
        </CardTitle>
        <CardDescription>
          Genera musica e audio con modelli AI avanzati via PIAPI
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Model Selection */}
        <div className="space-y-2">
          <Label>Modello AI</Label>
          <Select value={selectedModel} onValueChange={(v) => setSelectedModel(v as AudioModel)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AUDIO_MODELS.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{model.name}</span>
                    <span className="text-xs text-muted-foreground">{model.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Prompt */}
        <div className="space-y-2">
          <Label>Descrizione della musica</Label>
          <Textarea
            placeholder="Descrivi la musica che vuoi generare... Es: 'Energetic electronic music with heavy bass and synth arpeggios'"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
          />
        </div>

        {/* Style and Duration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Stile musicale</Label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona stile" />
              </SelectTrigger>
              <SelectContent>
                {STYLE_PRESETS.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Durata: {duration} secondi</Label>
            <Slider
              value={[duration]}
              onValueChange={(v) => setDuration(v[0])}
              min={5}
              max={currentModel.maxDuration}
              step={5}
            />
            <p className="text-xs text-muted-foreground">
              Max {currentModel.maxDuration}s per {currentModel.name}
            </p>
          </div>
        </div>

        {/* Generate Button */}
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generando con {currentModel.name}...
            </>
          ) : (
            <>
              <Music className="w-4 h-4 mr-2" />
              Genera Audio con {currentModel.name}
            </>
          )}
        </Button>

        {/* Audio Player */}
        {audioUrl && (
          <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border">
            <audio
              ref={audioRef}
              src={audioUrl}
              onEnded={() => setIsPlaying(false)}
              className="hidden"
            />
            
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePlayPause}
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
              
              <div className="flex-1">
                <p className="text-sm font-medium">Audio generato</p>
                <p className="text-xs text-muted-foreground">
                  {currentModel.name} - {duration}s
                </p>
              </div>
              
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDownload}
              >
                <Download className="w-4 h-4 mr-1" />
                Scarica
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
