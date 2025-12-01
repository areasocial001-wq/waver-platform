import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VideoGenerationCard } from "./VideoGenerationCard";
import { Video, Clock, Sparkles } from "lucide-react";

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
}

export const StoryboardVideoBatchCard = ({ batchId, videos, batchInfo }: StoryboardVideoBatchCardProps) => {
  const sortedVideos = [...videos].sort((a, b) => 
    (a.sequence_order ?? 0) - (b.sequence_order ?? 0)
  );

  const completedCount = videos.filter(v => v.status === "completed").length;
  const totalCount = videos.length;
  const totalDuration = videos.reduce((sum, v) => sum + v.duration, 0);

  const statusColor = 
    completedCount === totalCount ? "bg-green-500/10 text-green-500 border-green-500/20" :
    videos.some(v => v.status === "failed") ? "bg-red-500/10 text-red-500 border-red-500/20" :
    "bg-blue-500/10 text-blue-500 border-blue-500/20";

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
          <Badge variant="outline" className={statusColor}>
            {completedCount}/{totalCount} completati
          </Badge>
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
