import { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, Download, Loader2, AlertCircle } from "lucide-react";
import { VideoResultNodeData } from "../types";

const VideoResultNode = memo(({ data }: NodeProps) => {
  const nodeData = data as unknown as VideoResultNodeData;

  return (
    <Card className="w-64 bg-blue-500/10 backdrop-blur border-blue-500/30 shadow-lg shadow-blue-500/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Video className="h-4 w-4 text-blue-500" />
          Video Result
        </CardTitle>
      </CardHeader>
      <CardContent>
        {nodeData.status === "generating" && (
          <div className="flex flex-col items-center justify-center h-32 bg-muted/30 rounded-md">
            <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-2" />
            <span className="text-xs text-muted-foreground">Generando video...</span>
          </div>
        )}
        
        {nodeData.status === "completed" && nodeData.videoUrl && (
          <div className="space-y-2">
            <video
              src={nodeData.videoUrl}
              controls
              className="w-full h-32 object-cover rounded-md"
            />
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => window.open(nodeData.videoUrl, "_blank")}
            >
              <Download className="h-3 w-3 mr-1" />
              Download
            </Button>
          </div>
        )}
        
        {nodeData.status === "error" && (
          <div className="flex flex-col items-center justify-center h-32 bg-destructive/10 rounded-md">
            <AlertCircle className="h-8 w-8 text-destructive mb-2" />
            <span className="text-xs text-destructive">{nodeData.error || "Errore"}</span>
          </div>
        )}
        
        {nodeData.status === "idle" && (
          <div className="flex flex-col items-center justify-center h-32 bg-muted/30 rounded-md border-2 border-dashed border-muted-foreground/30">
            <Video className="h-8 w-8 text-muted-foreground mb-2" />
            <span className="text-xs text-muted-foreground">In attesa...</span>
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
