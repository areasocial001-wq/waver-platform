import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Eye } from "lucide-react";
import { useAuthVideo } from "@/hooks/useAuthVideo";
import { StoryScene } from "./types";

interface LivePreviewCardProps {
  scenes: StoryScene[];
  totalScenes: number;
}

export function LivePreviewCard({ scenes, totalScenes }: LivePreviewCardProps) {
  const completedVideos = scenes.filter(s => s.videoStatus === "completed" && s.videoUrl);

  if (completedVideos.length === 0) return null;

  const latestScene = completedVideos[completedVideos.length - 1];
  const rawUrl = latestScene.videoUrl!;
  const needsAuth = rawUrl.includes("/functions/v1/video-proxy");
  const { blobUrl, isLoading } = useAuthVideo(needsAuth ? rawUrl : undefined, true);
  const playableUrl = needsAuth ? blobUrl : rawUrl;

  return (
    <Card className="border-accent/20 bg-card/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Eye className="w-4 h-4 text-accent" />
          Anteprima Live — {completedVideos.length}/{totalScenes} scene completate
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-[200px] bg-muted rounded-lg">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : playableUrl ? (
          <video
            key={playableUrl}
            src={playableUrl}
            controls
            autoPlay
            muted
            className="w-full rounded-lg max-h-[300px]"
          />
        ) : (
          <div className="flex items-center justify-center h-[200px] bg-muted rounded-lg text-muted-foreground text-sm">
            Caricamento video...
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Ultima scena completata: Scena {latestScene.sceneNumber}
        </p>
      </CardContent>
    </Card>
  );
}
