import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle, XCircle, Loader2, Play, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
  };
  onDelete?: () => void;
}

export const VideoGenerationCard = ({ generation, onDelete }: VideoGenerationCardProps) => {
  const [progress, setProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
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
                className="w-full h-full object-cover"
                preload="metadata"
              />
            ) : (
              <div 
                className="w-full h-full flex items-center justify-center cursor-pointer bg-muted hover:bg-muted/80 transition-colors"
                onClick={() => setShouldLoadVideo(true)}
              >
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
                    <Play className="w-8 h-8 text-primary" />
                  </div>
                  <p className="text-xs text-muted-foreground">Clicca per caricare</p>
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
            <div className="flex items-center gap-3">
              <span className="capitalize">{generation.type.replace("_", " ")}</span>
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
