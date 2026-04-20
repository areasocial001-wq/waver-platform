import { useState, useMemo, useEffect, useRef } from "react";
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
  Image, Eye, Download, Mic, Unlock, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StoryScene, TransitionType } from "./types";
import { useAuthVideo } from "@/hooks/useAuthVideo";



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
  aspectRatio?: string;
  onToggleEdit: () => void;
  onUpdate: (field: keyof StoryScene, value: any) => void;
  onPreviewAudio: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onRegenerate?: (type: "image" | "audio" | "video" | "sfx") => void;
  onUnstuck?: () => void;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onDrop?: () => void;
}

export const SceneCard = ({
  scene, index, isEditing, isPreviewLoading, isDragging,
  mode, voices, defaultVoiceId, aspectRatio = "16:9", onToggleEdit, onUpdate, onPreviewAudio,
  onDuplicate, onDelete, onRegenerate, onUnstuck,
  onDragStart, onDragOver, onDragEnd, onDrop,
}: SceneCardProps) => {
  const isVideoReady = scene.videoStatus === "completed" && !!scene.videoUrl;
  const needsAuthFetch = isVideoReady && scene.videoUrl?.includes("/functions/v1/video-proxy");
  const { blobUrl: authBlobUrl, isLoading: isVideoLoading } = useAuthVideo(needsAuthFetch ? scene.videoUrl : undefined, isVideoReady);
  const playableVideoUrl = needsAuthFetch ? authBlobUrl : scene.videoUrl;

  // Detect "stuck" scenes: videoStatus generating for > 15 minutes.
  // Also drives a live countdown to the 12-min hard timeout (MAX_POLL_WALL_MS).
  // Re-tick every second while generating so the countdown stays fresh.
  const STUCK_THRESHOLD_MS = 15 * 60 * 1000;
  const MAX_POLL_WALL_MS = 12 * 60 * 1000;
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (scene.videoStatus !== "generating") return;
    const id = setInterval(() => forceTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [scene.videoStatus]);
  const isStuck =
    scene.videoStatus === "generating" &&
    !!scene.videoGeneratingStartedAt &&
    Date.now() - scene.videoGeneratingStartedAt > STUCK_THRESHOLD_MS;

  // Countdown to system auto-fail (12 min). Hidden once stuck banner appears.
  const timeoutRemainingMs =
    scene.videoStatus === "generating" && scene.videoGeneratingStartedAt
      ? MAX_POLL_WALL_MS - (Date.now() - scene.videoGeneratingStartedAt)
      : null;
  const formatCountdown = (ms: number) => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };
  const showCountdown =
    scene.videoStatus === "generating" &&
    !!scene.videoGeneratingStartedAt &&
    timeoutRemainingMs !== null &&
    timeoutRemainingMs > 0 &&
    !isStuck;

  const voiceName = useMemo(() => {
    const vid = scene.voiceId || defaultVoiceId;
    if (!vid || !voices?.length) return null;
    const found = voices.find(v => v.id === vid);
    return found?.name || null;
  }, [scene.voiceId, defaultVoiceId, voices]);
  const aspectClass = aspectRatio === "9:16" ? "aspect-[9/16]" : aspectRatio === "4:3" ? "aspect-[4/3]" : "aspect-video";

  if (mode === "generation") {
    return (
      <Card className="bg-card/50 border-border/50 overflow-hidden">
        <div className={cn(aspectClass, "bg-muted/30 relative")}>
          {isVideoReady && isVideoLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-2 text-xs text-muted-foreground">Caricamento video...</span>
            </div>
          ) : isVideoReady && playableVideoUrl ? (
            <div className="w-full h-full bg-black">
              <video src={playableVideoUrl} className="w-full h-full object-contain" autoPlay muted loop playsInline />
            </div>
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
          {(scene.imageAspectWarning || scene.videoAspectWarning) && (
            <div className="absolute bottom-2 inset-x-2 flex items-start gap-1.5 px-2 py-1 rounded-md bg-amber-500/95 text-white text-[10px] leading-tight shadow-lg">
              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
              <span className="line-clamp-2">
                {scene.imageAspectWarning
                  ? `Img ${scene.imageWidth}×${scene.imageHeight} non conforme`
                  : `Video ${scene.videoWidth}×${scene.videoHeight} non conforme`}
              </span>
              {onRegenerate && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 px-1.5 ml-auto text-[10px] text-white hover:bg-white/20"
                  onClick={() => onRegenerate(scene.imageAspectWarning ? "image" : "video")}
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                </Button>
              )}
            </div>
          )}
        </div>
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <StatusDot status={scene.imageStatus} /><span>Img</span>
            <StatusDot status={scene.audioStatus} /><span>Audio</span>
            <StatusDot status={scene.sfxStatus} /><span>SFX</span>
            <StatusDot status={scene.videoStatus} /><span>Video</span>
            {voiceName && (
              <Badge variant="outline" className="ml-auto text-[10px] h-5 gap-1">
                <Mic className="w-2.5 h-2.5" />{voiceName}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{scene.narration}</p>
          {onRegenerate && (
            <div className="flex gap-1 flex-wrap pt-1 border-t border-border/30">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] gap-1"
                onClick={() => { onRegenerate("image"); toast.info(`Rigenero immagine scena ${scene.sceneNumber}`); }}
                disabled={scene.imageStatus === "generating"}
                title="Rigenera immagine"
              >
                <RefreshCw className={cn("w-2.5 h-2.5", scene.imageStatus === "generating" && "animate-spin")} />
                <Image className="w-2.5 h-2.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] gap-1"
                onClick={() => { onRegenerate("video"); toast.info(`Rigenero video scena ${scene.sceneNumber}`); }}
                disabled={scene.videoStatus === "generating" || !scene.imageUrl}
                title={!scene.imageUrl ? "Genera prima l'immagine" : "Rigenera video"}
              >
                <RefreshCw className={cn("w-2.5 h-2.5", scene.videoStatus === "generating" && "animate-spin")} />
                <Eye className="w-2.5 h-2.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] gap-1"
                onClick={() => { onRegenerate("audio"); toast.info(`Rigenero audio scena ${scene.sceneNumber}`); }}
                disabled={scene.audioStatus === "generating"}
                title="Rigenera audio"
              >
                <RefreshCw className={cn("w-2.5 h-2.5", scene.audioStatus === "generating" && "animate-spin")} />
                <Volume2 className="w-2.5 h-2.5" />
              </Button>
              {scene.sfxPrompt && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px] gap-1"
                  onClick={() => { onRegenerate("sfx"); toast.info(`Rigenero SFX scena ${scene.sceneNumber}`); }}
                  disabled={scene.sfxStatus === "generating"}
                  title="Rigenera SFX"
                >
                  <RefreshCw className={cn("w-2.5 h-2.5", scene.sfxStatus === "generating" && "animate-spin")} />
                  🔊
                </Button>
              )}
            </div>
          )}
          {showCountdown && timeoutRemainingMs !== null && (
            <div className={cn(
              "flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded-md border",
              timeoutRemainingMs < 2 * 60 * 1000
                ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
                : "bg-muted/40 border-border/50 text-muted-foreground"
            )}>
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              <span>Timeout in {formatCountdown(timeoutRemainingMs)}</span>
            </div>
          )}
          {isStuck && onUnstuck && (
            <div className="flex items-center justify-between gap-2 mt-2 p-2 rounded-md bg-destructive/10 border border-destructive/30">
              <span className="text-[11px] text-destructive font-medium">
                ⚠️ Bloccata da {Math.floor((Date.now() - (scene.videoGeneratingStartedAt || 0)) / 60000)} min
              </span>
              <Button
                variant="destructive"
                size="sm"
                className="h-6 px-2 text-[11px] gap-1"
                onClick={() => { onUnstuck(); toast.success(`Scena ${scene.sceneNumber} sbloccata`); }}
              >
                <Unlock className="w-3 h-3" />
                Sblocca
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (mode === "complete") {
    const assetChecks = [
      { label: "Img", ok: !!scene.imageUrl, status: scene.imageStatus },
      { label: "Audio", ok: !!scene.audioUrl, status: scene.audioStatus },
      { label: "Video", ok: !!scene.videoUrl, status: scene.videoStatus },
      { label: "SFX", ok: !!scene.sfxUrl, status: scene.sfxStatus },
    ];
    const allReady = assetChecks.filter(a => a.label !== "SFX").every(a => a.ok);
    const hasError = assetChecks.some(a => a.status === "error");

    return (
      <Card className={cn("bg-card/50 overflow-hidden", hasError && "border-destructive/50", allReady && !hasError && "border-green-500/30")}>
        <div className="relative">
          {scene.imageUrl ? (
            <img src={scene.imageUrl} alt={`Scene ${index + 1}`} className={cn("w-full object-cover", aspectClass)} />
          ) : (
            <div className={cn("w-full flex items-center justify-center bg-muted/30", aspectClass)}>
              <Image className="w-6 h-6 text-muted-foreground" />
            </div>
          )}
          {/* Asset status overlay */}
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 flex items-center gap-1">
            {assetChecks.map(a => (
              <Badge key={a.label} variant="outline" className={cn(
                "text-[9px] h-4 px-1 border-none",
                a.status === "error" ? "bg-destructive/80 text-white" :
                a.ok ? "bg-green-500/80 text-white" :
                "bg-muted-foreground/40 text-white/70"
              )}>
                {a.status === "error" ? "✗" : a.ok ? "✓" : "—"} {a.label}
              </Badge>
            ))}
          </div>
        </div>
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
            {isStuck && onUnstuck && (
              <Button
                variant="destructive"
                size="sm"
                className="h-6 px-2 text-xs gap-1"
                onClick={() => { onUnstuck(); toast.success(`Scena ${scene.sceneNumber} sbloccata`); }}
                title={`Scena bloccata da ${Math.floor((Date.now() - (scene.videoGeneratingStartedAt || 0)) / 60000)} min — sblocca per rigenerare`}
              >
                <Unlock className="w-3 h-3" />
                Sblocca
              </Button>
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
