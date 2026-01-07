import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
  Wand2
} from "lucide-react";

interface ExtractedFrame {
  id: string;
  timestamp: number;
  imageData: string;
  editedImageData?: string;
  isProcessing?: boolean;
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
  const [removalPrompt, setRemovalPrompt] = useState("Remove all text, watermarks, and written content from this image. Keep the background and all other elements intact. Make it look natural.");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [regeneratePrompt, setRegeneratePrompt] = useState("");
  const [regenerateDuration, setRegenerateDuration] = useState("5");
  
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

  const removeTextFromFrame = async (frame: ExtractedFrame) => {
    setFrames((prev) =>
      prev.map((f) =>
        f.id === frame.id ? { ...f, isProcessing: true } : f
      )
    );

    try {
      const { data, error } = await supabase.functions.invoke("edit-image", {
        body: {
          prompt: removalPrompt,
          referenceImage: frame.imageData,
        },
      });

      if (error) throw error;

      if (data?.imageUrl) {
        setFrames((prev) =>
          prev.map((f) =>
            f.id === frame.id
              ? { ...f, editedImageData: data.imageUrl, isProcessing: false }
              : f
          )
        );
        
        // Update selected frame if it's the one being edited
        if (selectedFrame?.id === frame.id) {
          setSelectedFrame((prev) =>
            prev ? { ...prev, editedImageData: data.imageUrl, isProcessing: false } : null
          );
        }
        
        toast.success("Scritte rimosse con successo!");
      }
    } catch (error: any) {
      console.error("Error removing text:", error);
      toast.error(`Errore: ${error.message || "Impossibile rimuovere le scritte"}`);
      setFrames((prev) =>
        prev.map((f) =>
          f.id === frame.id ? { ...f, isProcessing: false } : f
        )
      );
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

      // Create video generation record
      const { data: newGen, error: insertError } = await supabase
        .from("video_generations")
        .insert({
          type: "image_to_video",
          prompt: regeneratePrompt || "Continue the motion naturally, maintain consistency",
          duration: parseInt(regenerateDuration),
          resolution: "720p",
          image_url: frame.editedImageData,
          image_name: `frame-edited-${formatTime(frame.timestamp)}`,
          status: "processing",
          user_id: user.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      toast.info("Avvio generazione video...");

      // Call generate-video function
      const { data, error } = await supabase.functions.invoke("generate-video", {
        body: {
          prompt: regeneratePrompt || "Continue the motion naturally, maintain consistency",
          duration: parseInt(regenerateDuration),
          resolution: "720p",
          type: "image_to_video",
          imageUrl: frame.editedImageData,
          generationId: newGen.id,
        },
      });

      if (error) throw error;

      // Update with prediction ID
      if (data?.id) {
        await supabase
          .from("video_generations")
          .update({ prediction_id: data.id })
          .eq("id", newGen.id);
      }

      toast.success("Generazione video avviata! Controlla la tab 'Tutti i video'");
      
      // Navigate to history tab to see the generation
      // We're already on history page, just switch tab
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

      {/* Removal Prompt */}
      {frames.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Prompt di Rimozione</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={removalPrompt}
              onChange={(e) => setRemovalPrompt(e.target.value)}
              placeholder="Descrivi cosa vuoi rimuovere dall'immagine..."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Personalizza il prompt per ottenere risultati migliori. L'AI cercherà di rimuovere scritte e watermark mantenendo intatto il resto dell'immagine.
            </p>
            <Button 
              onClick={removeTextFromAllFrames}
              className="w-full"
            >
              <Eraser className="w-4 h-4 mr-2" />
              Rimuovi scritte da tutti i frame
            </Button>
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
                    <Button
                      size="icon"
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeTextFromFrame(frame);
                      }}
                      disabled={frame.isProcessing}
                    >
                      <Eraser className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadFrame(frame, !!frame.editedImageData);
                      }}
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
                      <Eraser className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Clicca "Rimuovi scritte" per elaborare
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
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
