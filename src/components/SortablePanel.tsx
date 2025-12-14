import { DragEvent, useState } from "react";
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/ui/dropdown-menu";
import { Image as ImageIcon, X, GripVertical, ZoomIn, Loader2, Sparkles, ChevronDown, User } from "lucide-react";
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
  onGenerateMystic?: () => void;
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
  onGenerateMystic,
}: SortablePanelProps) => {
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [upscaleTaskId, setUpscaleTaskId] = useState<string | null>(null);
  const [selectedScale, setSelectedScale] = useState<"2x" | "4x" | "8x">("2x");
  const [showComparison, setShowComparison] = useState(false);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [upscaledImage, setUpscaledImage] = useState<string | null>(null);
  const [comparisonPosition, setComparisonPosition] = useState(50);

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

  const handleUpscale = async (scale: "2x" | "4x" | "8x", preset?: "standard" | "portraits") => {
    if (!imageUrl) return;
    
    setSelectedScale(scale);
    setIsUpscaling(true);
    setOriginalImage(imageUrl); // Store original for comparison
    
    const presetLabel = preset === "portraits" ? " (Ritratti)" : "";
    toast.info(`Upscaling ${scale}${presetLabel} con Magnific...`);

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

      // Preset configurations
      const presetConfig = preset === "portraits" 
        ? {
            optimizedFor: "soft_portraits",
            creativity: -2,
            hdr: 0,
            resemblance: 8,
          }
        : {
            optimizedFor: "standard",
            creativity: 2,
            hdr: 1,
            resemblance: 3,
          };

      const { data, error } = await supabase.functions.invoke("freepik-upscale", {
        body: {
          image: base64Image,
          scaleFactor: scale,
          mode: "creative",
          ...presetConfig,
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
    setUpscaledImage(newImageUrl);
    setShowComparison(true);
    setComparisonPosition(50);
    toast.success("Upscaling completato! Confronta prima/dopo.");
  };

  const handleAcceptUpscale = () => {
    if (upscaledImage && onImageUpdate) {
      onImageUpdate(upscaledImage);
    }
    setShowComparison(false);
    setOriginalImage(null);
    setUpscaledImage(null);
  };

  const handleRejectUpscale = () => {
    setShowComparison(false);
    setOriginalImage(null);
    setUpscaledImage(null);
    toast.info("Upscaling annullato");
  };

  const handleComparisonDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setComparisonPosition(percentage);
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="relative group overflow-hidden border-border bg-background/30 aspect-video"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Comparison Overlay */}
      {showComparison && originalImage && upscaledImage && (
        <div className="absolute inset-0 z-30 bg-background/95">
          <div 
            className="relative w-full h-full cursor-ew-resize"
            onMouseMove={handleComparisonDrag}
            onClick={handleComparisonDrag}
          >
            {/* Upscaled Image (full) */}
            <img
              src={upscaledImage}
              alt="Upscaled"
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Original Image (clipped) */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${comparisonPosition}%` }}
            >
              <img
                src={originalImage}
                alt="Original"
                className="w-full h-full object-cover"
                style={{ width: `${10000 / comparisonPosition}%`, maxWidth: 'none' }}
              />
            </div>
            {/* Divider Line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-primary z-10"
              style={{ left: `${comparisonPosition}%` }}
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-primary-foreground rounded-full p-1">
                <GripVertical className="h-4 w-4" />
              </div>
            </div>
            {/* Labels */}
            <div className="absolute top-2 left-2 bg-background/80 text-foreground text-xs px-2 py-1 rounded">
              Prima
            </div>
            <div className="absolute top-2 right-2 bg-background/80 text-foreground text-xs px-2 py-1 rounded">
              Dopo ({selectedScale})
            </div>
          </div>
          {/* Action Buttons */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2 z-20">
            <Button size="sm" variant="destructive" onClick={handleRejectUpscale}>
              <X className="h-4 w-4 mr-1" />
              Annulla
            </Button>
            <Button size="sm" variant="default" onClick={handleAcceptUpscale}>
              <ZoomIn className="h-4 w-4 mr-1" />
              Applica
            </Button>
          </div>
        </div>
      )}

      {imageUrl && !showComparison ? (
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 px-2"
                  disabled={isUpscaling}
                  title="Upscala con Magnific"
                >
                  {isUpscaling ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <ZoomIn className="h-4 w-4 mr-1" />
                      <ChevronDown className="h-3 w-3" />
                    </>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Standard</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => handleUpscale("2x")}>
                  Upscale 2x
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleUpscale("4x")}>
                  Upscale 4x
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleUpscale("8x")}>
                  Upscale 8x
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Ritratti
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => handleUpscale("2x", "portraits")}>
                  Ritratti 2x
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleUpscale("4x", "portraits")}>
                  Ritratti 4x
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleUpscale("8x", "portraits")}>
                  Ritratti 8x
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
      ) : !showComparison && (
        <div
          className="flex flex-col items-center justify-center h-full hover:bg-accent/10 transition-colors"
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          <label className="flex flex-col items-center justify-center cursor-pointer flex-1 w-full">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImageUpload(file);
              }}
            />
            <ImageIcon className="h-10 w-10 text-muted-foreground mb-2" />
            <span className="text-sm text-muted-foreground">Trascina o clicca</span>
            <span className="text-xs text-muted-foreground mb-2">Pannello {index + 1}</span>
          </label>
          {onGenerateMystic && (
            <Button
              variant="outline"
              size="sm"
              onClick={onGenerateMystic}
              className="mb-2"
            >
              <Sparkles className="h-4 w-4 mr-1" />
              Genera Mystic
            </Button>
          )}
        </div>
      )}
    </Card>
  );
};
