import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Sparkles, 
  Video, 
  ZoomIn, 
  Search, 
  Download, 
  Loader2, 
  Image as ImageIcon,
  ArrowUpRight,
  Wand2,
  RefreshCw
} from "lucide-react";
import { useImageGallery } from "@/contexts/ImageGalleryContext";

// Mystic Image Generation Component
const MysticImageGenerator = () => {
  const [prompt, setPrompt] = useState("");
  const [resolution, setResolution] = useState("1k");
  const [aspectRatio, setAspectRatio] = useState("square_1_1");
  const [model, setModel] = useState("realism");
  const [engine, setEngine] = useState("automatic");
  const [isLoading, setIsLoading] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const { addImage } = useImageGallery();

  useEffect(() => {
    if (!taskId) return;
    
    const pollStatus = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("freepik-image", {
          body: { action: "status", taskId },
        });

        if (error) throw error;

        if (data?.data?.status === "COMPLETED" && data?.data?.generated?.[0]?.url) {
          setGeneratedImage(data.data.generated[0].url);
          setTaskId(null);
          setIsLoading(false);
          setProgress(100);
          toast.success("Immagine Mystic generata!");
        } else if (data?.data?.status === "FAILED") {
          setTaskId(null);
          setIsLoading(false);
          toast.error("Generazione fallita");
        } else {
          setProgress((prev) => Math.min(prev + 5, 90));
        }
      } catch (err: any) {
        console.error("Poll error:", err);
      }
    };

    const interval = setInterval(pollStatus, 3000);
    return () => clearInterval(interval);
  }, [taskId]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Inserisci una descrizione");
      return;
    }

    setIsLoading(true);
    setProgress(10);
    setGeneratedImage(null);

    try {
      const { data, error } = await supabase.functions.invoke("freepik-image", {
        body: { prompt, resolution, aspectRatio, model, engine },
      });

      if (error) throw error;

      if (data?.data?.task_id) {
        setTaskId(data.data.task_id);
        toast.info("Generazione avviata...");
      } else if (data?.data?.generated?.[0]?.url) {
        setGeneratedImage(data.data.generated[0].url);
        setIsLoading(false);
        setProgress(100);
        toast.success("Immagine generata!");
      }
    } catch (err: any) {
      console.error("Generate error:", err);
      toast.error(err.message || "Errore generazione");
      setIsLoading(false);
    }
  };

  const handleSaveToGallery = () => {
    if (generatedImage) {
      addImage({ url: generatedImage, prompt, aspectRatio, model: `freepik-mystic-${model}` });
      toast.success("Salvata nella galleria!");
    }
  };

  return (
    <div className="space-y-4">
      <Alert className="border-accent/50 bg-accent/10">
        <Sparkles className="h-4 w-4 text-accent" />
        <AlertDescription>
          Genera immagini fotorealistiche fino a 4K con Freepik Mystic AI
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Prompt</Label>
          <Textarea
            placeholder="Descrivi l'immagine che vuoi creare..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Risoluzione</Label>
            <Select value={resolution} onValueChange={setResolution}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1k">1K</SelectItem>
                <SelectItem value="2k">2K</SelectItem>
                <SelectItem value="4k">4K</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Aspect Ratio</Label>
            <Select value={aspectRatio} onValueChange={setAspectRatio}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="square_1_1">1:1</SelectItem>
                <SelectItem value="widescreen_16_9">16:9</SelectItem>
                <SelectItem value="portrait_9_16">9:16</SelectItem>
                <SelectItem value="classic_4_3">4:3</SelectItem>
                <SelectItem value="classic_3_4">3:4</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Modello</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="realism">Realism</SelectItem>
                <SelectItem value="super_real">Super Real</SelectItem>
                <SelectItem value="editorial_portraits">Editorial</SelectItem>
                <SelectItem value="fluid">Fluid</SelectItem>
                <SelectItem value="zen">Zen</SelectItem>
                <SelectItem value="flexible">Flexible</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Engine</Label>
            <Select value={engine} onValueChange={setEngine}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="automatic">Automatico</SelectItem>
                <SelectItem value="magnific_sharpy">Sharpy</SelectItem>
                <SelectItem value="magnific_sparkle">Sparkle</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={handleGenerate} disabled={isLoading} className="w-full">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generando...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Genera Immagine
            </>
          )}
        </Button>

        {isLoading && <Progress value={progress} className="h-2" />}

        {generatedImage && (
          <Card>
            <CardContent className="p-4">
              <img src={generatedImage} alt="Generated" className="w-full rounded-lg" />
              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={handleSaveToGallery} className="flex-1">
                  Salva in Galleria
                </Button>
                <Button variant="outline" onClick={() => window.open(generatedImage, "_blank")} className="flex-1">
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

// Magnific Upscaler Component
const MagnificUpscaler = () => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [mode, setMode] = useState<"creative" | "precision">("creative");
  const [scaleFactor, setScaleFactor] = useState("2x");
  const [optimizedFor, setOptimizedFor] = useState("standard");
  const [prompt, setPrompt] = useState("");
  const [creativity, setCreativity] = useState(0);
  const [hdr, setHdr] = useState(0);
  const [resemblance, setResemblance] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [upscaledImage, setUpscaledImage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!taskId) return;
    
    const pollStatus = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("freepik-upscale", {
          body: { action: "status", taskId, mode },
        });

        if (error) throw error;

        if (data?.data?.status === "COMPLETED" && data?.data?.generated?.[0]?.url) {
          setUpscaledImage(data.data.generated[0].url);
          setTaskId(null);
          setIsLoading(false);
          setProgress(100);
          toast.success("Immagine upscalata!");
        } else if (data?.data?.status === "FAILED") {
          setTaskId(null);
          setIsLoading(false);
          toast.error("Upscaling fallito");
        } else {
          setProgress((prev) => Math.min(prev + 3, 90));
        }
      } catch (err: any) {
        console.error("Poll error:", err);
      }
    };

    const interval = setInterval(pollStatus, 4000);
    return () => clearInterval(interval);
  }, [taskId, mode]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
      setUpscaledImage(null);
    }
  };

  const handleUpscale = async () => {
    if (!imageFile) {
      toast.error("Seleziona un'immagine");
      return;
    }

    setIsLoading(true);
    setProgress(10);
    setUpscaledImage(null);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(",")[1];

        const body: any = {
          image: base64,
          scaleFactor,
          mode,
        };

        if (mode === "creative") {
          body.optimizedFor = optimizedFor;
          if (prompt) body.prompt = prompt;
          body.creativity = creativity;
          body.hdr = hdr;
          body.resemblance = resemblance;
        } else {
          body.optimizedFor = optimizedFor;
        }

        const { data, error } = await supabase.functions.invoke("freepik-upscale", { body });

        if (error) throw error;

        if (data?.data?.task_id) {
          setTaskId(data.data.task_id);
          toast.info("Upscaling avviato...");
        } else if (data?.data?.generated?.[0]?.url) {
          setUpscaledImage(data.data.generated[0].url);
          setIsLoading(false);
          setProgress(100);
          toast.success("Immagine upscalata!");
        }
      };
      reader.readAsDataURL(imageFile);
    } catch (err: any) {
      console.error("Upscale error:", err);
      toast.error(err.message || "Errore upscaling");
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Alert className="border-primary/50 bg-primary/10">
        <ZoomIn className="h-4 w-4 text-primary" />
        <AlertDescription>
          Upscala le tue immagini fino a 16x con Magnific AI
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Immagine da upscalare</Label>
          <Input type="file" accept="image/*" onChange={handleFileChange} />
          {imagePreview && (
            <img src={imagePreview} alt="Preview" className="max-h-48 rounded-lg mt-2" />
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Modalità</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as "creative" | "precision")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="creative">Creative</SelectItem>
                <SelectItem value="precision">Precision</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Scala</Label>
            <Select value={scaleFactor} onValueChange={setScaleFactor}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2x">2x</SelectItem>
                <SelectItem value="4x">4x</SelectItem>
                <SelectItem value="8x">8x</SelectItem>
                <SelectItem value="16x">16x</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Ottimizzato per</Label>
            <Select value={optimizedFor} onValueChange={setOptimizedFor}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {mode === "creative" ? (
                  <>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="soft_portraits">Ritratti Soft</SelectItem>
                    <SelectItem value="hard_portraits">Ritratti Nitidi</SelectItem>
                    <SelectItem value="art_n_illustration">Arte/Illustrazione</SelectItem>
                    <SelectItem value="films_n_photography">Film/Fotografia</SelectItem>
                    <SelectItem value="3d_renders">3D Renders</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="photo">Foto</SelectItem>
                    <SelectItem value="sublime">Sublime</SelectItem>
                    <SelectItem value="photo_denoiser">Photo Denoiser</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {mode === "creative" && (
          <>
            <div className="space-y-2">
              <Label>Prompt guida (opzionale)</Label>
              <Input 
                placeholder="Descrizione per guidare l'upscaling..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Creatività: {creativity}</Label>
                <Slider value={[creativity]} onValueChange={(v) => setCreativity(v[0])} min={-10} max={10} step={1} />
              </div>
              <div className="space-y-2">
                <Label>HDR: {hdr}</Label>
                <Slider value={[hdr]} onValueChange={(v) => setHdr(v[0])} min={-10} max={10} step={1} />
              </div>
              <div className="space-y-2">
                <Label>Somiglianza: {resemblance}</Label>
                <Slider value={[resemblance]} onValueChange={(v) => setResemblance(v[0])} min={-10} max={10} step={1} />
              </div>
            </div>
          </>
        )}

        <Button onClick={handleUpscale} disabled={isLoading || !imageFile} className="w-full">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Upscaling...
            </>
          ) : (
            <>
              <ZoomIn className="mr-2 h-4 w-4" />
              Upscala Immagine
            </>
          )}
        </Button>

        {isLoading && <Progress value={progress} className="h-2" />}

        {upscaledImage && (
          <Card>
            <CardContent className="p-4">
              <img src={upscaledImage} alt="Upscaled" className="w-full rounded-lg" />
              <Button variant="outline" onClick={() => window.open(upscaledImage, "_blank")} className="w-full mt-4">
                <Download className="mr-2 h-4 w-4" />
                Download Immagine HD
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

// Stock Library Component
const StockLibrary = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [contentType, setContentType] = useState("resources");
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { addImage } = useImageGallery();

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      toast.error("Inserisci un termine di ricerca");
      return;
    }

    setIsLoading(true);
    setResults([]);

    try {
      const { data, error } = await supabase.functions.invoke("freepik-stock", {
        body: { term: searchTerm, contentType, limit: 20 },
      });

      if (error) throw error;

      setResults(data?.data || []);
      toast.success(`Trovati ${data?.data?.length || 0} risultati`);
    } catch (err: any) {
      console.error("Search error:", err);
      toast.error(err.message || "Errore ricerca");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (item: any) => {
    try {
      const { data, error } = await supabase.functions.invoke("freepik-stock", {
        body: { action: "download", resourceId: item.id },
      });

      if (error) {
        const msg = (error as any)?.message || "";
        if (msg.includes("403")) {
          toast.warning("Download HD non autorizzato per questo asset. Apro la pagina dell'asset.");
          if (item?.url) window.open(item.url, "_blank");
          return;
        }
        throw error;
      }

      if (data?.data?.url) {
        window.open(data.data.url, "_blank");
        toast.success("Download avviato!");
      }
    } catch (err: any) {
      console.error("Download error:", err);
      toast.error(err.message || "Errore download");
    }
  };

  const handleAddToGallery = (item: any) => {
    const imageUrl = item.preview?.url || item.thumbnails?.[0]?.url || item.image?.url;
    if (imageUrl) {
      addImage({
        url: imageUrl,
        prompt: item.title || searchTerm,
        aspectRatio: "1:1",
        model: "freepik-stock",
      });
      toast.success("Aggiunto alla galleria!");
    }
  };

  return (
    <div className="space-y-4">
      <Alert className="border-secondary/50 bg-secondary/10">
        <Search className="h-4 w-4 text-secondary-foreground" />
        <AlertDescription>
          Cerca tra 100+ milioni di asset: foto, vettori, icone e video
        </AlertDescription>
      </Alert>

      <div className="flex gap-2">
        <Input 
          placeholder="Cerca immagini, icone, video..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="flex-1"
        />
        <Select value={contentType} onValueChange={setContentType}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="resources">Immagini</SelectItem>
            <SelectItem value="icons">Icone</SelectItem>
            <SelectItem value="videos">Video</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleSearch} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      <ScrollArea className="h-[400px]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {results.map((item: any) => (
            <Card key={item.id} className="overflow-hidden group">
              <div className="relative aspect-square">
                <img 
                  src={item.preview?.url || item.thumbnails?.[0]?.url || item.image?.url}
                  alt={item.title}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => handleAddToGallery(item)}>
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => handleDownload(item)}>
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <CardContent className="p-2">
                <p className="text-xs truncate text-muted-foreground">{item.title}</p>
                {item.licenses?.some((l: any) => l?.type === "premium") && (
                  <Badge variant="secondary" className="text-xs mt-1">Premium</Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

// Main FreepikTools Component
export const FreepikTools = () => {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Freepik AI Tools
        </h2>
        <p className="text-muted-foreground">
          Genera immagini, upscala e cerca contenuti stock
        </p>
      </div>

      <Tabs defaultValue="mystic" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="mystic" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Mystic</span>
          </TabsTrigger>
          <TabsTrigger value="upscale" className="flex items-center gap-2">
            <ZoomIn className="h-4 w-4" />
            <span className="hidden sm:inline">Upscaler</span>
          </TabsTrigger>
          <TabsTrigger value="stock" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Stock</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mystic" className="mt-6">
          <MysticImageGenerator />
        </TabsContent>

        <TabsContent value="upscale" className="mt-6">
          <MagnificUpscaler />
        </TabsContent>

        <TabsContent value="stock" className="mt-6">
          <StockLibrary />
        </TabsContent>
      </Tabs>
    </div>
  );
};
