import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Pencil, Volume2, Loader2, GripVertical, Copy, Trash2, RefreshCw,
  Image, Eye, Download, Mic,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StoryScene, TransitionType } from "./types";

const TRANSITIONS: { value: TransitionType; label: string; icon: string }[] = [
  { value: "crossfade", label: "Crossfade", icon: "✦" },
  { value: "fade_black", label: "Fade Nero", icon: "◼" },
  { value: "dissolve", label: "Dissolve", icon: "◇" },
  { value: "wipe_left", label: "Wipe ←", icon: "◁" },
  { value: "wipe_right", label: "Wipe →", icon: "▷" },
  { value: "none", label: "Nessuna", icon: "—" },
];

const CAMERA_MOVEMENTS = [
  "static", "slow_zoom_in", "slow_zoom_out", "pan_left",
  "pan_right", "tilt_up", "tilt_down", "dolly_forward",
];

export interface VoiceOption {
  id: string;
  name: string;
}

interface SceneCardProps {
  scene: StoryScene;
  index: number;
  isEditing: boolean;
  isPreviewLoading: boolean;
  isDragging?: boolean;
  mode: "review" | "generation" | "complete";
  voices?: VoiceOption[];
  defaultVoiceId?: string;
  onToggleEdit: () => void;
  onUpdate: (field: keyof StoryScene, value: any) => void;
  onPreviewAudio: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onRegenerate?: (type: "image" | "audio" | "video" | "sfx") => void;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onDrop?: () => void;
}

export const SceneCard = ({
  scene, index, isEditing, isPreviewLoading, isDragging,
  mode, voices, defaultVoiceId, onToggleEdit, onUpdate, onPreviewAudio,
  onDuplicate, onDelete, onRegenerate,
  onDragStart, onDragOver, onDragEnd, onDrop,
}: SceneCardProps) => {

  if (mode === "generation") {
    return (
      <Card className="bg-card/50 border-border/50 overflow-hidden">
        <div className="aspect-video bg-muted/30 relative">
          {scene.videoStatus === "completed" && scene.videoUrl ? (
            <video src={scene.videoUrl} className="w-full h-full object-cover" autoPlay muted loop playsInline />
          ) : scene.imageUrl ? (
            <img src={scene.imageUrl} alt={`Scene ${index + 1}`} className="w-full h-full object-cover" />
          ) : (
            <div className="flex items-center justify-center h-full">
              {scene.imageStatus === "generating" ? (
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              ) : (
                <Image className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
          )}
          <Badge className="absolute top-2 left-2 bg-background/80 text-foreground text-xs">
            Scena {scene.sceneNumber}
          </Badge>
          {scene.videoStatus === "completed" && (
            <Badge className="absolute top-2 right-2 bg-green-500/90 text-white text-xs">▶ Video</Badge>
          )}
        </div>
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <StatusDot status={scene.imageStatus} /><span>Img</span>
            <StatusDot status={scene.audioStatus} /><span>Audio</span>
            <StatusDot status={scene.sfxStatus} /><span>SFX</span>
            <StatusDot status={scene.videoStatus} /><span>Video</span>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{scene.narration}</p>
        </CardContent>
      </Card>
    );
  }

  if (mode === "complete") {
    return (
      <Card className="bg-card/50 overflow-hidden">
        {scene.imageUrl && (
          <img src={scene.imageUrl} alt={`Scene ${index + 1}`} className="w-full aspect-video object-cover" />
        )}
        <CardContent className="p-2 space-y-1">
          <p className="text-xs text-muted-foreground line-clamp-1">{scene.narration}</p>
          {/* Per-scene voice selector in complete mode */}
          {voices && voices.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Label className="text-[10px] text-muted-foreground shrink-0">🎙️</Label>
              <Select value={scene.voiceId || defaultVoiceId || ""} onValueChange={val => onUpdate("voiceId", val)}>
                <SelectTrigger className="h-6 text-[10px] flex-1"><SelectValue placeholder="Voce..." /></SelectTrigger>
                <SelectContent>
                  {voices.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex gap-1 flex-wrap">
            {scene.audioUrl && (
              <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => new Audio(scene.audioUrl!).play()}>
                <Volume2 className="w-3 h-3" />
              </Button>
            )}
            {scene.sfxUrl && (
              <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => new Audio(scene.sfxUrl!).play()} title="Ascolta SFX">
                🔊
              </Button>
            )}
            {scene.videoUrl && (
              <Button variant="ghost" size="sm" className="h-6 px-2" asChild>
                <a href={scene.videoUrl} target="_blank" rel="noopener"><Eye className="w-3 h-3" /></a>
              </Button>
            )}
            {onRegenerate && (
              <>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => onRegenerate("image")} title="Rigenera immagine">
                  <RefreshCw className="w-3 h-3 mr-1" /><Image className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => onRegenerate("audio")} title="Rigenera audio">
                  <RefreshCw className="w-3 h-3 mr-1" /><Volume2 className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => onRegenerate("video")} title="Rigenera video">
                  <RefreshCw className="w-3 h-3 mr-1" /><Eye className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => onRegenerate("sfx")} title="Rigenera SFX">
                  <RefreshCw className="w-3 h-3 mr-1" />🔊
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Review mode
  return (
    <Card
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => { e.preventDefault(); onDragOver?.(e); }}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
      className={cn(
        "bg-card/50 transition-all",
        isEditing ? "border-primary ring-1 ring-primary/20" : "border-border/50",
        isDragging ? "opacity-50 scale-95" : ""
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Drag handle */}
          <div className="cursor-grab active:cursor-grabbing mt-1 text-muted-foreground hover:text-foreground">
            <GripVertical className="w-4 h-4" />
          </div>

          {/* Scene number */}
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-sm shrink-0 mt-1">
            {scene.sceneNumber}
          </div>

          <div className="flex-1 space-y-2 min-w-0">
            {/* Controls row */}
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={String(scene.duration)} onValueChange={val => onUpdate("duration", Number(val))}>
                <SelectTrigger className="w-20 h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[5, 6, 7, 8, 9, 10].map(d => <SelectItem key={d} value={String(d)}>{d}s</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={scene.cameraMovement} onValueChange={val => onUpdate("cameraMovement", val)}>
                <SelectTrigger className="w-36 h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CAMERA_MOVEMENTS.map(m => <SelectItem key={m} value={m}>{m.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input value={scene.mood} onChange={e => onUpdate("mood", e.target.value)} className="h-7 text-xs flex-1 min-w-[80px]" placeholder="Mood..." />
              {/* Per-scene voice selector */}
              {voices && voices.length > 0 && (
                <Select value={scene.voiceId || defaultVoiceId || ""} onValueChange={val => onUpdate("voiceId", val)}>
                  <SelectTrigger className="w-32 h-7 text-xs"><SelectValue placeholder="Voce..." /></SelectTrigger>
                  <SelectContent>
                    {voices.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              
              {/* Actions */}
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onPreviewAudio} disabled={isPreviewLoading} title="Anteprima audio">
                {isPreviewLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Volume2 className="w-3 h-3" />}
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onToggleEdit} title="Modifica">
                <Pencil className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onDuplicate} title="Duplica">
                <Copy className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={onDelete} title="Elimina">
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>

            {/* Transition selector */}
            <div className="flex items-center gap-2 flex-wrap">
              <Label className="text-xs text-muted-foreground shrink-0">Transizione →</Label>
              <Select value={scene.transition || "crossfade"} onValueChange={val => onUpdate("transition", val as TransitionType)}>
                <SelectTrigger className="w-32 h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRANSITIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={String(scene.transitionDuration || 0.5)} onValueChange={val => onUpdate("transitionDuration", Number(val))}>
                <SelectTrigger className="w-20 h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0.3, 0.5, 0.8, 1.0, 1.5].map(d => <SelectItem key={d} value={String(d)}>{d}s</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                value={scene.sfxPrompt || ""}
                onChange={e => onUpdate("sfxPrompt", e.target.value)}
                className="h-7 text-xs flex-1 min-w-[120px]"
                placeholder="🔊 SFX prompt (es. vento, pioggia...)"
              />
            </div>

            {/* Preview audio player */}
            {scene.previewAudioUrl && !isEditing && (
              <audio src={scene.previewAudioUrl} controls className="w-full h-8" />
            )}

            {/* Content (edit or read) */}
            {isEditing ? (
              <div className="space-y-2">
                <div>
                  <Label className="text-xs text-muted-foreground">🎙️ Narrazione</Label>
                  <Textarea value={scene.narration} onChange={e => onUpdate("narration", e.target.value)} className="text-sm min-h-[60px]" />
                </div>
                {scene.previewAudioUrl && (
                  <audio src={scene.previewAudioUrl} controls className="w-full h-8" />
                )}
                <div>
                  <Label className="text-xs text-muted-foreground">🎨 Prompt Immagine (EN)</Label>
                  <Textarea value={scene.imagePrompt} onChange={e => onUpdate("imagePrompt", e.target.value)} className="text-xs min-h-[80px] font-mono" />
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium">🎙️ {scene.narration}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">🎨 {scene.imagePrompt}</p>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const StatusDot = ({ status }: { status?: string }) => {
  const color =
    status === "completed" ? "bg-green-500"
    : status === "generating" ? "bg-amber-500 animate-pulse"
    : status === "error" ? "bg-destructive"
    : "bg-muted-foreground/30";
  return <div className={cn("w-2 h-2 rounded-full", color)} />;
};
