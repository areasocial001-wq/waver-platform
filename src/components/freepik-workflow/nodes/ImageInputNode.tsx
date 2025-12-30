import { memo, useCallback } from "react";
import { Handle, Position, NodeProps, useReactFlow } from "@xyflow/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Image, Upload, X } from "lucide-react";
import { ImageInputNodeData } from "../types";

const ImageInputNode = memo(({ id, data }: NodeProps) => {
  const { setNodes } = useReactFlow();
  const nodeData = data as unknown as ImageInputNodeData;

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNodes((nodes) =>
          nodes.map((node) =>
            node.id === id
              ? { ...node, data: { ...node.data, imageUrl: reader.result as string, fileName: file.name } }
              : node
          )
        );
      };
      reader.readAsDataURL(file);
    }
  }, [id, setNodes]);

  const handleClear = useCallback(() => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, imageUrl: undefined, fileName: undefined } }
          : node
      )
    );
  }, [id, setNodes]);

  return (
    <Card className="w-64 bg-card/95 backdrop-blur border-primary/30 shadow-lg shadow-primary/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Image className="h-4 w-4 text-primary" />
          Input
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {nodeData.imageUrl ? (
          <div className="relative">
            <img
              src={nodeData.imageUrl}
              alt={nodeData.fileName || "Input"}
              className="w-full h-32 object-cover rounded-md"
            />
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-1 right-1 h-6 w-6"
              onClick={handleClear}
            >
              <X className="h-3 w-3" />
            </Button>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {nodeData.fileName}
            </p>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-muted-foreground/30 rounded-md cursor-pointer hover:border-primary/50 transition-colors">
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            <span className="text-xs text-muted-foreground">Carica immagine</span>
            <Input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
        )}
      </CardContent>
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-primary border-2 border-background"
      />
    </Card>
  );
});

ImageInputNode.displayName = "ImageInputNode";

export default ImageInputNode;
