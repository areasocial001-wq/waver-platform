import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Sparkles, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";

export const ImageToVideoForm = () => {
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState("6");
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

  const handleGenerate = async () => {
    if (!image) {
      toast.error("Carica un'immagine prima di procedere");
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

      // Save to database first
      const { data: generationData, error: dbError } = await supabase
        .from("video_generations")
        .insert({
          user_id: user.id,
          type: "image_to_video",
          prompt: prompt || "animate this image",
          duration: parseInt(duration),
          motion_intensity: motion,
          image_name: image.name,
          image_url: imagePreview,
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
            type: "image_to_video",
            prompt: prompt || "animate this image",
            image_url: imagePreview,
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
      
      setImage(null);
      setImagePreview("");
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
          Anima le tue immagini usando Google Veo 3. Carica un'immagine e descrivi come vuoi che si animi.
          La generazione richiede qualche minuto.
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
              <SelectItem value="4">4 secondi</SelectItem>
              <SelectItem value="6">6 secondi</SelectItem>
              <SelectItem value="8">8 secondi</SelectItem>
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
