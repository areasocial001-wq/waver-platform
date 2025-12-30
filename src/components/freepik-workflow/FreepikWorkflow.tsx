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
import { NODE_TYPES, NodeTypeKey, WorkflowNode, WorkflowEdge, InstructionsNodeData, ImageInputNodeData, UpscalerNodeData, FreepikVideoNodeData, AudioNodeData, VideoConcatNodeData, FinalVideoNodeData, VideoResultNodeData } from "./types";
import ImageInputNode from "./nodes/ImageInputNode";
import NoteNode from "./nodes/NoteNode";
import InstructionsNode from "./nodes/InstructionsNode";
import UpscalerNode from "./nodes/UpscalerNode";
import FreepikVideoNode from "./nodes/FreepikVideoNode";
import ImageResultNode from "./nodes/ImageResultNode";
import VideoResultNode from "./nodes/VideoResultNode";
import AudioNode from "./nodes/AudioNode";
import VideoConcatNode from "./nodes/VideoConcatNode";
import FinalVideoNode from "./nodes/FinalVideoNode";
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
  audio: AudioNode,
  videoConcat: VideoConcatNode,
  finalVideo: FinalVideoNode,
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
        case "audio":
          return { label: "Audio / Musica", audioType: "generate" as const, category: "music" as const, duration: 10, volume: 100 };
        case "videoConcat":
          return { label: "Concatena Video", transition: "none" as const, transitionDuration: 0.5, outputFormat: "mp4" as const, resolution: "hd" as const };
        case "finalVideo":
          return { label: "Video Finale", status: "idle" as const };
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

  // Find Audio node connected to a FinalVideo node
  const findAudioNode = useCallback((targetNodeId: string): WorkflowNode | undefined => {
    const incomingEdges = edges.filter(e => e.target === targetNodeId);
    for (const edge of incomingEdges) {
      const sourceNode = nodes.find(n => n.id === edge.source);
      if (sourceNode?.type === "audio") {
        return sourceNode;
      }
    }
    return undefined;
  }, [nodes, edges]);

  // Find VideoConcat node connected to a FinalVideo node
  const findVideoConcatNode = useCallback((targetNodeId: string): WorkflowNode | undefined => {
    const incomingEdges = edges.filter(e => e.target === targetNodeId);
    for (const edge of incomingEdges) {
      const sourceNode = nodes.find(n => n.id === edge.source);
      if (sourceNode?.type === "videoConcat") {
        return sourceNode;
      }
    }
    return undefined;
  }, [nodes, edges]);

  // Find all VideoResult nodes connected to a VideoConcat node (respecting custom order)
  const findConnectedVideoResults = useCallback((concatNodeId: string): { id: string; videoUrl?: string }[] => {
    const concatNode = nodes.find(n => n.id === concatNodeId);
    const concatData = concatNode?.data as unknown as VideoConcatNodeData | undefined;
    const customOrder = concatData?.videoOrder;
    
    const incomingEdges = edges.filter(e => e.target === concatNodeId);
    const videos: { id: string; videoUrl?: string }[] = [];
    
    for (const edge of incomingEdges) {
      const sourceNode = nodes.find(n => n.id === edge.source);
      if (sourceNode?.type === "videoResult") {
        const videoData = sourceNode.data as unknown as VideoResultNodeData;
        videos.push({
          id: sourceNode.id,
          videoUrl: videoData.videoUrl,
        });
      }
    }
    
    // Sort by custom order if available
    if (customOrder && customOrder.length > 0) {
      videos.sort((a, b) => {
        const indexA = customOrder.indexOf(a.id);
        const indexB = customOrder.indexOf(b.id);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });
    }
    
    return videos;
  }, [nodes, edges]);

  // Generate audio using ElevenLabs
  const generateAudio = useCallback(async (audioNode: WorkflowNode): Promise<string | undefined> => {
    const audioData = audioNode.data as unknown as AudioNodeData;
    
    if (audioData.audioType === "file" && audioData.audioUrl) {
      return audioData.audioUrl;
    }
    
    if (audioData.audioType === "generate" && audioData.prompt?.trim()) {
      const { data, error } = await supabase.functions.invoke("elevenlabs-music", {
        body: {
          prompt: audioData.prompt,
          category: audioData.category || "music",
          duration: audioData.duration || 10,
        },
      });
      
      if (error) throw error;
      
      if (data?.audioContent) {
        return `data:audio/mp3;base64,${data.audioContent}`;
      }
    }
    
    return undefined;
  }, []);

  // Process FinalVideo node - concatenate videos and add audio
  const processFinalVideo = useCallback(async (finalVideoNode: WorkflowNode) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === finalVideoNode.id
          ? { ...n, data: { ...n.data, status: "processing" } }
          : n
      )
    );

    try {
      const concatNode = findVideoConcatNode(finalVideoNode.id);
      const audioNode = findAudioNode(finalVideoNode.id);
      
      let videoUrls: string[] = [];
      let audioUrl: string | undefined;
      let concatData: VideoConcatNodeData | undefined;
      
      // Get videos from concat node
      if (concatNode) {
        concatData = concatNode.data as unknown as VideoConcatNodeData;
        const connectedVideos = findConnectedVideoResults(concatNode.id);
        videoUrls = connectedVideos
          .filter((v) => v.videoUrl)
          .map((v) => v.videoUrl!);
      }
      
      // Generate or get audio
      if (audioNode) {
        toast.info("Generando audio con AI...");
        audioUrl = await generateAudio(audioNode);
        if (audioUrl) {
          toast.success("Audio generato!");
        }
      }
      
      if (videoUrls.length === 0 && !audioUrl) {
        throw new Error("Nessun video o audio collegato");
      }
      
      let finalVideoUrl = videoUrls[0];
      let allSegments: string[] = videoUrls;
      
      // If we have multiple videos, use the concat edge function
      if (videoUrls.length > 1) {
        toast.info("Concatenando video...");
        
        const audioNodeData = audioNode?.data as unknown as AudioNodeData | undefined;
        
        const { data: concatResult, error: concatError } = await supabase.functions.invoke("video-concat", {
          body: {
            videoUrls,
            transition: concatData?.transition || "none",
            transitionDuration: concatData?.transitionDuration || 0.5,
            resolution: concatData?.resolution || "hd",
            audioUrl: audioUrl,
            audioVolume: audioNodeData?.volume || 100,
          },
        });
        
        if (concatError) {
          console.error("Concat error:", concatError);
          // Fall back to first video
        } else if (concatResult?.success) {
          finalVideoUrl = concatResult.videoUrl;
          allSegments = concatResult.segments || videoUrls;
          if (concatResult.audioUrl) {
            audioUrl = concatResult.audioUrl;
          }
          toast.success(concatResult.message || "Video concatenati!");
        }
      }
      
      // Update the FinalVideo node
      setNodes((nds) =>
        nds.map((n) =>
          n.id === finalVideoNode.id
            ? { 
                ...n, 
                data: { 
                  ...n.data, 
                  status: "completed", 
                  videoUrl: finalVideoUrl,
                  hasAudio: !!audioUrl,
                  audioUrl: audioUrl,
                  segments: allSegments,
                } 
              }
            : n
        )
      );
      
      if (allSegments.length > 1) {
        toast.success(`Video finale pronto! (${allSegments.length} segmenti)`);
      } else {
        toast.success("Video finale pronto!");
      }
      
      return { videoUrl: finalVideoUrl, audioUrl, segments: allSegments };
    } catch (err: any) {
      console.error("FinalVideo processing error:", err);
      setNodes((nds) =>
        nds.map((n) =>
          n.id === finalVideoNode.id
            ? { ...n, data: { ...n.data, status: "error", error: err.message } }
            : n
        )
      );
      throw err;
    }
  }, [findVideoConcatNode, findAudioNode, findConnectedVideoResults, generateAudio, setNodes]);


  const runWorkflow = useCallback(async () => {
    setIsRunning(true);
    toast.info("Esecuzione workflow in corso...");
    
    // Check for FinalVideo workflow first
    const finalVideoNodes = nodes.filter((n) => n.type === "finalVideo");
    for (const finalVideoNode of finalVideoNodes) {
      try {
        await processFinalVideo(finalVideoNode);
        setIsRunning(false);
        return;
      } catch (err: any) {
        setIsRunning(false);
        toast.error(err.message || "Errore nel processamento video finale");
        return;
      }
    }
    
    // Check for upscaler workflow (Input -> Upscaler -> Result)
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
  }, [nodes, edges, setNodes, findInputImage, findUpscalerNode, findFreepikVideoNode, pollImageStatus, pollVideoStatus, pollFreepikVideoStatus, processFinalVideo]);

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
    } else if (template === "video-with-music") {
      const templateNodes: WorkflowNode[] = [
        // Video generation path
        {
          id: "freepik-video-1",
          type: "freepikVideo",
          position: { x: 50, y: 100 },
          data: { label: "Video 1", prompt: "", model: "kling" as const, duration: 6 },
        },
        {
          id: "video-result-1",
          type: "videoResult",
          position: { x: 350, y: 100 },
          data: { label: "Video Result 1", status: "idle" as const },
        },
        // Second video (optional)
        {
          id: "freepik-video-2",
          type: "freepikVideo",
          position: { x: 50, y: 280 },
          data: { label: "Video 2", prompt: "", model: "kling" as const, duration: 6 },
        },
        {
          id: "video-result-2",
          type: "videoResult",
          position: { x: 350, y: 280 },
          data: { label: "Video Result 2", status: "idle" as const },
        },
        // Video concat
        {
          id: "video-concat-1",
          type: "videoConcat",
          position: { x: 600, y: 150 },
          data: { label: "Concatena Video", transition: "crossfade" as const, transitionDuration: 0.5, outputFormat: "mp4" as const },
        },
        // Audio generation
        {
          id: "audio-1",
          type: "audio",
          position: { x: 600, y: 350 },
          data: { label: "Audio / Musica", audioType: "generate" as const, category: "music" as const, duration: 15, volume: 80, prompt: "" },
        },
        // Final output
        {
          id: "final-video-1",
          type: "finalVideo",
          position: { x: 900, y: 200 },
          data: { label: "Video Finale", status: "idle" as const },
        },
      ];
      const templateEdges: WorkflowEdge[] = [
        { id: "e-fv1-vr1", source: "freepik-video-1", target: "video-result-1", animated: true, style: { stroke: "#06b6d4" } },
        { id: "e-fv2-vr2", source: "freepik-video-2", target: "video-result-2", animated: true, style: { stroke: "#06b6d4" } },
        { id: "e-vr1-vc", source: "video-result-1", target: "video-concat-1", animated: true, style: { stroke: "#a855f7" } },
        { id: "e-vr2-vc", source: "video-result-2", target: "video-concat-1", animated: true, style: { stroke: "#a855f7" } },
        { id: "e-vc-fv", source: "video-concat-1", target: "final-video-1", animated: true, style: { stroke: "#d946ef" } },
        { id: "e-audio-fv", source: "audio-1", target: "final-video-1", animated: true, style: { stroke: "#f97316" } },
      ];
      setNodes(templateNodes);
      setEdges(templateEdges);
      setCurrentWorkflowId(undefined);
      setCurrentWorkflowName(undefined);
      toast.success("Template Video + Musica caricato");
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
              case "audio": return "#f97316";
              case "videoConcat": return "#a855f7";
              case "finalVideo": return "#d946ef";
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
