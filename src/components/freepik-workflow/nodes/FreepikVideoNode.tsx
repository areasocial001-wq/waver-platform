import { memo, useCallback } from "react";
import { Handle, Position, NodeProps, useReactFlow } from "@xyflow/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Video } from "lucide-react";
import { FreepikVideoNodeData } from "../types";

const FreepikVideoNode = memo(({ id, data }: NodeProps) => {
  const nodeData = data as unknown as FreepikVideoNodeData;
  const { setNodes } = useReactFlow();

  const updateNodeData = useCallback((field: string, value: string | number) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, [field]: value } }
          : node
      )
    );
  }, [id, setNodes]);

  return (
    <Card className="w-72 bg-cyan-500/10 backdrop-blur border-cyan-500/30 shadow-lg shadow-cyan-500/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Video className="h-4 w-4 text-cyan-500" />
          Freepik Video
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
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
              onValueChange={(v) => updateNodeData("model", v)}
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

        <p className="text-[10px] text-muted-foreground">
          Collega un Input Image per image-to-video, o lascia vuoto per text-to-video.
        </p>
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
