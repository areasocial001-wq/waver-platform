import { DragEvent, useState } from "react";
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon, X, GripVertical, ZoomIn, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SortablePanelProps {
  id: string;
  imageUrl: string | null;
  caption: string;
  index: number;
  onImageUpload: (file: File) => void;
  onRemoveImage: () => void;
  onDragOver: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
  onImageUpdate?: (newImageUrl: string) => void;
}

export const SortablePanel = ({
  id,
  imageUrl,
  caption,
  index,
  onImageUpload,
  onRemoveImage,
  onDragOver,
  onDrop,
  onImageUpdate,
}: SortablePanelProps) => {
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [upscaleTaskId, setUpscaleTaskId] = useState<string | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleUpscale = async () => {
    if (!imageUrl) return;
    
    setIsUpscaling(true);
    toast.info("Upscaling con Magnific...");

    try {
      // Convert image URL to base64
      let base64Image: string;
      
      if (imageUrl.startsWith('data:')) {
        base64Image = imageUrl.split(',')[1];
      } else {
        // Fetch and convert to base64
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const reader = new FileReader();
        base64Image = await new Promise((resolve) => {
          reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.readAsDataURL(blob);
        });
      }

      const { data, error } = await supabase.functions.invoke("freepik-upscale", {
        body: {
          image: base64Image,
          scaleFactor: "2x",
          mode: "creative",
          optimizedFor: "standard",
          creativity: 2,
          hdr: 1,
          resemblance: 3,
        },
      });

      if (error) throw error;

      if (data?.data?.task_id) {
        setUpscaleTaskId(data.data.task_id);
        pollUpscaleStatus(data.data.task_id, data.mode || "creative");
      } else if (data?.data?.generated?.[0]?.url) {
        handleUpscaleComplete(data.data.generated[0].url);
      }
    } catch (err: any) {
      console.error("Upscale error:", err);
      toast.error(err.message || "Errore durante l'upscaling");
      setIsUpscaling(false);
    }
  };

  const pollUpscaleStatus = async (taskId: string, mode: string) => {
    const maxAttempts = 60;
    let attempts = 0;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        toast.error("Timeout upscaling");
        setIsUpscaling(false);
        setUpscaleTaskId(null);
        return;
      }

      attempts++;

      try {
        const { data, error } = await supabase.functions.invoke("freepik-upscale", {
          body: { action: "status", taskId, mode },
        });

        if (error) throw error;

        if (data?.data?.status === "COMPLETED" && data?.data?.generated?.[0]?.url) {
          handleUpscaleComplete(data.data.generated[0].url);
        } else if (data?.data?.status === "FAILED") {
          toast.error("Upscaling fallito");
          setIsUpscaling(false);
          setUpscaleTaskId(null);
        } else {
          setTimeout(poll, 3000);
        }
      } catch (err) {
        console.error("Poll error:", err);
        setTimeout(poll, 3000);
      }
    };

    poll();
  };

  const handleUpscaleComplete = (newImageUrl: string) => {
    setIsUpscaling(false);
    setUpscaleTaskId(null);
    toast.success("Immagine upscalata con successo!");
    
    if (onImageUpdate) {
      onImageUpdate(newImageUrl);
    }
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="relative group overflow-hidden border-border bg-background/30 aspect-video"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {imageUrl ? (
        <>
          <div
            {...attributes}
            {...listeners}
            className="absolute top-2 left-2 z-10 cursor-grab active:cursor-grabbing bg-background/80 rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <GripVertical className="h-4 w-4 text-foreground" />
          </div>
          <img
            src={imageUrl}
            alt={`Panel ${index + 1}`}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="icon"
              variant="secondary"
              className="h-8 w-8"
              onClick={handleUpscale}
              disabled={isUpscaling}
              title="Upscala con Magnific"
            >
              {isUpscaling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ZoomIn className="h-4 w-4" />
              )}
            </Button>
            <Button
              size="icon"
              variant="destructive"
              className="h-8 w-8"
              onClick={onRemoveImage}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {isUpscaling && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="text-center text-white">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p className="text-sm">Upscaling...</p>
              </div>
            </div>
          )}
          {caption && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-2 text-sm">
              {caption}
            </div>
          )}
        </>
      ) : (
        <label
          className="flex flex-col items-center justify-center h-full cursor-pointer hover:bg-accent/10 transition-colors"
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImageUpload(file);
            }}
          />
          <ImageIcon className="h-12 w-12 text-muted-foreground mb-2" />
          <span className="text-sm text-muted-foreground">Trascina o clicca</span>
          <span className="text-xs text-muted-foreground">Pannello {index + 1}</span>
        </label>
      )}
    </Card>
  );
};
