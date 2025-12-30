import { memo, useCallback } from "react";
import { Handle, Position, NodeProps, useReactFlow } from "@xyflow/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Sparkles } from "lucide-react";
import { InstructionsNodeData } from "../types";

const InstructionsNode = memo(({ id, data }: NodeProps) => {
  const { setNodes } = useReactFlow();
  const nodeData = data as unknown as InstructionsNodeData;

  const updateNodeData = useCallback((updates: Partial<InstructionsNodeData>) => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, ...updates } }
          : node
      )
    );
  }, [id, setNodes]);

  return (
    <Card className="w-72 bg-violet-500/10 backdrop-blur border-violet-500/30 shadow-lg shadow-violet-500/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" />
          Instructions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Prompt</Label>
          <Textarea
            placeholder="Istruzioni dettagliate per l'AI..."
            value={nodeData.prompt || ""}
            onChange={(e) => updateNodeData({ prompt: e.target.value })}
            rows={4}
            className="text-sm resize-none bg-transparent border-violet-500/30 focus:border-violet-500"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Modello</Label>
            <Select
              value={nodeData.model || "mystic"}
              onValueChange={(value) => updateNodeData({ model: value })}
            >
              <SelectTrigger className="h-8 text-xs bg-transparent border-violet-500/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mystic">Mystic</SelectItem>
                <SelectItem value="flux">Flux</SelectItem>
                <SelectItem value="kling-video">Kling Video</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-1">
            <Label className="text-xs">Aspect Ratio</Label>
            <Select
              value={nodeData.aspectRatio || "1:1"}
              onValueChange={(value) => updateNodeData({ aspectRatio: value })}
            >
              <SelectTrigger className="h-8 text-xs bg-transparent border-violet-500/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1:1">1:1</SelectItem>
                <SelectItem value="16:9">16:9</SelectItem>
                <SelectItem value="9:16">9:16</SelectItem>
                <SelectItem value="4:3">4:3</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-violet-500 border-2 border-background"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-violet-500 border-2 border-background"
      />
    </Card>
  );
});

InstructionsNode.displayName = "InstructionsNode";

export default InstructionsNode;
