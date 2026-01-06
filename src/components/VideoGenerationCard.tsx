import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle, XCircle, Loader2, Play, Trash2, Download, Volume2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AddVoiceoverDialog } from "./AddVoiceoverDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface VideoGenerationCardProps {
  generation: {
    id: string;
    type: string;
    prompt: string;
    status: string;
    video_url: string | null;
    error_message: string | null;
    created_at: string;
    duration: number;
    image_url?: string;
    retry_count?: number;
    max_retries?: number;
    next_retry_at?: string;
    queue_position?: number;
    priority?: number;
    provider?: string;
    dialogue_text?: string | null;
    audio_url?: string | null;
  };
  onDelete?: () => void;
}

// Genera miniatura dal primo frame del video
const generateThumbnail = (videoUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';
    
    video.onloadeddata = () => {
      video.currentTime = 0.1; // Primo frame
    };
    
    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
          resolve(thumbnail);
        } else {
          reject(new Error('Canvas context not available'));
        }
      } catch (error) {
        reject(error);
      }
    };
    
    video.onerror = () => reject(new Error('Video load error'));
    video.src = videoUrl;
  });
};

// Cache per le miniature in localStorage
const getThumbnailFromCache = (videoId: string): string | null => {
  try {
    return localStorage.getItem(`thumb_${videoId}`);
  } catch {
    return null;
  }
};

const saveThumbnailToCache = (videoId: string, thumbnail: string) => {
  try {
    localStorage.setItem(`thumb_${videoId}`, thumbnail);
  } catch {
    // localStorage pieno, ignora
  }
};

export const VideoGenerationCard = ({ generation, onDelete }: VideoGenerationCardProps) => {
  const [progress, setProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [isLoadingThumbnail, setIsLoadingThumbnail] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("video_generations")
        .delete()
        .eq("id", generation.id);

      if (error) throw error;
      
      toast.success("Video eliminato con successo");
      onDelete?.();
    } catch (error) {
      console.error("Error deleting video:", error);
      toast.error("Errore nell'eliminazione del video");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownload = async () => {
    if (!generation.video_url) return;
    
    setIsDownloading(true);
    try {
      const response = await fetch(generation.video_url);
      if (!response.ok) throw new Error("Impossibile scaricare il video");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `video-${generation.id.slice(0, 8)}.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success("Download avviato!");
    } catch (error) {
      console.error("Error downloading video:", error);
      toast.error("Errore nel download del video");
    } finally {
      setIsDownloading(false);
    }
  };

  // Lazy loading: only load video when card is visible
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Genera miniatura quando il card è visibile
  useEffect(() => {
    if (!isVisible || !generation.video_url || generation.status !== "completed") return;
    
    // Prima controlla la cache
    const cached = getThumbnailFromCache(generation.id);
    if (cached) {
      setThumbnail(cached);
      return;
    }
    
    // Genera la miniatura
    setIsLoadingThumbnail(true);
    generateThumbnail(generation.video_url)
      .then((thumb) => {
        setThumbnail(thumb);
        saveThumbnailToCache(generation.id, thumb);
      })
      .catch((err) => {
        console.log('Thumbnail generation failed:', err);
        // Fallback: usa image_url se disponibile
        if (generation.image_url) {
          setThumbnail(generation.image_url);
        }
      })
      .finally(() => setIsLoadingThumbnail(false));
  }, [isVisible, generation.video_url, generation.status, generation.id, generation.image_url]);

  // Kling: 3-5 minuti, Veo: 60-120 secondi
  const getEstimatedTotalSeconds = () => {
    // Se il tempo trascorso supera 2 minuti, probabilmente è Kling
    return elapsedTime > 120 ? 240 : 90; // 4 minuti per Kling, 90s per Veo
  };

  useEffect(() => {
    if (generation.status === "processing") {
      const startTime = new Date(generation.created_at).getTime();
      
      const updateProgress = () => {
        const now = Date.now();
        const elapsed = Math.floor((now - startTime) / 1000);
        setElapsedTime(elapsed);
        
        // Stima dinamica basata sul tempo trascorso
        const estimatedTotal = elapsed > 120 ? 240 : 90;
        const calculatedProgress = Math.min((elapsed / estimatedTotal) * 100, 95);
        setProgress(calculatedProgress);
      };

      updateProgress();
      const interval = setInterval(updateProgress, 1000);

      return () => clearInterval(interval);
    } else if (generation.status === "completed") {
      setProgress(100);
    }
  }, [generation.status, generation.created_at]);

  const getStatusIcon = () => {
    switch (generation.status) {
      case "processing":
        return <Loader2 className="w-4 h-4 animate-spin text-accent" />;
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = () => {
    switch (generation.status) {
      case "processing":
        return (
          <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            In elaborazione...
          </Badge>
        );
      case "pending":
        if (generation.next_retry_at) {
          const retryTime = new Date(generation.next_retry_at);
          const timeLeft = Math.max(0, Math.ceil((retryTime.getTime() - Date.now()) / 1000));
          return (
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
              <Clock className="w-3 h-3 mr-1" />
              Retry in {timeLeft}s ({generation.retry_count}/{generation.max_retries})
            </Badge>
          );
        }
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30">
            <Clock className="w-3 h-3 mr-1" />
            In coda {generation.queue_position ? `#${generation.queue_position}` : ""}
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completato
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
            <XCircle className="w-3 h-3 mr-1" />
            Errore
          </Badge>
        );
      default:
        return null;
    }
  };

  const formatElapsedTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatRemainingTime = () => {
    const estimatedTotal = elapsedTime > 120 ? 240 : 90;
    const remaining = Math.max(0, estimatedTotal - elapsedTime);
    if (remaining === 0) return "Quasi pronto...";
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    if (mins > 0) {
      return `~${mins}m ${secs}s rimanenti`;
    }
    return `~${secs}s rimanenti`;
  };

  return (
    <Card ref={cardRef} className="overflow-hidden hover:shadow-lg transition-all duration-300 border-border/50">
      <CardContent className="p-0">
        <div className="aspect-video bg-muted relative overflow-hidden">
          {generation.status === "completed" && generation.video_url ? (
            shouldLoadVideo ? (
              <video
                src={generation.video_url}
                controls
                autoPlay
                className="w-full h-full object-cover"
                preload="metadata"
              />
            ) : (
              <div 
                className="w-full h-full flex items-center justify-center cursor-pointer bg-muted hover:bg-muted/80 transition-colors relative group"
                onClick={() => setShouldLoadVideo(true)}
              >
                {/* Miniatura del video */}
                {thumbnail ? (
                  <img 
                    src={thumbnail} 
                    alt="Anteprima video"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : isLoadingThumbnail ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : null}
                
                {/* Overlay con pulsante play */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                  <div className="text-center space-y-2">
                    <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center mx-auto shadow-lg group-hover:scale-110 transition-transform">
                      <Play className="w-8 h-8 text-primary-foreground ml-1" />
                    </div>
                    <p className="text-xs text-white font-medium drop-shadow-md">Clicca per riprodurre</p>
                  </div>
                </div>
              </div>
            )
          ) : generation.image_url && isVisible ? (
            <div className="relative w-full h-full">
              <img
                src={generation.image_url}
                alt="Preview"
                className="w-full h-full object-cover opacity-50"
                loading="lazy"
              />
              {generation.status === "processing" && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
                  <div className="text-center space-y-3 p-6">
                    <Loader2 className="w-12 h-12 animate-spin text-accent mx-auto" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        Generazione in corso...
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Tempo trascorso: {formatElapsedTime(elapsedTime)}
                      </p>
                      <p className="text-xs text-accent font-medium">
                        {formatRemainingTime()}
                      </p>
                    </div>
                    <Progress value={progress} className="w-48 h-2" />
                    <p className="text-xs text-muted-foreground">
                      {Math.round(progress)}% completato
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {getStatusIcon()}
            </div>
          )}
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm line-clamp-2 flex-1 text-foreground">
              {generation.prompt}
            </p>
            {getStatusBadge()}
          </div>

          {generation.status === "processing" && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Generazione video...</span>
                <span>{Math.round(progress)}%</span>
              </div>
            </div>
          )}

          {generation.error_message && (
            <p className="text-xs text-destructive">
              {generation.error_message}
            </p>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(new Date(generation.created_at), {
                addSuffix: true,
                locale: it,
              })}
            </span>
            <div className="flex items-center gap-2">
              <span className="capitalize">{generation.type.replace("_", " ")}</span>
              
              {generation.status === "completed" && generation.video_url && (
                <>
                  {/* Voiceover button */}
                  <AddVoiceoverDialog 
                    videoId={generation.id}
                    dialogueText={generation.dialogue_text}
                    onVoiceoverAdded={() => {
                      toast.success("Voiceover aggiunto al video!");
                    }}
                  />
                  
                  {/* Show audio indicator if voiceover exists */}
                  {generation.audio_url && (
                    <Badge variant="secondary" className="gap-1">
                      <Volume2 className="h-3 w-3" />
                      Audio
                    </Badge>
                  )}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-primary border-primary/30 hover:bg-primary hover:text-primary-foreground"
                    onClick={handleDownload}
                    disabled={isDownloading}
                  >
                    {isDownloading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-1" />
                        Scarica
                      </>
                    )}
                  </Button>
                </>
              )}
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 px-3 text-destructive border-destructive/30 hover:bg-destructive hover:text-destructive-foreground"
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-1" />
                        Elimina
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Eliminare questo video?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Questa azione non può essere annullata. Il video verrà eliminato permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Elimina
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
