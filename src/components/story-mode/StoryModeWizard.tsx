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
  Film, Image, Volume2, Loader2, Download, RotateCcw, Eye, Pencil, Music, RefreshCw,
  Save, FolderOpen, Trash2, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StoryScene, StoryScript, StoryStep, StoryModeInput } from "./types";

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
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah (F)", lang: "Multi" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George (M)", lang: "Multi" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily (F)", lang: "Multi" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel (M)", lang: "Multi" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura (F)", lang: "Multi" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam (M)", lang: "Multi" },
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
    imageUrl: "",
    imageFile: null,
    styleId: "cinema",
    styleName: "Cinema",
    stylePromptModifier: "cinematic style, anamorphic lens, professional color grading, film grain, shallow depth of field",
    description: "",
    language: "it",
    voiceId: "EXAVITQu4vr4xnSDxMaL",
    numScenes: 8,
  });
  const [script, setScript] = useState<StoryScript | null>(null);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [backgroundMusicUrl, setBackgroundMusicUrl] = useState<string | null>(null);
  const [editingSceneIndex, setEditingSceneIndex] = useState<number | null>(null);

  // DB persistence
  const [projectId, setProjectId] = useState<string | null>(null);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showProjectList, setShowProjectList] = useState(false);

  // Load saved projects on mount
  useEffect(() => {
    loadProjectList();
  }, []);

  const loadProjectList = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("story_mode_projects")
      .select("id, title, status, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(20);
    if (data) setSavedProjects(data);
  };

  const saveProject = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !script) return;
    setIsSaving(true);
    try {
      const projectData = {
        user_id: user.id,
        title: script.title,
        synopsis: script.synopsis,
        suggested_music: script.suggestedMusic,
        scenes: script.scenes as any,
        input_config: input as any,
        status: step === "complete" ? "completed" : step === "generation" ? "generating" : "draft",
        final_video_url: finalVideoUrl,
        background_music_url: backgroundMusicUrl,
      };

      if (projectId) {
        const { error } = await supabase
          .from("story_mode_projects")
          .update(projectData)
          .eq("id", projectId);
        if (error) throw error;
        toast.success("Progetto aggiornato!");
      } else {
        const { data, error } = await supabase
          .from("story_mode_projects")
          .insert(projectData)
          .select("id")
          .single();
        if (error) throw error;
        setProjectId(data.id);
        toast.success("Progetto salvato!");
      }
      loadProjectList();
    } catch (err: any) {
      toast.error(err.message || "Errore nel salvataggio");
    } finally {
      setIsSaving(false);
    }
  };

  const loadProject = async (id: string) => {
    const { data, error } = await supabase
      .from("story_mode_projects")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) {
      toast.error("Errore nel caricamento del progetto");
      return;
    }
    setProjectId(data.id);
    const config = data.input_config as any;
    setInput({
      imageUrl: config.imageUrl || "",
      imageFile: null,
      styleId: config.styleId || "cinema",
      styleName: config.styleName || "Cinema",
      stylePromptModifier: config.stylePromptModifier || "",
      description: config.description || "",
      language: config.language || "it",
      voiceId: config.voiceId || "EXAVITQu4vr4xnSDxMaL",
      numScenes: config.numScenes || 8,
    });
    setScript({
      title: data.title,
      synopsis: data.synopsis || "",
      scenes: (data.scenes as any) || [],
      suggestedMusic: data.suggested_music || "",
    });
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
    if (error) {
      toast.error("Errore nell'eliminazione");
      return;
    }
    if (projectId === id) {
      setProjectId(null);
    }
    toast.success("Progetto eliminato");
    loadProjectList();
  };

  // Handle image upload
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setInput(prev => ({ ...prev, imageUrl: url, imageFile: file }));
  }, []);

  const handleStyleSelect = useCallback((styleId: string) => {
    const style = VIDEO_STYLES.find(s => s.id === styleId);
    if (style) {
      setInput(prev => ({
        ...prev,
        styleId: style.id,
        styleName: style.name,
        stylePromptModifier: style.promptModifier,
      }));
    }
  }, []);

  // Scene editing
  const updateScene = (index: number, field: keyof StoryScene, value: any) => {
    if (!script) return;
    const updatedScenes = [...script.scenes];
    updatedScenes[index] = { ...updatedScenes[index], [field]: value };
    setScript({ ...script, scenes: updatedScenes });
  };

  // Generate script
  const handleGenerateScript = async () => {
    if (!input.description.trim()) {
      toast.error("Inserisci una descrizione per la storia");
      return;
    }
    setIsGeneratingScript(true);
    try {
      const { data, error } = await supabase.functions.invoke("story-mode-script", {
        body: {
          description: input.description,
          style: input.styleName,
          stylePromptModifier: input.stylePromptModifier,
          numScenes: input.numScenes,
          language: input.language,
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const enrichedScenes = data.scenes.map((s: StoryScene) => ({
        ...s,
        imageStatus: "idle" as const,
        videoStatus: "idle" as const,
        audioStatus: "idle" as const,
      }));

      setScript({ ...data, scenes: enrichedScenes });
      setStep("script");
      toast.success("Script generato con successo!");
    } catch (err: any) {
      toast.error(err.message || "Errore nella generazione dello script");
    } finally {
      setIsGeneratingScript(false);
    }
  };

  // Generate background music
  const generateBackgroundMusic = async (): Promise<string | null> => {
    if (!script?.suggestedMusic) return null;
    try {
      toast.info("Generazione colonna sonora in corso...");
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-music`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            prompt: script.suggestedMusic,
            duration: Math.min(script.scenes.reduce((acc, s) => acc + s.duration, 0), 120),
          }),
        }
      );
      if (!response.ok) throw new Error(`Music generation failed: ${response.status}`);
      const audioBlob = await response.blob();
      const musicUrl = URL.createObjectURL(audioBlob);
      setBackgroundMusicUrl(musicUrl);
      toast.success("Colonna sonora generata! 🎵");
      return musicUrl;
    } catch (err: any) {
      console.error("Music generation error:", err);
      toast.error("Errore nella generazione della colonna sonora");
      return null;
    }
  };

  // Generate all assets
  const handleGenerateAll = async () => {
    if (!script) return;
    setIsGenerating(true);
    setStep("generation");
    setGenerationProgress(0);

    // +1 for music generation
    const totalSteps = script.scenes.length * 3 + 1;
    let completed = 0;

    const updateProgress = () => {
      completed++;
      setGenerationProgress(Math.round((completed / totalSteps) * 100));
    };

    const updatedScenes = [...script.scenes];

    // Step 0: Generate background music in parallel
    const musicPromise = generateBackgroundMusic().then(() => updateProgress());

    // Step 1: Generate images
    for (let i = 0; i < updatedScenes.length; i++) {
      const scene = updatedScenes[i];
      try {
        updatedScenes[i] = { ...scene, imageStatus: "generating" };
        setScript(prev => prev ? { ...prev, scenes: [...updatedScenes] } : prev);

        const { data, error } = await supabase.functions.invoke("generate-image", {
          body: {
            prompt: scene.imagePrompt,
            model: "flux",
            style: input.stylePromptModifier,
          },
        });
        if (error) throw error;
        updatedScenes[i] = { ...updatedScenes[i], imageUrl: data.imageUrl || data.url, imageStatus: "completed" };
      } catch (err: any) {
        console.error(`Scene ${i + 1} image error:`, err);
        updatedScenes[i] = { ...updatedScenes[i], imageStatus: "error", error: err.message };
      }
      updateProgress();
      setScript(prev => prev ? { ...prev, scenes: [...updatedScenes] } : prev);
    }

    // Step 2: Generate voiceover
    for (let i = 0; i < updatedScenes.length; i++) {
      const scene = updatedScenes[i];
      try {
        updatedScenes[i] = { ...scene, audioStatus: "generating" };
        setScript(prev => prev ? { ...prev, scenes: [...updatedScenes] } : prev);

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              text: scene.narration,
              voiceId: input.voiceId,
              language_code: input.language,
            }),
          }
        );
        if (!response.ok) throw new Error("TTS generation failed");
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        updatedScenes[i] = { ...updatedScenes[i], audioUrl, audioStatus: "completed" };
      } catch (err: any) {
        console.error(`Scene ${i + 1} audio error:`, err);
        updatedScenes[i] = { ...updatedScenes[i], audioStatus: "error", error: err.message };
      }
      updateProgress();
      setScript(prev => prev ? { ...prev, scenes: [...updatedScenes] } : prev);
    }

    // Step 3: Generate videos from images
    for (let i = 0; i < updatedScenes.length; i++) {
      const scene = updatedScenes[i];
      if (scene.imageStatus !== "completed" || !scene.imageUrl) {
        updateProgress();
        continue;
      }
      try {
        updatedScenes[i] = { ...scene, videoStatus: "generating" };
        setScript(prev => prev ? { ...prev, scenes: [...updatedScenes] } : prev);

        const { data, error } = await supabase.functions.invoke("generate-video", {
          body: {
            prompt: `${scene.imagePrompt}, ${scene.cameraMovement.replace(/_/g, " ")}`,
            image_url: scene.imageUrl,
            type: "image_to_video",
            duration: Math.min(scene.duration, 10),
            model: "kling-2.1",
          },
        });
        if (error) throw error;
        updatedScenes[i] = { ...updatedScenes[i], videoUrl: data.videoUrl || data.video_url, videoStatus: "completed" };
      } catch (err: any) {
        console.error(`Scene ${i + 1} video error:`, err);
        updatedScenes[i] = { ...updatedScenes[i], videoStatus: "error", error: err.message };
      }
      updateProgress();
      setScript(prev => prev ? { ...prev, scenes: [...updatedScenes] } : prev);
    }

    // Wait for music
    await musicPromise;

    // Step 4: Concatenate videos
    const completedVideos = updatedScenes.filter(s => s.videoStatus === "completed" && s.videoUrl);
    if (completedVideos.length >= 2) {
      try {
        toast.info("Concatenazione video in corso...");
        const { data, error } = await supabase.functions.invoke("video-concat", {
          body: {
            videoUrls: completedVideos.map(s => s.videoUrl),
            transition: "crossfade",
            transitionDuration: 0.5,
          },
        });
        if (error) throw error;
        setFinalVideoUrl(data.videoUrl || data.url);
        toast.success("Video finale generato con successo! 🎬");
      } catch (err: any) {
        console.error("Concat error:", err);
        toast.error("Errore nella concatenazione dei video");
      }
    }

    setStep("complete");
    setIsGenerating(false);

    // Auto-save
    setTimeout(() => saveProject(), 500);
  };

  // Step indicators
  const stepsConfig: { key: StoryStep; label: string; icon: React.ReactNode }[] = [
    { key: "input", label: "Input", icon: <Upload className="w-4 h-4" /> },
    { key: "script", label: "Script", icon: <Pencil className="w-4 h-4" /> },
    { key: "generation", label: "Generazione", icon: <Sparkles className="w-4 h-4" /> },
    { key: "complete", label: "Video Finale", icon: <Film className="w-4 h-4" /> },
  ];

  const stepIndex = stepsConfig.findIndex(s => s.key === step);

  return (
    <div className="space-y-6">
      {/* Top bar: progress + actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {stepsConfig.map((s, idx) => (
            <div key={s.key} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
                  idx <= stepIndex
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {idx < stepIndex ? <Check className="w-4 h-4" /> : s.icon}
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {idx < stepsConfig.length - 1 && (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowProjectList(!showProjectList)}
          >
            <FolderOpen className="w-4 h-4" />
            <span className="hidden sm:inline ml-1">Progetti</span>
            {savedProjects.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">{savedProjects.length}</Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Saved Projects Panel */}
      {showProjectList && (
        <Card className="border-accent/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-accent" />
              Progetti Salvati
            </CardTitle>
          </CardHeader>
          <CardContent>
            {savedProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nessun progetto salvato</p>
            ) : (
              <div className="grid gap-2 max-h-60 overflow-y-auto">
                {savedProjects.map(p => (
                  <div
                    key={p.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors",
                      projectId === p.id ? "border-primary bg-primary/5" : "border-border"
                    )}
                    onClick={() => loadProject(p.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{p.status}</Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(p.updated_at).toLocaleDateString("it-IT")}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={(e) => { e.stopPropagation(); deleteProject(p.id); }}
                    >
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
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Image className="w-5 h-5 text-primary" />
                  Immagine di Riferimento
                </CardTitle>
              </CardHeader>
              <CardContent>
                {input.imageUrl ? (
                  <div className="relative">
                    <img src={input.imageUrl} alt="Reference" className="w-full rounded-lg max-h-48 object-cover" />
                    <Button
                      variant="secondary"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => setInput(prev => ({ ...prev, imageUrl: "", imageFile: null }))}
                    >
                      <RotateCcw className="w-3 h-3 mr-1" /> Cambia
                    </Button>
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
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-accent" />
                  Stile Visivo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2">
                  {VIDEO_STYLES.map(style => (
                    <button
                      key={style.id}
                      onClick={() => handleStyleSelect(style.id)}
                      className={cn(
                        "p-2 rounded-lg text-xs font-medium text-center transition-all border-2",
                        input.styleId === style.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {style.name}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="border-secondary/20 bg-card/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Film className="w-5 h-5 text-secondary" />
                  Descrizione della Storia
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Descrivi la storia che vuoi raccontare... Es: 'Un viaggio epico attraverso le galassie alla scoperta di mondi sconosciuti, dove un astronauta solitario trova una civiltà aliena pacifica'"
                  value={input.description}
                  onChange={e => setInput(prev => ({ ...prev, description: e.target.value }))}
                  className="min-h-[120px]"
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Lingua</Label>
                    <Select value={input.language} onValueChange={val => setInput(prev => ({ ...prev, language: val }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map(l => <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Voce Narrante</Label>
                    <Select value={input.voiceId} onValueChange={val => setInput(prev => ({ ...prev, voiceId: val }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {VOICES.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">
                    Numero Scene: {input.numScenes} (~{input.numScenes * 8}s totali)
                  </Label>
                  <Slider
                    value={[input.numScenes]}
                    onValueChange={([val]) => setInput(prev => ({ ...prev, numScenes: val }))}
                    min={4} max={12} step={1} className="mt-2"
                  />
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={handleGenerateScript}
              disabled={!input.description.trim() || isGeneratingScript}
              className="w-full h-12 text-lg"
              size="lg"
            >
              {isGeneratingScript ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Generazione Script...</>
              ) : (
                <><Sparkles className="w-5 h-5 mr-2" />Genera Script AI</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Script Review with Editing */}
      {step === "script" && script && (
        <div className="space-y-4">
          <Card className="border-primary/20 bg-card/50">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex-1 min-w-0">
                  <Input
                    value={script.title}
                    onChange={e => setScript({ ...script, title: e.target.value })}
                    className="text-xl font-bold bg-transparent border-none p-0 h-auto focus-visible:ring-0"
                  />
                  <Textarea
                    value={script.synopsis}
                    onChange={e => setScript({ ...script, synopsis: e.target.value })}
                    className="mt-2 text-sm text-muted-foreground bg-transparent border-none p-0 min-h-0 resize-none focus-visible:ring-0"
                    rows={2}
                  />
                </div>
                <div className="shrink-0 space-y-1">
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Music className="w-3 h-3" />
                    Colonna sonora
                  </Badge>
                  <Input
                    value={script.suggestedMusic}
                    onChange={e => setScript({ ...script, suggestedMusic: e.target.value })}
                    className="text-xs h-7"
                    placeholder="Descrivi la musica..."
                  />
                </div>
              </div>
            </CardHeader>
          </Card>

          <div className="grid gap-3">
            {script.scenes.map((scene, idx) => (
              <Card
                key={idx}
                className={cn(
                  "bg-card/50 transition-all",
                  editingSceneIndex === idx ? "border-primary ring-1 ring-primary/20" : "border-border/50"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-sm shrink-0 mt-1">
                      {scene.sceneNumber}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Select
                          value={String(scene.duration)}
                          onValueChange={val => updateScene(idx, "duration", Number(val))}
                        >
                          <SelectTrigger className="w-20 h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[5, 6, 7, 8, 9, 10].map(d => (
                              <SelectItem key={d} value={String(d)}>{d}s</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={scene.cameraMovement}
                          onValueChange={val => updateScene(idx, "cameraMovement", val)}
                        >
                          <SelectTrigger className="w-36 h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {["static", "slow_zoom_in", "slow_zoom_out", "pan_left", "pan_right", "tilt_up", "tilt_down", "dolly_forward"].map(m => (
                              <SelectItem key={m} value={m}>{m.replace(/_/g, " ")}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          value={scene.mood}
                          onChange={e => updateScene(idx, "mood", e.target.value)}
                          className="h-7 text-xs flex-1 min-w-[100px]"
                          placeholder="Mood..."
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => setEditingSceneIndex(editingSceneIndex === idx ? null : idx)}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                      </div>

                      {editingSceneIndex === idx ? (
                        <div className="space-y-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">🎙️ Narrazione</Label>
                            <Textarea
                              value={scene.narration}
                              onChange={e => updateScene(idx, "narration", e.target.value)}
                              className="text-sm min-h-[60px]"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">🎨 Prompt Immagine (EN)</Label>
                            <Textarea
                              value={scene.imagePrompt}
                              onChange={e => updateScene(idx, "imagePrompt", e.target.value)}
                              className="text-xs min-h-[80px] font-mono"
                            />
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
            ))}
          </div>

          <div className="flex gap-3 flex-wrap">
            <Button variant="outline" onClick={() => setStep("input")}>
              <ChevronLeft className="w-4 h-4 mr-2" />Modifica Input
            </Button>
            <Button variant="outline" onClick={handleGenerateScript} disabled={isGeneratingScript}>
              <RefreshCw className="w-4 h-4 mr-2" />Rigenera Script
            </Button>
            <Button variant="outline" onClick={saveProject} disabled={isSaving}>
              <Save className="w-4 h-4 mr-2" />Salva Bozza
            </Button>
            <Button onClick={handleGenerateAll} className="flex-1" size="lg">
              <Play className="w-5 h-5 mr-2" />Avvia Produzione Completa
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Generation Progress */}
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
                {backgroundMusicUrl && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Music className="w-3 h-3 text-primary" />
                    Colonna sonora generata
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {script.scenes.map((scene, idx) => (
              <Card key={idx} className="bg-card/50 border-border/50 overflow-hidden">
                <div className="aspect-video bg-muted/30 relative">
                  {scene.imageUrl ? (
                    <img src={scene.imageUrl} alt={`Scene ${idx + 1}`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      {scene.imageStatus === "generating" ? (
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      ) : (
                        <Image className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                  )}
                  <div className="absolute top-2 left-2">
                    <Badge className="bg-background/80 text-foreground text-xs">Scena {scene.sceneNumber}</Badge>
                  </div>
                </div>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <StatusDot status={scene.imageStatus} /><span>Img</span>
                    <StatusDot status={scene.audioStatus} /><span>Audio</span>
                    <StatusDot status={scene.videoStatus} /><span>Video</span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{scene.narration}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Step 4: Complete */}
      {step === "complete" && script && (
        <div className="space-y-6">
          {finalVideoUrl ? (
            <Card className="border-primary/20 bg-card/50">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Film className="w-6 h-6 text-primary" />{script.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <video src={finalVideoUrl} controls className="w-full rounded-lg max-h-[500px]" />
                {backgroundMusicUrl && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <Music className="w-5 h-5 text-primary shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Colonna Sonora</p>
                      <audio src={backgroundMusicUrl} controls className="w-full mt-1 h-8" />
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <a href={backgroundMusicUrl} download="soundtrack.mp3">
                        <Download className="w-3 h-3" />
                      </a>
                    </Button>
                  </div>
                )}
                <div className="flex gap-3 flex-wrap">
                  <Button asChild>
                    <a href={finalVideoUrl} download={`${script.title}.mp4`}>
                      <Download className="w-4 h-4 mr-2" />Scarica Video
                    </a>
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setStep("input");
                    setScript(null);
                    setFinalVideoUrl(null);
                    setBackgroundMusicUrl(null);
                    setGenerationProgress(0);
                    setProjectId(null);
                  }}>
                    <RotateCcw className="w-4 h-4 mr-2" />Nuova Storia
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-accent/20 bg-card/50">
              <CardContent className="pt-6">
                <div className="text-center space-y-3">
                  <p className="text-muted-foreground">
                    La concatenazione non è riuscita, ma puoi scaricare le singole scene:
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {script.scenes.filter(s => s.videoStatus === "completed" && s.videoUrl).map((s, i) => (
                      <Button key={i} variant="outline" size="sm" asChild>
                        <a href={s.videoUrl} download><Download className="w-3 h-3 mr-1" />Scena {s.sceneNumber}</a>
                      </Button>
                    ))}
                  </div>
                  <Button variant="outline" onClick={() => {
                    setStep("input");
                    setScript(null);
                    setFinalVideoUrl(null);
                    setBackgroundMusicUrl(null);
                    setProjectId(null);
                  }}>
                    <RotateCcw className="w-4 h-4 mr-2" />Nuova Storia
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Scene gallery */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {script.scenes.map((scene, idx) => (
              <Card key={idx} className="bg-card/50 overflow-hidden">
                {scene.imageUrl && (
                  <img src={scene.imageUrl} alt={`Scene ${idx + 1}`} className="w-full aspect-video object-cover" />
                )}
                <CardContent className="p-2">
                  <p className="text-xs text-muted-foreground line-clamp-1">{scene.narration}</p>
                  <div className="flex gap-1 mt-1">
                    {scene.audioUrl && (
                      <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => new Audio(scene.audioUrl!).play()}>
                        <Volume2 className="w-3 h-3" />
                      </Button>
                    )}
                    {scene.videoUrl && (
                      <Button variant="ghost" size="sm" className="h-6 px-2" asChild>
                        <a href={scene.videoUrl} target="_blank" rel="noopener"><Eye className="w-3 h-3" /></a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
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
