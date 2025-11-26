import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Sparkles, Download, Save } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useImageGallery } from "@/contexts/ImageGalleryContext";

export const ImageGenerationForm = () => {
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [model, setModel] = useState("black-forest-labs/flux-schnell");
  const [isLoading, setIsLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const { addImage } = useImageGallery();

  const examplePrompts = [
    "A futuristic cityscape at sunset with flying cars",
    "Medieval fantasy castle surrounded by mystical forest",
    "Professional studio portrait photography setup",
    "Cyberpunk street scene with neon lights and rain"
  ];

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Inserisci una descrizione per l'immagine");
      return;
    }

    setIsLoading(true);
    setGeneratedImage(null);

    try {
      console.log("Calling generate-image function with:", { prompt, aspectRatio, model });

      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: { 
          prompt,
          aspectRatio,
          model,
          outputFormat: "webp",
          outputQuality: 90
        }
      });

      if (error) {
        console.error("Edge function error:", error);
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.imageUrl) {
        setGeneratedImage(data.imageUrl);
        toast.success("Immagine generata con successo!");
      } else {
        throw new Error("Nessun URL immagine ricevuto");
      }

    } catch (error: any) {
      console.error("Error generating image:", error);
      toast.error(error.message || "Errore nella generazione dell'immagine");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (generatedImage) {
      window.open(generatedImage, '_blank');
    }
  };

  const handleSaveToGallery = () => {
    if (generatedImage) {
      addImage({
        url: generatedImage,
        prompt,
        aspectRatio,
        model,
      });
      toast.success("Immagine salvata nella galleria!");
    }
  };

  return (
    <div className="space-y-6">
      <Alert className="border-accent/50 bg-accent/10">
        <Sparkles className="h-4 w-4 text-accent" />
        <AlertDescription>
          Genera immagini professionali per scenografie e storyboard usando Replicate Flux AI
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="prompt">Descrizione Immagine *</Label>
          <Textarea
            id="prompt"
            placeholder="Descrivi l'immagine che vuoi creare in dettaglio..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            className="resize-none bg-background/50 border-border"
          />
          <div className="flex flex-wrap gap-2 mt-2">
            {examplePrompts.map((example, idx) => (
              <button
                key={idx}
                onClick={() => setPrompt(example)}
                className="text-xs px-3 py-1 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="aspectRatio">Aspect Ratio</Label>
            <Select value={aspectRatio} onValueChange={setAspectRatio}>
              <SelectTrigger id="aspectRatio" className="bg-background/50 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1:1">Quadrato (1:1)</SelectItem>
                <SelectItem value="16:9">Panoramico (16:9)</SelectItem>
                <SelectItem value="9:16">Verticale (9:16)</SelectItem>
                <SelectItem value="4:3">Standard (4:3)</SelectItem>
                <SelectItem value="3:4">Ritratto (3:4)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="model">Modello</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger id="model" className="bg-background/50 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="black-forest-labs/flux-schnell">Flux Schnell (Veloce)</SelectItem>
                <SelectItem value="black-forest-labs/flux-dev">Flux Dev (Qualità Alta)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button 
          onClick={handleGenerate}
          disabled={isLoading || !prompt.trim()}
          className="w-full bg-gradient-to-r from-accent to-accent/80 hover:from-accent/90 hover:to-accent/70 text-accent-foreground"
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generazione in corso...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Genera Immagine
            </>
          )}
        </Button>

        {generatedImage && (
          <Card className="p-4 space-y-4 border-accent/20 bg-card/50">
            <div className="relative rounded-lg overflow-hidden">
              <img 
                src={generatedImage} 
                alt="Generated" 
                className="w-full h-auto"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button 
                onClick={handleSaveToGallery}
                variant="default"
                className="w-full bg-gradient-to-r from-primary to-primary/80"
              >
                <Save className="mr-2 h-4 w-4" />
                Salva in Galleria
              </Button>
              <Button 
                onClick={handleDownload}
                variant="outline"
                className="w-full"
              >
                <Download className="mr-2 h-4 w-4" />
                Scarica
              </Button>
            </div>
          </Card>
        )}

        {!generatedImage && !isLoading && (
          <p className="text-sm text-muted-foreground text-center">
            Aspect Ratio: <span className="font-medium text-foreground">{aspectRatio}</span> • 
            Modello: <span className="font-medium text-foreground">
              {model === "black-forest-labs/flux-schnell" ? "Flux Schnell" : "Flux Dev"}
            </span>
          </p>
        )}
      </div>
    </div>
  );
};