import React, { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Film, Music, Type, Subtitles, Play, Loader2, Download, Trash2, 
  Plus, Settings, Wand2, Volume2, Image, Clock, Palette, GripVertical,
  Eye, Clapperboard, Sparkles, Monitor
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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

interface VideoClip {
  id: string;
  src: string;
  duration?: number;
  muted: boolean;
  resize: "cover" | "fit" | "contain";
  pan: string;
  zoom: number;
  fadeIn: number;
  fadeOut: number;
  correction: {
    brightness: number;
    contrast: number;
    saturation: number;
  };
  textOverlays: TextOverlay[];
}

interface TextOverlay {
  id: string;
  text: string;
  position: string;
  start: number;
  duration: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  backgroundColor?: string;
  fadeIn: number;
  fadeOut: number;
}

interface SubtitleSettings {
  enabled: boolean;
  style: string;
  position: string;
  fontFamily: string;
  fontSize: number;
  wordColor: string;
  lineColor: string;
  boxColor: string;
  outlineWidth: number;
  maxWordsPerLine: number;
  allCaps: boolean;
  language: string;
}

interface IntroOutro {
  enabled: boolean;
  text: string;
  duration: number;
  backgroundColor: string;
  textColor: string;
  animation: string;
  fontSize: number;
  fontFamily: string;
  logoUrl?: string;
}

interface AudioTrack {
  src: string;
  volume: number;
  fadeIn: number;
  fadeOut: number;
}

interface JSON2VideoEditorProps {
  videoUrls?: string[];
  onComplete?: (videoUrl: string) => void;
}

const defaultClip = (src: string): VideoClip => ({
  id: crypto.randomUUID(),
  src,
  muted: true,
  resize: "cover",
  pan: "none",
  zoom: 0,
  fadeIn: 0,
  fadeOut: 0,
  correction: { brightness: 0, contrast: 1, saturation: 1 },
  textOverlays: [],
});

const defaultSubtitles: SubtitleSettings = {
  enabled: false,
  style: "classic",
  position: "bottom-center",
  fontFamily: "Arial Bold",
  fontSize: 90,
  wordColor: "#FFFF00",
  lineColor: "#FFFFFF",
  boxColor: "#000000",
  outlineWidth: 2,
  maxWordsPerLine: 4,
  allCaps: false,
  language: "auto",
};

const defaultIntro: IntroOutro = {
  enabled: false,
  text: "",
  duration: 3,
  backgroundColor: "#000000",
  textColor: "#FFFFFF",
  animation: "fade",
  fontSize: 72,
  fontFamily: "Oswald Bold",
};

// Transition presets
interface TransitionPreset {
  name: string;
  description: string;
  icon: React.ReactNode;
  transition: { type: string; duration: number };
  subtitles?: Partial<SubtitleSettings>;
  intro?: Partial<IntroOutro>;
}

const transitionPresets: TransitionPreset[] = [
  {
    name: "Cinematografico",
    description: "Transizioni eleganti per video professionali",
    icon: <Clapperboard className="h-5 w-5" />,
    transition: { type: "crossfade", duration: 1.5 },
    subtitles: {
      style: "classic",
      fontFamily: "Oswald Bold",
      fontSize: 80,
      wordColor: "#FFFFFF",
      lineColor: "#CCCCCC",
      position: "bottom-center",
    },
    intro: {
      animation: "fade",
      duration: 4,
      backgroundColor: "#000000",
      textColor: "#FFFFFF",
    },
  },
  {
    name: "Social Media",
    description: "Dinamico e accattivante per TikTok/Instagram",
    icon: <Sparkles className="h-5 w-5" />,
    transition: { type: "zoom", duration: 0.3 },
    subtitles: {
      style: "boxed-word",
      fontFamily: "Permanent Marker",
      fontSize: 100,
      wordColor: "#FFFF00",
      lineColor: "#FF00FF",
      allCaps: true,
      position: "center-center",
    },
    intro: {
      animation: "zoom",
      duration: 2,
      backgroundColor: "#FF0080",
      textColor: "#FFFFFF",
    },
  },
  {
    name: "Presentazione",
    description: "Pulito e professionale per business",
    icon: <Monitor className="h-5 w-5" />,
    transition: { type: "wipe-left", duration: 0.8 },
    subtitles: {
      style: "classic-progressive",
      fontFamily: "Arial Bold",
      fontSize: 70,
      wordColor: "#000000",
      lineColor: "#333333",
      boxColor: "#FFFFFF",
      position: "bottom-center",
    },
    intro: {
      animation: "slide",
      duration: 3,
      backgroundColor: "#1E40AF",
      textColor: "#FFFFFF",
    },
  },
];

// Sortable clip component
interface SortableClipProps {
  clip: VideoClip;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}

function SortableClip({ clip, index, isSelected, onSelect, onRemove }: SortableClipProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: clip.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
        isSelected 
          ? "border-primary bg-primary/5" 
          : "border-border hover:border-primary/50"
      } ${isDragging ? "shadow-lg" : ""}`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            className="cursor-grab active:cursor-grabbing touch-none"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
          <Badge variant="secondary">{index + 1}</Badge>
          <span className="text-sm truncate max-w-[120px]">
            {clip.src.split("/").pop() || "Video"}
          </span>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {clip.textOverlays.length > 0 && (
        <div className="mt-1 ml-6 flex gap-1">
          <Badge variant="outline" className="text-xs">
            <Type className="h-3 w-3 mr-1" />
            {clip.textOverlays.length} testi
          </Badge>
        </div>
      )}
    </div>
  );
}

export default function JSON2VideoEditor({ videoUrls = [], onComplete }: JSON2VideoEditorProps) {
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [subtitles, setSubtitles] = useState<SubtitleSettings>(defaultSubtitles);
  const [intro, setIntro] = useState<IntroOutro>(defaultIntro);
  const [outro, setOutro] = useState<IntroOutro>({ ...defaultIntro, text: "" });
  const [audioTrack, setAudioTrack] = useState<AudioTrack | null>(null);
  const [resolution, setResolution] = useState<string>("full-hd");
  const [transition, setTransition] = useState({ type: "fade", duration: 0.5 });
  
  const [isRendering, setIsRendering] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [renderedUrl, setRenderedUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Initialize clips from videoUrls
  useEffect(() => {
    if (videoUrls.length > 0 && clips.length === 0) {
      setClips(videoUrls.map(url => defaultClip(url)));
    }
  }, [videoUrls]);

  const selectedClip = clips.find(c => c.id === selectedClipId);

  // Handle drag end for reordering
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setClips((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
      toast.success("Ordine clips aggiornato");
    }
  };

  // Apply transition preset
  const applyPreset = (preset: TransitionPreset) => {
    setTransition(preset.transition);
    if (preset.subtitles) {
      setSubtitles({ ...subtitles, ...preset.subtitles });
    }
    if (preset.intro) {
      setIntro({ ...intro, ...preset.intro });
      setOutro({ ...outro, ...preset.intro });
    }
    toast.success(`Preset "${preset.name}" applicato`);
  };

  // Calculate total duration for preview
  const totalDuration = useMemo(() => {
    let duration = 0;
    if (intro.enabled) duration += intro.duration;
    clips.forEach((clip, i) => {
      duration += clip.duration || 5; // Default 5 sec per clip
      if (i < clips.length - 1 && transition.type !== "none") {
        duration -= transition.duration * 0.5; // Overlap
      }
    });
    if (outro.enabled) duration += outro.duration;
    return duration;
  }, [clips, intro, outro, transition]);

  // Preview playback
  useEffect(() => {
    if (showPreview && previewVideoRef.current) {
      previewVideoRef.current.play().catch(() => {});
    }
  }, [showPreview, previewIndex]);

  const handlePreviewVideoEnd = () => {
    if (previewIndex < clips.length - 1) {
      setPreviewIndex(previewIndex + 1);
    } else {
      setPreviewIndex(0);
    }
  };

  const addClip = (url: string) => {
    setClips([...clips, defaultClip(url)]);
  };

  const removeClip = (id: string) => {
    setClips(clips.filter(c => c.id !== id));
    if (selectedClipId === id) setSelectedClipId(null);
  };

  const updateClip = (id: string, updates: Partial<VideoClip>) => {
    setClips(clips.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const addTextOverlay = (clipId: string) => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;
    
    const newOverlay: TextOverlay = {
      id: crypto.randomUUID(),
      text: "Testo",
      position: "bottom-center",
      start: 0,
      duration: -2,
      fontSize: 48,
      fontFamily: "Arial Bold",
      color: "#FFFFFF",
      fadeIn: 0.5,
      fadeOut: 0.5,
    };
    
    updateClip(clipId, { textOverlays: [...clip.textOverlays, newOverlay] });
  };

  const updateTextOverlay = (clipId: string, overlayId: string, updates: Partial<TextOverlay>) => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;
    
    updateClip(clipId, {
      textOverlays: clip.textOverlays.map(o => o.id === overlayId ? { ...o, ...updates } : o),
    });
  };

  const removeTextOverlay = (clipId: string, overlayId: string) => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;
    
    updateClip(clipId, {
      textOverlays: clip.textOverlays.filter(o => o.id !== overlayId),
    });
  };

  const startRender = async () => {
    if (clips.length === 0) {
      toast.error("Aggiungi almeno un video clip");
      return;
    }

    setIsRendering(true);
    setProgress(0);
    setRenderedUrl(null);

    try {
      const payload = {
        action: "render",
        videoClips: clips.map(clip => ({
          src: clip.src,
          duration: clip.duration,
          muted: clip.muted,
          resize: clip.resize,
          pan: clip.pan !== "none" ? clip.pan : undefined,
          zoom: clip.zoom,
          fadeIn: clip.fadeIn,
          fadeOut: clip.fadeOut,
          correction: clip.correction,
          textOverlays: clip.textOverlays.length > 0 ? clip.textOverlays : undefined,
        })),
        resolution,
        transition: transition.type !== "none" ? transition : undefined,
        subtitles: subtitles.enabled ? subtitles : undefined,
        intro: intro.enabled ? intro : undefined,
        outro: outro.enabled ? outro : undefined,
        audioTrack: audioTrack || undefined,
        draft: false,
        quality: "high",
      };

      console.log("JSON2Video payload:", payload);

      const { data, error } = await supabase.functions.invoke("json2video", {
        body: payload,
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Render failed");

      setProjectId(data.projectId);
      toast.info("Rendering avviato...");
      
      // Start polling for status
      pollStatus(data.projectId);

    } catch (error) {
      console.error("Render error:", error);
      toast.error("Errore durante il rendering");
      setIsRendering(false);
    }
  };

  const pollStatus = async (pid: string) => {
    let attempts = 0;
    const maxAttempts = 120; // 10 minutes max
    
    const poll = async () => {
      if (attempts >= maxAttempts) {
        toast.error("Timeout: rendering troppo lungo");
        setIsRendering(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("json2video", {
          body: { action: "status", projectId: pid },
        });

        if (error) throw error;

        const status = data.movie?.status;
        console.log("Render status:", status, data);

        if (status === "done") {
          const finalUrl = data.movie?.supabaseUrl || data.movie?.url;
          setRenderedUrl(finalUrl);
          setProgress(100);
          setIsRendering(false);
          toast.success("Video pronto!");
          onComplete?.(finalUrl);
        } else if (status === "failed" || status === "error") {
          toast.error("Rendering fallito: " + (data.movie?.error || "Errore sconosciuto"));
          setIsRendering(false);
        } else {
          // Still processing
          const progressPercent = data.movie?.progress || Math.min(90, attempts * 2);
          setProgress(progressPercent);
          attempts++;
          setTimeout(poll, 5000);
        }
      } catch (err) {
        console.error("Poll error:", err);
        attempts++;
        setTimeout(poll, 5000);
      }
    };

    poll();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Film className="h-6 w-6" />
            JSON2Video Editor
          </h2>
          <p className="text-muted-foreground">
            Concatena video, aggiungi sottotitoli, audio e transizioni
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowPreview(!showPreview)}
            disabled={clips.length === 0}
          >
            <Eye className="mr-2 h-4 w-4" />
            {showPreview ? "Nascondi" : "Anteprima"}
          </Button>
          <Button onClick={startRender} disabled={isRendering || clips.length === 0}>
            {isRendering ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Rendering... {progress}%
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                Genera Video
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Transition Presets */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Preset Stile
          </CardTitle>
          <CardDescription>Scegli un preset per applicare automaticamente transizioni e stili</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {transitionPresets.map((preset) => (
              <button
                key={preset.name}
                onClick={() => applyPreset(preset)}
                className="p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all text-left group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    {preset.icon}
                  </div>
                  <span className="font-medium">{preset.name}</span>
                </div>
                <p className="text-xs text-muted-foreground">{preset.description}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Live Preview */}
      {showPreview && clips.length > 0 && (
        <Card className="border-primary/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Anteprima Live
              </span>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  Clip {previewIndex + 1} / {clips.length}
                </Badge>
                <Badge variant="secondary">
                  ~{totalDuration.toFixed(1)}s totali
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Video preview */}
              <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
                <video
                  ref={previewVideoRef}
                  key={clips[previewIndex]?.src}
                  src={clips[previewIndex]?.src}
                  className="w-full h-full object-contain"
                  controls
                  muted={clips[previewIndex]?.muted}
                  onEnded={handlePreviewVideoEnd}
                />
                {/* Transition indicator */}
                {transition.type !== "none" && (
                  <div className="absolute top-2 right-2">
                    <Badge className="bg-black/70">
                      Transizione: {transition.type} ({transition.duration}s)
                    </Badge>
                  </div>
                )}
                {/* Intro/Outro indicator */}
                {intro.enabled && previewIndex === 0 && (
                  <div className="absolute bottom-2 left-2">
                    <Badge variant="secondary">Intro: {intro.text || "(testo intro)"}</Badge>
                  </div>
                )}
              </div>

              {/* Timeline preview */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Timeline</Label>
                <div className="flex gap-1 items-center overflow-x-auto pb-2">
                  {intro.enabled && (
                    <>
                      <div className="flex-shrink-0 px-3 py-2 bg-primary/20 rounded text-xs font-medium border border-primary/30">
                        Intro ({intro.duration}s)
                      </div>
                      <div className="text-muted-foreground">→</div>
                    </>
                  )}
                  {clips.map((clip, i) => (
                    <React.Fragment key={clip.id}>
                      <div 
                        className={`flex-shrink-0 px-3 py-2 rounded text-xs font-medium cursor-pointer transition-colors ${
                          i === previewIndex 
                            ? "bg-primary text-primary-foreground" 
                            : "bg-muted hover:bg-muted/80"
                        }`}
                        onClick={() => setPreviewIndex(i)}
                      >
                        Clip {i + 1} ({clip.duration || 5}s)
                      </div>
                      {i < clips.length - 1 && transition.type !== "none" && (
                        <div className="flex-shrink-0 text-xs text-muted-foreground px-1">
                          ⟷
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                  {outro.enabled && (
                    <>
                      <div className="text-muted-foreground">→</div>
                      <div className="flex-shrink-0 px-3 py-2 bg-secondary/20 rounded text-xs font-medium border border-secondary/30">
                        Outro ({outro.duration}s)
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress bar */}
      {isRendering && (
        <Card>
          <CardContent className="py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Rendering in corso...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rendered result */}
      {renderedUrl && (
        <Card className="border-green-500">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-green-500">Completato</Badge>
                <span className="text-sm">Video pronto per il download</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href={renderedUrl} target="_blank" rel="noopener noreferrer">
                    <Play className="mr-2 h-4 w-4" />
                    Anteprima
                  </a>
                </Button>
                <Button size="sm" asChild>
                  <a href={renderedUrl} download>
                    <Download className="mr-2 h-4 w-4" />
                    Scarica
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left panel - Clips list with drag & drop */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                Video Clips ({clips.length})
              </span>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Aggiungi Video Clip</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <Input
                      placeholder="URL del video..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const input = e.target as HTMLInputElement;
                          if (input.value) {
                            addClip(input.value);
                            input.value = "";
                          }
                        }
                      }}
                    />
                  </div>
                </DialogContent>
              </Dialog>
            </CardTitle>
            <CardDescription className="text-xs">
              Trascina per riordinare i clips
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={clips.map(c => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {clips.map((clip, index) => (
                      <SortableClip
                        key={clip.id}
                        clip={clip}
                        index={index}
                        isSelected={selectedClipId === clip.id}
                        onSelect={() => setSelectedClipId(clip.id)}
                        onRemove={() => removeClip(clip.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              {clips.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Film className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nessun video clip</p>
                  <p className="text-xs">Aggiungi clip per iniziare</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right panel - Settings */}
        <Card className="lg:col-span-2">
          <CardContent className="pt-6">
            <Tabs defaultValue="clip">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="clip">Clip</TabsTrigger>
                <TabsTrigger value="subtitles">Sottotitoli</TabsTrigger>
                <TabsTrigger value="audio">Audio</TabsTrigger>
                <TabsTrigger value="intro">Intro/Outro</TabsTrigger>
                <TabsTrigger value="settings">Output</TabsTrigger>
              </TabsList>

              {/* Clip settings */}
              <TabsContent value="clip" className="space-y-4 mt-4">
                {selectedClip ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Durata (sec)</Label>
                        <Input
                          type="number"
                          value={selectedClip.duration || ""}
                          placeholder="Auto"
                          onChange={(e) => updateClip(selectedClip.id, { 
                            duration: e.target.value ? Number(e.target.value) : undefined 
                          })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Resize</Label>
                        <Select
                          value={selectedClip.resize}
                          onValueChange={(v) => updateClip(selectedClip.id, { resize: v as "cover" | "fit" | "contain" })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cover">Cover</SelectItem>
                            <SelectItem value="fit">Fit</SelectItem>
                            <SelectItem value="contain">Contain</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Pan</Label>
                        <Select
                          value={selectedClip.pan}
                          onValueChange={(v) => updateClip(selectedClip.id, { pan: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nessuno</SelectItem>
                            <SelectItem value="left">Sinistra</SelectItem>
                            <SelectItem value="right">Destra</SelectItem>
                            <SelectItem value="top">Alto</SelectItem>
                            <SelectItem value="bottom">Basso</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Zoom (-10 a 10)</Label>
                        <Slider
                          value={[selectedClip.zoom]}
                          min={-10}
                          max={10}
                          step={1}
                          onValueChange={([v]) => updateClip(selectedClip.id, { zoom: v })}
                        />
                      </div>
                    </div>

                    <Accordion type="single" collapsible>
                      <AccordionItem value="color">
                        <AccordionTrigger>
                          <div className="flex items-center gap-2">
                            <Palette className="h-4 w-4" />
                            Correzione Colore
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-4 pt-2">
                            <div className="space-y-2">
                              <Label>Luminosità</Label>
                              <Slider
                                value={[selectedClip.correction.brightness]}
                                min={-1}
                                max={1}
                                step={0.1}
                                onValueChange={([v]) => updateClip(selectedClip.id, { 
                                  correction: { ...selectedClip.correction, brightness: v } 
                                })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Contrasto</Label>
                              <Slider
                                value={[selectedClip.correction.contrast]}
                                min={0}
                                max={3}
                                step={0.1}
                                onValueChange={([v]) => updateClip(selectedClip.id, { 
                                  correction: { ...selectedClip.correction, contrast: v } 
                                })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Saturazione</Label>
                              <Slider
                                value={[selectedClip.correction.saturation]}
                                min={0}
                                max={3}
                                step={0.1}
                                onValueChange={([v]) => updateClip(selectedClip.id, { 
                                  correction: { ...selectedClip.correction, saturation: v } 
                                })}
                              />
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="text">
                        <AccordionTrigger>
                          <div className="flex items-center gap-2">
                            <Type className="h-4 w-4" />
                            Testi Overlay ({selectedClip.textOverlays.length})
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-4 pt-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => addTextOverlay(selectedClip.id)}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Aggiungi Testo
                            </Button>
                            {selectedClip.textOverlays.map((overlay) => (
                              <Card key={overlay.id} className="p-3">
                                <div className="space-y-3">
                                  <div className="flex justify-between">
                                    <Input
                                      value={overlay.text}
                                      onChange={(e) => updateTextOverlay(selectedClip.id, overlay.id, { text: e.target.value })}
                                      placeholder="Testo..."
                                    />
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => removeTextOverlay(selectedClip.id, overlay.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <Select
                                      value={overlay.position}
                                      onValueChange={(v) => updateTextOverlay(selectedClip.id, overlay.id, { position: v })}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Posizione" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="top-center">Alto</SelectItem>
                                        <SelectItem value="center-center">Centro</SelectItem>
                                        <SelectItem value="bottom-center">Basso</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <Input
                                      type="color"
                                      value={overlay.color}
                                      onChange={(e) => updateTextOverlay(selectedClip.id, overlay.id, { color: e.target.value })}
                                    />
                                  </div>
                                </div>
                              </Card>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Settings className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Seleziona un clip per modificarlo</p>
                  </div>
                )}
              </TabsContent>

              {/* Subtitles settings */}
              <TabsContent value="subtitles" className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Subtitles className="h-5 w-5" />
                    <Label>Abilita Sottotitoli Automatici</Label>
                  </div>
                  <Switch
                    checked={subtitles.enabled}
                    onCheckedChange={(v) => setSubtitles({ ...subtitles, enabled: v })}
                  />
                </div>

                {subtitles.enabled && (
                  <div className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Stile</Label>
                        <Select
                          value={subtitles.style}
                          onValueChange={(v) => setSubtitles({ ...subtitles, style: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="classic">Classico</SelectItem>
                            <SelectItem value="classic-progressive">Progressivo</SelectItem>
                            <SelectItem value="classic-one-word">Parola per parola</SelectItem>
                            <SelectItem value="boxed-line">Box Linea</SelectItem>
                            <SelectItem value="boxed-word">Box Parola</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Posizione</Label>
                        <Select
                          value={subtitles.position}
                          onValueChange={(v) => setSubtitles({ ...subtitles, position: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="top-center">Alto</SelectItem>
                            <SelectItem value="center-center">Centro</SelectItem>
                            <SelectItem value="bottom-center">Basso</SelectItem>
                            <SelectItem value="mid-bottom-center">Medio-Basso</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Font</Label>
                        <Select
                          value={subtitles.fontFamily}
                          onValueChange={(v) => setSubtitles({ ...subtitles, fontFamily: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Arial Bold">Arial Bold</SelectItem>
                            <SelectItem value="Oswald Bold">Oswald Bold</SelectItem>
                            <SelectItem value="Roboto">Roboto</SelectItem>
                            <SelectItem value="Lobster">Lobster</SelectItem>
                            <SelectItem value="Permanent Marker">Permanent Marker</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Dimensione Font</Label>
                        <Slider
                          value={[subtitles.fontSize]}
                          min={30}
                          max={200}
                          step={5}
                          onValueChange={([v]) => setSubtitles({ ...subtitles, fontSize: v })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Colore Parola</Label>
                        <Input
                          type="color"
                          value={subtitles.wordColor}
                          onChange={(e) => setSubtitles({ ...subtitles, wordColor: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Colore Linea</Label>
                        <Input
                          type="color"
                          value={subtitles.lineColor}
                          onChange={(e) => setSubtitles({ ...subtitles, lineColor: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Colore Box</Label>
                        <Input
                          type="color"
                          value={subtitles.boxColor}
                          onChange={(e) => setSubtitles({ ...subtitles, boxColor: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={subtitles.allCaps}
                          onCheckedChange={(v) => setSubtitles({ ...subtitles, allCaps: v })}
                        />
                        <Label>TUTTO MAIUSCOLO</Label>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Audio settings */}
              <TabsContent value="audio" className="space-y-4 mt-4">
                <div className="space-y-4">
                  {/* Local audio upload */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Music className="h-4 w-4" />
                      Carica Audio Locale
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="file"
                        accept="audio/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          
                          if (file.size > 50 * 1024 * 1024) {
                            toast.error("File troppo grande (max 50MB)");
                            return;
                          }
                          
                          // Upload to Supabase storage
                          const fileName = `audio/${Date.now()}-${file.name}`;
                          const { data, error } = await supabase.storage
                            .from("generated-videos")
                            .upload(fileName, file, {
                              contentType: file.type,
                              upsert: true,
                            });
                          
                          if (error) {
                            toast.error("Errore upload: " + error.message);
                            return;
                          }
                          
                          const { data: urlData } = supabase.storage
                            .from("generated-videos")
                            .getPublicUrl(fileName);
                          
                          setAudioTrack({
                            src: urlData.publicUrl,
                            volume: 0.5,
                            fadeIn: 0,
                            fadeOut: 2,
                          });
                          toast.success("Audio caricato!");
                        }}
                        className="flex-1"
                      />
                      {audioTrack && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setAudioTrack(null)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Oppure inserisci un URL diretto sotto
                    </p>
                  </div>

                  {/* URL input */}
                  <div className="space-y-2">
                    <Label>URL Audio di Sottofondo</Label>
                    <Input
                      placeholder="https://... (MP3, WAV)"
                      value={audioTrack?.src || ""}
                      onChange={(e) => setAudioTrack(e.target.value ? { 
                        src: e.target.value, 
                        volume: audioTrack?.volume || 0.5,
                        fadeIn: audioTrack?.fadeIn || 0,
                        fadeOut: audioTrack?.fadeOut || 2,
                      } : null)}
                    />
                  </div>

                  {audioTrack && (
                    <>
                      {/* Audio preview */}
                      <div className="space-y-2">
                        <Label>Anteprima Audio</Label>
                        <audio 
                          controls 
                          src={audioTrack.src} 
                          className="w-full h-10"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Volume</Label>
                        <div className="flex items-center gap-2">
                          <Volume2 className="h-4 w-4" />
                          <Slider
                            value={[audioTrack.volume]}
                            min={0}
                            max={2}
                            step={0.1}
                            onValueChange={([v]) => setAudioTrack({ ...audioTrack, volume: v })}
                          />
                          <span className="text-sm w-10">{Math.round(audioTrack.volume * 100)}%</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Fade In (sec)</Label>
                          <Input
                            type="number"
                            value={audioTrack.fadeIn}
                            onChange={(e) => setAudioTrack({ ...audioTrack, fadeIn: Number(e.target.value) })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Fade Out (sec)</Label>
                          <Input
                            type="number"
                            value={audioTrack.fadeOut}
                            onChange={(e) => setAudioTrack({ ...audioTrack, fadeOut: Number(e.target.value) })}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </TabsContent>

              {/* Intro/Outro settings */}
              <TabsContent value="intro" className="space-y-4 mt-4">
                <Accordion type="single" collapsible defaultValue="intro">
                  <AccordionItem value="intro">
                    <AccordionTrigger>
                      <div className="flex items-center gap-2">
                        <Play className="h-4 w-4" />
                        Intro
                        {intro.enabled && <Badge variant="secondary">Attivo</Badge>}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-2">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={intro.enabled}
                            onCheckedChange={(v) => setIntro({ ...intro, enabled: v })}
                          />
                          <Label>Abilita Intro</Label>
                        </div>

                        {intro.enabled && (
                          <>
                            <div className="space-y-2">
                              <Label>Testo</Label>
                              <Textarea
                                value={intro.text}
                                onChange={(e) => setIntro({ ...intro, text: e.target.value })}
                                placeholder="Il tuo titolo..."
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Durata (sec)</Label>
                                <Input
                                  type="number"
                                  value={intro.duration}
                                  onChange={(e) => setIntro({ ...intro, duration: Number(e.target.value) })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Animazione</Label>
                                <Select
                                  value={intro.animation}
                                  onValueChange={(v) => setIntro({ ...intro, animation: v })}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="fade">Fade</SelectItem>
                                    <SelectItem value="slide">Slide</SelectItem>
                                    <SelectItem value="zoom">Zoom</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Colore Sfondo</Label>
                                <Input
                                  type="color"
                                  value={intro.backgroundColor}
                                  onChange={(e) => setIntro({ ...intro, backgroundColor: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Colore Testo</Label>
                                <Input
                                  type="color"
                                  value={intro.textColor}
                                  onChange={(e) => setIntro({ ...intro, textColor: e.target.value })}
                                />
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="outro">
                    <AccordionTrigger>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Outro
                        {outro.enabled && <Badge variant="secondary">Attivo</Badge>}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-2">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={outro.enabled}
                            onCheckedChange={(v) => setOutro({ ...outro, enabled: v })}
                          />
                          <Label>Abilita Outro</Label>
                        </div>

                        {outro.enabled && (
                          <>
                            <div className="space-y-2">
                              <Label>Testo</Label>
                              <Textarea
                                value={outro.text}
                                onChange={(e) => setOutro({ ...outro, text: e.target.value })}
                                placeholder="Grazie per aver guardato..."
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Durata (sec)</Label>
                                <Input
                                  type="number"
                                  value={outro.duration}
                                  onChange={(e) => setOutro({ ...outro, duration: Number(e.target.value) })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Colore Sfondo</Label>
                                <Input
                                  type="color"
                                  value={outro.backgroundColor}
                                  onChange={(e) => setOutro({ ...outro, backgroundColor: e.target.value })}
                                />
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </TabsContent>

              {/* Output settings */}
              <TabsContent value="settings" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Risoluzione</Label>
                    <Select value={resolution} onValueChange={setResolution}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sd">SD (480p)</SelectItem>
                        <SelectItem value="hd">HD (720p)</SelectItem>
                        <SelectItem value="full-hd">Full HD (1080p)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Transizione tra Clip</Label>
                    <Select
                      value={transition.type}
                      onValueChange={(v) => setTransition({ ...transition, type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nessuna</SelectItem>
                        <SelectItem value="fade">Fade</SelectItem>
                        <SelectItem value="crossfade">Crossfade</SelectItem>
                        <SelectItem value="wipe-left">Wipe Sinistra</SelectItem>
                        <SelectItem value="wipe-right">Wipe Destra</SelectItem>
                        <SelectItem value="slide">Slide</SelectItem>
                        <SelectItem value="zoom">Zoom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {transition.type !== "none" && (
                  <div className="space-y-2">
                    <Label>Durata Transizione (sec)</Label>
                    <Slider
                      value={[transition.duration]}
                      min={0.1}
                      max={3}
                      step={0.1}
                      onValueChange={([v]) => setTransition({ ...transition, duration: v })}
                    />
                    <span className="text-sm text-muted-foreground">{transition.duration}s</span>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
