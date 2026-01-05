import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Upload, Sparkles, X, Video, Image, Play, Loader2, Info, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";

export const MotionControlForm = () => {
  const [characterImage, setCharacterImage] = useState<string | null>(null);
  const [characterImageName, setCharacterImageName] = useState<string>("");
  const [motionVideo, setMotionVideo] = useState<string | null>(null);
  const [motionVideoName, setMotionVideoName] = useState<string>("");
  const [motionVideoPreview, setMotionVideoPreview] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [characterOrientation, setCharacterOrientation] = useState<"video" | "image">("video");
  const [keepOriginalSound, setKeepOriginalSound] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const compressImage = (file: File, maxWidth: number = 1280, quality: number = 0.85): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      const reader = new FileReader();
      
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      reader.onerror = () => reject(new Error('Failed to read file'));
      
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Seleziona un file immagine valido");
      return;
    }

    try {
      toast.info("Ottimizzazione immagine...");
      const compressed = await compressImage(file);
      setCharacterImage(compressed);
      setCharacterImageName(file.name);
      toast.success("Immagine personaggio caricata!");
    } catch (error) {
      toast.error("Errore nel caricamento dell'immagine");
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      toast.error("Seleziona un file video valido");
      return;
    }

    // Check file size (max 100MB)
    if (file.size > 100 * 1024 * 1024) {
      toast.error("Il video deve essere inferiore a 100MB");
      return;
    }

    try {
      // Create blob URL for preview
      const videoUrl = URL.createObjectURL(file);
      setMotionVideoPreview(videoUrl);
      
      // Read as base64 for API
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setMotionVideo(base64);
        setMotionVideoName(file.name);
        toast.success("Video di riferimento caricato!");
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error("Errore nel caricamento del video");
    }
  };

  const handleGenerate = async () => {
    if (!characterImage) {
      toast.error("Carica l'immagine del personaggio");
      return;
    }

    if (!motionVideo) {
      toast.error("Carica il video di riferimento per i movimenti");
      return;
    }

    setIsLoading(true);
    setProgress(0);
    setGeneratedVideoUrl(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Devi effettuare l'accesso");
        return;
      }

      // Save to database
      const { data: generationData, error: dbError } = await supabase
        .from("video_generations")
        .insert({
          user_id: user.id,
          type: "image_to_video",
          prompt: prompt || "Motion control video",
          duration: characterOrientation === "video" ? 30 : 10,
          motion_intensity: "motion_control",
          image_name: `Motion Control: ${characterImageName}`,
          image_url: characterImage,
          status: "processing",
          provider: "piapi-kling-2.6"
        })
        .select()
        .single();

      if (dbError) throw dbError;

      toast.success("Generazione Motion Control avviata!", {
        description: "Il personaggio eseguirà i movimenti del video di riferimento..."
      });

      setProgress(10);

      // Call the edge function with motion control parameters
      const { data, error } = await supabase.functions.invoke("generate-video", {
        body: {
          type: "image_to_video",
          start_image: characterImage,
          motion_video: motionVideo,
          motion_control: true,
          character_orientation: characterOrientation,
          keep_original_sound: keepOriginalSound,
          prompt: prompt || "Smooth motion transfer",
          preferredProvider: "piapi-kling-2.6-motion",
          generationId: generationData.id
        }
      });

      if (error) throw error;

      setProgress(30);

      // Poll for result
      if (data?.operationId) {
        let attempts = 0;
        const maxAttempts = 120; // 6 minutes max

        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 3000));
          attempts++;
          
          setProgress(30 + Math.min(60, (attempts / maxAttempts) * 60));

          const { data: pollData, error: pollError } = await supabase.functions.invoke("generate-video", {
            body: { operationId: data.operationId, generationId: generationData.id }
          });

          if (pollError) throw pollError;

          if (pollData?.status === "succeeded" && pollData?.output) {
            setGeneratedVideoUrl(pollData.output);
            setProgress(100);
            toast.success("Video Motion Control generato!");
            break;
          } else if (pollData?.status === "failed") {
            throw new Error(pollData?.error || "Generazione fallita");
          }
        }

        if (attempts >= maxAttempts) {
          throw new Error("Timeout nella generazione");
        }
      }

    } catch (error: any) {
      console.error("Motion control error:", error);
      toast.error(error.message || "Errore nella generazione");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Alert className="border-primary/30 bg-primary/5">
        <Wand2 className="h-4 w-4 text-primary" />
        <AlertDescription>
          <strong>Kling 2.6 Motion Control</strong> - Trasferisci i movimenti da un video di riferimento 
          a qualsiasi personaggio. Il personaggio nell'immagine eseguirà esattamente le stesse azioni 
          e espressioni del video di riferimento.
        </AlertDescription>
      </Alert>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Character Image Upload */}
        <Card className="border-dashed border-2 hover:border-primary/50 transition-colors">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Image className="w-4 h-4 text-primary" />
              Immagine Personaggio
            </CardTitle>
            <CardDescription className="text-xs">
              Carica l'immagine del personaggio da animare
            </CardDescription>
          </CardHeader>
          <CardContent>
            {characterImage ? (
              <div className="relative">
                <img 
                  src={characterImage} 
                  alt="Character" 
                  className="w-full h-48 object-cover rounded-lg"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6"
                  onClick={() => {
                    setCharacterImage(null);
                    setCharacterImageName("");
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
                <p className="text-xs text-muted-foreground mt-2 truncate">{characterImageName}</p>
              </div>
            ) : (
              <div 
                className="flex flex-col items-center justify-center h-48 cursor-pointer"
                onClick={() => imageInputRef.current?.click()}
              >
                <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Clicca per caricare</p>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG (max 10MB)</p>
              </div>
            )}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </CardContent>
        </Card>

        {/* Motion Video Upload */}
        <Card className="border-dashed border-2 hover:border-accent/50 transition-colors">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Video className="w-4 h-4 text-accent" />
              Video Riferimento Movimenti
            </CardTitle>
            <CardDescription className="text-xs">
              Carica il video con i movimenti da trasferire
            </CardDescription>
          </CardHeader>
          <CardContent>
            {motionVideo ? (
              <div className="relative">
                <video 
                  src={motionVideoPreview} 
                  className="w-full h-48 object-cover rounded-lg"
                  controls
                  muted
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6"
                  onClick={() => {
                    setMotionVideo(null);
                    setMotionVideoName("");
                    setMotionVideoPreview("");
                    if (motionVideoPreview) URL.revokeObjectURL(motionVideoPreview);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
                <p className="text-xs text-muted-foreground mt-2 truncate">{motionVideoName}</p>
              </div>
            ) : (
              <div 
                className="flex flex-col items-center justify-center h-48 cursor-pointer"
                onClick={() => videoInputRef.current?.click()}
              >
                <Play className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Clicca per caricare</p>
                <p className="text-xs text-muted-foreground mt-1">MP4, MOV (max 100MB, 3-30s)</p>
              </div>
            )}
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              onChange={handleVideoUpload}
              className="hidden"
            />
          </CardContent>
        </Card>
      </div>

      {/* Options */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Orientamento Personaggio</Label>
          <Select 
            value={characterOrientation} 
            onValueChange={(v) => setCharacterOrientation(v as "video" | "image")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="video">
                <div className="flex flex-col">
                  <span>Segue Video (max 30s)</span>
                  <span className="text-xs text-muted-foreground">Migliore per movimenti complessi</span>
                </div>
              </SelectItem>
              <SelectItem value="image">
                <div className="flex flex-col">
                  <span>Segue Immagine (max 10s)</span>
                  <span className="text-xs text-muted-foreground">Migliore per movimenti di camera</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Audio Originale</Label>
          <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
            <div>
              <p className="text-sm font-medium">Mantieni audio del video</p>
              <p className="text-xs text-muted-foreground">L'audio del video di riferimento sarà incluso</p>
            </div>
            <Switch
              checked={keepOriginalSound}
              onCheckedChange={setKeepOriginalSound}
            />
          </div>
        </div>
      </div>

      {/* Prompt */}
      <div className="space-y-2">
        <Label>Prompt (opzionale)</Label>
        <Textarea
          placeholder="Descrivi elementi aggiuntivi come sfondo, effetti, stile..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground">
          Usa il prompt per controllare elementi di sfondo e altri dettagli
        </p>
      </div>

      {/* Tips */}
      <Card className="bg-muted/30">
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" />
            Suggerimenti per risultati ottimali
          </CardTitle>
        </CardHeader>
        <CardContent className="py-0 pb-4">
          <ul className="text-xs text-muted-foreground space-y-1.5">
            <li>• L'immagine del personaggio deve mostrare il corpo intero o il busto visibile</li>
            <li>• Il video di riferimento deve contenere una persona reale con movimenti fluidi</li>
            <li>• Evita tagli e movimenti di camera nel video di riferimento</li>
            <li>• Le proporzioni del personaggio nell'immagine devono corrispondere a quelle nel video</li>
            <li>• Per movimenti complessi usa "Segue Video", per controllo camera usa "Segue Immagine"</li>
          </ul>
        </CardContent>
      </Card>

      {/* Progress */}
      {isLoading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Generazione in corso...</span>
            <span className="text-sm font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {/* Generate Button */}
      <Button 
        onClick={handleGenerate}
        disabled={isLoading || !characterImage || !motionVideo}
        className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
        size="lg"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generazione Motion Control...
          </>
        ) : (
          <>
            <Wand2 className="mr-2 h-4 w-4" />
            Genera Video con Motion Control
          </>
        )}
      </Button>

      {/* Result */}
      {generatedVideoUrl && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Video Generato
            </CardTitle>
          </CardHeader>
          <CardContent>
            <video 
              src={generatedVideoUrl}
              controls
              className="w-full rounded-lg"
            />
            <div className="flex gap-2 mt-3">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => window.open(generatedVideoUrl, '_blank')}
              >
                Apri in nuova scheda
              </Button>
              <Button 
                variant="default"
                className="flex-1"
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = generatedVideoUrl;
                  a.download = 'motion-control-video.mp4';
                  a.click();
                }}
              >
                Scarica
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
