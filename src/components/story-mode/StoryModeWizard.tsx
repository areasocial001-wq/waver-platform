import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Upload, Sparkles, Play, Check, ChevronRight, ChevronLeft,
  Film, Image, Volume2, Loader2, Download, RotateCcw, Pencil, Music, RefreshCw,
  Save, FolderOpen, Trash2, Clock, Eye, FileText, Timer,
} from "lucide-react";
import { jsPDF } from "jspdf";
import { cn } from "@/lib/utils";
import { StoryScene, StoryScript, StoryStep, StoryModeInput } from "./types";
import { SceneCard } from "./SceneCard";

const VIDEO_STYLES = [
  { id: "animation", name: "Animation", promptModifier: "3D animated style, Pixar-like, vibrant colors, smooth animation" },
  { id: "claymation", name: "Claymation", promptModifier: "claymation style, stop motion, handcrafted clay figures, warm lighting" },
  { id: "comic-noir", name: "Comic Noir", promptModifier: "comic book noir style, high contrast black and white, dramatic shadows, ink strokes" },
  { id: "watercolor", name: "Watercolor", promptModifier: "watercolor painting style, soft washes, delicate brushstrokes, pastel tones" },
  { id: "cinema", name: "Cinema", promptModifier: "cinematic style, anamorphic lens, professional color grading, film grain, shallow depth of field" },
  { id: "vintage-poster", name: "Vintage Poster", promptModifier: "vintage poster art style, retro 1950s aesthetic, bold typography, limited color palette" },
  { id: "sci-fi", name: "Sci-Fi", promptModifier: "sci-fi style, futuristic, neon lighting, holographic elements, cyberpunk atmosphere" },
  { id: "collage", name: "Collage", promptModifier: "mixed media collage style, paper textures, layered cutouts, editorial design" },
  { id: "pen-ink", name: "Pen & Ink", promptModifier: "pen and ink illustration style, detailed linework, cross-hatching, hand-drawn feel" },
  { id: "plastic-blocks", name: "Plastic Blocks", promptModifier: "plastic building blocks style, LEGO-like, miniature world, toy aesthetic, bright colors" },
  { id: "halftone", name: "Halftone", promptModifier: "halftone dot pattern, pop art style, Ben-Day dots, comic print aesthetic" },
  { id: "motion-graphics", name: "Motion Graphics", promptModifier: "clean motion graphics, flat design, geometric shapes, smooth transitions, corporate style" },
];

const VOICES = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah (F)" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George (M)" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily (F)" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel (M)" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura (F)" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam (M)" },
];

const LANGUAGES = [
  { code: "it", name: "🇮🇹 Italiano" },
  { code: "en", name: "🇬🇧 English" },
  { code: "es", name: "🇪🇸 Español" },
  { code: "fr", name: "🇫🇷 Français" },
  { code: "de", name: "🇩🇪 Deutsch" },
];

interface SavedProject {
  id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export const StoryModeWizard = () => {
  const [step, setStep] = useState<StoryStep>("input");
  const [input, setInput] = useState<StoryModeInput>({
    imageUrl: "", imageFile: null, styleId: "cinema", styleName: "Cinema",
    stylePromptModifier: "cinematic style, anamorphic lens, professional color grading, film grain, shallow depth of field",
    description: "", language: "it", voiceId: "EXAVITQu4vr4xnSDxMaL", numScenes: 8,
  });
  const [script, setScript] = useState<StoryScript | null>(null);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [backgroundMusicUrl, setBackgroundMusicUrl] = useState<string | null>(null);
  const [editingSceneIndex, setEditingSceneIndex] = useState<number | null>(null);
  const [previewLoadingIndex, setPreviewLoadingIndex] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [regeneratingScene, setRegeneratingScene] = useState<{ idx: number; type: string } | null>(null);

  // DB persistence
  const [projectId, setProjectId] = useState<string | null>(null);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showProjectList, setShowProjectList] = useState(false);

  useEffect(() => { loadProjectList(); }, []);

  const loadProjectList = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("story_mode_projects")
      .select("id, title, status, created_at, updated_at")
      .eq("user_id", user.id).order("updated_at", { ascending: false }).limit(20);
    if (data) setSavedProjects(data);
  };

  const saveProject = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !script) return;
    setIsSaving(true);
    try {
      const projectData = {
        user_id: user.id, title: script.title, synopsis: script.synopsis,
        suggested_music: script.suggestedMusic, scenes: script.scenes as any,
        input_config: input as any,
        status: step === "complete" ? "completed" : step === "generation" ? "generating" : "draft",
        final_video_url: finalVideoUrl, background_music_url: backgroundMusicUrl,
      };
      if (projectId) {
        const { error } = await supabase.from("story_mode_projects").update(projectData).eq("id", projectId);
        if (error) throw error;
        toast.success("Progetto aggiornato!");
      } else {
        const { data, error } = await supabase.from("story_mode_projects").insert(projectData).select("id").single();
        if (error) throw error;
        setProjectId(data.id);
        toast.success("Progetto salvato!");
      }
      loadProjectList();
    } catch (err: any) { toast.error(err.message || "Errore nel salvataggio"); }
    finally { setIsSaving(false); }
  };

  const loadProject = async (id: string) => {
    const { data, error } = await supabase.from("story_mode_projects").select("*").eq("id", id).single();
    if (error || !data) { toast.error("Errore nel caricamento"); return; }
    setProjectId(data.id);
    const config = data.input_config as any;
    setInput({
      imageUrl: config.imageUrl || "", imageFile: null, styleId: config.styleId || "cinema",
      styleName: config.styleName || "Cinema", stylePromptModifier: config.stylePromptModifier || "",
      description: config.description || "", language: config.language || "it",
      voiceId: config.voiceId || "EXAVITQu4vr4xnSDxMaL", numScenes: config.numScenes || 8,
    });
    setScript({ title: data.title, synopsis: data.synopsis || "", scenes: (data.scenes as any) || [], suggestedMusic: data.suggested_music || "" });
    setFinalVideoUrl(data.final_video_url);
    setBackgroundMusicUrl(data.background_music_url);
    if (data.status === "completed") setStep("complete");
    else if (data.status === "generating") setStep("generation");
    else setStep("script");
    setShowProjectList(false);
    toast.success(`Progetto "${data.title}" caricato`);
  };

  const deleteProject = async (id: string) => {
    const { error } = await supabase.from("story_mode_projects").delete().eq("id", id);
    if (error) { toast.error("Errore nell'eliminazione"); return; }
    if (projectId === id) setProjectId(null);
    toast.success("Progetto eliminato");
    loadProjectList();
  };

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setInput(prev => ({ ...prev, imageUrl: URL.createObjectURL(file), imageFile: file }));
  }, []);

  const handleStyleSelect = useCallback((styleId: string) => {
    const style = VIDEO_STYLES.find(s => s.id === styleId);
    if (style) setInput(prev => ({ ...prev, styleId: style.id, styleName: style.name, stylePromptModifier: style.promptModifier }));
  }, []);

  const updateScene = (index: number, field: keyof StoryScene, value: any) => {
    if (!script) return;
    const s = [...script.scenes];
    s[index] = { ...s[index], [field]: value };
    setScript({ ...script, scenes: s });
  };

  // Scene management
  const duplicateScene = (index: number) => {
    if (!script) return;
    const scenes = [...script.scenes];
    const dup = { ...scenes[index], sceneNumber: scenes.length + 1, previewAudioUrl: undefined };
    scenes.splice(index + 1, 0, dup);
    // Renumber
    scenes.forEach((s, i) => { s.sceneNumber = i + 1; });
    setScript({ ...script, scenes });
    toast.success(`Scena ${index + 1} duplicata`);
  };

  const deleteScene = (index: number) => {
    if (!script || script.scenes.length <= 2) {
      toast.error("Servono almeno 2 scene");
      return;
    }
    const scenes = script.scenes.filter((_, i) => i !== index);
    scenes.forEach((s, i) => { s.sceneNumber = i + 1; });
    setScript({ ...script, scenes });
    if (editingSceneIndex === index) setEditingSceneIndex(null);
    toast.success("Scena eliminata");
  };

  // Drag & drop reorder
  const handleDragDrop = (fromIdx: number, toIdx: number) => {
    if (!script || fromIdx === toIdx) return;
    const scenes = [...script.scenes];
    const [moved] = scenes.splice(fromIdx, 1);
    scenes.splice(toIdx, 0, moved);
    scenes.forEach((s, i) => { s.sceneNumber = i + 1; });
    setScript({ ...script, scenes });
  };

  // Audio preview for a single scene
  const previewSceneAudio = async (index: number) => {
    if (!script) return;
    const scene = script.scenes[index];
    if (!scene.narration.trim()) { toast.error("La scena non ha testo di narrazione"); return; }
    setPreviewLoadingIndex(index);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ text: scene.narration, voiceId: input.voiceId, language_code: input.language }),
      });
      if (!response.ok) throw new Error("TTS preview failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      updateScene(index, "previewAudioUrl", url);
      // Auto-play
      const audio = new Audio(url);
      audio.play();
    } catch (err: any) {
      toast.error("Errore nell'anteprima audio");
    } finally {
      setPreviewLoadingIndex(null);
    }
  };

  // Regenerate single scene asset
  const regenerateSceneAsset = async (index: number, type: "image" | "audio" | "video") => {
    if (!script) return;
    const scene = script.scenes[index];
    setRegeneratingScene({ idx: index, type });

    try {
      if (type === "image") {
        updateScene(index, "imageStatus", "generating");
        const { data, error } = await supabase.functions.invoke("generate-image", {
          body: { prompt: scene.imagePrompt, model: "flux", style: input.stylePromptModifier },
        });
        if (error) throw error;
        const scenes = [...script.scenes];
        scenes[index] = { ...scenes[index], imageUrl: data.imageUrl || data.url, imageStatus: "completed" };
        setScript({ ...script, scenes });
        toast.success(`Immagine scena ${index + 1} rigenerata`);
      } else if (type === "audio") {
        updateScene(index, "audioStatus", "generating");
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text: scene.narration, voiceId: input.voiceId, language_code: input.language }),
        });
        if (!response.ok) throw new Error("TTS failed");
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const scenes = [...script.scenes];
        scenes[index] = { ...scenes[index], audioUrl: url, audioStatus: "completed" };
        setScript({ ...script, scenes });
        toast.success(`Audio scena ${index + 1} rigenerato`);
      } else if (type === "video") {
        if (!scene.imageUrl) { toast.error("Genera prima l'immagine"); return; }
        updateScene(index, "videoStatus", "generating");
        const { data, error } = await supabase.functions.invoke("generate-video", {
          body: {
            prompt: `${scene.imagePrompt}, ${scene.cameraMovement.replace(/_/g, " ")}`,
            image_url: scene.imageUrl, type: "image_to_video",
            duration: Math.min(scene.duration, 10), model: "kling-2.1",
          },
        });
        if (error) throw error;
        const scenes = [...script.scenes];
        scenes[index] = { ...scenes[index], videoUrl: data.videoUrl || data.video_url, videoStatus: "completed" };
        setScript({ ...script, scenes });
        toast.success(`Video scena ${index + 1} rigenerato`);
      }
    } catch (err: any) {
      console.error(`Regen ${type} scene ${index + 1}:`, err);
      toast.error(`Errore rigenerazione ${type} scena ${index + 1}`);
      if (type === "image") updateScene(index, "imageStatus", "error");
      else if (type === "audio") updateScene(index, "audioStatus", "error");
      else updateScene(index, "videoStatus", "error");
    } finally {
      setRegeneratingScene(null);
    }
  };

  const handleGenerateScript = async () => {
    if (!input.description.trim()) { toast.error("Inserisci una descrizione"); return; }
    setIsGeneratingScript(true);
    try {
      const { data, error } = await supabase.functions.invoke("story-mode-script", {
        body: { description: input.description, style: input.styleName, stylePromptModifier: input.stylePromptModifier, numScenes: input.numScenes, language: input.language },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      const enrichedScenes = data.scenes.map((s: StoryScene) => ({
        ...s, imageStatus: "idle" as const, videoStatus: "idle" as const, audioStatus: "idle" as const,
      }));
      setScript({ ...data, scenes: enrichedScenes });
      setStep("script");
      toast.success("Script generato!");
    } catch (err: any) { toast.error(err.message || "Errore generazione script"); }
    finally { setIsGeneratingScript(false); }
  };

  const generateBackgroundMusic = async (): Promise<string | null> => {
    if (!script?.suggestedMusic) return null;
    try {
      toast.info("Generazione colonna sonora...");
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-music`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ prompt: script.suggestedMusic, duration: Math.min(script.scenes.reduce((a, s) => a + s.duration, 0), 120) }),
      });
      if (!response.ok) throw new Error(`Music failed: ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setBackgroundMusicUrl(url);
      toast.success("Colonna sonora generata! 🎵");
      return url;
    } catch (err: any) { console.error("Music error:", err); toast.error("Errore colonna sonora"); return null; }
  };

  const handleGenerateAll = async () => {
    if (!script) return;
    setIsGenerating(true);
    setStep("generation");
    setGenerationProgress(0);
    const totalSteps = script.scenes.length * 3 + 1;
    let completed = 0;
    const tick = () => { completed++; setGenerationProgress(Math.round((completed / totalSteps) * 100)); };
    const scenes = [...script.scenes];
    const musicP = generateBackgroundMusic().then(tick);

    for (let i = 0; i < scenes.length; i++) {
      try {
        scenes[i] = { ...scenes[i], imageStatus: "generating" };
        setScript(p => p ? { ...p, scenes: [...scenes] } : p);
        const { data, error } = await supabase.functions.invoke("generate-image", { body: { prompt: scenes[i].imagePrompt, model: "flux", style: input.stylePromptModifier } });
        if (error) throw error;
        scenes[i] = { ...scenes[i], imageUrl: data.imageUrl || data.url, imageStatus: "completed" };
      } catch (err: any) { scenes[i] = { ...scenes[i], imageStatus: "error", error: err.message }; }
      tick(); setScript(p => p ? { ...p, scenes: [...scenes] } : p);
    }

    for (let i = 0; i < scenes.length; i++) {
      try {
        scenes[i] = { ...scenes[i], audioStatus: "generating" };
        setScript(p => p ? { ...p, scenes: [...scenes] } : p);
        const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`, {
          method: "POST", headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: JSON.stringify({ text: scenes[i].narration, voiceId: input.voiceId, language_code: input.language }),
        });
        if (!r.ok) throw new Error("TTS failed");
        scenes[i] = { ...scenes[i], audioUrl: URL.createObjectURL(await r.blob()), audioStatus: "completed" };
      } catch (err: any) { scenes[i] = { ...scenes[i], audioStatus: "error", error: err.message }; }
      tick(); setScript(p => p ? { ...p, scenes: [...scenes] } : p);
    }

    for (let i = 0; i < scenes.length; i++) {
      if (scenes[i].imageStatus !== "completed" || !scenes[i].imageUrl) { tick(); continue; }
      try {
        scenes[i] = { ...scenes[i], videoStatus: "generating" };
        setScript(p => p ? { ...p, scenes: [...scenes] } : p);
        const { data, error } = await supabase.functions.invoke("generate-video", {
          body: { prompt: `${scenes[i].imagePrompt}, ${scenes[i].cameraMovement.replace(/_/g, " ")}`, image_url: scenes[i].imageUrl, type: "image_to_video", duration: Math.min(scenes[i].duration, 10), model: "kling-2.1" },
        });
        if (error) throw error;
        scenes[i] = { ...scenes[i], videoUrl: data.videoUrl || data.video_url, videoStatus: "completed" };
      } catch (err: any) { scenes[i] = { ...scenes[i], videoStatus: "error", error: err.message }; }
      tick(); setScript(p => p ? { ...p, scenes: [...scenes] } : p);
    }

    await musicP;
    const vids = scenes.filter(s => s.videoStatus === "completed" && s.videoUrl);
    if (vids.length >= 2) {
      try {
        toast.info("Concatenazione...");
        const { data, error } = await supabase.functions.invoke("video-concat", { body: { videoUrls: vids.map(s => s.videoUrl), transition: "crossfade", transitionDuration: 0.5 } });
        if (error) throw error;
        setFinalVideoUrl(data.videoUrl || data.url);
        toast.success("Video finale generato! 🎬");
      } catch { toast.error("Errore concatenazione"); }
    }
    setStep("complete");
    setIsGenerating(false);
    setTimeout(() => saveProject(), 500);
  };

  const stepsConfig: { key: StoryStep; label: string; icon: React.ReactNode }[] = [
    { key: "input", label: "Input", icon: <Upload className="w-4 h-4" /> },
    { key: "script", label: "Script", icon: <Pencil className="w-4 h-4" /> },
    { key: "generation", label: "Generazione", icon: <Sparkles className="w-4 h-4" /> },
    { key: "complete", label: "Video Finale", icon: <Film className="w-4 h-4" /> },
  ];
  const stepIndex = stepsConfig.findIndex(s => s.key === step);

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {stepsConfig.map((s, idx) => (
            <div key={s.key} className="flex items-center gap-2">
              <div className={cn("flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all", idx <= stepIndex ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                {idx < stepIndex ? <Check className="w-4 h-4" /> : s.icon}
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {idx < stepsConfig.length - 1 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {script && (
            <Button variant="outline" size="sm" onClick={saveProject} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span className="hidden sm:inline ml-1">Salva</span>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowProjectList(!showProjectList)}>
            <FolderOpen className="w-4 h-4" />
            <span className="hidden sm:inline ml-1">Progetti</span>
            {savedProjects.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{savedProjects.length}</Badge>}
          </Button>
        </div>
      </div>

      {/* Projects panel */}
      {showProjectList && (
        <Card className="border-accent/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2"><FolderOpen className="w-5 h-5 text-accent" />Progetti Salvati</CardTitle>
          </CardHeader>
          <CardContent>
            {savedProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nessun progetto salvato</p>
            ) : (
              <div className="grid gap-2 max-h-60 overflow-y-auto">
                {savedProjects.map(p => (
                  <div key={p.id} className={cn("flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors", projectId === p.id ? "border-primary bg-primary/5" : "border-border")} onClick={() => loadProject(p.id)}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{p.status}</Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(p.updated_at).toLocaleDateString("it-IT")}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="shrink-0" onClick={(e) => { e.stopPropagation(); deleteProject(p.id); }}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 1: Input */}
      {step === "input" && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <Card className="border-primary/20 bg-card/50">
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Image className="w-5 h-5 text-primary" />Immagine di Riferimento</CardTitle></CardHeader>
              <CardContent>
                {input.imageUrl ? (
                  <div className="relative">
                    <img src={input.imageUrl} alt="Reference" className="w-full rounded-lg max-h-48 object-cover" />
                    <Button variant="secondary" size="sm" className="absolute top-2 right-2" onClick={() => setInput(p => ({ ...p, imageUrl: "", imageFile: null }))}><RotateCcw className="w-3 h-3 mr-1" />Cambia</Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-primary/30 rounded-lg cursor-pointer hover:bg-primary/5 transition-colors">
                    <Upload className="w-8 h-8 text-primary/50 mb-2" />
                    <span className="text-sm text-muted-foreground">Carica un'immagine di riferimento</span>
                    <span className="text-xs text-muted-foreground mt-1">(opzionale)</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </label>
                )}
              </CardContent>
            </Card>
            <Card className="border-accent/20 bg-card/50">
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Sparkles className="w-5 h-5 text-accent" />Stile Visivo</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2">
                  {VIDEO_STYLES.map(style => (
                    <button key={style.id} onClick={() => handleStyleSelect(style.id)} className={cn("p-2 rounded-lg text-xs font-medium text-center transition-all border-2", input.styleId === style.id ? "border-primary bg-primary/10 text-primary" : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted")}>{style.name}</button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-4">
            <Card className="border-secondary/20 bg-card/50">
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Film className="w-5 h-5 text-secondary" />Descrizione della Storia</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Textarea placeholder="Descrivi la storia che vuoi raccontare..." value={input.description} onChange={e => setInput(p => ({ ...p, description: e.target.value }))} className="min-h-[120px]" />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Lingua</Label>
                    <Select value={input.language} onValueChange={v => setInput(p => ({ ...p, language: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{LANGUAGES.map(l => <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>)}</SelectContent></Select>
                  </div>
                  <div>
                    <Label className="text-xs">Voce Narrante</Label>
                    <Select value={input.voiceId} onValueChange={v => setInput(p => ({ ...p, voiceId: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{VOICES.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent></Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Numero Scene: {input.numScenes} (~{input.numScenes * 8}s totali)</Label>
                  <Slider value={[input.numScenes]} onValueChange={([v]) => setInput(p => ({ ...p, numScenes: v }))} min={4} max={12} step={1} className="mt-2" />
                </div>
              </CardContent>
            </Card>
            <Button onClick={handleGenerateScript} disabled={!input.description.trim() || isGeneratingScript} className="w-full h-12 text-lg" size="lg">
              {isGeneratingScript ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Generazione Script...</> : <><Sparkles className="w-5 h-5 mr-2" />Genera Script AI</>}
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Script Review */}
      {step === "script" && script && (
        <div className="space-y-4">
          <Card className="border-primary/20 bg-card/50">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex-1 min-w-0">
                  <Input value={script.title} onChange={e => setScript({ ...script, title: e.target.value })} className="text-xl font-bold bg-transparent border-none p-0 h-auto focus-visible:ring-0" />
                  <Textarea value={script.synopsis} onChange={e => setScript({ ...script, synopsis: e.target.value })} className="mt-2 text-sm text-muted-foreground bg-transparent border-none p-0 min-h-0 resize-none focus-visible:ring-0" rows={2} />
                </div>
                <div className="shrink-0 space-y-1">
                  <Badge variant="secondary" className="flex items-center gap-1"><Music className="w-3 h-3" />Colonna sonora</Badge>
                  <Input value={script.suggestedMusic} onChange={e => setScript({ ...script, suggestedMusic: e.target.value })} className="text-xs h-7" placeholder="Descrivi la musica..." />
                </div>
              </div>
            </CardHeader>
          </Card>

          <div className="text-xs text-muted-foreground text-center">
            Trascina le scene per riordinarle • Clicca 🔊 per l'anteprima audio • ✏️ per modificare
          </div>

          <div className="grid gap-3">
            {script.scenes.map((scene, idx) => (
              <SceneCard
                key={`scene-${idx}-${scene.sceneNumber}`}
                scene={scene}
                index={idx}
                mode="review"
                isEditing={editingSceneIndex === idx}
                isPreviewLoading={previewLoadingIndex === idx}
                isDragging={dragIndex === idx}
                onToggleEdit={() => setEditingSceneIndex(editingSceneIndex === idx ? null : idx)}
                onUpdate={(field, value) => updateScene(idx, field, value)}
                onPreviewAudio={() => previewSceneAudio(idx)}
                onDuplicate={() => duplicateScene(idx)}
                onDelete={() => deleteScene(idx)}
                onDragStart={() => setDragIndex(idx)}
                onDragOver={() => setDragOverIndex(idx)}
                onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                onDrop={() => { if (dragIndex !== null) handleDragDrop(dragIndex, idx); setDragIndex(null); setDragOverIndex(null); }}
              />
            ))}
          </div>

          <div className="flex gap-3 flex-wrap">
            <Button variant="outline" onClick={() => setStep("input")}><ChevronLeft className="w-4 h-4 mr-2" />Modifica Input</Button>
            <Button variant="outline" onClick={handleGenerateScript} disabled={isGeneratingScript}><RefreshCw className="w-4 h-4 mr-2" />Rigenera</Button>
            <Button variant="outline" onClick={saveProject} disabled={isSaving}><Save className="w-4 h-4 mr-2" />Salva Bozza</Button>
            <Button onClick={handleGenerateAll} className="flex-1" size="lg"><Play className="w-5 h-5 mr-2" />Avvia Produzione</Button>
          </div>
        </div>
      )}

      {/* Step 3: Generation */}
      {step === "generation" && script && (
        <div className="space-y-6">
          <Card className="border-primary/20 bg-card/50">
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Progresso Produzione</span>
                  <span className="text-sm text-muted-foreground">{generationProgress}%</span>
                </div>
                <Progress value={generationProgress} className="h-3" />
                {backgroundMusicUrl && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Music className="w-3 h-3 text-primary" />Colonna sonora generata</div>}
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {script.scenes.map((scene, idx) => (
              <SceneCard key={idx} scene={scene} index={idx} mode="generation" isEditing={false} isPreviewLoading={false} onToggleEdit={() => {}} onUpdate={() => {}} onPreviewAudio={() => {}} onDuplicate={() => {}} onDelete={() => {}} />
            ))}
          </div>
        </div>
      )}

      {/* Step 4: Complete */}
      {step === "complete" && script && (
        <div className="space-y-6">
          {finalVideoUrl ? (
            <Card className="border-primary/20 bg-card/50">
              <CardHeader><CardTitle className="text-xl flex items-center gap-2"><Film className="w-6 h-6 text-primary" />{script.title}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <video src={finalVideoUrl} controls className="w-full rounded-lg max-h-[500px]" />
                {backgroundMusicUrl && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <Music className="w-5 h-5 text-primary shrink-0" />
                    <div className="flex-1"><p className="text-sm font-medium">Colonna Sonora</p><audio src={backgroundMusicUrl} controls className="w-full mt-1 h-8" /></div>
                    <Button variant="outline" size="sm" asChild><a href={backgroundMusicUrl} download="soundtrack.mp3"><Download className="w-3 h-3" /></a></Button>
                  </div>
                )}
                <div className="flex gap-3 flex-wrap">
                  <Button asChild><a href={finalVideoUrl} download={`${script.title}.mp4`}><Download className="w-4 h-4 mr-2" />Scarica Video</a></Button>
                  <Button variant="outline" onClick={() => { setStep("input"); setScript(null); setFinalVideoUrl(null); setBackgroundMusicUrl(null); setGenerationProgress(0); setProjectId(null); }}><RotateCcw className="w-4 h-4 mr-2" />Nuova Storia</Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-accent/20 bg-card/50">
              <CardContent className="pt-6 text-center space-y-3">
                <p className="text-muted-foreground">Scarica le singole scene o rigenera quelle in errore:</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {script.scenes.filter(s => s.videoStatus === "completed" && s.videoUrl).map((s, i) => (
                    <Button key={i} variant="outline" size="sm" asChild><a href={s.videoUrl} download><Download className="w-3 h-3 mr-1" />Scena {s.sceneNumber}</a></Button>
                  ))}
                </div>
                <Button variant="outline" onClick={() => { setStep("input"); setScript(null); setFinalVideoUrl(null); setBackgroundMusicUrl(null); setProjectId(null); }}><RotateCcw className="w-4 h-4 mr-2" />Nuova Storia</Button>
              </CardContent>
            </Card>
          )}

          {/* Scene gallery with regeneration */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {script.scenes.map((scene, idx) => (
              <SceneCard
                key={idx}
                scene={scene}
                index={idx}
                mode="complete"
                isEditing={false}
                isPreviewLoading={false}
                onToggleEdit={() => {}}
                onUpdate={() => {}}
                onPreviewAudio={() => {}}
                onDuplicate={() => {}}
                onDelete={() => {}}
                onRegenerate={(type) => regenerateSceneAsset(idx, type)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
