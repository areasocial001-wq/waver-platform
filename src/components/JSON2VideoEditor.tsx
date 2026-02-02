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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { 
  Film, Music, Type, Subtitles, Play, Loader2, Download, Trash2, 
  Plus, Settings, Wand2, Volume2, Image, Clock, Palette, GripVertical,
  Eye, Clapperboard, Sparkles, Monitor, Save, FolderOpen, Zap, Waves,
  Music2, Mic, CloudLightning, Settings2, Brain, FileCode
} from "lucide-react";
import JSON2VideoTemplateManager from "@/components/JSON2VideoTemplateManager";
import JSON2VideoAIAssets, { AIImage, AIVoice } from "@/components/JSON2VideoAIAssets";
import { useJSON2VideoNotifications } from "@/hooks/useJSON2VideoNotifications";
import { ActiveProviderIndicator } from "@/components/ActiveProviderIndicator";
import { QuickProviderSwitch } from "@/components/QuickProviderSwitch";
import { ProjectCostEstimator } from "@/components/ProjectCostEstimator";
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

interface SoundEffect {
  id: string;
  name: string;
  src: string;
  clipId?: string; // If attached to specific clip, or null for global
  startTime: number;
  volume: number;
  category: 'transition' | 'ambient' | 'sfx';
}

interface SavedProject {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  rendered_url?: string;
  thumbnail_url?: string;
}

interface JSON2VideoEditorProps {
  videoUrls?: string[];
  onComplete?: (videoUrl: string) => void;
  projectId?: string;
}

// Predefined sound effects library
const soundEffectsLibrary: { name: string; category: 'transition' | 'ambient' | 'sfx'; prompt: string }[] = [
  { name: "Whoosh", category: "transition", prompt: "Smooth whoosh transition sound effect, cinematic" },
  { name: "Impact", category: "transition", prompt: "Deep impact hit sound effect, dramatic" },
  { name: "Swoosh", category: "transition", prompt: "Fast swoosh transition sound, modern" },
  { name: "Glitch", category: "transition", prompt: "Digital glitch transition sound effect" },
  { name: "Rise", category: "transition", prompt: "Rising tension sound effect, building" },
  { name: "Click", category: "sfx", prompt: "Soft click sound effect, UI" },
  { name: "Pop", category: "sfx", prompt: "Bubble pop sound effect, playful" },
  { name: "Ding", category: "sfx", prompt: "Notification ding sound, pleasant" },
  { name: "Success", category: "sfx", prompt: "Success celebration chime sound" },
  { name: "Error", category: "sfx", prompt: "Subtle error buzz sound effect" },
  { name: "Ambience City", category: "ambient", prompt: "Urban city ambient background noise, traffic" },
  { name: "Nature Forest", category: "ambient", prompt: "Forest nature ambient sounds, birds, wind" },
  { name: "Rain", category: "ambient", prompt: "Gentle rain ambient sound, relaxing" },
  { name: "Office", category: "ambient", prompt: "Office background ambient noise, typing, murmur" },
];

// AI Music generation prompts
const musicPrompts = [
  { name: "Epico Cinematografico", prompt: "Epic cinematic orchestral music, dramatic, inspiring, heroic, trailer music", duration: 30 },
  { name: "Corporate Upbeat", prompt: "Upbeat corporate background music, positive, motivational, business presentation", duration: 20 },
  { name: "Chill Lo-Fi", prompt: "Chill lo-fi hip hop beats, relaxing, study music, mellow", duration: 30 },
  { name: "Tech Innovation", prompt: "Modern technology innovation music, futuristic, inspiring, electronic", duration: 25 },
  { name: "Emotional Piano", prompt: "Emotional piano music, touching, sentimental, documentary style", duration: 30 },
  { name: "Energetic Pop", prompt: "Energetic upbeat pop music, fun, youthful, social media vibe", duration: 20 },
  { name: "Ambient Atmospheric", prompt: "Ambient atmospheric soundscape, ethereal, dreamy, cinematic background", duration: 30 },
  { name: "Action Intense", prompt: "Intense action music, fast-paced, adrenaline, thriller", duration: 25 },
];

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

export default function JSON2VideoEditor({ videoUrls = [], onComplete, projectId: initialProjectId }: JSON2VideoEditorProps) {
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [subtitles, setSubtitles] = useState<SubtitleSettings>(defaultSubtitles);
  const [intro, setIntro] = useState<IntroOutro>(defaultIntro);
  const [outro, setOutro] = useState<IntroOutro>({ ...defaultIntro, text: "" });
  const [audioTrack, setAudioTrack] = useState<AudioTrack | null>(null);
  const [soundEffects, setSoundEffects] = useState<SoundEffect[]>([]);
  const [resolution, setResolution] = useState<string>("full-hd");
  const [transition, setTransition] = useState({ type: "fade", duration: 0.5 });
  
  const [isRendering, setIsRendering] = useState(false);
  const [renderProjectId, setRenderProjectId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [renderedUrl, setRenderedUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  // Project management state
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(initialProjectId || null);
  const [projectName, setProjectName] = useState<string>("");
  const [projectDescription, setProjectDescription] = useState<string>("");
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  // AI Music generation state
  const [isGeneratingMusic, setIsGeneratingMusic] = useState(false);
  const [musicPrompt, setMusicPrompt] = useState("");
  const [musicDuration, setMusicDuration] = useState(30);
  const [showMusicDialog, setShowMusicDialog] = useState(false);

  // Sound effects generation state
  const [isGeneratingSfx, setIsGeneratingSfx] = useState(false);
  const [sfxGeneratingId, setSfxGeneratingId] = useState<string | null>(null);

  // AI Assets state
  const [aiImages, setAiImages] = useState<AIImage[]>([]);
  const [aiVoices, setAiVoices] = useState<AIVoice[]>([]);
  const [savedTemplatesCount, setSavedTemplatesCount] = useState(0);
  
  // Use webhook notifications
  const { createNotification, notifications } = useJSON2VideoNotifications();

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

  // Load project if initialProjectId is provided
  useEffect(() => {
    if (initialProjectId) {
      loadProject(initialProjectId);
    }
  }, [initialProjectId]);

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

  // ============ PROJECT MANAGEMENT ============
  const loadSavedProjects = async () => {
    setIsLoadingProjects(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Devi essere autenticato per caricare i progetti");
        return;
      }

      const { data, error } = await supabase
        .from("json2video_projects")
        .select("id, name, description, created_at, updated_at, rendered_url, thumbnail_url")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setSavedProjects(data || []);
    } catch (error) {
      console.error("Error loading projects:", error);
      toast.error("Errore nel caricamento dei progetti");
    } finally {
      setIsLoadingProjects(false);
    }
  };

  // Generate thumbnail from video
  const generateThumbnail = async (videoUrl: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.src = videoUrl;
      video.muted = true;
      
      video.onloadeddata = () => {
        video.currentTime = 1; // Seek to 1 second for better frame
      };
      
      video.onseeked = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 320;
          canvas.height = 180;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
            resolve(dataUrl);
          } else {
            resolve(null);
          }
        } catch (error) {
          console.error("Error generating thumbnail:", error);
          resolve(null);
        }
      };
      
      video.onerror = () => {
        resolve(null);
      };
      
      // Timeout fallback
      setTimeout(() => resolve(null), 5000);
    });
  };

  const saveProject = async (saveAsNew = false) => {
    if (!projectName.trim()) {
      toast.error("Inserisci un nome per il progetto");
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Devi essere autenticato per salvare");
        return;
      }

      // Generate thumbnail from first clip
      let thumbnailUrl: string | null = null;
      if (clips.length > 0) {
        const thumbnailDataUrl = await generateThumbnail(clips[0].src);
        if (thumbnailDataUrl) {
          // Upload thumbnail to storage
          const base64Data = thumbnailDataUrl.split(",")[1];
          const thumbnailBlob = base64ToBlob(base64Data, "image/jpeg");
          const fileName = `thumbnails/${Date.now()}-${projectName.slice(0, 20).replace(/\s/g, "-")}.jpg`;
          
          const { error: uploadError } = await supabase.storage
            .from("generated-videos")
            .upload(fileName, thumbnailBlob, { contentType: "image/jpeg" });

          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from("generated-videos")
              .getPublicUrl(fileName);
            thumbnailUrl = urlData.publicUrl;
          }
        }
      }

      const projectData = {
        name: projectName,
        description: projectDescription,
        clips: JSON.parse(JSON.stringify(clips)),
        subtitles: JSON.parse(JSON.stringify(subtitles)),
        intro: JSON.parse(JSON.stringify(intro)),
        outro: JSON.parse(JSON.stringify(outro)),
        audio_track: audioTrack ? JSON.parse(JSON.stringify(audioTrack)) : null,
        sound_effects: JSON.parse(JSON.stringify(soundEffects)),
        transition: JSON.parse(JSON.stringify(transition)),
        resolution: resolution,
        rendered_url: renderedUrl,
        thumbnail_url: thumbnailUrl,
        user_id: user.id,
      };

      if (currentProjectId && !saveAsNew) {
        // Update existing
        const { error } = await supabase
          .from("json2video_projects")
          .update(projectData)
          .eq("id", currentProjectId);
        
        if (error) throw error;
        toast.success("Progetto aggiornato!");
      } else {
        // Create new
        const { data, error } = await supabase
          .from("json2video_projects")
          .insert(projectData)
          .select("id")
          .single();
        
        if (error) throw error;
        setCurrentProjectId(data.id);
        toast.success("Progetto salvato!");
      }
      setShowSaveDialog(false);
    } catch (error) {
      console.error("Error saving project:", error);
      toast.error("Errore nel salvataggio");
    } finally {
      setIsSaving(false);
    }
  };

  const loadProject = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from("json2video_projects")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      if (!data) {
        toast.error("Progetto non trovato");
        return;
      }

      setClips((data.clips as unknown as VideoClip[]) || []);
      setSubtitles((data.subtitles as unknown as SubtitleSettings) || defaultSubtitles);
      setIntro((data.intro as unknown as IntroOutro) || defaultIntro);
      setOutro((data.outro as unknown as IntroOutro) || { ...defaultIntro, text: "" });
      setAudioTrack((data.audio_track as unknown as AudioTrack) || null);
      setSoundEffects((data.sound_effects as unknown as SoundEffect[]) || []);
      setTransition((data.transition as unknown as { type: string; duration: number }) || { type: "fade", duration: 0.5 });
      setResolution(data.resolution || "full-hd");
      setRenderedUrl(data.rendered_url || null);
      setProjectName(data.name);
      setProjectDescription(data.description || "");
      setCurrentProjectId(id);
      
      toast.success(`Progetto "${data.name}" caricato!`);
      setShowLoadDialog(false);
    } catch (error) {
      console.error("Error loading project:", error);
      toast.error("Errore nel caricamento del progetto");
    }
  };

  const deleteProject = async (id: string) => {
    try {
      const { error } = await supabase
        .from("json2video_projects")
        .delete()
        .eq("id", id);

      if (error) throw error;
      setSavedProjects(savedProjects.filter(p => p.id !== id));
      if (currentProjectId === id) {
        setCurrentProjectId(null);
        setProjectName("");
      }
      toast.success("Progetto eliminato");
    } catch (error) {
      console.error("Error deleting project:", error);
      toast.error("Errore nell'eliminazione");
    }
  };

  // ============ AI MUSIC GENERATION ============
  const generateAIMusic = async (prompt: string, duration: number) => {
    setIsGeneratingMusic(true);
    try {
      const { data, error } = await supabase.functions.invoke("elevenlabs-music", {
        body: {
          prompt,
          category: "music",
          duration: Math.min(duration, 30),
        },
      });

      if (error) throw error;
      if (!data.audioContent) throw new Error("No audio content returned");

      // Convert base64 to blob and upload to storage
      const audioBlob = base64ToBlob(data.audioContent, "audio/mp3");
      const fileName = `ai-music/${Date.now()}-${prompt.slice(0, 20).replace(/\s/g, "-")}.mp3`;
      
      const { error: uploadError } = await supabase.storage
        .from("generated-videos")
        .upload(fileName, audioBlob, { contentType: "audio/mp3" });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("generated-videos")
        .getPublicUrl(fileName);

      setAudioTrack({
        src: urlData.publicUrl,
        volume: 0.5,
        fadeIn: 2,
        fadeOut: 3,
      });

      toast.success("Musica AI generata con successo!");
      setShowMusicDialog(false);
    } catch (error) {
      console.error("Error generating AI music:", error);
      toast.error("Errore nella generazione della musica AI");
    } finally {
      setIsGeneratingMusic(false);
    }
  };

  // ============ SOUND EFFECTS ============
  const generateSoundEffect = async (sfxPrompt: string, name: string, category: 'transition' | 'ambient' | 'sfx') => {
    setSfxGeneratingId(name);
    setIsGeneratingSfx(true);
    try {
      const { data, error } = await supabase.functions.invoke("elevenlabs-music", {
        body: {
          prompt: sfxPrompt,
          category: "sfx",
          duration: category === "ambient" ? 10 : 5,
        },
      });

      if (error) throw error;
      if (!data.audioContent) throw new Error("No audio content returned");

      const audioBlob = base64ToBlob(data.audioContent, "audio/mp3");
      const fileName = `sfx/${Date.now()}-${name.replace(/\s/g, "-")}.mp3`;
      
      const { error: uploadError } = await supabase.storage
        .from("generated-videos")
        .upload(fileName, audioBlob, { contentType: "audio/mp3" });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("generated-videos")
        .getPublicUrl(fileName);

      const newSfx: SoundEffect = {
        id: crypto.randomUUID(),
        name,
        src: urlData.publicUrl,
        startTime: 0,
        volume: 0.7,
        category,
      };

      setSoundEffects([...soundEffects, newSfx]);
      toast.success(`Effetto sonoro "${name}" generato!`);
    } catch (error) {
      console.error("Error generating sound effect:", error);
      toast.error("Errore nella generazione dell'effetto sonoro");
    } finally {
      setIsGeneratingSfx(false);
      setSfxGeneratingId(null);
    }
  };

  const removeSoundEffect = (id: string) => {
    setSoundEffects(soundEffects.filter(sfx => sfx.id !== id));
  };

  const updateSoundEffect = (id: string, updates: Partial<SoundEffect>) => {
    setSoundEffects(soundEffects.map(sfx => sfx.id === id ? { ...sfx, ...updates } : sfx));
  };

  // Helper function to convert base64 to Blob
  const base64ToBlob = (base64: string, mimeType: string): Blob => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
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
        // AI-generated assets
        aiImages: aiImages.length > 0 ? aiImages.map(img => ({
          model: img.model,
          prompt: img.prompt,
          aspectRatio: img.aspectRatio,
          duration: img.duration,
          resize: img.resize,
          zoom: img.zoom,
          pan: img.pan !== "none" ? img.pan : undefined,
        })) : undefined,
        aiVoices: aiVoices.length > 0 ? aiVoices.map(v => ({
          model: v.model,
          text: v.text,
          voice: v.voice,
          volume: v.volume,
        })) : undefined,
        // Webhook notifications for realtime updates
        useWebhook: true,
        draft: false,
        quality: "high",
      };

      console.log("JSON2Video payload:", payload);

      const { data, error } = await supabase.functions.invoke("json2video", {
        body: payload,
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Render failed");

      setRenderProjectId(data.projectId);
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
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Film className="h-6 w-6" />
              JSON2Video Editor
              {currentProjectId && (
                <Badge variant="outline" className="ml-2">{projectName}</Badge>
              )}
            </h2>
          </div>
          <p className="text-muted-foreground text-sm">
            Concatena video, aggiungi sottotitoli, audio e transizioni
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <ActiveProviderIndicator 
              operations={['video_generation', 'music_generation', 'sound_effects', 'text_to_speech']}
            />
            <QuickProviderSwitch 
              operations={['video_generation', 'music_generation', 'sound_effects', 'text_to_speech']}
              trigger={
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
                  <Settings2 className="h-3.5 w-3.5" />
                  Cambia
                </Button>
              }
            />
            <ProjectCostEstimator
              compact
              operations={{
                video_clips: clips.length,
                music_tracks: audioTrack ? 1 : 0,
                sound_effects: soundEffects.length,
                voiceovers: clips.filter(c => c.textOverlays.length > 0).length,
                voiceover_characters: clips.reduce((acc, c) => 
                  acc + c.textOverlays.reduce((sum, t) => sum + t.text.length, 0), 0
                ),
              }}
            />
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Project Management Buttons */}
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              loadSavedProjects();
              setShowLoadDialog(true);
            }}
          >
            <FolderOpen className="mr-2 h-4 w-4" />
            Apri
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowSaveDialog(true)}
          >
            <Save className="mr-2 h-4 w-4" />
            Salva
          </Button>
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

      {/* Save Project Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salva Progetto</DialogTitle>
            <DialogDescription>
              Salva il progetto per riprenderlo successivamente
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Nome Progetto *</Label>
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Il mio video..."
              />
            </div>
            <div className="space-y-2">
              <Label>Descrizione</Label>
              <Textarea
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Descrivi il progetto..."
              />
            </div>
          </div>
          <DialogFooter>
            {currentProjectId && (
              <Button variant="outline" onClick={() => saveProject(true)} disabled={isSaving}>
                Salva come Nuovo
              </Button>
            )}
            <Button onClick={() => saveProject(false)} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {currentProjectId ? "Aggiorna" : "Salva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load Project Dialog */}
      <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Carica Progetto</DialogTitle>
            <DialogDescription>
              Seleziona un progetto salvato da caricare
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px] mt-4">
            {isLoadingProjects ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : savedProjects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FolderOpen className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nessun progetto salvato</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {savedProjects.map((project) => (
                  <div
                    key={project.id}
                    className="rounded-lg border hover:border-primary transition-colors cursor-pointer group overflow-hidden"
                    onClick={() => loadProject(project.id)}
                  >
                    {/* Thumbnail */}
                    <div className="aspect-video bg-muted relative overflow-hidden">
                      {project.thumbnail_url ? (
                        <img 
                          src={project.thumbnail_url} 
                          alt={project.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Film className="h-8 w-8 text-muted-foreground opacity-50" />
                        </div>
                      )}
                      {project.rendered_url && (
                        <Badge variant="secondary" className="absolute top-2 right-2 text-xs">
                          Renderizzato
                        </Badge>
                      )}
                    </div>
                    {/* Info */}
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{project.name}</h4>
                          {project.description && (
                            <p className="text-sm text-muted-foreground line-clamp-1">{project.description}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(project.updated_at).toLocaleDateString("it-IT")}
                          </p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteProject(project.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* AI Music Dialog */}
      <Dialog open={showMusicDialog} onOpenChange={setShowMusicDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CloudLightning className="h-5 w-5" />
              Genera Musica AI
            </DialogTitle>
            <DialogDescription>
              Genera automaticamente una colonna sonora con ElevenLabs AI
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Prompt personalizzato</Label>
              <Textarea
                value={musicPrompt}
                onChange={(e) => setMusicPrompt(e.target.value)}
                placeholder="Descrivi lo stile musicale desiderato..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Durata (secondi): {musicDuration}s</Label>
              <Slider
                value={[musicDuration]}
                min={10}
                max={30}
                step={5}
                onValueChange={([v]) => setMusicDuration(v)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {musicPrompts.map((mp) => (
                <button
                  key={mp.name}
                  onClick={() => {
                    setMusicPrompt(mp.prompt);
                    setMusicDuration(mp.duration);
                  }}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    musicPrompt === mp.prompt ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  }`}
                >
                  <span className="text-sm font-medium">{mp.name}</span>
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => generateAIMusic(musicPrompt, musicDuration)}
              disabled={isGeneratingMusic || !musicPrompt}
            >
              {isGeneratingMusic ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  Genera Musica
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <TabsList className="grid w-full grid-cols-7">
                <TabsTrigger value="clip">Clip</TabsTrigger>
                <TabsTrigger value="subtitles">Sottotitoli</TabsTrigger>
                <TabsTrigger value="audio">Audio</TabsTrigger>
                <TabsTrigger value="intro">Intro/Outro</TabsTrigger>
                <TabsTrigger value="ai-assets" className="relative">
                  <Brain className="h-3.5 w-3.5 mr-1" />
                  AI
                  {(aiImages.length > 0 || aiVoices.length > 0) && (
                    <Badge 
                      variant="secondary" 
                      className="ml-1.5 h-5 min-w-5 px-1.5 text-xs font-semibold bg-primary text-primary-foreground"
                    >
                      {aiImages.length + aiVoices.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="templates" className="relative">
                  <FileCode className="h-3.5 w-3.5 mr-1" />
                  Template
                  {savedTemplatesCount > 0 && (
                    <Badge 
                      variant="secondary" 
                      className="ml-1.5 h-5 min-w-5 px-1.5 text-xs font-semibold bg-primary text-primary-foreground"
                    >
                      {savedTemplatesCount}
                    </Badge>
                  )}
                </TabsTrigger>
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
                <Accordion type="single" collapsible defaultValue="background">
                  {/* AI Music Generation */}
                  <AccordionItem value="ai-music">
                    <AccordionTrigger>
                      <div className="flex items-center gap-2">
                        <CloudLightning className="h-4 w-4" />
                        Genera Musica AI
                        {audioTrack && <Badge variant="secondary">Attivo</Badge>}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-2">
                        <p className="text-sm text-muted-foreground">
                          Genera automaticamente una colonna sonora con ElevenLabs AI
                        </p>
                        <Button 
                          onClick={() => setShowMusicDialog(true)}
                          className="w-full"
                        >
                          <Wand2 className="mr-2 h-4 w-4" />
                          Apri Generatore Musica AI
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Background Audio */}
                  <AccordionItem value="background">
                    <AccordionTrigger>
                      <div className="flex items-center gap-2">
                        <Music className="h-4 w-4" />
                        Audio di Sottofondo
                        {audioTrack && <Badge variant="secondary">Attivo</Badge>}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-2">
                        {/* Local audio upload */}
                        <div className="space-y-2">
                          <Label>Carica Audio Locale</Label>
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
                                
                                const fileName = `audio/${Date.now()}-${file.name}`;
                                const { error } = await supabase.storage
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
                        </div>

                        {/* URL input */}
                        <div className="space-y-2">
                          <Label>URL Audio</Label>
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
                            <div className="space-y-2">
                              <Label>Anteprima</Label>
                              <audio 
                                controls 
                                src={audioTrack.src} 
                                className="w-full h-10"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Volume: {Math.round(audioTrack.volume * 100)}%</Label>
                              <Slider
                                value={[audioTrack.volume]}
                                min={0}
                                max={2}
                                step={0.1}
                                onValueChange={([v]) => setAudioTrack({ ...audioTrack, volume: v })}
                              />
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
                    </AccordionContent>
                  </AccordionItem>

                  {/* Sound Effects */}
                  <AccordionItem value="sfx">
                    <AccordionTrigger>
                      <div className="flex items-center gap-2">
                        <Waves className="h-4 w-4" />
                        Effetti Sonori ({soundEffects.length})
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-2">
                        <p className="text-sm text-muted-foreground">
                          Genera effetti sonori AI per transizioni e momenti chiave
                        </p>
                        
                        {/* SFX Library */}
                        <div className="space-y-2">
                          <Label>Libreria Effetti Sonori</Label>
                          <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
                            {soundEffectsLibrary.map((sfx) => (
                              <button
                                key={sfx.name}
                                onClick={() => generateSoundEffect(sfx.prompt, sfx.name, sfx.category)}
                                disabled={isGeneratingSfx}
                                className="p-2 rounded border text-left text-sm hover:border-primary transition-colors disabled:opacity-50 flex items-center justify-between"
                              >
                                <span>{sfx.name}</span>
                                {sfxGeneratingId === sfx.name ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Badge variant="outline" className="text-xs">
                                    {sfx.category}
                                  </Badge>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Active Sound Effects */}
                        {soundEffects.length > 0 && (
                          <div className="space-y-2">
                            <Label>Effetti Attivi</Label>
                            <div className="space-y-2">
                              {soundEffects.map((sfx) => (
                                <div key={sfx.id} className="p-3 rounded-lg border space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="secondary">{sfx.category}</Badge>
                                      <span className="text-sm font-medium">{sfx.name}</span>
                                    </div>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => removeSoundEffect(sfx.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  <audio controls src={sfx.src} className="w-full h-8" />
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                      <Label className="text-xs">Inizio (sec)</Label>
                                      <Input
                                        type="number"
                                        value={sfx.startTime}
                                        onChange={(e) => updateSoundEffect(sfx.id, { startTime: Number(e.target.value) })}
                                        className="h-8"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs">Volume: {Math.round(sfx.volume * 100)}%</Label>
                                      <Slider
                                        value={[sfx.volume]}
                                        min={0}
                                        max={1}
                                        step={0.1}
                                        onValueChange={([v]) => updateSoundEffect(sfx.id, { volume: v })}
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
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

              {/* AI Assets Tab */}
              <TabsContent value="ai-assets" className="space-y-4 mt-4">
                <JSON2VideoAIAssets
                  aiImages={aiImages}
                  aiVoices={aiVoices}
                  onImagesChange={setAiImages}
                  onVoicesChange={setAiVoices}
                />
              </TabsContent>

              {/* Templates Tab */}
              <TabsContent value="templates" className="space-y-4 mt-4">
                <JSON2VideoTemplateManager
                  currentConfig={{
                    clips,
                    subtitles,
                    intro,
                    outro,
                    audioTrack,
                    transition,
                    resolution,
                    soundEffects,
                    aiImages,
                    aiVoices,
                  }}
                  onApplyTemplate={(config) => {
                    if (config.clips) setClips(config.clips as VideoClip[]);
                    if (config.subtitles) setSubtitles(config.subtitles as SubtitleSettings);
                    if (config.intro) setIntro(config.intro as IntroOutro);
                    if (config.outro) setOutro(config.outro as IntroOutro);
                    if (config.audioTrack !== undefined) setAudioTrack(config.audioTrack as AudioTrack | null);
                    if (config.transition) setTransition(config.transition);
                    if (config.resolution) setResolution(config.resolution);
                    if (config.soundEffects) setSoundEffects(config.soundEffects as SoundEffect[]);
                    if (config.aiImages) setAiImages(config.aiImages);
                    if (config.aiVoices) setAiVoices(config.aiVoices);
                  }}
                  onTemplatesCountChange={setSavedTemplatesCount}
                />
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
