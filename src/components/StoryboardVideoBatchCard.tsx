import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VideoGenerationCard } from "./VideoGenerationCard";
import { Video, Clock, Trash2, Film, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

type VideoBatch = {
  id: string;
  transition_style: string | null;
  transition_speed: string | null;
  duration: number;
  camera_movement: string | null;
  audio_type: string | null;
};

type VideoGeneration = {
  id: string;
  type: "text_to_video" | "image_to_video";
  prompt: string | null;
  duration: number;
  resolution: string | null;
  motion_intensity: string | null;
  image_url: string | null;
  image_name: string | null;
  status: string;
  created_at: string;
  prediction_id: string | null;
  video_url: string | null;
  error_message: string | null;
  batch_id: string | null;
  sequence_order: number | null;
};

interface StoryboardVideoBatchCardProps {
  batchId: string;
  videos: VideoGeneration[];
  batchInfo?: VideoBatch;
  onDelete?: () => void;
}

export const StoryboardVideoBatchCard = ({ batchId, videos, batchInfo, onDelete }: StoryboardVideoBatchCardProps) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();

  const handleDeleteBatch = async () => {
    setIsDeleting(true);
    try {
      // Delete all videos in this batch first
      const { error: videosError } = await supabase
        .from("video_generations")
        .delete()
        .eq("batch_id", batchId);

      if (videosError) throw videosError;

      // Delete the batch record
      const { error: batchError } = await supabase
        .from("storyboard_video_batches")
        .delete()
        .eq("id", batchId);

      if (batchError) throw batchError;

      toast.success("Batch eliminato con successo");
      onDelete?.();
    } catch (error) {
      console.error("Error deleting batch:", error);
      toast.error("Errore durante l'eliminazione del batch");
    } finally {
      setIsDeleting(false);
    }
  };

  const sortedVideos = [...videos].sort((a, b) => 
    (a.sequence_order ?? 0) - (b.sequence_order ?? 0)
  );

  const completedCount = videos.filter(v => v.status === "completed").length;
  const totalCount = videos.length;
  const totalDuration = videos.reduce((sum, v) => sum + v.duration, 0);
  const allCompleted = completedCount === totalCount && totalCount > 0;

  const statusColor = 
    completedCount === totalCount ? "bg-green-500/10 text-green-500 border-green-500/20" :
    videos.some(v => v.status === "failed") ? "bg-red-500/10 text-red-500 border-red-500/20" :
    "bg-blue-500/10 text-blue-500 border-blue-500/20";

  const handleOpenEditor = () => {
    navigate(`/video-editor?batchId=${batchId}`);
  };

  const transitionIcons: Record<string, string> = {
    smooth: "🌊",
    fade: "🌫️",
    dissolve: "✨",
    wipe: "↔️",
    zoom: "🔍",
    morph: "🦋",
    push: "➡️",
    spin: "🌀",
  };

  const transitionLabels: Record<string, string> = {
    smooth: "Smooth",
    fade: "Fade",
    dissolve: "Dissolve",
    wipe: "Wipe",
    zoom: "Zoom",
    morph: "Morph",
    push: "Push",
    spin: "Spin",
  };

  const speedIcons: Record<string, string> = {
    fast: "⚡",
    normal: "➡️",
    slow: "🐌",
  };

  const speedLabels: Record<string, string> = {
    fast: "Veloce",
    normal: "Normale",
    slow: "Lento",
  };

  return (
    <Card className="overflow-hidden border-2 border-primary/20">
      <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Video className="h-5 w-5 text-primary" />
            Video Sequenziale da Storyboard
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={statusColor}>
              {completedCount}/{totalCount} completati
            </Badge>
            {allCompleted && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenEditor}
                className="gap-1 bg-primary/10 hover:bg-primary/20 text-primary border-primary/30"
              >
                <Film className="h-4 w-4" />
                Concatena Video
                <ExternalLink className="h-3 w-3" />
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={isDeleting}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminare questo batch?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Questa azione eliminerà tutti i {totalCount} video in questo batch. 
                    L'operazione non può essere annullata.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteBatch}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Elimina batch
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            Durata totale: {totalDuration}s
          </div>
          <div>
            {videos.length} transizioni
          </div>
          {batchInfo?.transition_style && (
            <Badge variant="outline" className="gap-1">
              <span>{transitionIcons[batchInfo.transition_style] || "✨"}</span>
              {transitionLabels[batchInfo.transition_style] || batchInfo.transition_style}
            </Badge>
          )}
          {batchInfo?.transition_speed && (
            <Badge variant="outline" className="gap-1">
              <span>{speedIcons[batchInfo.transition_speed] || "➡️"}</span>
              {speedLabels[batchInfo.transition_speed] || batchInfo.transition_speed}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-3">
          {sortedVideos.map((video, idx) => (
            <div key={video.id} className="relative">
              <div className="absolute -left-4 top-4 z-10">
                <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold">
                  {idx + 1}
                </div>
              </div>
              <div className="pl-6">
                <VideoGenerationCard generation={video} />
              </div>
              {idx < sortedVideos.length - 1 && (
                <div className="flex items-center justify-center py-2">
                  <div className="h-8 w-0.5 bg-gradient-to-b from-primary/50 to-primary/20" />
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
