import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sanitizeRemovalPrompt, hasWatermarkTerms } from "@/lib/promptSanitizer";
import { InpaintingCanvas } from "@/components/InpaintingCanvas";
import { 
  Play, 
  Pause, 
  Camera, 
  Eraser, 
  Download, 
  Loader2, 
  Upload,
  ImageIcon,
  Trash2,
  RotateCcw,
  Video,
  Wand2,
  Paintbrush,
  AlertTriangle
} from "lucide-react";

interface ExtractedFrame {
  id: string;
  timestamp: number;
  imageData: string;
  editedImageData?: string;
  isProcessing?: boolean;
  maskData?: string;
}

export function VideoTextRemover() {
  const navigate = useNavigate();
  const [videoUrl, setVideoUrl] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [frames, setFrames] = useState<ExtractedFrame[]>([]);
  const [selectedFrame, setSelectedFrame] = useState<ExtractedFrame | null>(null);
  const [removalPrompt, setRemovalPrompt] = useState("Remove all visible text (subtitles, captions, signs) from this image. Keep the background and all other elements intact. Make it look natural.");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [regeneratePrompt, setRegeneratePrompt] = useState("");
  const [regenerateDuration, setRegenerateDuration] = useState("5");
  const [useInpainting, setUseInpainting] = useState(true);
  const [showInpaintingCanvas, setShowInpaintingCanvas] = useState(false);
  const [frameForInpainting, setFrameForInpainting] = useState<ExtractedFrame | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setFrames([]);
      setSelectedFrame(null);
    }
  };

  const handleUrlChange = (url: string) => {
    setVideoUrl(url);
    setVideoFile(null);
    setFrames([]);
    setSelectedFrame(null);
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (value: number[]) => {
    if (videoRef.current) {
      videoRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const extractCurrentFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = canvas.toDataURL("image/png");
    const newFrame: ExtractedFrame = {
      id: `frame-${Date.now()}`,
      timestamp: currentTime,
      imageData,
    };

    setFrames((prev) => [...prev, newFrame]);
    toast.success(`Frame estratto a ${formatTime(currentTime)}`);
  }, [currentTime]);

  const extractMultipleFrames = async (count: number) => {
    if (!videoRef.current || !canvasRef.current || duration === 0) return;

    setIsExtracting(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      setIsExtracting(false);
      return;
    }

    const interval = duration / (count + 1);
    const newFrames: ExtractedFrame[] = [];

    for (let i = 1; i <= count; i++) {
      const timestamp = interval * i;
      
      await new Promise<void>((resolve) => {
        video.currentTime = timestamp;
        video.onseeked = () => {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const imageData = canvas.toDataURL("image/png");
          newFrames.push({
            id: `frame-${Date.now()}-${i}`,
            timestamp,
            imageData,
          });
          resolve();
        };
      });
    }

    setFrames((prev) => [...prev, ...newFrames]);
    toast.success(`${count} frame estratti con successo`);
    setIsExtracting(false);
  };

  const removeTextFromFrame = async (frame: ExtractedFrame, maskData?: string) => {
    setFrames((prev) =>
      prev.map((f) =>
        f.id === frame.id ? { ...f, isProcessing: true } : f
      )
    );

    try {
      // Sanitize the prompt before sending
      const { sanitized, wasModified, removedTerms } = sanitizeRemovalPrompt(removalPrompt);
      
      if (wasModified) {
        toast.info(`Prompt modificato: rimossi termini non supportati (${removedTerms.join(", ")})`);
      }

      let data, error;

      // Use inpainting API if mask is provided or useInpainting is enabled with mask
      const effectiveMask = maskData || frame.maskData;
      
      if (useInpainting && effectiveMask) {
        // Use OpenAI inpainting with mask
        const result = await supabase.functions.invoke("inpaint-image", {
          body: {
            prompt: sanitized,
            image: frame.imageData,
            mask: effectiveMask,
          },
        });
        data = result.data;
        error = result.error;
      } else {
        // Use standard edit-image
        const result = await supabase.functions.invoke("edit-image", {
          body: {
            prompt: sanitized,
            referenceImage: frame.imageData,
          },
        });
        data = result.data;
        error = result.error;
      }

      if (error) {
        const messageFromBody =
          data && typeof data === "object" && "error" in data
            ? String((data as any).error)
            : null;
        throw new Error(messageFromBody || error.message);
      }

      if (data?.imageUrl) {
        setFrames((prev) =>
          prev.map((f) =>
            f.id === frame.id
              ? { ...f, editedImageData: data.imageUrl, isProcessing: false, maskData: effectiveMask }
              : f
          )
        );

        // Update selected frame if it's the one being edited
        if (selectedFrame?.id === frame.id) {
          setSelectedFrame((prev) =>
            prev ? { ...prev, editedImageData: data.imageUrl, isProcessing: false, maskData: effectiveMask } : null
          );
        }

        toast.success("Scritte rimosse con successo!");
      } else {
        throw new Error("Risposta AI non valida: immagine mancante");
      }
    } catch (error: any) {
      console.error("Error removing text:", error);
      toast.error(`Errore: ${error.message || "Impossibile rimuovere le scritte"}`);
      setFrames((prev) =>
        prev.map((f) => (f.id === frame.id ? { ...f, isProcessing: false } : f))
      );
    }
  };

  const openInpaintingCanvas = (frame: ExtractedFrame) => {
    setFrameForInpainting(frame);
    setShowInpaintingCanvas(true);
  };

  const handleMaskComplete = async (maskData: string, applyToAll?: boolean) => {
    if (!frameForInpainting) return;
    
    setShowInpaintingCanvas(false);
    
    if (applyToAll && frames.length > 1) {
      // Apply mask to all frames
      toast.info(`Applicazione maschera a ${frames.length} frame...`);
      
      // Update all frames with the mask
      setFrames((prev) =>
        prev.map((f) => ({ ...f, maskData }))
      );
      
      // Process all frames sequentially
      for (const frame of frames) {
        if (!frame.editedImageData && !frame.isProcessing) {
          await removeTextFromFrame(frame, maskData);
        }
      }
      
      setFrameForInpainting(null);
    } else {
      // Apply to single frame only
      setFrames((prev) =>
        prev.map((f) =>
          f.id === frameForInpainting.id ? { ...f, maskData } : f
        )
      );
      
      // Start processing with the mask
      await removeTextFromFrame(frameForInpainting, maskData);
      setFrameForInpainting(null);
    }
  };

  const removeTextFromAllFrames = async () => {
    const unprocessedFrames = frames.filter((f) => !f.editedImageData && !f.isProcessing);
    
    if (unprocessedFrames.length === 0) {
      toast.info("Tutti i frame sono già stati processati");
      return;
    }

    toast.info(`Elaborazione di ${unprocessedFrames.length} frame...`);
    
    for (const frame of unprocessedFrames) {
      await removeTextFromFrame(frame);
    }
  };

  const downloadFrame = (frame: ExtractedFrame, edited: boolean = false) => {
    const imageData = edited && frame.editedImageData ? frame.editedImageData : frame.imageData;
    const link = document.createElement("a");
    link.href = imageData;
    link.download = `frame-${formatTime(frame.timestamp).replace(/:/g, "-")}${edited ? "-edited" : ""}.png`;
    link.click();
  };

  const deleteFrame = (frameId: string) => {
    setFrames((prev) => prev.filter((f) => f.id !== frameId));
    if (selectedFrame?.id === frameId) {
      setSelectedFrame(null);
    }
  };

  const resetFrame = (frameId: string) => {
    setFrames((prev) =>
      prev.map((f) =>
        f.id === frameId ? { ...f, editedImageData: undefined } : f
      )
    );
    if (selectedFrame?.id === frameId) {
      setSelectedFrame((prev) =>
        prev ? { ...prev, editedImageData: undefined } : null
      );
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
  };

  // Compress image to reduce size for API - PiAPI has strict size limits
  const compressImageForApi = (imageData: string, maxDimension = 720, quality = 0.6): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Scale down to max dimension while maintaining aspect ratio
        const scaleFactor = Math.min(maxDimension / width, maxDimension / height, 1);
        width = Math.floor(width * scaleFactor);
        height = Math.floor(height * scaleFactor);
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        // Use JPEG for smaller file size
        const compressed = canvas.toDataURL('image/jpeg', quality);
        
        // Log size for debugging
        const sizeKB = Math.round((compressed.length * 3/4) / 1024);
        console.log(`Compressed image: ${width}x${height}, ~${sizeKB}KB`);
        
        resolve(compressed);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageData;
    });
  };

  const regenerateVideoFromFrame = async (frame: ExtractedFrame) => {
    if (!frame.editedImageData) {
      toast.error("Devi prima rimuovere le scritte dal frame");
      return;
    }

    setIsGeneratingVideo(true);

    try {
      // Get user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Devi essere autenticato");
        return;
      }

      toast.info("Compressione immagine...");
      
      // Compress the image aggressively - PiAPI has ~1MB limit
      const compressedImage = await compressImageForApi(frame.editedImageData, 720, 0.6);
      
      // Create video generation record with compressed image
      const { data: newGen, error: insertError } = await supabase
        .from("video_generations")
        .insert({
          type: "image_to_video",
          prompt: regeneratePrompt || "Continue the motion naturally, maintain consistency",
          duration: parseInt(regenerateDuration),
          resolution: "720p",
          image_url: compressedImage,
          image_name: `frame-edited-${formatTime(frame.timestamp)}`,
          status: "processing",
          user_id: user.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      toast.info("Avvio generazione video...");

      // Call generate-video function with compressed image
      const { data, error } = await supabase.functions.invoke("generate-video", {
        body: {
          prompt: regeneratePrompt || "Continue the motion naturally, maintain consistency",
          duration: parseInt(regenerateDuration),
          resolution: "720p",
          type: "image_to_video",
          start_image: compressedImage,
          generationId: newGen.id,
        },
      });

      if (error) throw error;

      // Update with prediction ID
      if (data?.id || data?.operationId) {
        await supabase
          .from("video_generations")
          .update({ prediction_id: data.id || data.operationId })
          .eq("id", newGen.id);
      }

      toast.success("Generazione video avviata! Controlla la tab 'Tutti i video'");
      
      // Navigate to history tab to see the generation
      const tabsList = document.querySelector('[data-state="active"][value="text-remover"]');
      if (tabsList) {
        const allTab = document.querySelector('[value="all"]') as HTMLButtonElement;
        if (allTab) allTab.click();
      }

    } catch (error: any) {
      console.error("Error generating video:", error);
      toast.error(`Errore: ${error.message || "Impossibile generare il video"}`);
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eraser className="w-5 h-5" />
            Rimuovi Scritte da Video
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Video Input */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Carica Video</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="video/*"
                  onChange={handleFileUpload}
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Oppure inserisci URL</Label>
              <Input
                type="url"
                placeholder="https://esempio.com/video.mp4"
                value={videoFile ? "" : videoUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                disabled={!!videoFile}
              />
            </div>
          </div>

          {/* Video Player */}
          {videoUrl && (
            <div className="space-y-4">
              <div className="relative bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="w-full max-h-[400px] object-contain"
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  crossOrigin="anonymous"
                />
              </div>

              {/* Video Controls */}
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={togglePlayPause}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
                
                <div className="flex-1">
                  <Slider
                    value={[currentTime]}
                    max={duration || 100}
                    step={0.01}
                    onValueChange={handleSeek}
                  />
                </div>
                
                <span className="text-sm text-muted-foreground min-w-[100px] text-right">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              {/* Frame Extraction Controls */}
              <div className="flex flex-wrap gap-2">
                <Button onClick={extractCurrentFrame} variant="secondary">
                  <Camera className="w-4 h-4 mr-2" />
                  Estrai frame corrente
                </Button>
                <Button 
                  onClick={() => extractMultipleFrames(5)} 
                  variant="outline"
                  disabled={isExtracting}
                >
                  {isExtracting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <ImageIcon className="w-4 h-4 mr-2" />
                  )}
                  Estrai 5 frame
                </Button>
                <Button 
                  onClick={() => extractMultipleFrames(10)} 
                  variant="outline"
                  disabled={isExtracting}
                >
                  {isExtracting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <ImageIcon className="w-4 h-4 mr-2" />
                  )}
                  Estrai 10 frame
                </Button>
              </div>
            </div>
          )}

          {/* Hidden canvas for frame extraction */}
          <canvas ref={canvasRef} className="hidden" />
        </CardContent>
      </Card>

      {/* Inpainting Canvas Modal */}
      {showInpaintingCanvas && frameForInpainting && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Paintbrush className="w-5 h-5" />
              Disegna maschera - Frame {formatTime(frameForInpainting.timestamp)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <InpaintingCanvas
              imageData={frameForInpainting.imageData}
              onMaskComplete={handleMaskComplete}
              onCancel={() => {
                setShowInpaintingCanvas(false);
                setFrameForInpainting(null);
              }}
              frameCount={frames.length}
            />
          </CardContent>
        </Card>
      )}

      {/* Removal Prompt */}
      {frames.length > 0 && !showInpaintingCanvas && (
        <Card>
          <CardHeader>
            <CardTitle>Impostazioni Rimozione</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Inpainting toggle */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="use-inpainting" className="font-medium">Usa Inpainting (OpenAI)</Label>
                <p className="text-xs text-muted-foreground">
                  Abilita per disegnare manualmente le aree da rimuovere. Più preciso ma richiede API key OpenAI.
                </p>
              </div>
              <Switch
                id="use-inpainting"
                checked={useInpainting}
                onCheckedChange={setUseInpainting}
              />
            </div>

            {/* Warning for watermark terms */}
            {hasWatermarkTerms(removalPrompt) && (
              <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-600">Termini non supportati rilevati</p>
                  <p className="text-muted-foreground">
                    Il prompt contiene parole come "watermark", "logo" o "brand" che l'AI non può elaborare. 
                    Questi termini verranno automaticamente rimossi.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Prompt di Rimozione</Label>
              <Textarea
                value={removalPrompt}
                onChange={(e) => setRemovalPrompt(e.target.value)}
                placeholder="Descrivi cosa vuoi rimuovere dall'immagine..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Personalizza il prompt per ottenere risultati migliori. Concentra il prompt su scritte/sottotitoli.
              </p>
            </div>

            <Button 
              onClick={removeTextFromAllFrames}
              className="w-full"
              disabled={useInpainting}
            >
              <Eraser className="w-4 h-4 mr-2" />
              {useInpainting ? "Disegna una maschera per ogni frame" : "Rimuovi scritte da tutti i frame"}
            </Button>
            
            {useInpainting && (
              <p className="text-xs text-center text-muted-foreground">
                Con l'inpainting attivo, clicca su un frame e poi "Disegna maschera" per selezionare le aree da rimuovere.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Extracted Frames Grid */}
      {frames.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Frame Estratti ({frames.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {frames.map((frame) => (
                <div
                  key={frame.id}
                  className={`relative group rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                    selectedFrame?.id === frame.id
                      ? "border-primary"
                      : "border-transparent hover:border-muted"
                  }`}
                  onClick={() => setSelectedFrame(frame)}
                >
                  <img
                    src={frame.editedImageData || frame.imageData}
                    alt={`Frame at ${formatTime(frame.timestamp)}`}
                    className="w-full aspect-video object-cover"
                  />
                  
                  {/* Processing overlay */}
                  {frame.isProcessing && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-white" />
                    </div>
                  )}

                  {/* Edited badge */}
                  {frame.editedImageData && !frame.isProcessing && (
                    <div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                      Editato
                    </div>
                  )}

                  {/* Timestamp */}
                  <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                    {formatTime(frame.timestamp)}
                  </div>

                  {/* Actions overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    {useInpainting ? (
                      <Button
                        size="icon"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          openInpaintingCanvas(frame);
                        }}
                        disabled={frame.isProcessing}
                        title="Disegna maschera"
                      >
                        <Paintbrush className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button
                        size="icon"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTextFromFrame(frame);
                        }}
                        disabled={frame.isProcessing}
                        title="Rimuovi scritte"
                      >
                        <Eraser className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadFrame(frame, !!frame.editedImageData);
                      }}
                      title="Scarica"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    {frame.editedImageData && (
                      <Button
                        size="icon"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          resetFrame(frame.id);
                        }}
                        title="Ripristina"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteFrame(frame.id);
                      }}
                      title="Elimina"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selected Frame Detail */}
      {selectedFrame && (
        <Card>
          <CardHeader>
            <CardTitle>Dettaglio Frame - {formatTime(selectedFrame.timestamp)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Originale</Label>
                <div className="relative rounded-lg overflow-hidden bg-muted">
                  <img
                    src={selectedFrame.imageData}
                    alt="Original frame"
                    className="w-full object-contain"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => downloadFrame(selectedFrame, false)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Scarica originale
                </Button>
              </div>
              
              <div className="space-y-2">
                <Label>Editato</Label>
                <div className="relative rounded-lg overflow-hidden bg-muted min-h-[200px] flex items-center justify-center">
                  {selectedFrame.isProcessing ? (
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Elaborazione in corso...</p>
                    </div>
                  ) : selectedFrame.editedImageData ? (
                    <img
                      src={selectedFrame.editedImageData}
                      alt="Edited frame"
                      className="w-full object-contain"
                    />
                  ) : (
                    <div className="text-center p-4">
                      {useInpainting ? (
                        <>
                          <Paintbrush className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            Clicca "Disegna maschera" per selezionare le aree
                          </p>
                        </>
                      ) : (
                        <>
                          <Eraser className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            Clicca "Rimuovi scritte" per elaborare
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  {useInpainting ? (
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1"
                      onClick={() => openInpaintingCanvas(selectedFrame)}
                      disabled={selectedFrame.isProcessing}
                    >
                      {selectedFrame.isProcessing ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Paintbrush className="w-4 h-4 mr-2" />
                      )}
                      Disegna maschera
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1"
                      onClick={() => removeTextFromFrame(selectedFrame)}
                      disabled={selectedFrame.isProcessing}
                    >
                      {selectedFrame.isProcessing ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Eraser className="w-4 h-4 mr-2" />
                      )}
                      Rimuovi scritte
                    </Button>
                  )}
                  {selectedFrame.editedImageData && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => downloadFrame(selectedFrame, true)}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Scarica editato
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Regenerate Video Section */}
            {selectedFrame.editedImageData && (
              <div className="mt-6 pt-6 border-t space-y-4">
                <div className="flex items-center gap-2">
                  <Wand2 className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">Rigenera Video</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Usa il frame editato (senza scritte) come primo frame per generare un nuovo video.
                </p>
                
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="regenerate-prompt">Prompt (opzionale)</Label>
                    <Textarea
                      id="regenerate-prompt"
                      value={regeneratePrompt}
                      onChange={(e) => setRegeneratePrompt(e.target.value)}
                      placeholder="Descrivi il movimento desiderato..."
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="regenerate-duration">Durata</Label>
                    <Select value={regenerateDuration} onValueChange={setRegenerateDuration}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 secondi</SelectItem>
                        <SelectItem value="6">6 secondi</SelectItem>
                        <SelectItem value="8">8 secondi</SelectItem>
                        <SelectItem value="10">10 secondi</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button 
                  onClick={() => regenerateVideoFromFrame(selectedFrame)}
                  disabled={isGeneratingVideo}
                  className="w-full"
                >
                  {isGeneratingVideo ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Video className="w-4 h-4 mr-2" />
                  )}
                  Genera nuovo video da frame editato
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
