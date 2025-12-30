import { memo, useRef, useEffect, useState, useCallback } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, Download, Loader2, AlertCircle, Maximize2, Play, Pause, Music, Volume2, VolumeX, SkipForward, SkipBack } from "lucide-react";
import { FinalVideoNodeData } from "../types";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";

interface ExtendedFinalVideoNodeData extends FinalVideoNodeData {
  audioUrl?: string;
  segments?: string[];
}

const FinalVideoNode = memo(({ data }: NodeProps) => {
  const nodeData = data as unknown as ExtendedFinalVideoNodeData;
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioVolume, setAudioVolume] = useState(0.8);
  
  // Sequential playback state
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  
  const segments = nodeData.segments || (nodeData.videoUrl ? [nodeData.videoUrl] : []);
  const hasMultipleSegments = segments.length > 1;
  const currentVideoUrl = segments[currentSegmentIndex] || nodeData.videoUrl;

  // Sync audio with video
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    
    if (!video || !audio || !nodeData.audioUrl) return;

    const handlePlay = () => {
      audio.currentTime = video.currentTime;
      audio.play().catch(console.error);
      setIsPlaying(true);
    };
    
    const handlePause = () => {
      audio.pause();
      setIsPlaying(false);
    };
    
    const handleSeek = () => {
      audio.currentTime = video.currentTime;
    };

    const handleTimeUpdate = () => {
      if (video.duration && !hasMultipleSegments) {
        setPlaybackProgress((video.currentTime / video.duration) * 100);
      }
    };
    
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("seeked", handleSeek);
    video.addEventListener("timeupdate", handleTimeUpdate);
    
    return () => {
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("seeked", handleSeek);
      video.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [nodeData.audioUrl, nodeData.videoUrl, hasMultipleSegments]);

  // Handle video ended - play next segment
  const handleVideoEnded = useCallback(() => {
    if (hasMultipleSegments) {
      if (currentSegmentIndex < segments.length - 1) {
        // Play next segment
        setCurrentSegmentIndex(prev => prev + 1);
      } else {
        // All segments played, reset
        setIsPlaying(false);
        setCurrentSegmentIndex(0);
        setPlaybackProgress(100);
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
      }
    }
  }, [hasMultipleSegments, currentSegmentIndex, segments.length]);

  // Auto-play next segment when index changes
  useEffect(() => {
    if (isPlaying && videoRef.current && hasMultipleSegments) {
      videoRef.current.play().catch(console.error);
    }
  }, [currentSegmentIndex, isPlaying, hasMultipleSegments]);

  // Update progress for multi-segment playback
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hasMultipleSegments) return;

    const updateProgress = () => {
      const segmentDuration = video.duration || 1;
      const segmentProgress = video.currentTime / segmentDuration;
      const totalProgress = ((currentSegmentIndex + segmentProgress) / segments.length) * 100;
      setPlaybackProgress(totalProgress);
    };

    video.addEventListener("timeupdate", updateProgress);
    return () => video.removeEventListener("timeupdate", updateProgress);
  }, [currentSegmentIndex, segments.length, hasMultipleSegments]);

  const handleDownload = async () => {
    if (!nodeData.videoUrl) return;
    
    try {
      const response = await fetch(nodeData.videoUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `final-video-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("Video finale scaricato!");
    } catch (error) {
      toast.error("Errore durante il download");
    }
  };

  const handleDownloadAudio = async () => {
    if (!nodeData.audioUrl) return;
    
    try {
      const response = await fetch(nodeData.audioUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audio-${Date.now()}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("Audio scaricato!");
    } catch (error) {
      toast.error("Errore durante il download audio");
    }
  };

  const handleFullscreen = () => {
    if (videoRef.current?.requestFullscreen) {
      videoRef.current.requestFullscreen();
    }
  };

  const toggleAudio = () => {
    if (audioRef.current) {
      if (isAudioPlaying) {
        audioRef.current.pause();
        setIsAudioPlaying(false);
      } else {
        audioRef.current.play().catch(console.error);
        setIsAudioPlaying(true);
      }
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const vol = value[0];
    setAudioVolume(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol;
    }
  };

  const playPause = () => {
    const video = videoRef.current;
    if (!video) return;
    
    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch(console.error);
    }
  };

  const skipPrevious = () => {
    if (currentSegmentIndex > 0) {
      setCurrentSegmentIndex(prev => prev - 1);
    }
  };

  const skipNext = () => {
    if (currentSegmentIndex < segments.length - 1) {
      setCurrentSegmentIndex(prev => prev + 1);
    }
  };

  return (
    <Card className="w-80 bg-gradient-to-br from-purple-500/10 to-orange-500/10 backdrop-blur border-purple-500/30 shadow-lg shadow-purple-500/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Video className="h-4 w-4 text-purple-500" />
          Video Finale
          {hasMultipleSegments && (
            <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
              {segments.length} clip
            </span>
          )}
          {nodeData.hasAudio && (
            <span className="text-[10px] bg-orange-500/20 text-orange-500 px-1.5 py-0.5 rounded flex items-center gap-1">
              <Music className="h-3 w-3" />
              Audio
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {nodeData.status === "processing" && (
          <div className="flex flex-col items-center justify-center h-44 bg-muted/30 rounded-md">
            <Loader2 className="h-8 w-8 text-purple-500 animate-spin mb-2" />
            <span className="text-xs text-muted-foreground">Elaborazione in corso...</span>
            <span className="text-xs text-muted-foreground/60 mt-1">
              Concatenazione video con Shotstack
            </span>
          </div>
        )}
        
        {nodeData.status === "completed" && currentVideoUrl && (
          <div className="space-y-2">
            <div className="relative group">
              <video
                ref={videoRef}
                src={currentVideoUrl}
                controls={!hasMultipleSegments}
                className="w-full h-36 object-contain rounded-md bg-black"
                loop={!hasMultipleSegments}
                playsInline
                onEnded={handleVideoEnded}
              />
              {nodeData.audioUrl && (
                <audio 
                  ref={audioRef} 
                  src={nodeData.audioUrl} 
                  loop={!hasMultipleSegments}
                />
              )}
              <div className="absolute top-1 right-1 flex gap-1">
                {nodeData.audioUrl && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 bg-black/50 hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={toggleAudio}
                  >
                    {isAudioPlaying ? (
                      <Volume2 className="h-3 w-3 text-orange-400" />
                    ) : (
                      <VolumeX className="h-3 w-3 text-white" />
                    )}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 bg-black/50 hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={handleFullscreen}
                >
                  <Maximize2 className="h-3 w-3 text-white" />
                </Button>
              </div>
            </div>

            {/* Multi-segment playback controls */}
            {hasMultipleSegments && (
              <div className="space-y-2 p-2 bg-muted/20 rounded-md">
                <Progress value={playbackProgress} className="h-1" />
                
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    Clip {currentSegmentIndex + 1} / {segments.length}
                  </span>
                  
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={skipPrevious}
                      disabled={currentSegmentIndex === 0}
                      className="h-6 w-6"
                    >
                      <SkipBack className="h-3 w-3" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={playPause}
                      className="h-7 w-7"
                    >
                      {isPlaying ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={skipNext}
                      disabled={currentSegmentIndex === segments.length - 1}
                      className="h-6 w-6"
                    >
                      <SkipForward className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Audio volume control */}
            {nodeData.audioUrl && (
              <div className="flex items-center gap-2 p-2 bg-orange-500/10 rounded-md">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleAudio}
                  className="h-6 w-6"
                >
                  {isAudioPlaying ? (
                    <Volume2 className="h-3 w-3 text-orange-400" />
                  ) : (
                    <VolumeX className="h-3 w-3" />
                  )}
                </Button>
                <Slider
                  value={[audioVolume]}
                  max={1}
                  step={0.1}
                  onValueChange={handleVolumeChange}
                  className="flex-1"
                />
                <span className="text-[10px] text-muted-foreground w-8">
                  {Math.round(audioVolume * 100)}%
                </span>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleDownload}
              >
                <Download className="h-3 w-3 mr-1" />
                Video
              </Button>
              {nodeData.audioUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={handleDownloadAudio}
                >
                  <Music className="h-3 w-3 mr-1" />
                  Audio
                </Button>
              )}
            </div>
          </div>
        )}
        
        {nodeData.status === "error" && (
          <div className="flex flex-col items-center justify-center h-44 bg-destructive/10 rounded-md p-2">
            <AlertCircle className="h-8 w-8 text-destructive mb-2" />
            <span className="text-xs text-destructive text-center">{nodeData.error || "Errore"}</span>
          </div>
        )}
        
        {nodeData.status === "idle" && (
          <div className="flex flex-col items-center justify-center h-44 bg-muted/30 rounded-md border-2 border-dashed border-muted-foreground/30">
            <Play className="h-8 w-8 text-muted-foreground mb-2" />
            <span className="text-xs text-muted-foreground">In attesa...</span>
            <span className="text-xs text-muted-foreground/60 mt-1 text-center px-4">
              Collega nodi Video Concat e/o Audio
            </span>
          </div>
        )}
      </CardContent>
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-purple-500 border-2 border-background"
      />
    </Card>
  );
});

FinalVideoNode.displayName = "FinalVideoNode";

export default FinalVideoNode;
