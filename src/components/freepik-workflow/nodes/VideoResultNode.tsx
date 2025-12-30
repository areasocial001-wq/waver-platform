import { memo, useRef } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, Download, Loader2, AlertCircle, Play, Pause, Maximize2 } from "lucide-react";
import { VideoResultNodeData } from "../types";
import { toast } from "sonner";

const VideoResultNode = memo(({ data }: NodeProps) => {
  const nodeData = data as unknown as VideoResultNodeData;
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleDownload = async () => {
    if (!nodeData.videoUrl) return;
    
    try {
      const response = await fetch(nodeData.videoUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `workflow-video-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("Video scaricato!");
    } catch (error) {
      toast.error("Errore durante il download");
    }
  };

  const handleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };

  return (
    <Card className="w-72 bg-blue-500/10 backdrop-blur border-blue-500/30 shadow-lg shadow-blue-500/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Video className="h-4 w-4 text-blue-500" />
          Video Result
        </CardTitle>
      </CardHeader>
      <CardContent>
        {nodeData.status === "generating" && (
          <div className="flex flex-col items-center justify-center h-40 bg-muted/30 rounded-md">
            <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-2" />
            <span className="text-xs text-muted-foreground">Generando video...</span>
            <span className="text-xs text-muted-foreground/60 mt-1">Può richiedere alcuni minuti</span>
          </div>
        )}
        
        {nodeData.status === "completed" && nodeData.videoUrl && (
          <div className="space-y-2">
            <div className="relative group">
              <video
                ref={videoRef}
                src={nodeData.videoUrl}
                controls
                className="w-full h-40 object-contain rounded-md bg-black"
                loop
                playsInline
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 bg-black/50 hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handleFullscreen}
              >
                <Maximize2 className="h-3 w-3 text-white" />
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleDownload}
            >
              <Download className="h-3 w-3 mr-1" />
              Scarica Video
            </Button>
          </div>
        )}
        
        {nodeData.status === "error" && (
          <div className="flex flex-col items-center justify-center h-40 bg-destructive/10 rounded-md p-2">
            <AlertCircle className="h-8 w-8 text-destructive mb-2" />
            <span className="text-xs text-destructive text-center">{nodeData.error || "Errore"}</span>
          </div>
        )}
        
        {nodeData.status === "idle" && (
          <div className="flex flex-col items-center justify-center h-40 bg-muted/30 rounded-md border-2 border-dashed border-muted-foreground/30">
            <Video className="h-8 w-8 text-muted-foreground mb-2" />
            <span className="text-xs text-muted-foreground">In attesa...</span>
            <span className="text-xs text-muted-foreground/60 mt-1">Collega un nodo Freepik Video</span>
          </div>
        )}
      </CardContent>
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-blue-500 border-2 border-background"
      />
    </Card>
  );
});

VideoResultNode.displayName = "VideoResultNode";

export default VideoResultNode;
