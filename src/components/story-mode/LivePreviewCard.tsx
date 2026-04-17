import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Eye, ChevronLeft, ChevronRight, PlayCircle, StopCircle } from "lucide-react";
import { useAuthVideo } from "@/hooks/useAuthVideo";
import { StoryScene } from "./types";
import { cn } from "@/lib/utils";

interface LivePreviewCardProps {
  scenes: StoryScene[];
  totalScenes: number;
  aspectRatio?: string;
}

export function LivePreviewCard({ scenes, totalScenes, aspectRatio = "16:9" }: LivePreviewCardProps) {
  const completedVideos = scenes.filter(s => !!s.videoUrl && (s.videoStatus === "completed" || s.videoStatus === "generating"));
  const [selectedIndex, setSelectedIndex] = useState(completedVideos.length - 1);
  const [playAll, setPlayAll] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const aspectClass = aspectRatio === "9:16" ? "aspect-[9/16]" : aspectRatio === "4:3" ? "aspect-[4/3]" : "aspect-video";

  useEffect(() => {
    if (!playAll) setSelectedIndex(completedVideos.length - 1);
  }, [completedVideos.length, playAll]);

  const handleVideoEnded = useCallback(() => {
    if (!playAll) return;
    const nextIndex = selectedIndex + 1;
    if (nextIndex < completedVideos.length) {
      setSelectedIndex(nextIndex);
    } else {
      setPlayAll(false);
    }
  }, [playAll, selectedIndex, completedVideos.length]);

  const togglePlayAll = () => {
    if (playAll) {
      setPlayAll(false);
    } else {
      setSelectedIndex(0);
      setPlayAll(true);
    }
  };

  if (completedVideos.length === 0) return null;

  const safeIndex = Math.max(0, Math.min(selectedIndex, completedVideos.length - 1));
  const currentScene = completedVideos[safeIndex];
  const rawUrl = currentScene.videoUrl!;
  const needsAuth = rawUrl.includes("/functions/v1/video-proxy");
  const { blobUrl, isLoading } = useAuthVideo(needsAuth ? rawUrl : undefined, true);
  const playableUrl = needsAuth ? blobUrl : rawUrl;

  const canPrev = safeIndex > 0;
  const canNext = safeIndex < completedVideos.length - 1;

  return (
    <Card className="border-accent/20 bg-card/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-accent" />
            Anteprima Live — {completedVideos.length}/{totalScenes} scene completate
          </div>
          <div className="flex items-center gap-1">
            {completedVideos.length > 1 && (
              <Button
                variant={playAll ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={togglePlayAll}
              >
                {playAll ? <StopCircle className="w-3.5 h-3.5" /> : <PlayCircle className="w-3.5 h-3.5" />}
                {playAll ? "Stop" : "Play All"}
              </Button>
            )}
            {completedVideos.length > 1 && (
              <>
                <Button variant="ghost" size="icon" className="w-7 h-7" disabled={!canPrev} onClick={() => { setPlayAll(false); setSelectedIndex(i => i - 1); }}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs text-muted-foreground min-w-[3ch] text-center">{safeIndex + 1}/{completedVideos.length}</span>
                <Button variant="ghost" size="icon" className="w-7 h-7" disabled={!canNext} onClick={() => { setPlayAll(false); setSelectedIndex(i => i + 1); }}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className={cn("flex items-center justify-center bg-muted rounded-lg", aspectClass)}>
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : playableUrl ? (
          <div className={cn("w-full rounded-lg overflow-hidden bg-black", aspectClass)}>
            <video
              ref={videoRef}
              key={playableUrl}
              src={playableUrl}
              controls
              autoPlay
              muted
              playsInline
              className="w-full h-full object-contain"
              onEnded={handleVideoEnded}
            />
          </div>
        ) : (
          <div className={cn("flex items-center justify-center bg-muted rounded-lg text-muted-foreground text-sm", aspectClass)}>
            Caricamento video...
          </div>
        )}

        {completedVideos.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {completedVideos.map((scene, i) => (
              <button
                key={scene.sceneNumber}
                onClick={() => { setPlayAll(false); setSelectedIndex(i); }}
                className={cn(
                  "shrink-0 w-14 h-10 rounded border-2 overflow-hidden transition-all text-[10px] flex items-center justify-center bg-muted",
                  i === safeIndex ? "border-primary ring-1 ring-primary/30" : "border-border hover:border-primary/50 opacity-70 hover:opacity-100"
                )}
              >
                {scene.imageUrl ? (
                  <img src={scene.imageUrl} alt={`Scena ${scene.sceneNumber}`} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-muted-foreground">S{scene.sceneNumber}</span>
                )}
              </button>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Scena {currentScene.sceneNumber}{playAll && " — Riproduzione sequenziale"}
        </p>
      </CardContent>
    </Card>
  );
}
