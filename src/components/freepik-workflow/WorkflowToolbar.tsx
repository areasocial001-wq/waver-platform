import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
  Image, 
  StickyNote, 
  Sparkles, 
  ImageIcon, 
  Video,
  Film,
  Play,
  Trash2,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Save,
  FolderOpen,
  Loader2,
  LayoutTemplate,
  FileVideo,
  Music,
  Layers,
  Clapperboard
} from "lucide-react";
import { NodeTypeKey } from "./types";

export type TemplateType = "text-to-video" | "image-to-video" | "video-with-music";

interface WorkflowToolbarProps {
  onAddNode: (type: NodeTypeKey) => void;
  onRunWorkflow: () => void;
  onClearCanvas: () => void;
  onExport: () => void;
  onSave: () => void;
  onLoad: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onLoadTemplate?: (template: TemplateType) => void;
  isRunning: boolean;
  currentWorkflowName?: string;
}

export const WorkflowToolbar = ({
  onAddNode,
  onRunWorkflow,
  onClearCanvas,
  onExport,
  onSave,
  onLoad,
  onZoomIn,
  onZoomOut,
  onFitView,
  onLoadTemplate,
  isRunning,
  currentWorkflowName,
}: WorkflowToolbarProps) => {
  const nodeButtons = [
    { type: "imageInput" as NodeTypeKey, icon: Image, label: "Input Image", color: "text-primary" },
    { type: "note" as NodeTypeKey, icon: StickyNote, label: "Note", color: "text-amber-500" },
    { type: "instructions" as NodeTypeKey, icon: Sparkles, label: "Instructions", color: "text-violet-500" },
    { type: "upscaler" as NodeTypeKey, icon: ZoomIn, label: "Upscaler", color: "text-pink-500" },
    { type: "freepikVideo" as NodeTypeKey, icon: Film, label: "Freepik Video", color: "text-cyan-500" },
    { type: "imageResult" as NodeTypeKey, icon: ImageIcon, label: "Image Result", color: "text-emerald-500" },
    { type: "videoResult" as NodeTypeKey, icon: Video, label: "Video Result", color: "text-blue-500" },
    { type: "audio" as NodeTypeKey, icon: Music, label: "Audio / Musica", color: "text-orange-500" },
    { type: "videoConcat" as NodeTypeKey, icon: Layers, label: "Concatena Video", color: "text-purple-500" },
    { type: "finalVideo" as NodeTypeKey, icon: Clapperboard, label: "Video Finale", color: "text-fuchsia-500" },
  ];

  return (
    <TooltipProvider delayDuration={300}>
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-background/80 backdrop-blur-sm border border-border/50 rounded-lg p-2 shadow-lg">
        {/* Node buttons */}
        {nodeButtons.map(({ type, icon: Icon, label, color }) => (
          <Tooltip key={type}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => onAddNode(type)}
              >
                <Icon className={`h-5 w-5 ${color}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{label}</p>
            </TooltipContent>
          </Tooltip>
        ))}

        <Separator orientation="vertical" className="h-6" />

        {/* Run */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="default"
              size="icon"
              className="h-9 w-9"
              onClick={onRunWorkflow}
              disabled={isRunning}
            >
              {isRunning ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Play className="h-5 w-5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Esegui Workflow</p>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6" />

        {/* Save & Load */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onSave}>
              <Save className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Salva Workflow</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onLoad}>
              <FolderOpen className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Carica Workflow</p>
          </TooltipContent>
        </Tooltip>

        {/* Templates */}
        {onLoadTemplate && (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <LayoutTemplate className="h-4 w-4 text-cyan-500" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Template Rapidi</p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => onLoadTemplate("text-to-video")}>
                <FileVideo className="h-4 w-4 mr-2 text-cyan-500" />
                Text-to-Video
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onLoadTemplate("image-to-video")}>
                <Image className="h-4 w-4 mr-2 text-primary" />
                Image-to-Video
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onLoadTemplate("video-with-music")}>
                <Music className="h-4 w-4 mr-2 text-orange-500" />
                Video + Musica
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <Separator orientation="vertical" className="h-6" />

        {/* Zoom controls */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Zoom In</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Zoom Out</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onFitView}>
              <Maximize2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Adatta Vista</p>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6" />

        {/* Clear & Export */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onExport}>
              <Download className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Esporta JSON</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={onClearCanvas}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Pulisci Canvas</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Current workflow name badge */}
      {currentWorkflowName && (
        <div className="absolute top-4 right-4 z-10">
          <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
            {currentWorkflowName}
          </Badge>
        </div>
      )}
    </TooltipProvider>
  );
};
