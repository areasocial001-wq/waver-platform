import { memo, useCallback, useEffect, useState } from "react";
import { Handle, Position, NodeProps, useReactFlow } from "@xyflow/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Layers, Video, ArrowRight } from "lucide-react";
import { VideoConcatNodeData, VideoResultNodeData } from "../types";

const VideoConcatNode = memo(({ data, id }: NodeProps) => {
  const nodeData = data as unknown as VideoConcatNodeData;
  const { getNodes, getEdges } = useReactFlow();
  const [connectedVideos, setConnectedVideos] = useState<{ id: string; url?: string }[]>([]);

  // Find all connected video result nodes
  useEffect(() => {
    const edges = getEdges();
    const nodes = getNodes();
    const incomingEdges = edges.filter((e) => e.target === id);
    
    const videos: { id: string; url?: string }[] = [];
    for (const edge of incomingEdges) {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      if (sourceNode?.type === "videoResult") {
        const videoData = sourceNode.data as unknown as VideoResultNodeData;
        videos.push({
          id: sourceNode.id,
          url: videoData.videoUrl,
        });
      }
    }
    setConnectedVideos(videos);
  }, [getNodes, getEdges, id]);

  const handleChange = (field: string, value: any) => {
    const event = new CustomEvent("nodeDataChange", {
      detail: {
        nodeId: id,
        data: { ...nodeData, [field]: value },
      },
    });
    window.dispatchEvent(event);
  };

  return (
    <Card className="w-72 bg-purple-500/10 backdrop-blur border-purple-500/30 shadow-lg shadow-purple-500/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Layers className="h-4 w-4 text-purple-500" />
          Concatena Video
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label className="text-xs">Video Collegati</Label>
          {connectedVideos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-16 bg-muted/30 rounded-md border-2 border-dashed border-muted-foreground/30">
              <Video className="h-5 w-5 text-muted-foreground mb-1" />
              <span className="text-xs text-muted-foreground">Collega nodi Video Result</span>
            </div>
          ) : (
            <div className="space-y-1">
              {connectedVideos.map((video, index) => (
                <div
                  key={video.id}
                  className="flex items-center gap-2 p-2 bg-muted/30 rounded text-xs"
                >
                  <Badge variant="outline" className="h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                    {index + 1}
                  </Badge>
                  <Video className="h-3 w-3 text-purple-500" />
                  <span className="flex-1 truncate text-muted-foreground">
                    {video.url ? "Video pronto" : "In attesa..."}
                  </span>
                  {index < connectedVideos.length - 1 && (
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Transizione</Label>
          <Select
            value={nodeData.transition || "none"}
            onValueChange={(value) => handleChange("transition", value)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nessuna</SelectItem>
              <SelectItem value="fade">Dissolvenza</SelectItem>
              <SelectItem value="crossfade">Crossfade</SelectItem>
              <SelectItem value="wipe">Wipe</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Durata Transizione (sec)</Label>
          <Select
            value={String(nodeData.transitionDuration || 0.5)}
            onValueChange={(value) => handleChange("transitionDuration", parseFloat(value))}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0.25">0.25s</SelectItem>
              <SelectItem value="0.5">0.5s</SelectItem>
              <SelectItem value="1">1s</SelectItem>
              <SelectItem value="2">2s</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Output</Label>
          <Select
            value={nodeData.outputFormat || "mp4"}
            onValueChange={(value) => handleChange("outputFormat", value)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mp4">MP4</SelectItem>
              <SelectItem value="webm">WebM</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="pt-2 border-t border-border/30">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Video totali:</span>
            <Badge variant="secondary" className="text-[10px]">
              {connectedVideos.length}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
            <span>Pronti:</span>
            <Badge variant="secondary" className="text-[10px]">
              {connectedVideos.filter((v) => v.url).length}
            </Badge>
          </div>
        </div>
      </CardContent>
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-purple-500 border-2 border-background"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-purple-500 border-2 border-background"
      />
    </Card>
  );
});

VideoConcatNode.displayName = "VideoConcatNode";

export default VideoConcatNode;
