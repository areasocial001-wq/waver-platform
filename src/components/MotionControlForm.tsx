import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Upload, Sparkles, X, Video, Image, Play, Loader2, Info, Wand2, Library, History, Check } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Example video URLs for presets (using public domain / royalty-free motion reference videos)
const PRESET_VIDEOS: Record<string, string> = {
  // Dance
  dance_hiphop: "https://assets.mixkit.co/videos/preview/mixkit-young-man-dancing-hip-hop-in-a-dark-studio-37808-large.mp4",
  dance_ballet: "https://assets.mixkit.co/videos/preview/mixkit-ballet-dancer-on-a-dark-stage-4846-large.mp4",
  dance_salsa: "https://assets.mixkit.co/videos/preview/mixkit-couple-dancing-salsa-in-the-dark-4875-large.mp4",
  dance_robot: "https://assets.mixkit.co/videos/preview/mixkit-young-man-dancing-hip-hop-in-a-dark-studio-37808-large.mp4",
  dance_wave: "https://assets.mixkit.co/videos/preview/mixkit-young-woman-doing-a-contemporary-dance-50319-large.mp4",
  // Gestures
  gesture_wave: "https://assets.mixkit.co/videos/preview/mixkit-portrait-of-a-woman-waving-with-her-hand-22616-large.mp4",
  gesture_thumbsup: "https://assets.mixkit.co/videos/preview/mixkit-woman-giving-a-thumbs-up-on-a-pink-background-43295-large.mp4",
  gesture_clap: "https://assets.mixkit.co/videos/preview/mixkit-happy-audience-clapping-505-large.mp4",
  gesture_point: "https://assets.mixkit.co/videos/preview/mixkit-woman-pointing-with-her-finger-to-the-left-44494-large.mp4",
  gesture_shrug: "https://assets.mixkit.co/videos/preview/mixkit-woman-shrugging-her-shoulders-while-talking-44495-large.mp4",
  // Expressions  
  expr_smile: "https://assets.mixkit.co/videos/preview/mixkit-portrait-of-a-smiling-woman-on-a-pink-background-43292-large.mp4",
  expr_surprise: "https://assets.mixkit.co/videos/preview/mixkit-woman-with-a-surprised-expression-44491-large.mp4",
  expr_think: "https://assets.mixkit.co/videos/preview/mixkit-woman-thinking-and-looking-to-the-side-44493-large.mp4",
  expr_laugh: "https://assets.mixkit.co/videos/preview/mixkit-happy-woman-laughing-hard-43303-large.mp4",
  expr_wink: "https://assets.mixkit.co/videos/preview/mixkit-portrait-of-a-smiling-woman-on-a-pink-background-43292-large.mp4",
  // Actions
  action_walk: "https://assets.mixkit.co/videos/preview/mixkit-woman-walking-in-high-heels-through-an-aisle-6563-large.mp4",
  action_run: "https://assets.mixkit.co/videos/preview/mixkit-woman-running-in-the-park-at-sunset-43017-large.mp4",
  action_jump: "https://assets.mixkit.co/videos/preview/mixkit-young-man-jumping-on-the-street-1230-large.mp4",
  action_sit: "https://assets.mixkit.co/videos/preview/mixkit-woman-sitting-on-a-pink-background-43305-large.mp4",
  action_turn: "https://assets.mixkit.co/videos/preview/mixkit-woman-turning-around-and-posing-43301-large.mp4",
};

// Motion presets library
const MOTION_PRESETS = {
  dance: [
    { id: "dance_hiphop", name: "Hip Hop", description: "Movimenti hip hop urbani e dinamici", thumbnail: "🕺", hasVideo: true },
    { id: "dance_ballet", name: "Balletto", description: "Movimenti eleganti di danza classica", thumbnail: "🩰", hasVideo: true },
    { id: "dance_salsa", name: "Salsa", description: "Passi di salsa latina energici", thumbnail: "💃", hasVideo: true },
    { id: "dance_robot", name: "Robot", description: "Movimenti meccanici stile robot", thumbnail: "🤖", hasVideo: true },
    { id: "dance_wave", name: "Wave", description: "Movimento ondulatorio fluido", thumbnail: "🌊", hasVideo: true },
  ],
  gestures: [
    { id: "gesture_wave", name: "Saluto", description: "Saluto con la mano", thumbnail: "👋", hasVideo: true },
    { id: "gesture_thumbsup", name: "Pollice su", description: "Gesto di approvazione", thumbnail: "👍", hasVideo: true },
    { id: "gesture_clap", name: "Applauso", description: "Battere le mani", thumbnail: "👏", hasVideo: true },
    { id: "gesture_point", name: "Indicare", description: "Indicare con il dito", thumbnail: "👉", hasVideo: true },
    { id: "gesture_shrug", name: "Scrollata", description: "Scrollare le spalle", thumbnail: "🤷", hasVideo: true },
  ],
  expressions: [
    { id: "expr_smile", name: "Sorriso", description: "Espressione di felicità", thumbnail: "😊", hasVideo: true },
    { id: "expr_surprise", name: "Sorpresa", description: "Espressione sorpresa", thumbnail: "😮", hasVideo: true },
    { id: "expr_think", name: "Pensieroso", description: "Espressione riflessiva", thumbnail: "🤔", hasVideo: true },
    { id: "expr_laugh", name: "Risata", description: "Risata genuina", thumbnail: "😂", hasVideo: true },
    { id: "expr_wink", name: "Occhiolino", description: "Strizzare l'occhio", thumbnail: "😉", hasVideo: true },
  ],
  actions: [
    { id: "action_walk", name: "Camminata", description: "Camminare normalmente", thumbnail: "🚶", hasVideo: true },
    { id: "action_run", name: "Corsa", description: "Correre velocemente", thumbnail: "🏃", hasVideo: true },
    { id: "action_jump", name: "Salto", description: "Saltare in alto", thumbnail: "⬆️", hasVideo: true },
    { id: "action_sit", name: "Sedersi", description: "Sedersi lentamente", thumbnail: "🪑", hasVideo: true },
    { id: "action_turn", name: "Girarsi", description: "Ruotare su se stessi", thumbnail: "🔄", hasVideo: true },
  ],
};

type MotionPreset = {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  hasVideo?: boolean;
};

type HistoryVideo = {
  id: string;
  video_url: string | null;
  prompt: string | null;
  created_at: string;
  image_name: string | null;
};

// Video card with hover preview component
const VideoPreviewCard = ({ 
  video, 
  onSelect 
}: { 
  video: HistoryVideo; 
  onSelect: (video: HistoryVideo) => void;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseEnter = () => {
    setIsHovering(true);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <Card 
      className="cursor-pointer hover:border-primary transition-all overflow-hidden group"
      onClick={() => onSelect(video)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="relative aspect-video bg-muted">
        <video 
          ref={videoRef}
          src={video.video_url || ""} 
          className="w-full h-full object-cover"
          muted
          loop
          playsInline
          preload="metadata"
        />
        <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${isHovering ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}`}>
          <Check className="w-8 h-8 text-white" />
        </div>
        {isHovering && (
          <div className="absolute bottom-1 left-1 bg-primary/90 text-primary-foreground text-[10px] px-1.5 py-0.5 rounded">
            ▶ Anteprima
          </div>
        )}
      </div>
      <CardContent className="p-2">
        <p className="text-xs text-muted-foreground truncate">
          {video.prompt || video.image_name || "Video"}
        </p>
        <p className="text-xs text-muted-foreground/70">
          {new Date(video.created_at).toLocaleDateString()}
        </p>
      </CardContent>
    </Card>
  );
};

// Preset card with video preview
const PresetVideoCard = ({
  preset,
  isSelected,
  onSelect,
  onUseVideo
}: {
  preset: MotionPreset;
  isSelected: boolean;
  onSelect: () => void;
  onUseVideo: (videoUrl: string, presetName: string) => void;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const videoUrl = PRESET_VIDEOS[preset.id];

  const handleMouseEnter = () => {
    setIsHovering(true);
    setShowVideo(true);
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {});
      }
    }, 100);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    if (videoRef.current) {
      videoRef.current.pause();
    }
  };

  const handleUseVideo = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoUrl) {
      onUseVideo(videoUrl, preset.name);
    }
  };

  return (
    <Card 
      className={`cursor-pointer hover:border-primary transition-all overflow-hidden ${
        isSelected ? "border-primary bg-primary/5 ring-2 ring-primary/20" : ""
      }`}
      onClick={onSelect}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="relative aspect-video bg-gradient-to-br from-muted to-muted/50 overflow-hidden">
        {showVideo && videoUrl ? (
          <video 
            ref={videoRef}
            src={videoUrl} 
            className="w-full h-full object-cover"
            muted
            loop
            playsInline
            preload="metadata"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-5xl">{preset.thumbnail}</span>
          </div>
        )}
        {isHovering && videoUrl && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex flex-col items-center justify-end pb-2">
            <Button 
              size="sm" 
              variant="secondary"
              className="text-xs h-7 shadow-lg"
              onClick={handleUseVideo}
            >
              <Video className="w-3 h-3 mr-1" />
              Usa questo video
            </Button>
          </div>
        )}
        {isSelected && (
          <div className="absolute top-1 right-1">
            <Badge variant="default" className="text-[10px] px-1.5 py-0.5">
              <Check className="w-3 h-3" />
            </Badge>
          </div>
        )}
      </div>
      <CardContent className="p-3 text-center">
        <p className="font-medium text-sm">{preset.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{preset.description}</p>
      </CardContent>
    </Card>
  );
};

export const MotionControlForm = () => {
  const [characterImage, setCharacterImage] = useState<string | null>(null);
  const [characterImageName, setCharacterImageName] = useState<string>("");
  const [motionVideo, setMotionVideo] = useState<string | null>(null);
  const [motionVideoName, setMotionVideoName] = useState<string>("");
  const [motionVideoPreview, setMotionVideoPreview] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [characterOrientation, setCharacterOrientation] = useState<"video" | "image">("video");
  const [keepOriginalSound, setKeepOriginalSound] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<MotionPreset | null>(null);
  const [historyVideos, setHistoryVideos] = useState<HistoryVideo[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showPresetLibrary, setShowPresetLibrary] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Fetch history videos on mount
  useEffect(() => {
    fetchHistoryVideos();
  }, []);

  const fetchHistoryVideos = async () => {
    setIsLoadingHistory(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("video_generations")
        .select("id, video_url, prompt, created_at, image_name")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .not("video_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setHistoryVideos(data || []);
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSelectHistoryVideo = async (video: HistoryVideo) => {
    if (!video.video_url) return;

    try {
      toast.info("Caricamento video dalla galleria...");
      
      // Fetch the video and convert to base64
      const response = await fetch(video.video_url);
      const blob = await response.blob();
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setMotionVideo(base64);
        setMotionVideoName(video.prompt || video.image_name || "Video dalla galleria");
        setMotionVideoPreview(video.video_url!);
        setShowHistoryDialog(false);
        toast.success("Video selezionato dalla galleria!");
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error("Error loading video:", error);
      toast.error("Errore nel caricamento del video");
    }
  };

  const handleSelectPreset = (preset: MotionPreset) => {
    setSelectedPreset(preset);
    // Add preset description to prompt
    setPrompt((prev) => {
      const presetText = `${preset.name}: ${preset.description}`;
      if (prev.includes(presetText)) return prev;
      return prev ? `${prev}\n${presetText}` : presetText;
    });
    toast.success(`Preset "${preset.name}" applicato al prompt`);
  };

  const handleUsePresetVideo = async (videoUrl: string, presetName: string) => {
    try {
      toast.info("Caricamento video preset...");
      
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setMotionVideo(base64);
        setMotionVideoName(`Preset: ${presetName}`);
        setMotionVideoPreview(videoUrl);
        setShowPresetLibrary(false);
        toast.success(`Video preset "${presetName}" caricato!`);
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error("Error loading preset video:", error);
      toast.error("Errore nel caricamento del video preset");
    }
  };

  const compressImage = (file: File, maxWidth: number = 1280, quality: number = 0.85): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      const reader = new FileReader();
      
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      reader.onerror = () => reject(new Error('Failed to read file'));
      
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Seleziona un file immagine valido");
      return;
    }

    try {
      toast.info("Ottimizzazione immagine...");
      const compressed = await compressImage(file);
      setCharacterImage(compressed);
      setCharacterImageName(file.name);
      toast.success("Immagine personaggio caricata!");
    } catch (error) {
      toast.error("Errore nel caricamento dell'immagine");
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      toast.error("Seleziona un file video valido");
      return;
    }

    // Check file size (max 100MB)
    if (file.size > 100 * 1024 * 1024) {
      toast.error("Il video deve essere inferiore a 100MB");
      return;
    }

    try {
      // Create blob URL for preview
      const videoUrl = URL.createObjectURL(file);
      setMotionVideoPreview(videoUrl);
      
      // Read as base64 for API
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setMotionVideo(base64);
        setMotionVideoName(file.name);
        toast.success("Video di riferimento caricato!");
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error("Errore nel caricamento del video");
    }
  };

  const handleGenerate = async () => {
    if (!characterImage) {
      toast.error("Carica l'immagine del personaggio");
      return;
    }

    if (!motionVideo) {
      toast.error("Carica il video di riferimento per i movimenti");
      return;
    }

    setIsLoading(true);
    setProgress(0);
    setGeneratedVideoUrl(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Devi effettuare l'accesso");
        return;
      }

      // Save to database
      const { data: generationData, error: dbError } = await supabase
        .from("video_generations")
        .insert({
          user_id: user.id,
          type: "image_to_video",
          prompt: prompt || "Motion control video",
          duration: characterOrientation === "video" ? 30 : 10,
          motion_intensity: "motion_control",
          image_name: `Motion Control: ${characterImageName}`,
          image_url: characterImage,
          status: "processing",
          provider: "piapi-kling-2.6"
        })
        .select()
        .single();

      if (dbError) throw dbError;

      toast.success("Generazione Motion Control avviata!", {
        description: "Il personaggio eseguirà i movimenti del video di riferimento..."
      });

      setProgress(10);

      // Call the edge function with motion control parameters
      const { data, error } = await supabase.functions.invoke("generate-video", {
        body: {
          type: "image_to_video",
          start_image: characterImage,
          motion_video: motionVideo,
          motion_control: true,
          character_orientation: characterOrientation,
          keep_original_sound: keepOriginalSound,
          prompt: prompt || "Smooth motion transfer",
          preferredProvider: "piapi-kling-2.6-motion",
          generationId: generationData.id
        }
      });

      if (error) throw error;

      setProgress(30);

      // Poll for result
      if (data?.operationId) {
        let attempts = 0;
        const maxAttempts = 120; // 6 minutes max

        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 3000));
          attempts++;
          
          setProgress(30 + Math.min(60, (attempts / maxAttempts) * 60));

          const { data: pollData, error: pollError } = await supabase.functions.invoke("generate-video", {
            body: { operationId: data.operationId, generationId: generationData.id }
          });

          if (pollError) throw pollError;

          if (pollData?.status === "succeeded" && pollData?.output) {
            setGeneratedVideoUrl(pollData.output);
            setProgress(100);
            toast.success("Video Motion Control generato!");
            break;
          } else if (pollData?.status === "failed") {
            throw new Error(pollData?.error || "Generazione fallita");
          }
        }

        if (attempts >= maxAttempts) {
          throw new Error("Timeout nella generazione");
        }
      }

    } catch (error: any) {
      console.error("Motion control error:", error);
      toast.error(error.message || "Errore nella generazione");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Alert className="border-primary/30 bg-primary/5">
        <Wand2 className="h-4 w-4 text-primary" />
        <AlertDescription>
          <strong>Kling 2.6 Motion Control</strong> - Trasferisci i movimenti da un video di riferimento 
          a qualsiasi personaggio. Il personaggio nell'immagine eseguirà esattamente le stesse azioni 
          e espressioni del video di riferimento.
        </AlertDescription>
      </Alert>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Character Image Upload */}
        <Card className="border-dashed border-2 hover:border-primary/50 transition-colors">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Image className="w-4 h-4 text-primary" />
              Immagine Personaggio
            </CardTitle>
            <CardDescription className="text-xs">
              Carica l'immagine del personaggio da animare
            </CardDescription>
          </CardHeader>
          <CardContent>
            {characterImage ? (
              <div className="relative">
                <img 
                  src={characterImage} 
                  alt="Character" 
                  className="w-full h-48 object-cover rounded-lg"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6"
                  onClick={() => {
                    setCharacterImage(null);
                    setCharacterImageName("");
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
                <p className="text-xs text-muted-foreground mt-2 truncate">{characterImageName}</p>
              </div>
            ) : (
              <div 
                className="flex flex-col items-center justify-center h-48 cursor-pointer"
                onClick={() => imageInputRef.current?.click()}
              >
                <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Clicca per caricare</p>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG (max 10MB)</p>
              </div>
            )}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </CardContent>
        </Card>

        {/* Motion Video Upload */}
        <Card className="border-dashed border-2 hover:border-accent/50 transition-colors">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Video className="w-4 h-4 text-accent" />
              Video Riferimento Movimenti
            </CardTitle>
            <CardDescription className="text-xs">
              Carica video, seleziona dalla galleria o usa un preset
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {motionVideo ? (
              <div className="relative">
                <video 
                  src={motionVideoPreview} 
                  className="w-full h-40 object-cover rounded-lg"
                  controls
                  muted
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6"
                  onClick={() => {
                    setMotionVideo(null);
                    setMotionVideoName("");
                    setMotionVideoPreview("");
                    setSelectedPreset(null);
                    if (motionVideoPreview && !motionVideoPreview.startsWith("http")) {
                      URL.revokeObjectURL(motionVideoPreview);
                    }
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
                <p className="text-xs text-muted-foreground mt-2 truncate">{motionVideoName}</p>
              </div>
            ) : (
              <div 
                className="flex flex-col items-center justify-center h-32 cursor-pointer border rounded-lg border-dashed hover:bg-muted/50 transition-colors"
                onClick={() => videoInputRef.current?.click()}
              >
                <Play className="w-6 h-6 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Clicca per caricare</p>
                <p className="text-xs text-muted-foreground mt-1">MP4, MOV (max 100MB)</p>
              </div>
            )}
            
            {/* Quick action buttons */}
            <div className="flex gap-2">
              <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="flex-1">
                    <History className="w-4 h-4 mr-1" />
                    Galleria
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh]">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <History className="w-5 h-5" />
                      Seleziona Video dalla Galleria
                    </DialogTitle>
                  </DialogHeader>
                  <ScrollArea className="h-[60vh] pr-4">
                    {isLoadingHistory ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      </div>
                    ) : historyVideos.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Video className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Nessun video nella galleria</p>
                        <p className="text-xs mt-1">Genera prima alcuni video per usarli come riferimento</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {historyVideos.map((video) => (
                          <VideoPreviewCard
                            key={video.id}
                            video={video}
                            onSelect={handleSelectHistoryVideo}
                          />
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </DialogContent>
              </Dialog>

              <Dialog open={showPresetLibrary} onOpenChange={setShowPresetLibrary}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="flex-1">
                    <Library className="w-4 h-4 mr-1" />
                    Preset
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh]">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Library className="w-5 h-5" />
                      Libreria Preset Movimenti
                    </DialogTitle>
                  </DialogHeader>
                  <Tabs defaultValue="dance" className="w-full">
                    <TabsList className="grid grid-cols-4 w-full">
                      <TabsTrigger value="dance">🕺 Danza</TabsTrigger>
                      <TabsTrigger value="gestures">👋 Gesti</TabsTrigger>
                      <TabsTrigger value="expressions">😊 Espressioni</TabsTrigger>
                      <TabsTrigger value="actions">🏃 Azioni</TabsTrigger>
                    </TabsList>
                    {Object.entries(MOTION_PRESETS).map(([category, presets]) => (
                      <TabsContent key={category} value={category} className="mt-4">
                        <ScrollArea className="h-[50vh]">
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pr-4">
                            {presets.map((preset) => (
                              <PresetVideoCard
                                key={preset.id}
                                preset={preset}
                                isSelected={selectedPreset?.id === preset.id}
                                onSelect={() => handleSelectPreset(preset)}
                                onUseVideo={handleUsePresetVideo}
                              />
                            ))}
                          </div>
                        </ScrollArea>
                      </TabsContent>
                    ))}
                  </Tabs>
                </DialogContent>
              </Dialog>
            </div>
            
            {selectedPreset && (
              <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-lg">
                <span className="text-lg">{selectedPreset.thumbnail}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{selectedPreset.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{selectedPreset.description}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => setSelectedPreset(null)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
            
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              onChange={handleVideoUpload}
              className="hidden"
            />
          </CardContent>
        </Card>
      </div>

      {/* Options */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Orientamento Personaggio</Label>
          <Select 
            value={characterOrientation} 
            onValueChange={(v) => setCharacterOrientation(v as "video" | "image")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="video">
                <div className="flex flex-col">
                  <span>Segue Video (max 30s)</span>
                  <span className="text-xs text-muted-foreground">Migliore per movimenti complessi</span>
                </div>
              </SelectItem>
              <SelectItem value="image">
                <div className="flex flex-col">
                  <span>Segue Immagine (max 10s)</span>
                  <span className="text-xs text-muted-foreground">Migliore per movimenti di camera</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Audio Originale</Label>
          <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
            <div>
              <p className="text-sm font-medium">Mantieni audio del video</p>
              <p className="text-xs text-muted-foreground">L'audio del video di riferimento sarà incluso</p>
            </div>
            <Switch
              checked={keepOriginalSound}
              onCheckedChange={setKeepOriginalSound}
            />
          </div>
        </div>
      </div>

      {/* Prompt */}
      <div className="space-y-2">
        <Label>Prompt (opzionale)</Label>
        <Textarea
          placeholder="Descrivi elementi aggiuntivi come sfondo, effetti, stile..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground">
          Usa il prompt per controllare elementi di sfondo e altri dettagli
        </p>
      </div>

      {/* Tips */}
      <Card className="bg-muted/30">
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" />
            Suggerimenti per risultati ottimali
          </CardTitle>
        </CardHeader>
        <CardContent className="py-0 pb-4">
          <ul className="text-xs text-muted-foreground space-y-1.5">
            <li>• L'immagine del personaggio deve mostrare il corpo intero o il busto visibile</li>
            <li>• Il video di riferimento deve contenere una persona reale con movimenti fluidi</li>
            <li>• Evita tagli e movimenti di camera nel video di riferimento</li>
            <li>• Le proporzioni del personaggio nell'immagine devono corrispondere a quelle nel video</li>
            <li>• Per movimenti complessi usa "Segue Video", per controllo camera usa "Segue Immagine"</li>
          </ul>
        </CardContent>
      </Card>

      {/* Progress */}
      {isLoading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Generazione in corso...</span>
            <span className="text-sm font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {/* Generate Button */}
      <Button 
        onClick={handleGenerate}
        disabled={isLoading || !characterImage || !motionVideo}
        className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
        size="lg"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generazione Motion Control...
          </>
        ) : (
          <>
            <Wand2 className="mr-2 h-4 w-4" />
            Genera Video con Motion Control
          </>
        )}
      </Button>

      {/* Result */}
      {generatedVideoUrl && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Video Generato
            </CardTitle>
          </CardHeader>
          <CardContent>
            <video 
              src={generatedVideoUrl}
              controls
              className="w-full rounded-lg"
            />
            <div className="flex gap-2 mt-3">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => window.open(generatedVideoUrl, '_blank')}
              >
                Apri in nuova scheda
              </Button>
              <Button 
                variant="default"
                className="flex-1"
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = generatedVideoUrl;
                  a.download = 'motion-control-video.mp4';
                  a.click();
                }}
              >
                Scarica
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
