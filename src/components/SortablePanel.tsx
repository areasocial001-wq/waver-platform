import { DragEvent } from "react";
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon, X, GripVertical } from "lucide-react";

interface SortablePanelProps {
  id: string;
  imageUrl: string | null;
  caption: string;
  index: number;
  onImageUpload: (file: File) => void;
  onRemoveImage: () => void;
  onDragOver: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
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
}: SortablePanelProps) => {
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
          <Button
            size="icon"
            variant="destructive"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={onRemoveImage}
          >
            <X className="h-4 w-4" />
          </Button>
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