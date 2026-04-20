import { useState, useMemo, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import {
  Pencil, Volume2, Loader2, GripVertical, Copy, Trash2, RefreshCw,
  Image, Eye, Download, Mic, Unlock, AlertTriangle, Wand2, Check, Undo2,
  History, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StoryScene, TransitionType, AssetVersion } from "./types";
import { useAuthVideo } from "@/hooks/useAuthVideo";
import { TransitionPreview } from "./TransitionPreview";



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

// Quick correction-note presets shown as clickable chips inside the regen popovers.
// Clicking a chip appends its text to the current note (with a comma separator).
const IMAGE_CORRECTION_PRESETS = [
  "mantieni stesso outfit",
  "stessa identità del personaggio",
  "stessa angolazione",
  "cambia angolazione",
  "più luce naturale",
  "luce più drammatica",
  "primo piano",
  "campo lungo",
  "rimuovi elementi sullo sfondo",
  "colori più caldi",
  "colori più freddi",
  "espressione più seria",
];

const VIDEO_CORRECTION_PRESETS = [
  "meno zoom, più stabile",
  "movimento camera più lento",
  "movimento camera più veloce",
  "camera fissa",
  "evita sbalzi bruschi",
  "transizione più fluida",
  "mantieni soggetto al centro",
  "evita morphing del volto",
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
  onRegenerate?: (type: "image" | "audio" | "video" | "sfx", opts?: { correctionNote?: string }) => void;
  onKeepNew?: (type: "image" | "audio" | "video" | "sfx") => void;
  /** When `versionUrl` is provided, restore that specific entry from versionHistory. */
  onRollback?: (type: "image" | "audio" | "video" | "sfx", versionUrl?: string) => void;
  onDeleteVersion?: (type: "image" | "audio" | "video" | "sfx", versionUrl: string) => void;
  onUnstuck?: () => void;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onDrop?: () => void;
}

export const SceneCard = ({
  scene, index, isEditing, isPreviewLoading, isDragging,
  mode, voices, defaultVoiceId, aspectRatio = "16:9", onToggleEdit, onUpdate, onPreviewAudio,
  onDuplicate, onDelete, onRegenerate, onKeepNew, onRollback, onDeleteVersion, onUnstuck,
  onDragStart, onDragOver, onDragEnd, onDrop,
}: SceneCardProps) => {
  // Local state for the correction note popovers (image + video regen with guidance).
  const [imageCorrectionNote, setImageCorrectionNote] = useState(scene.lastImageCorrectionNote || "");
  const [videoCorrectionNote, setVideoCorrectionNote] = useState(scene.lastVideoCorrectionNote || "");
  const [imageNoteOpen, setImageNoteOpen] = useState(false);
  const [videoNoteOpen, setVideoNoteOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
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

  // After regenerating the image, prefer showing the new image over the (now stale) video
  // so the user can actually see the change. They can then regenerate the video too.
  const imageJustRegenerated = !!scene.previousImageUrl && !!scene.imageUrl;

  if (mode === "generation") {
    return (
      <Card className="bg-card/50 border-border/50 overflow-hidden">
        <div className={cn(aspectClass, "bg-muted/30 relative")}>
          {!imageJustRegenerated && isVideoReady && isVideoLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-2 text-xs text-muted-foreground">Caricamento video...</span>
            </div>
          ) : !imageJustRegenerated && isVideoReady && playableVideoUrl ? (
            <div className="w-full h-full bg-black">
              <video src={playableVideoUrl} className="w-full h-full object-contain" autoPlay muted loop playsInline />
            </div>
          ) : scene.imageUrl ? (
            <img
              key={scene.imageUrl}
              src={scene.imageUrl}
              alt={`Scene ${index + 1}`}
              className="w-full h-full object-cover"
            />
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
            <ServerReachBadge label="Voce" url={scene.audioUrl} />
            {scene.sfxPrompt && <ServerReachBadge label="SFX" url={scene.sfxUrl} />}
            {voiceName && (
              <Badge variant="outline" className="ml-auto text-[10px] h-5 gap-1">
                <Mic className="w-2.5 h-2.5" />{voiceName}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{scene.narration}</p>
          {onRegenerate && (
            <div className="flex gap-1 flex-wrap pt-1 border-t border-border/30">
              {/* Image regen with optional correction note popover (chip presets supported) */}
              <CorrectionNotePopover
                open={imageNoteOpen}
                onOpenChange={setImageNoteOpen}
                note={imageCorrectionNote}
                setNote={setImageCorrectionNote}
                presets={IMAGE_CORRECTION_PRESETS}
                title="Nota di correzione immagine"
                placeholder='Es: "la ragazza indossa un vestito ocra lungo, non pantaloni"'
                disabled={scene.imageStatus === "generating"}
                spinning={scene.imageStatus === "generating"}
                icon={<Image className="w-2.5 h-2.5" />}
                onConfirm={(note) => {
                  setImageNoteOpen(false);
                  onRegenerate("image", note ? { correctionNote: note } : undefined);
                  toast.info(
                    note
                      ? `Rigenero immagine scena ${scene.sceneNumber} con correzione`
                      : `Rigenero immagine scena ${scene.sceneNumber}`,
                  );
                }}
              />

              {/* Video regen with optional correction note popover (camera-movement guidance) */}
              <CorrectionNotePopover
                open={videoNoteOpen}
                onOpenChange={setVideoNoteOpen}
                note={videoCorrectionNote}
                setNote={setVideoCorrectionNote}
                presets={VIDEO_CORRECTION_PRESETS}
                title="Nota di correzione video"
                placeholder='Es: "meno zoom, più stabile, evita morphing"'
                disabled={scene.videoStatus === "generating" || !scene.imageUrl}
                disabledTitle={!scene.imageUrl ? "Genera prima l'immagine" : undefined}
                spinning={scene.videoStatus === "generating"}
                icon={<Eye className="w-2.5 h-2.5" />}
                onConfirm={(note) => {
                  setVideoNoteOpen(false);
                  onRegenerate("video", note ? { correctionNote: note } : undefined);
                  toast.info(
                    note
                      ? `Rigenero video scena ${scene.sceneNumber} con correzione`
                      : `Rigenero video scena ${scene.sceneNumber}`,
                  );
                }}
              />

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

              {/* Version history popover — appears when at least one asset has past versions */}
              {hasAnyVersionHistory(scene) && (
                <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px] gap-1 ml-auto text-primary"
                      title="Storico versioni rigenerate"
                    >
                      <History className="w-2.5 h-2.5" />
                      Storico
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-96 p-3 max-h-[60vh] overflow-y-auto" align="end">
                    <VersionHistoryList
                      scene={scene}
                      onRollback={onRollback}
                      onDeleteVersion={onDeleteVersion}
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>
          )}

          {/* Before/After comparison panel — appears after a regen if previous URL is kept */}
          {(scene.previousImageUrl || scene.previousVideoUrl || scene.previousAudioUrl || scene.previousSfxUrl) && (
            <BeforeAfterPanel
              scene={scene}
              aspectClass={aspectClass}
              onKeepNew={onKeepNew}
              onRollback={onRollback}
            />
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
              {/* Live mini preview of the selected transition */}
              <TransitionPreview
                type={(scene.transition || "crossfade") as TransitionType}
                duration={scene.transitionDuration || 0.5}
                size={56}
              />
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

/**
 * Inline before/after comparison shown on the scene card after a regeneration.
 * Lets the user keep the new asset (clears the backup) or roll back to the previous one.
 * Supports image, video, audio and sfx — only the asset types with a `previousXxxUrl` are rendered.
 */
const BeforeAfterPanel = ({
  scene,
  aspectClass,
  onKeepNew,
  onRollback,
}: {
  scene: StoryScene;
  aspectClass: string;
  onKeepNew?: (type: "image" | "audio" | "video" | "sfx") => void;
  onRollback?: (type: "image" | "audio" | "video" | "sfx") => void;
}) => {
  const items: { type: "image" | "video" | "audio" | "sfx"; label: string; prev: string; next?: string }[] = [];
  if (scene.previousImageUrl) items.push({ type: "image", label: "Immagine", prev: scene.previousImageUrl, next: scene.imageUrl });
  if (scene.previousVideoUrl) items.push({ type: "video", label: "Video", prev: scene.previousVideoUrl, next: scene.videoUrl });
  if (scene.previousAudioUrl) items.push({ type: "audio", label: "Audio", prev: scene.previousAudioUrl, next: scene.audioUrl });
  if (scene.previousSfxUrl) items.push({ type: "sfx", label: "SFX", prev: scene.previousSfxUrl, next: scene.sfxUrl });
  if (!items.length) return null;

  return (
    <div className="space-y-2 pt-2 mt-1 border-t border-primary/30">
      {items.map(item => (
        <div key={item.type} className="rounded-md border border-primary/30 bg-primary/5 p-2 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="outline" className="text-[10px] h-5 gap-1 border-primary/40">
              <Wand2 className="w-2.5 h-2.5" /> Confronto {item.label}
            </Badge>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] gap-1"
                onClick={() => onRollback?.(item.type)}
                title="Ripristina la versione precedente"
              >
                <Undo2 className="w-3 h-3" />
                Ripristina
              </Button>
              <Button
                size="sm"
                className="h-6 px-2 text-[10px] gap-1"
                onClick={() => onKeepNew?.(item.type)}
                title="Mantieni la nuova versione (scarta backup)"
              >
                <Check className="w-3 h-3" />
                Mantieni
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <AssetPreview url={item.prev} type={item.type} aspectClass={aspectClass} label="Prima" />
            <AssetPreview url={item.next} type={item.type} aspectClass={aspectClass} label="Dopo" />
          </div>
        </div>
      ))}
    </div>
  );
};

const AssetPreview = ({
  url,
  type,
  aspectClass,
  label,
}: {
  url?: string;
  type: "image" | "video" | "audio" | "sfx";
  aspectClass: string;
  label: string;
}) => {
  const isVisual = type === "image" || type === "video";
  return (
    <div className="space-y-1">
      <div className="text-[9px] text-muted-foreground uppercase tracking-wide font-semibold">{label}</div>
      {!url ? (
        <div className={cn("flex items-center justify-center bg-muted/30 rounded text-[10px] text-muted-foreground", isVisual ? aspectClass : "h-10")}>—</div>
      ) : type === "image" ? (
        <img src={url} alt={label} className={cn("w-full object-cover rounded", aspectClass)} />
      ) : type === "video" ? (
        <video src={url} className={cn("w-full object-cover rounded bg-black", aspectClass)} muted loop playsInline controls />
      ) : (
        <audio src={url} controls className="w-full h-8" />
      )}
    </div>
  );
};

/**
 * Reusable correction-note popover used for both image and video regen.
 * Includes:
 *  - a freeform textarea (sticky last note via parent state),
 *  - a row of clickable "preset chips" appended to the note on click,
 *  - "Senza nota" + "Rigenera" actions (with optional custom icons).
 */
const CorrectionNotePopover = ({
  open, onOpenChange, note, setNote, presets, title, placeholder,
  disabled, disabledTitle, spinning, icon, onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  note: string;
  setNote: (v: string) => void;
  presets: string[];
  title: string;
  placeholder: string;
  disabled?: boolean;
  disabledTitle?: string;
  spinning?: boolean;
  icon: React.ReactNode;
  onConfirm: (note: string) => void;
}) => {
  const appendChip = (chip: string) => {
    const trimmed = note.trim();
    if (!trimmed) { setNote(chip); return; }
    if (trimmed.toLowerCase().includes(chip.toLowerCase())) return; // avoid duplicate
    setNote(trimmed.endsWith(",") || trimmed.endsWith(".") ? `${trimmed} ${chip}` : `${trimmed}, ${chip}`);
  };
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[10px] gap-1"
          disabled={disabled}
          title={disabledTitle || `${title} (con nota di correzione opzionale)`}
        >
          <RefreshCw className={cn("w-2.5 h-2.5", spinning && "animate-spin")} />
          {icon}
          <Wand2 className="w-2.5 h-2.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-3 space-y-2" align="start">
        <div className="space-y-1">
          <Label className="text-xs font-semibold">{title} (opzionale)</Label>
          <p className="text-[10px] text-muted-foreground leading-tight">
            Verrà appesa al prompt originale per guidare la rigenerazione.
          </p>
        </div>
        {/* Quick preset chips */}
        <div className="flex flex-wrap gap-1">
          {presets.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => appendChip(chip)}
              className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-muted/30 hover:bg-primary/10 hover:border-primary/40 transition-colors"
              title="Aggiungi alla nota"
            >
              + {chip}
            </button>
          ))}
        </div>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={placeholder}
          className="text-xs min-h-[70px]"
          autoFocus
        />
        <div className="flex justify-between gap-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setNote("")}>Pulisci</Button>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onConfirm("")}>Senza nota</Button>
            <Button size="sm" className="h-7 text-xs gap-1" onClick={() => onConfirm(note.trim())}>
              <Wand2 className="w-3 h-3" />
              Rigenera
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const hasAnyVersionHistory = (scene: StoryScene): boolean => {
  const h = scene.versionHistory;
  if (!h) return false;
  return !!(h.image?.length || h.video?.length || h.audio?.length || h.sfx?.length);
};

const ASSET_LABELS: Record<"image" | "video" | "audio" | "sfx", string> = {
  image: "🖼️ Immagini",
  video: "🎬 Video",
  audio: "🎙️ Audio",
  sfx: "🔊 SFX",
};

/**
 * Lists every past version (per asset type) saved in `scene.versionHistory`.
 * Each entry shows a thumbnail/preview, when it was created, and the optional
 * correction note. From here the user can restore any past version (which pushes
 * the current one back into the stack) or permanently delete an entry.
 */
const VersionHistoryList = ({
  scene,
  onRollback,
  onDeleteVersion,
}: {
  scene: StoryScene;
  onRollback?: (type: "image" | "audio" | "video" | "sfx", versionUrl?: string) => void;
  onDeleteVersion?: (type: "image" | "audio" | "video" | "sfx", versionUrl: string) => void;
}) => {
  const types: ("image" | "video" | "audio" | "sfx")[] = ["image", "video", "audio", "sfx"];
  const sections = types
    .map((t) => ({ type: t, versions: scene.versionHistory?.[t] || [] }))
    .filter((s) => s.versions.length > 0);

  if (!sections.length) return <div className="text-xs text-muted-foreground">Nessuna versione precedente.</div>;

  const fmtTime = (ts: number) => {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 1) return "ora";
    if (m < 60) return `${m}m fa`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h fa`;
    return `${Math.floor(h / 24)}g fa`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <History className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold">Storico versioni</span>
      </div>
      {sections.map(({ type, versions }) => (
        <div key={type} className="space-y-1.5">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            {ASSET_LABELS[type]} ({versions.length})
          </div>
          <div className="space-y-1.5">
            {versions.map((v) => (
              <VersionRow
                key={v.id}
                version={v}
                type={type}
                fmtTime={fmtTime}
                onRestore={() => onRollback?.(type, v.url)}
                onDelete={() => onDeleteVersion?.(type, v.url)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const VersionRow = ({
  version, type, fmtTime, onRestore, onDelete,
}: {
  version: AssetVersion;
  type: "image" | "video" | "audio" | "sfx";
  fmtTime: (ts: number) => string;
  onRestore: () => void;
  onDelete: () => void;
}) => {
  const isVisual = type === "image" || type === "video";
  return (
    <div className="flex items-center gap-2 p-1.5 rounded-md border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors">
      <div className="w-12 h-12 shrink-0 rounded overflow-hidden bg-black/30 flex items-center justify-center">
        {type === "image" ? (
          <img src={version.url} alt="version" className="w-full h-full object-cover" />
        ) : type === "video" ? (
          <video src={version.url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
        ) : (
          <Volume2 className="w-4 h-4 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-muted-foreground">{fmtTime(version.createdAt)}</div>
        {version.correctionNote ? (
          <div className="text-[10px] truncate" title={version.correctionNote}>
            <Wand2 className="w-2.5 h-2.5 inline mr-0.5 text-primary" />
            {version.correctionNote}
          </div>
        ) : (
          <div className="text-[10px] text-muted-foreground/60 italic">senza nota</div>
        )}
        {!isVisual && <audio src={version.url} controls className="w-full h-6 mt-0.5" />}
      </div>
      <div className="flex flex-col gap-0.5 shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="h-6 px-2 text-[10px] gap-1"
          onClick={onRestore}
          title="Ripristina questa versione"
        >
          <Undo2 className="w-2.5 h-2.5" />
          Usa
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[10px] gap-1 text-destructive hover:bg-destructive/10"
          onClick={onDelete}
          title="Elimina questa versione dallo storico"
        >
          <X className="w-2.5 h-2.5" />
        </Button>
      </div>
    </div>
  );
};
