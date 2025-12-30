import { memo, useRef, useEffect, useState } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, Download, Loader2, AlertCircle, Maximize2, Play, Music, Volume2, VolumeX } from "lucide-react";
import { FinalVideoNodeData } from "../types";
import { toast } from "sonner";

interface ExtendedFinalVideoNodeData extends FinalVideoNodeData {
  audioUrl?: string;
}

const FinalVideoNode = memo(({ data }: NodeProps) => {
  const nodeData = data as unknown as ExtendedFinalVideoNodeData;
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  // Sync audio with video
  useEffect(() => {
    if (videoRef.current && audioRef.current && nodeData.audioUrl) {
      const video = videoRef.current;
      const audio = audioRef.current;
      
      const handlePlay = () => {
        audio.currentTime = video.currentTime;
        audio.play();
        setIsAudioPlaying(true);
      };
      
      const handlePause = () => {
        audio.pause();
        setIsAudioPlaying(false);
      };
      
      const handleSeek = () => {
        audio.currentTime = video.currentTime;
      };
      
      video.addEventListener("play", handlePlay);
      video.addEventListener("pause", handlePause);
      video.addEventListener("seeked", handleSeek);
      
      return () => {
        video.removeEventListener("play", handlePlay);
        video.removeEventListener("pause", handlePause);
        video.removeEventListener("seeked", handleSeek);
      };
    }
  }, [nodeData.audioUrl, nodeData.videoUrl]);

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
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const toggleAudio = () => {
    if (audioRef.current) {
      if (isAudioPlaying) {
        audioRef.current.pause();
        setIsAudioPlaying(false);
      } else {
        audioRef.current.play();
        setIsAudioPlaying(true);
      }
    }
  };

  return (
    <Card className="w-80 bg-gradient-to-br from-purple-500/10 to-orange-500/10 backdrop-blur border-purple-500/30 shadow-lg shadow-purple-500/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Video className="h-4 w-4 text-purple-500" />
          Video Finale
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
              Concatenazione video e mixaggio audio
            </span>
          </div>
        )}
        
        {nodeData.status === "completed" && nodeData.videoUrl && (
          <div className="space-y-2">
            <div className="relative group">
              <video
                ref={videoRef}
                src={nodeData.videoUrl}
                controls
                className="w-full h-36 object-contain rounded-md bg-black"
                loop
                playsInline
              />
              {nodeData.audioUrl && (
                <audio ref={audioRef} src={nodeData.audioUrl} loop />
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
