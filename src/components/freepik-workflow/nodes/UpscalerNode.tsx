import { memo, useCallback } from "react";
import { Handle, Position, NodeProps, useReactFlow } from "@xyflow/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ZoomIn } from "lucide-react";

interface UpscalerNodeData {
  label: string;
  mode: "creative" | "precision";
  scaleFactor: string;
  optimizedFor: string;
  creativity: number;
}

const UpscalerNode = memo(({ id, data }: NodeProps) => {
  const { setNodes } = useReactFlow();
  const nodeData = data as unknown as UpscalerNodeData;

  const updateNodeData = useCallback((updates: Partial<UpscalerNodeData>) => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, ...updates } }
          : node
      )
    );
  }, [id, setNodes]);

  return (
    <Card className="w-72 bg-pink-500/10 backdrop-blur border-pink-500/30 shadow-lg shadow-pink-500/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <ZoomIn className="h-4 w-4 text-pink-500" />
          Magnific Upscaler
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Modalità</Label>
            <Select
              value={nodeData.mode || "creative"}
              onValueChange={(value) => updateNodeData({ mode: value as "creative" | "precision" })}
            >
              <SelectTrigger className="h-8 text-xs bg-transparent border-pink-500/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="creative">Creative</SelectItem>
                <SelectItem value="precision">Precision</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-1">
            <Label className="text-xs">Scala</Label>
            <Select
              value={nodeData.scaleFactor || "2x"}
              onValueChange={(value) => updateNodeData({ scaleFactor: value })}
            >
              <SelectTrigger className="h-8 text-xs bg-transparent border-pink-500/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2x">2x</SelectItem>
                <SelectItem value="4x">4x</SelectItem>
                <SelectItem value="8x">8x</SelectItem>
                <SelectItem value="16x">16x</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="space-y-1">
          <Label className="text-xs">Ottimizzato per</Label>
          <Select
            value={nodeData.optimizedFor || "standard"}
            onValueChange={(value) => updateNodeData({ optimizedFor: value })}
          >
            <SelectTrigger className="h-8 text-xs bg-transparent border-pink-500/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {nodeData.mode === "precision" ? (
                <>
                  <SelectItem value="photo">Foto</SelectItem>
                  <SelectItem value="sublime">Sublime</SelectItem>
                  <SelectItem value="photo_denoiser">Photo Denoiser</SelectItem>
                </>
              ) : (
                <>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="soft_portraits">Ritratti Soft</SelectItem>
                  <SelectItem value="hard_portraits">Ritratti Nitidi</SelectItem>
                  <SelectItem value="art_n_illustration">Arte/Illustrazione</SelectItem>
                  <SelectItem value="films_n_photography">Film/Fotografia</SelectItem>
                  <SelectItem value="3d_renders">3D Renders</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        </div>

        {nodeData.mode !== "precision" && (
          <div className="space-y-1">
            <Label className="text-xs">Creatività: {nodeData.creativity || 0}</Label>
            <Slider 
              value={[nodeData.creativity || 0]} 
              onValueChange={(v) => updateNodeData({ creativity: v[0] })} 
              min={-10} 
              max={10} 
              step={1}
              className="py-2"
            />
          </div>
        )}
      </CardContent>
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-pink-500 border-2 border-background"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-pink-500 border-2 border-background"
      />
    </Card>
  );
});

UpscalerNode.displayName = "UpscalerNode";

export default UpscalerNode;
