import { memo, useCallback } from "react";
import { Handle, Position, NodeProps, useReactFlow } from "@xyflow/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { StickyNote } from "lucide-react";
import { NoteNodeData } from "../types";

const NoteNode = memo(({ id, data }: NodeProps) => {
  const { setNodes } = useReactFlow();
  const nodeData = data as unknown as NoteNodeData;

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, text: e.target.value } }
          : node
      )
    );
  }, [id, setNodes]);

  return (
    <Card className="w-64 bg-amber-500/10 backdrop-blur border-amber-500/30 shadow-lg shadow-amber-500/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-amber-500" />
          Note
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Textarea
          placeholder="Descrivi l'immagine di riferimento..."
          value={nodeData.text || ""}
          onChange={handleTextChange}
          rows={4}
          className="text-sm resize-none bg-transparent border-amber-500/30 focus:border-amber-500"
        />
      </CardContent>
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-amber-500 border-2 border-background"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-amber-500 border-2 border-background"
      />
    </Card>
  );
});

NoteNode.displayName = "NoteNode";

export default NoteNode;
