import { memo, useCallback, useEffect, useState, useRef } from "react";
import { Handle, Position, NodeProps, useReactFlow } from "@xyflow/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Layers, Video, GripVertical, Loader2 } from "lucide-react";
import { VideoConcatNodeData, VideoResultNodeData } from "../types";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface ConnectedVideo {
  id: string;
  url?: string;
  thumbnail?: string;
}

// Component for video thumbnail with lazy loading
const VideoThumbnail = memo(({ url }: { url?: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!url) {
      setThumbnail(null);
      return;
    }

    setLoading(true);
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.src = url;
    video.muted = true;
    video.preload = "metadata";

    video.onloadeddata = () => {
      video.currentTime = 0.1; // Get frame slightly after start
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 36;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          setThumbnail(canvas.toDataURL("image/jpeg", 0.7));
        }
      } catch (e) {
        console.error("Thumbnail error:", e);
      }
      setLoading(false);
    };

    video.onerror = () => {
      setLoading(false);
    };

    return () => {
      video.src = "";
    };
  }, [url]);

  if (!url) {
    return (
      <div className="w-12 h-7 bg-muted/50 rounded flex items-center justify-center">
        <Video className="h-3 w-3 text-muted-foreground" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-12 h-7 bg-muted/50 rounded flex items-center justify-center">
        <Loader2 className="h-3 w-3 animate-spin text-purple-500" />
      </div>
    );
  }

  if (thumbnail) {
    return (
      <img
        src={thumbnail}
        alt="Video thumbnail"
        className="w-12 h-7 object-cover rounded border border-purple-500/30"
      />
    );
  }

  return (
    <div className="w-12 h-7 bg-purple-500/20 rounded flex items-center justify-center">
      <Video className="h-3 w-3 text-purple-500" />
    </div>
  );
});

VideoThumbnail.displayName = "VideoThumbnail";

// Sortable video item component
const SortableVideoItem = memo(({ video, index, totalCount }: { video: ConnectedVideo; index: number; totalCount: number }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: video.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-1.5 bg-muted/30 rounded text-xs ${
        isDragging ? "ring-2 ring-purple-500 z-50" : ""
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-muted/50 rounded"
      >
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </button>
      
      <Badge variant="outline" className="h-5 w-5 p-0 flex items-center justify-center text-[10px] shrink-0">
        {index + 1}
      </Badge>
      
      <VideoThumbnail url={video.url} />
      
      <span className="flex-1 truncate text-muted-foreground text-[10px]">
        {video.url ? "Pronto" : "In attesa..."}
      </span>
    </div>
  );
});

SortableVideoItem.displayName = "SortableVideoItem";

const VideoConcatNode = memo(({ data, id }: NodeProps) => {
  const nodeData = data as unknown as VideoConcatNodeData;
  const { getNodes, getEdges } = useReactFlow();
  const [connectedVideos, setConnectedVideos] = useState<ConnectedVideo[]>([]);
  const [orderedIds, setOrderedIds] = useState<string[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Find all connected video result nodes
  useEffect(() => {
    const edges = getEdges();
    const nodes = getNodes();
    const incomingEdges = edges.filter((e) => e.target === id);
    
    const videos: ConnectedVideo[] = [];
    for (const edge of incomingEdges) {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      if (sourceNode?.type === "videoResult") {
        const videoData = sourceNode.data as unknown as VideoResultNodeData;
        videos.push({
          id: sourceNode.id,
          url: videoData.videoUrl,
        });
      }
    }
    
    // Maintain order for existing videos, add new ones at the end
    const newOrderedIds = orderedIds.filter(oid => videos.some(v => v.id === oid));
    videos.forEach(v => {
      if (!newOrderedIds.includes(v.id)) {
        newOrderedIds.push(v.id);
      }
    });
    
    setOrderedIds(newOrderedIds);
    setConnectedVideos(videos);
  }, [getNodes, getEdges, id]);

  // Get videos in the correct order
  const orderedVideos = orderedIds
    .map(oid => connectedVideos.find(v => v.id === oid))
    .filter((v): v is ConnectedVideo => v !== undefined);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setOrderedIds((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        
        // Emit order change event
        const orderEvent = new CustomEvent("nodeDataChange", {
          detail: {
            nodeId: id,
            data: { ...nodeData, videoOrder: newOrder },
          },
        });
        window.dispatchEvent(orderEvent);
        
        return newOrder;
      });
    }
  }, [id, nodeData]);

  const handleChange = (field: string, value: any) => {
    const event = new CustomEvent("nodeDataChange", {
      detail: {
        nodeId: id,
        data: { ...nodeData, [field]: value },
      },
    });
    window.dispatchEvent(event);
  };

  return (
    <Card className="w-80 bg-purple-500/10 backdrop-blur border-purple-500/30 shadow-lg shadow-purple-500/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Layers className="h-4 w-4 text-purple-500" />
          Concatena Video
          {connectedVideos.length > 0 && (
            <Badge variant="secondary" className="text-[10px] ml-auto">
              {connectedVideos.filter((v) => v.url).length}/{connectedVideos.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Video Collegati</Label>
            {connectedVideos.length > 1 && (
              <span className="text-[10px] text-muted-foreground">Trascina per riordinare</span>
            )}
          </div>
          
          {connectedVideos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-16 bg-muted/30 rounded-md border-2 border-dashed border-muted-foreground/30">
              <Video className="h-5 w-5 text-muted-foreground mb-1" />
              <span className="text-xs text-muted-foreground">Collega nodi Video Result</span>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={orderedVideos.map(v => v.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {orderedVideos.map((video, index) => (
                    <SortableVideoItem
                      key={video.id}
                      video={video}
                      index={index}
                      totalCount={orderedVideos.length}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Transizione</Label>
          <Select
            value={nodeData.transition || "none"}
            onValueChange={(value) => handleChange("transition", value)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nessuna</SelectItem>
              <SelectItem value="fade">Dissolvenza</SelectItem>
              <SelectItem value="crossfade">Crossfade</SelectItem>
              <SelectItem value="wipe">Wipe</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Durata Transizione (sec)</Label>
          <Select
            value={String(nodeData.transitionDuration || 0.5)}
            onValueChange={(value) => handleChange("transitionDuration", parseFloat(value))}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0.25">0.25s</SelectItem>
              <SelectItem value="0.5">0.5s</SelectItem>
              <SelectItem value="1">1s</SelectItem>
              <SelectItem value="2">2s</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Formato</Label>
            <Select
              value={nodeData.outputFormat || "mp4"}
              onValueChange={(value) => handleChange("outputFormat", value)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mp4">MP4</SelectItem>
                <SelectItem value="webm">WebM</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Risoluzione</Label>
            <Select
              value={nodeData.resolution || "hd"}
              onValueChange={(value) => handleChange("resolution", value)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sd">SD (480p)</SelectItem>
                <SelectItem value="hd">HD (720p)</SelectItem>
                <SelectItem value="fhd">Full HD (1080p)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-purple-500 border-2 border-background"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-purple-500 border-2 border-background"
      />
    </Card>
  );
});

VideoConcatNode.displayName = "VideoConcatNode";

export default VideoConcatNode;
