import { useCallback, useState, useRef } from "react";
import {
  ReactFlow,
  Background,
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

import { WorkflowToolbar, TemplateType } from "./WorkflowToolbar";
import { SaveWorkflowDialog, LoadWorkflowDialog } from "./WorkflowDialogs";
import { NODE_TYPES, NodeTypeKey, WorkflowNode, WorkflowEdge, InstructionsNodeData, ImageInputNodeData, UpscalerNodeData, FreepikVideoNodeData } from "./types";
import ImageInputNode from "./nodes/ImageInputNode";
import NoteNode from "./nodes/NoteNode";
import InstructionsNode from "./nodes/InstructionsNode";
import UpscalerNode from "./nodes/UpscalerNode";
import FreepikVideoNode from "./nodes/FreepikVideoNode";
import ImageResultNode from "./nodes/ImageResultNode";
import VideoResultNode from "./nodes/VideoResultNode";
import { SavedWorkflow } from "@/hooks/useWorkflows";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const nodeTypes = {
  imageInput: ImageInputNode,
  note: NoteNode,
  instructions: InstructionsNode,
  upscaler: UpscalerNode,
  freepikVideo: FreepikVideoNode,
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
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [currentWorkflowId, setCurrentWorkflowId] = useState<string | undefined>();
  const [currentWorkflowName, setCurrentWorkflowName] = useState<string | undefined>();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
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
        case "upscaler":
          return { label: "Upscaler", mode: "creative" as const, scaleFactor: "2x", optimizedFor: "standard", creativity: 0 };
        case "freepikVideo":
          return { label: "Freepik Video", prompt: "", model: "kling" as const, duration: 6 };
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

  // Find connected input image for instructions node
  const findInputImage = useCallback((instructionsNodeId: string): string | undefined => {
    // Traverse backwards through edges to find image input
    const visitedNodes = new Set<string>();
    const queue = [instructionsNodeId];
    
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visitedNodes.has(currentId)) continue;
      visitedNodes.add(currentId);
      
      // Find edges pointing to current node
      const incomingEdges = edges.filter(e => e.target === currentId);
      for (const edge of incomingEdges) {
        const sourceNode = nodes.find(n => n.id === edge.source);
        if (sourceNode?.type === "imageInput") {
          const data = sourceNode.data as unknown as ImageInputNodeData;
          if (data.imageUrl) return data.imageUrl;
        }
        queue.push(edge.source);
      }
    }
    return undefined;
  }, [nodes, edges]);

  // Find upscaler node between input and result
  const findUpscalerNode = useCallback((resultNodeId: string): { node: WorkflowNode; inputImageUrl: string } | undefined => {
    const visitedNodes = new Set<string>();
    const queue = [resultNodeId];
    
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visitedNodes.has(currentId)) continue;
      visitedNodes.add(currentId);
      
      const incomingEdges = edges.filter(e => e.target === currentId);
      for (const edge of incomingEdges) {
        const sourceNode = nodes.find(n => n.id === edge.source);
        if (sourceNode?.type === "upscaler") {
          // Find input image for this upscaler
          const inputImage = findInputImage(sourceNode.id);
          if (inputImage) {
            return { node: sourceNode, inputImageUrl: inputImage };
          }
        }
        queue.push(edge.source);
      }
    }
    return undefined;
  }, [nodes, edges, findInputImage]);

  // Poll for image generation status
  const pollImageStatus = useCallback(async (taskId: string, resultNodeId: string, source: "freepik-image" | "freepik-upscale" = "freepik-image", mode?: string) => {
    try {
      const { data, error } = await supabase.functions.invoke(source, {
        body: { action: "status", taskId, mode },
      });

      if (error) throw error;

      if (data?.data?.status === "COMPLETED" && data?.data?.generated?.[0]?.url) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setNodes((nds) =>
          nds.map((n) =>
            n.id === resultNodeId
              ? { ...n, data: { ...n.data, status: "completed", imageUrl: data.data.generated[0].url } }
              : n
          )
        );
        setIsRunning(false);
        toast.success(source === "freepik-upscale" ? "Immagine upscalata!" : "Immagine generata!");
      } else if (data?.data?.status === "FAILED") {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setNodes((nds) =>
          nds.map((n) =>
            n.id === resultNodeId
              ? { ...n, data: { ...n.data, status: "error", error: "Generazione fallita" } }
              : n
          )
        );
        setIsRunning(false);
        toast.error("Generazione fallita");
      }
    } catch (err: any) {
      console.error("Poll error:", err);
    }
  }, [setNodes]);

  // Poll for video generation status (via database)
  const pollVideoStatus = useCallback(async (generationId: string, resultNodeId: string) => {
    try {
      const { data, error } = await supabase
        .from("video_generations")
        .select("status, video_url, error_message")
        .eq("id", generationId)
        .maybeSingle();

      if (error) throw error;

      if (data?.status === "completed" && data?.video_url) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setNodes((nds) =>
          nds.map((n) =>
            n.id === resultNodeId
              ? { ...n, data: { ...n.data, status: "completed", videoUrl: data.video_url } }
              : n
          )
        );
        setIsRunning(false);
        toast.success("Video generato!");
      } else if (data?.status === "failed") {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setNodes((nds) =>
          nds.map((n) =>
            n.id === resultNodeId
              ? { ...n, data: { ...n.data, status: "error", error: data.error_message || "Generazione fallita" } }
              : n
          )
        );
        setIsRunning(false);
        toast.error("Generazione video fallita");
      }
    } catch (err: any) {
      console.error("Poll video error:", err);
    }
  }, [setNodes]);

  // Poll for Freepik video generation status
  const pollFreepikVideoStatus = useCallback(async (taskId: string, resultNodeId: string, model: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("freepik-video", {
        body: { action: "status", taskId, model },
      });

      if (error) throw error;

      console.log("Freepik video status:", data);

      if (data?.data?.status === "COMPLETED" && data?.data?.video?.url) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setNodes((nds) =>
          nds.map((n) =>
            n.id === resultNodeId
              ? { ...n, data: { ...n.data, status: "completed", videoUrl: data.data.video.url } }
              : n
          )
        );
        setIsRunning(false);
        toast.success("Video Freepik generato!");
      } else if (data?.data?.status === "FAILED") {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setNodes((nds) =>
          nds.map((n) =>
            n.id === resultNodeId
              ? { ...n, data: { ...n.data, status: "error", error: "Generazione fallita" } }
              : n
          )
        );
        setIsRunning(false);
        toast.error("Generazione video fallita");
      }
    } catch (err: any) {
      console.error("Poll Freepik video error:", err);
    }
  }, [setNodes]);

  // Find FreepikVideo node connected to a result
  const findFreepikVideoNode = useCallback((resultNodeId: string): { node: WorkflowNode; inputImageUrl?: string } | undefined => {
    const visitedNodes = new Set<string>();
    const queue = [resultNodeId];
    
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visitedNodes.has(currentId)) continue;
      visitedNodes.add(currentId);
      
      const incomingEdges = edges.filter(e => e.target === currentId);
      for (const edge of incomingEdges) {
        const sourceNode = nodes.find(n => n.id === edge.source);
        if (sourceNode?.type === "freepikVideo") {
          const inputImage = findInputImage(sourceNode.id);
          return { node: sourceNode, inputImageUrl: inputImage };
        }
        queue.push(edge.source);
      }
    }
    return undefined;
  }, [nodes, edges, findInputImage]);

  const runWorkflow = useCallback(async () => {
    setIsRunning(true);
    toast.info("Esecuzione workflow in corso...");
    
    // Check for upscaler workflow first (Input -> Upscaler -> Result)
    const upscalerNodes = nodes.filter((n) => n.type === "upscaler");
    const resultNodes = nodes.filter((n) => n.type === "imageResult" || n.type === "videoResult");
    
    // Find upscaler connected to a result
    for (const resultNode of resultNodes) {
      const upscalerInfo = findUpscalerNode(resultNode.id);
      if (upscalerInfo) {
        // Execute upscaling workflow
        const upscalerData = upscalerInfo.node.data as unknown as UpscalerNodeData;
        
        setNodes((nds) =>
          nds.map((n) =>
            n.id === resultNode.id
              ? { ...n, data: { ...n.data, status: "generating" } }
              : n
          )
        );

        try {
          // Convert image URL to base64 for upscaling
          const response = await fetch(upscalerInfo.inputImageUrl);
          const blob = await response.blob();
          const reader = new FileReader();
          
          reader.onloadend = async () => {
            const base64 = (reader.result as string).split(",")[1];
            
            const body: any = {
              image: base64,
              scaleFactor: upscalerData.scaleFactor || "2x",
              mode: upscalerData.mode || "creative",
              optimizedFor: upscalerData.optimizedFor || "standard",
            };
            
            if (upscalerData.mode === "creative") {
              body.creativity = upscalerData.creativity || 0;
            }

            const { data, error } = await supabase.functions.invoke("freepik-upscale", { body });

            if (error) throw error;

            if (data?.data?.task_id) {
              pollingRef.current = setInterval(() => {
                pollImageStatus(data.data.task_id, resultNode.id, "freepik-upscale", upscalerData.mode);
              }, 4000);
            } else if (data?.data?.generated?.[0]?.url) {
              setNodes((nds) =>
                nds.map((n) =>
                  n.id === resultNode.id
                    ? { ...n, data: { ...n.data, status: "completed", imageUrl: data.data.generated[0].url } }
                    : n
                )
              );
              setIsRunning(false);
              toast.success("Immagine upscalata!");
            }
          };
          
          reader.readAsDataURL(blob);
          return; // Exit after starting upscale workflow
        } catch (err: any) {
          console.error("Upscale error:", err);
          setNodes((nds) =>
            nds.map((n) =>
              n.id === resultNode.id
                ? { ...n, data: { ...n.data, status: "error", error: err.message } }
                : n
            )
          );
          setIsRunning(false);
          toast.error("Errore nell'upscaling");
          return;
        }
      }
    }

    // Check for Freepik Video workflow (Input -> FreepikVideo -> VideoResult)
    for (const resultNode of resultNodes) {
      if (resultNode.type !== "videoResult") continue;
      
      const freepikVideoInfo = findFreepikVideoNode(resultNode.id);
      if (freepikVideoInfo) {
        const videoData = freepikVideoInfo.node.data as unknown as FreepikVideoNodeData;
        
        if (!videoData.prompt?.trim()) {
          toast.error("Inserisci un prompt nel nodo Freepik Video");
          setIsRunning(false);
          return;
        }

        setNodes((nds) =>
          nds.map((n) =>
            n.id === resultNode.id
              ? { ...n, data: { ...n.data, status: "generating" } }
              : n
          )
        );

        try {
          const body: any = {
            prompt: videoData.prompt,
            duration: videoData.duration || 6,
            model: videoData.model || "kling",
          };

          // If there's an input image from connected node, convert to base64
          if (freepikVideoInfo.inputImageUrl) {
            const response = await fetch(freepikVideoInfo.inputImageUrl);
            const blob = await response.blob();
            const base64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
              reader.readAsDataURL(blob);
            });
            body.firstFrameImage = base64;
          }

          // If there's a last frame image (MiniMax only), add it
          if (videoData.model === "minimax" && videoData.lastFrameImageUrl) {
            // Last frame is already base64 from file upload
            const base64Data = videoData.lastFrameImageUrl.split(",")[1];
            if (base64Data) {
              body.lastFrameImage = base64Data;
            }
          }

          const { data, error } = await supabase.functions.invoke("freepik-video", { body });

          if (error) throw error;

          console.log("Freepik video response:", data);

          if (data?.data?.task_id) {
            pollingRef.current = setInterval(() => {
              pollFreepikVideoStatus(data.data.task_id, resultNode.id, videoData.model || "kling");
            }, 5000);
          }
          return; // Exit after starting Freepik video workflow
        } catch (err: any) {
          console.error("Freepik video error:", err);
          setNodes((nds) =>
            nds.map((n) =>
              n.id === resultNode.id
                ? { ...n, data: { ...n.data, status: "error", error: err.message } }
                : n
            )
          );
          setIsRunning(false);
          toast.error("Errore nella generazione video Freepik");
          return;
        }
      }
    }

    // Standard instructions workflow
    const instructionsNode = nodes.find((n) => n.type === "instructions");
    if (!instructionsNode) {
      toast.error("Aggiungi un nodo Instructions, Upscaler o Freepik Video per eseguire il workflow");
      setIsRunning(false);
      return;
    }

    const instructionsData = instructionsNode.data as unknown as InstructionsNodeData;
    if (!instructionsData.prompt?.trim()) {
      toast.error("Inserisci un prompt nel nodo Instructions");
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

    const resultNode = nodes.find((n) => n.id === connectedResultEdge.target);
    if (!resultNode) {
      toast.error("Nodo Result non trovato");
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

    const inputImageUrl = findInputImage(instructionsNode.id);
    const isVideoResult = resultNode.type === "videoResult";
    const model = instructionsData.model || "mystic";

    try {
      if (isVideoResult || model === "kling-video") {
        // Video generation via PiAPI
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          toast.error("Devi essere autenticato");
          setIsRunning(false);
          return;
        }

        const videoPayload: any = {
          type: inputImageUrl ? "image_to_video" : "text_to_video",
          prompt: instructionsData.prompt,
          duration: 5,
          provider: "piapi-kling",
        };

        if (inputImageUrl) {
          videoPayload.imageUrl = inputImageUrl;
        }

        const { data, error } = await supabase.functions.invoke("generate-video", {
          body: videoPayload,
        });

        if (error) throw error;

        if (data?.generationId) {
          // Poll for video completion
          pollingRef.current = setInterval(() => {
            pollVideoStatus(data.generationId, resultNode.id);
          }, 5000);
        }
      } else {
        // Image generation via Freepik Mystic
        const aspectRatioMap: Record<string, string> = {
          "1:1": "square_1_1",
          "16:9": "widescreen_16_9",
          "9:16": "portrait_9_16",
          "4:3": "classic_4_3",
        };

        const { data, error } = await supabase.functions.invoke("freepik-image", {
          body: {
            prompt: instructionsData.prompt,
            resolution: "2k",
            aspectRatio: aspectRatioMap[instructionsData.aspectRatio] || "square_1_1",
            model: model === "flux" ? "flexible" : "realism",
            engine: "automatic",
          },
        });

        if (error) throw error;

        if (data?.data?.task_id) {
          // Poll for image completion
          pollingRef.current = setInterval(() => {
            pollImageStatus(data.data.task_id, resultNode.id);
          }, 3000);
        } else if (data?.data?.generated?.[0]?.url) {
          // Immediate result
          setNodes((nds) =>
            nds.map((n) =>
              n.id === resultNode.id
                ? { ...n, data: { ...n.data, status: "completed", imageUrl: data.data.generated[0].url } }
                : n
            )
          );
          setIsRunning(false);
          toast.success("Immagine generata!");
        }
      }
    } catch (err: any) {
      console.error("Workflow error:", err);
      setNodes((nds) =>
        nds.map((n) =>
          n.id === resultNode.id
            ? { ...n, data: { ...n.data, status: "error", error: err.message } }
            : n
        )
      );
      setIsRunning(false);
      toast.error(err.message || "Errore nell'esecuzione del workflow");
    }
  }, [nodes, edges, setNodes, findInputImage, findUpscalerNode, findFreepikVideoNode, pollImageStatus, pollVideoStatus, pollFreepikVideoStatus]);

  const loadTemplate = useCallback((template: TemplateType) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    
    if (template === "text-to-video") {
      const templateNodes: WorkflowNode[] = [
        {
          id: "freepik-video-1",
          type: "freepikVideo",
          position: { x: 100, y: 150 },
          data: { label: "Freepik Video", prompt: "", model: "kling" as const, duration: 6 },
        },
        {
          id: "video-result-1",
          type: "videoResult",
          position: { x: 450, y: 150 },
          data: { label: "Video Result", status: "idle" as const },
        },
      ];
      const templateEdges: WorkflowEdge[] = [
        { id: "e-video-1", source: "freepik-video-1", target: "video-result-1", animated: true, style: { stroke: "#06b6d4" } },
      ];
      setNodes(templateNodes);
      setEdges(templateEdges);
      setCurrentWorkflowId(undefined);
      setCurrentWorkflowName(undefined);
      toast.success("Template Text-to-Video caricato");
    } else if (template === "image-to-video") {
      const templateNodes: WorkflowNode[] = [
        {
          id: "input-1",
          type: "imageInput",
          position: { x: 50, y: 150 },
          data: { label: "Input Image" },
        },
        {
          id: "freepik-video-1",
          type: "freepikVideo",
          position: { x: 350, y: 150 },
          data: { label: "Freepik Video", prompt: "", model: "kling" as const, duration: 6 },
        },
        {
          id: "video-result-1",
          type: "videoResult",
          position: { x: 700, y: 150 },
          data: { label: "Video Result", status: "idle" as const },
        },
      ];
      const templateEdges: WorkflowEdge[] = [
        { id: "e-input-1", source: "input-1", target: "freepik-video-1", animated: true, style: { stroke: "#6366f1" } },
        { id: "e-video-1", source: "freepik-video-1", target: "video-result-1", animated: true, style: { stroke: "#06b6d4" } },
      ];
      setNodes(templateNodes);
      setEdges(templateEdges);
      setCurrentWorkflowId(undefined);
      setCurrentWorkflowName(undefined);
      toast.success("Template Image-to-Video caricato");
    }
  }, [setNodes, setEdges]);

  const clearCanvas = useCallback(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setNodes([]);
    setEdges([]);
    setCurrentWorkflowId(undefined);
    setCurrentWorkflowName(undefined);
    toast.info("Canvas pulito");
  }, [setNodes, setEdges]);

  const exportWorkflow = useCallback(() => {
    const workflowData = { nodes, edges };
    const blob = new Blob([JSON.stringify(workflowData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentWorkflowName || "freepik-workflow"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Workflow esportato");
  }, [nodes, edges, currentWorkflowName]);

  const handleLoadWorkflow = useCallback((workflow: SavedWorkflow) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setNodes(workflow.nodes);
    setEdges(workflow.edges);
    setCurrentWorkflowId(workflow.id);
    setCurrentWorkflowName(workflow.name);
    toast.success(`Workflow "${workflow.name}" caricato`);
  }, [setNodes, setEdges]);

  const handleWorkflowSaved = useCallback((id: string, name: string) => {
    setCurrentWorkflowId(id);
    setCurrentWorkflowName(name);
  }, []);

  return (
    <div className="w-full h-[600px] bg-background rounded-lg border border-border/50 overflow-hidden relative">
      <WorkflowToolbar
        onAddNode={addNode}
        onRunWorkflow={runWorkflow}
        onClearCanvas={clearCanvas}
        onExport={exportWorkflow}
        onSave={() => setSaveDialogOpen(true)}
        onLoad={() => setLoadDialogOpen(true)}
        onZoomIn={() => zoomIn()}
        onZoomOut={() => zoomOut()}
        onFitView={() => fitView()}
        onLoadTemplate={loadTemplate}
        isRunning={isRunning}
        currentWorkflowName={currentWorkflowName}
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
              case "upscaler": return "#ec4899";
              case "freepikVideo": return "#06b6d4";
              case "imageResult": return "#10b981";
              case "videoResult": return "#3b82f6";
              default: return "hsl(var(--muted))";
            }
          }}
        />
      </ReactFlow>

      <SaveWorkflowDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        nodes={nodes as WorkflowNode[]}
        edges={edges as WorkflowEdge[]}
        currentWorkflowId={currentWorkflowId}
        currentWorkflowName={currentWorkflowName}
        onSaved={handleWorkflowSaved}
      />

      <LoadWorkflowDialog
        open={loadDialogOpen}
        onOpenChange={setLoadDialogOpen}
        onLoad={handleLoadWorkflow}
      />
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
