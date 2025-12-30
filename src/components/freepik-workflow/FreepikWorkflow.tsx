import { useCallback, useState, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { WorkflowToolbar } from "./WorkflowToolbar";
import { NODE_TYPES, NodeTypeKey, WorkflowNode, WorkflowEdge } from "./types";
import ImageInputNode from "./nodes/ImageInputNode";
import NoteNode from "./nodes/NoteNode";
import InstructionsNode from "./nodes/InstructionsNode";
import ImageResultNode from "./nodes/ImageResultNode";
import VideoResultNode from "./nodes/VideoResultNode";
import { toast } from "sonner";

const nodeTypes = {
  imageInput: ImageInputNode,
  note: NoteNode,
  instructions: InstructionsNode,
  imageResult: ImageResultNode,
  videoResult: VideoResultNode,
};

// Initial nodes for demo
const initialNodes: WorkflowNode[] = [
  {
    id: "input-1",
    type: "imageInput",
    position: { x: 50, y: 150 },
    data: { label: "Input Image" },
  },
  {
    id: "note-1",
    type: "note",
    position: { x: 350, y: 100 },
    data: { label: "Note", text: "" },
  },
  {
    id: "instructions-1",
    type: "instructions",
    position: { x: 650, y: 150 },
    data: { label: "Instructions", prompt: "", model: "mystic", aspectRatio: "1:1" },
  },
  {
    id: "result-1",
    type: "imageResult",
    position: { x: 1000, y: 150 },
    data: { label: "Image Result", status: "idle" },
  },
];

const initialEdges: WorkflowEdge[] = [
  { id: "e1-2", source: "input-1", target: "note-1", animated: true, style: { stroke: "#f59e0b" } },
  { id: "e2-3", source: "note-1", target: "instructions-1", animated: true, style: { stroke: "#8b5cf6" } },
  { id: "e3-4", source: "instructions-1", target: "result-1", animated: true, style: { stroke: "#10b981" } },
];

const FreepikWorkflowInner = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [isRunning, setIsRunning] = useState(false);
  const { fitView, zoomIn, zoomOut } = useReactFlow();

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: "#6366f1" } }, eds));
    },
    [setEdges]
  );

  const addNode = useCallback((type: NodeTypeKey) => {
    const id = `${type}-${Date.now()}`;
    const position = { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 };
    
    const getNodeData = () => {
      switch (type) {
        case "imageInput":
          return { label: "Input Image" };
        case "note":
          return { label: "Note", text: "" };
        case "instructions":
          return { label: "Instructions", prompt: "", model: "mystic", aspectRatio: "1:1" };
        case "imageResult":
          return { label: "Image Result", status: "idle" as const };
        case "videoResult":
          return { label: "Video Result", status: "idle" as const };
        default:
          return { label: type };
      }
    };

    const newNode: WorkflowNode = {
      id,
      type,
      position,
      data: getNodeData(),
    };

    setNodes((nds) => [...nds, newNode]);
    toast.success(`Nodo ${type} aggiunto`);
  }, [setNodes]);

  const runWorkflow = useCallback(async () => {
    setIsRunning(true);
    toast.info("Esecuzione workflow in corso...");
    
    // Find instructions node and its connected result node
    const instructionsNode = nodes.find((n) => n.type === "instructions");
    if (!instructionsNode) {
      toast.error("Aggiungi un nodo Instructions per eseguire il workflow");
      setIsRunning(false);
      return;
    }

    // Find connected result nodes
    const connectedResultEdge = edges.find((e) => e.source === instructionsNode.id);
    if (!connectedResultEdge) {
      toast.error("Collega il nodo Instructions a un nodo Result");
      setIsRunning(false);
      return;
    }

    // Set result node to generating
    setNodes((nds) =>
      nds.map((n) =>
        n.id === connectedResultEdge.target
          ? { ...n, data: { ...n.data, status: "generating" } }
          : n
      )
    );

    // Simulate generation (in real implementation, call Freepik API)
    setTimeout(() => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === connectedResultEdge.target
            ? {
                ...n,
                data: {
                  ...n.data,
                  status: "completed",
                  imageUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400",
                },
              }
            : n
        )
      );
      setIsRunning(false);
      toast.success("Workflow completato!");
    }, 3000);
  }, [nodes, edges, setNodes]);

  const clearCanvas = useCallback(() => {
    setNodes([]);
    setEdges([]);
    toast.info("Canvas pulito");
  }, [setNodes, setEdges]);

  const exportWorkflow = useCallback(() => {
    const workflowData = { nodes, edges };
    const blob = new Blob([JSON.stringify(workflowData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "freepik-workflow.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Workflow esportato");
  }, [nodes, edges]);

  return (
    <div className="w-full h-[600px] bg-background rounded-lg border border-border/50 overflow-hidden relative">
      <WorkflowToolbar
        onAddNode={addNode}
        onRunWorkflow={runWorkflow}
        onClearCanvas={clearCanvas}
        onExport={exportWorkflow}
        onZoomIn={() => zoomIn()}
        onZoomOut={() => zoomOut()}
        onFitView={() => fitView()}
        isRunning={isRunning}
      />
      
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        className="bg-background"
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(var(--muted-foreground) / 0.2)" />
        <MiniMap 
          className="!bg-background/80 !border-border/50"
          nodeColor={(node) => {
            switch (node.type) {
              case "imageInput": return "hsl(var(--primary))";
              case "note": return "#f59e0b";
              case "instructions": return "#8b5cf6";
              case "imageResult": return "#10b981";
              case "videoResult": return "#3b82f6";
              default: return "hsl(var(--muted))";
            }
          }}
        />
      </ReactFlow>
    </div>
  );
};

export const FreepikWorkflow = () => {
  return (
    <ReactFlowProvider>
      <FreepikWorkflowInner />
    </ReactFlowProvider>
  );
};

export default FreepikWorkflow;
