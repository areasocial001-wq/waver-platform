import { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Image, Download, Loader2, AlertCircle, Save } from "lucide-react";
import { ImageResultNodeData } from "../types";
import { useImageGallery } from "@/contexts/ImageGalleryContext";
import { toast } from "sonner";

const ImageResultNode = memo(({ data }: NodeProps) => {
  const nodeData = data as unknown as ImageResultNodeData;
  const { addImage } = useImageGallery();

  const handleDownload = async () => {
    if (!nodeData.imageUrl) return;
    
    try {
      const response = await fetch(nodeData.imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `workflow-image-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("Immagine scaricata!");
    } catch (error) {
      toast.error("Errore durante il download");
    }
  };

  const handleSaveToGallery = () => {
    if (!nodeData.imageUrl) return;
    
    addImage({
      url: nodeData.imageUrl,
      prompt: "Workflow generated",
      aspectRatio: "1:1",
      model: "freepik",
    });
    toast.success("Immagine salvata in galleria!");
  };

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
              className="w-full h-32 object-cover rounded-md cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => window.open(nodeData.imageUrl, "_blank")}
            />
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleDownload}
              >
                <Download className="h-3 w-3 mr-1" />
                Scarica
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleSaveToGallery}
              >
                <Save className="h-3 w-3 mr-1" />
                Galleria
              </Button>
            </div>
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
