import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Sparkles, Download, Save, Upload, X, ImageIcon, Images, Wand2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useImageGallery } from "@/contexts/ImageGalleryContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

const imageFilters = [
  { id: "vintage", name: "Vintage", prompt: "Apply vintage film photography style with warm tones, grain, and faded colors" },
  { id: "hdr", name: "HDR", prompt: "Apply HDR effect with enhanced dynamic range, vivid colors and sharp details" },
  { id: "bw", name: "Bianco e Nero", prompt: "Convert to high contrast black and white with dramatic shadows" },
  { id: "cinematic", name: "Cinematico", prompt: "Apply cinematic color grading with film-like tones and letterbox feel" },
  { id: "watercolor", name: "Acquerello", prompt: "Transform into watercolor painting style with soft edges and flowing colors" },
  { id: "oil-painting", name: "Pittura a Olio", prompt: "Transform into oil painting style with visible brush strokes and rich textures" },
  { id: "pop-art", name: "Pop Art", prompt: "Apply pop art style with bold colors, halftone patterns and graphic look" },
  { id: "neon", name: "Neon Glow", prompt: "Add neon glow effects with vibrant electric colors and light trails" },
  { id: "sketch", name: "Schizzo", prompt: "Convert to pencil sketch style with detailed line work" },
  { id: "anime", name: "Anime", prompt: "Transform into anime/manga art style with cel shading" },
];

export const ImageGenerationForm = () => {
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [model, setModel] = useState("black-forest-labs/flux-schnell");
  const [isLoading, setIsLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceFileName, setReferenceFileName] = useState<string | null>(null);
  const [showGalleryPicker, setShowGalleryPicker] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { images, addImage } = useImageGallery();

  const examplePrompts = [
    "A futuristic cityscape at sunset with flying cars",
    "Medieval fantasy castle surrounded by mystical forest",
    "Professional studio portrait photography setup",
    "Cyberpunk street scene with neon lights and rain"
  ];

  const editPrompts = [
    "Make it look like sunset",
    "Add dramatic lighting",
    "Convert to watercolor style",
    "Make it more vibrant and colorful"
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Per favore seleziona un file immagine");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("L'immagine deve essere inferiore a 10MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setReferenceImage(result);
      setReferenceFileName(file.name);
      toast.success("Immagine di riferimento caricata!");
    };
    reader.onerror = () => {
      toast.error("Errore nel caricamento dell'immagine");
    };
    reader.readAsDataURL(file);
  };

  const removeReferenceImage = () => {
    setReferenceImage(null);
    setReferenceFileName(null);
    setSelectedFilter(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const selectFromGallery = (imageUrl: string, imagePrompt: string) => {
    setReferenceImage(imageUrl);
    setReferenceFileName(`Dalla galleria: ${imagePrompt.substring(0, 30)}...`);
    setShowGalleryPicker(false);
    toast.success("Immagine dalla galleria selezionata!");
  };

  const applyFilter = (filterId: string) => {
    const filter = imageFilters.find(f => f.id === filterId);
    if (filter) {
      setSelectedFilter(filterId);
      setPrompt(filter.prompt);
      toast.success(`Filtro "${filter.name}" applicato!`);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Inserisci una descrizione per l'immagine");
      return;
    }

    setIsLoading(true);
    setGeneratedImage(null);

    try {
      if (referenceImage) {
        // Use Lovable AI for image editing
        console.log("Editing image with Lovable AI...");
        
        const { data, error } = await supabase.functions.invoke('edit-image', {
          body: { 
            prompt,
            referenceImage
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
          toast.success("Immagine modificata con successo!");
        } else {
          throw new Error("Nessun URL immagine ricevuto");
        }
      } else {
        // Standard image generation
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
      }

    } catch (error: any) {
      console.error("Error generating/editing image:", error);
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
        model: referenceImage ? "lovable-ai-edit" : model,
      });
      toast.success("Immagine salvata nella galleria!");
    }
  };

  return (
    <div className="space-y-6">
      <Alert className="border-accent/50 bg-accent/10">
        <Sparkles className="h-4 w-4 text-accent" />
        <AlertDescription>
          {referenceImage 
            ? "Modifica l'immagine caricata descrivendo le modifiche desiderate"
            : "Genera immagini professionali per scenografie e storyboard usando Replicate Flux AI"
          }
        </AlertDescription>
      </Alert>

      {/* Reference Image Upload Section */}
      <div className="space-y-2">
        <Label>Immagine di Riferimento (Opzionale)</Label>
        <div className="border-2 border-dashed border-border rounded-lg p-4 transition-colors hover:border-accent/50">
          {referenceImage ? (
            <div className="space-y-3">
              <div className="relative inline-block">
                <img 
                  src={referenceImage} 
                  alt="Reference" 
                  className="max-h-40 rounded-lg object-contain"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6"
                  onClick={removeReferenceImage}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                {referenceFileName}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-4 gap-3">
              <div className="p-3 rounded-full bg-muted">
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">Carica immagine di riferimento</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Carica File
                </Button>
                <Dialog open={showGalleryPicker} onOpenChange={setShowGalleryPicker}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={images.length === 0}
                    >
                      <Images className="mr-2 h-4 w-4" />
                      Dalla Galleria ({images.length})
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Seleziona dalla Galleria</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="h-[400px] pr-4">
                      {images.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                          <ImageIcon className="h-12 w-12 mb-2" />
                          <p>Nessuna immagine nella galleria</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {images.map((img) => (
                            <div
                              key={img.id}
                              className="relative group cursor-pointer rounded-lg overflow-hidden border border-border hover:border-accent transition-colors"
                              onClick={() => selectFromGallery(img.url, img.prompt)}
                            >
                              <img
                                src={img.url}
                                alt={img.prompt}
                                className="w-full h-32 object-cover"
                              />
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <p className="text-white text-xs px-2 text-center line-clamp-2">
                                  {img.prompt}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
              </div>
              <p className="text-xs text-muted-foreground">
                Seleziona un'immagine da modificare
              </p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* Preset Filters Section */}
      {referenceImage && (
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Wand2 className="h-4 w-4" />
            Filtri Predefiniti
          </Label>
          <div className="flex flex-wrap gap-2">
            {imageFilters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => applyFilter(filter.id)}
                className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                  selectedFilter === filter.id
                    ? "bg-accent text-accent-foreground"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                }`}
              >
                {filter.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="prompt">
            {referenceImage ? "Descrivi le modifiche *" : "Descrizione Immagine *"}
          </Label>
          <Textarea
            id="prompt"
            placeholder={referenceImage 
              ? "Descrivi come vuoi modificare l'immagine..." 
              : "Descrivi l'immagine che vuoi creare in dettaglio..."
            }
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            className="resize-none bg-background/50 border-border"
          />
          <div className="flex flex-wrap gap-2 mt-2">
            {(referenceImage ? editPrompts : examplePrompts).map((example, idx) => (
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

        {!referenceImage && (
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
        )}

        <Button 
          onClick={handleGenerate}
          disabled={isLoading || !prompt.trim()}
          className="w-full bg-gradient-to-r from-accent to-accent/80 hover:from-accent/90 hover:to-accent/70 text-accent-foreground"
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {referenceImage ? "Modifica in corso..." : "Generazione in corso..."}
            </>
          ) : (
            <>
              {referenceImage ? <Upload className="mr-2 h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {referenceImage ? "Modifica Immagine" : "Genera Immagine"}
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

        {!generatedImage && !isLoading && !referenceImage && (
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