import { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Image, Download, Loader2, AlertCircle } from "lucide-react";
import { ImageResultNodeData } from "../types";

const ImageResultNode = memo(({ data }: NodeProps) => {
  const nodeData = data as unknown as ImageResultNodeData;

  return (
    <Card className="w-64 bg-emerald-500/10 backdrop-blur border-emerald-500/30 shadow-lg shadow-emerald-500/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Image className="h-4 w-4 text-emerald-500" />
          Image Result
        </CardTitle>
      </CardHeader>
      <CardContent>
        {nodeData.status === "generating" && (
          <div className="flex flex-col items-center justify-center h-32 bg-muted/30 rounded-md">
            <Loader2 className="h-8 w-8 text-emerald-500 animate-spin mb-2" />
            <span className="text-xs text-muted-foreground">Generando...</span>
          </div>
        )}
        
        {nodeData.status === "completed" && nodeData.imageUrl && (
          <div className="space-y-2">
            <img
              src={nodeData.imageUrl}
              alt="Generated"
              className="w-full h-32 object-cover rounded-md"
            />
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => window.open(nodeData.imageUrl, "_blank")}
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
            <Image className="h-8 w-8 text-muted-foreground mb-2" />
            <span className="text-xs text-muted-foreground">In attesa...</span>
          </div>
        )}
      </CardContent>
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-emerald-500 border-2 border-background"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-emerald-500 border-2 border-background"
      />
    </Card>
  );
});

ImageResultNode.displayName = "ImageResultNode";

export default ImageResultNode;
