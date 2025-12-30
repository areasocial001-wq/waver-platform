import { memo, useCallback, useRef, useEffect, useState } from "react";
import { Handle, Position, NodeProps, useReactFlow, useEdges, useNodes } from "@xyflow/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Video, X, ImageIcon } from "lucide-react";
import { FreepikVideoNodeData, ImageInputNodeData } from "../types";

const FreepikVideoNode = memo(({ id, data }: NodeProps) => {
  const nodeData = data as unknown as FreepikVideoNodeData;
  const { setNodes } = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const edges = useEdges();
  const nodes = useNodes();
  const [connectedImageUrl, setConnectedImageUrl] = useState<string | undefined>();

  // Find connected input image
  useEffect(() => {
    const visitedNodes = new Set<string>();
    const queue = [id];
    
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visitedNodes.has(currentId)) continue;
      visitedNodes.add(currentId);
      
      const incomingEdges = edges.filter(e => e.target === currentId);
      for (const edge of incomingEdges) {
        const sourceNode = nodes.find(n => n.id === edge.source);
        if (sourceNode?.type === "imageInput") {
          const inputData = sourceNode.data as unknown as ImageInputNodeData;
          if (inputData.imageUrl) {
            setConnectedImageUrl(inputData.imageUrl);
            return;
          }
        }
        queue.push(edge.source);
      }
    }
    setConnectedImageUrl(undefined);
  }, [id, edges, nodes]);

  const updateNodeData = useCallback((field: string, value: string | number | undefined) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, [field]: value } }
          : node
      )
    );
  }, [id, setNodes]);

  const handleLastFrameUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const imageUrl = event.target?.result as string;
      setNodes((nds) =>
        nds.map((node) =>
          node.id === id
            ? { 
                ...node, 
                data: { 
                  ...node.data, 
                  lastFrameImageUrl: imageUrl,
                  lastFrameFileName: file.name 
                } 
              }
            : node
        )
      );
    };
    reader.readAsDataURL(file);
  }, [id, setNodes]);

  const clearLastFrame = useCallback(() => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === id
          ? { 
              ...node, 
              data: { 
                ...node.data, 
                lastFrameImageUrl: undefined,
                lastFrameFileName: undefined 
              } 
            }
          : node
      )
    );
  }, [id, setNodes]);

  const isMinimax = nodeData.model === "minimax";

  return (
    <Card className="w-72 bg-cyan-500/10 backdrop-blur border-cyan-500/30 shadow-lg shadow-cyan-500/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Video className="h-4 w-4 text-cyan-500" />
          Freepik Video
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* First Frame Preview - from connected Input Image */}
        {connectedImageUrl && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <ImageIcon className="h-3 w-3" />
              First Frame (collegato)
            </Label>
            <div className="relative">
              <img
                src={connectedImageUrl}
                alt="First frame preview"
                className="w-full h-20 object-cover rounded-md border-2 border-primary/50"
              />
              <div className="absolute bottom-1 left-1 bg-background/80 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] text-primary font-medium">
                Image-to-Video
              </div>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Prompt</Label>
          <Textarea
            placeholder="Descrivi il movimento del video..."
            className="text-xs min-h-[60px] resize-none bg-background/50"
            value={nodeData.prompt || ""}
            onChange={(e) => updateNodeData("prompt", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Modello</Label>
            <Select
              value={nodeData.model || "kling"}
              onValueChange={(v) => {
                updateNodeData("model", v);
                // Clear last frame if switching away from minimax
                if (v !== "minimax" && nodeData.lastFrameImageUrl) {
                  clearLastFrame();
                }
              }}
            >
              <SelectTrigger className="h-8 text-xs bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kling">Kling v2.5 Pro</SelectItem>
                <SelectItem value="minimax">MiniMax Hailuo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Durata</Label>
            <Select
              value={String(nodeData.duration || 6)}
              onValueChange={(v) => updateNodeData("duration", parseInt(v))}
            >
              <SelectTrigger className="h-8 text-xs bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 sec</SelectItem>
                <SelectItem value="6">6 sec</SelectItem>
                <SelectItem value="10">10 sec</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Last Frame Image - Only for MiniMax */}
        {isMinimax && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Last Frame (opzionale)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLastFrameUpload}
            />
            {nodeData.lastFrameImageUrl ? (
              <div className="relative">
                <img
                  src={nodeData.lastFrameImageUrl}
                  alt="Last frame"
                  className="w-full h-16 object-cover rounded-md border border-border/50"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute -top-1 -right-1 h-5 w-5"
                  onClick={clearLastFrame}
                >
                  <X className="h-3 w-3" />
                </Button>
                <p className="text-[10px] text-muted-foreground mt-1 truncate">
                  {nodeData.lastFrameFileName}
                </p>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 text-xs"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="h-3 w-3 mr-1" />
                Carica Last Frame
              </Button>
            )}
            <p className="text-[10px] text-muted-foreground">
              Solo MiniMax supporta l'immagine finale
            </p>
          </div>
        )}

        {!connectedImageUrl && (
          <p className="text-[10px] text-muted-foreground">
            Collega un Input Image per image-to-video, o lascia vuoto per text-to-video.
          </p>
        )}
      </CardContent>
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-cyan-500 border-2 border-background"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-cyan-500 border-2 border-background"
      />
    </Card>
  );
});

FreepikVideoNode.displayName = "FreepikVideoNode";

export default FreepikVideoNode;