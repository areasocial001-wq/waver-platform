import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const TextToVideoForm = () => {
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState("5");
  const [resolution, setResolution] = useState("720p");
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast.error("Inserisci una descrizione per il video");
      return;
    }

    setIsLoading(true);
    
    // Simulate generation process
    toast.info("Preparazione della richiesta...", {
      description: "Verrai reindirizzato al bot Discord di Waver"
    });

    setTimeout(() => {
      setIsLoading(false);
      toast.success("Pronto!", {
        description: "Usa il comando sul Discord di Waver per generare il video"
      });
    }, 2000);
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
          Questa piattaforma si integra con il bot Discord di Waver. Dopo aver preparato i parametri, 
          utilizza il bot Discord per generare il video.
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="duration">Durata</Label>
          <Select value={duration} onValueChange={setDuration}>
            <SelectTrigger id="duration">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2">2 secondi</SelectItem>
              <SelectItem value="5">5 secondi</SelectItem>
              <SelectItem value="10">10 secondi</SelectItem>
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
