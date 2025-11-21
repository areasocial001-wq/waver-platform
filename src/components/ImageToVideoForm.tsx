import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Sparkles, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const ImageToVideoForm = () => {
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState("5");
  const [motion, setMotion] = useState("medium");
  const [isLoading, setIsLoading] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error("Seleziona un file immagine valido");
        return;
      }
      setImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      toast.success("Immagine caricata con successo");
    }
  };

  const removeImage = () => {
    setImage(null);
    setImagePreview("");
  };

  const handleGenerate = () => {
    if (!image) {
      toast.error("Carica un'immagine prima di procedere");
      return;
    }

    setIsLoading(true);
    
    toast.success("Parametri pronti!", {
      description: "Ora puoi usare questi parametri con la tua installazione di Waver o un servizio API"
    });
    
    setIsLoading(false);
  };

  return (
    <div className="space-y-6">
      <Alert className="border-accent/30 bg-accent/5">
        <AlertCircle className="h-4 w-4 text-accent" />
        <AlertDescription>
          Carica un'immagine e configura i parametri. Waver è un modello open source - 
          dovrai hostarlo tu stesso o usare un servizio di terze parti per generare il video.
        </AlertDescription>
      </Alert>

      <div className="space-y-2">
        <Label>Immagine Sorgente</Label>
        {!imagePreview ? (
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-accent/50 transition-colors">
            <input
              type="file"
              id="image-upload"
              className="hidden"
              accept="image/*"
              onChange={handleImageChange}
            />
            <label
              htmlFor="image-upload"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <Upload className="w-12 h-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Clicca per caricare un'immagine
              </p>
              <p className="text-xs text-muted-foreground">
                PNG, JPG o WEBP (max 10MB)
              </p>
            </label>
          </div>
        ) : (
          <div className="relative rounded-lg overflow-hidden border border-border">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-full h-auto max-h-96 object-contain bg-muted"
            />
            <button
              onClick={removeImage}
              className="absolute top-2 right-2 p-2 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="i2v-prompt">Descrizione del Movimento (Opzionale)</Label>
        <Textarea
          id="i2v-prompt"
          placeholder="Descrivi come vuoi che l'immagine si animi..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="min-h-[100px] resize-none"
        />
        <p className="text-xs text-muted-foreground">
          Esempio: "La persona si muove lentamente verso la camera"
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="i2v-duration">Durata</Label>
          <Select value={duration} onValueChange={setDuration}>
            <SelectTrigger id="i2v-duration">
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
        disabled={isLoading || !image}
        className="w-full bg-gradient-accent text-accent-foreground hover:opacity-90 shadow-glow-accent transition-all duration-300"
        size="lg"
      >
        <Sparkles className="w-5 h-5 mr-2" />
        {isLoading ? "Preparazione..." : "Genera Video da Immagine"}
      </Button>

      {image && (
        <div className="p-4 rounded-lg bg-muted/30 border border-border">
          <p className="text-sm text-muted-foreground mb-2">
            <strong>Parametri selezionati:</strong>
          </p>
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Immagine:</span>
              <span className="font-medium">{image.name}</span>
            </div>
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
