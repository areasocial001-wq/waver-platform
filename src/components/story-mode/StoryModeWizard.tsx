import { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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
  Save, FolderOpen, Trash2, Clock, Eye, FileText, Timer, Mic, Square, Pause,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { jsPDF } from "jspdf";
import { cn } from "@/lib/utils";
import { StoryScene, StoryScript, StoryStep, StoryModeInput } from "./types";
import { SceneCard } from "./SceneCard";
import { useVoiceOptions } from "@/hooks/useVoiceOptions";
import { useQuotas } from "@/hooks/useQuotas";

// Style preview images
import animationImg from "@/assets/styles/animation.jpg";
import claymationImg from "@/assets/styles/claymation.jpg";
import comicNoirImg from "@/assets/styles/comic-noir.jpg";
import watercolorImg from "@/assets/styles/watercolor.jpg";
import cinemaImg from "@/assets/styles/cinema.jpg";
import vintagePosterImg from "@/assets/styles/vintage-poster.jpg";
import sciFiImg from "@/assets/styles/sci-fi.jpg";
import collageImg from "@/assets/styles/collage.jpg";
import penInkImg from "@/assets/styles/pen-ink.jpg";
import plasticBlocksImg from "@/assets/styles/plastic-blocks.jpg";
import halftoneImg from "@/assets/styles/halftone.jpg";
import motionGraphicsImg from "@/assets/styles/motion-graphics.jpg";

const VIDEO_STYLES = [
  { id: "animation", name: "Animation", preview: animationImg, description: "Stile animazione 3D fluida e colorata", promptModifier: "3D animated style, Pixar-like, vibrant colors, smooth animation" },
  { id: "claymation", name: "Claymation", preview: claymationImg, description: "Stop-motion in plastilina artigianale", promptModifier: "claymation style, stop motion, handcrafted clay figures, warm lighting" },
  { id: "comic-noir", name: "Comic Noir", preview: comicNoirImg, description: "Fumetto dark con contrasti forti", promptModifier: "comic book noir style, high contrast black and white, dramatic shadows, ink strokes" },
  { id: "watercolor", name: "Watercolor", preview: watercolorImg, description: "Acquerello delicato con sfumature morbide", promptModifier: "watercolor painting style, soft washes, delicate brushstrokes, pastel tones" },
  { id: "cinema", name: "Cinema", preview: cinemaImg, description: "Cinematografico con color grading professionale", promptModifier: "cinematic style, anamorphic lens, professional color grading, film grain, shallow depth of field" },
  { id: "vintage-poster", name: "Vintage Poster", preview: vintagePosterImg, description: "Poster retrò anni '50-'60", promptModifier: "vintage poster art style, retro 1950s aesthetic, bold typography, limited color palette" },
  { id: "sci-fi", name: "Sci-Fi", preview: sciFiImg, description: "Fantascienza con atmosfere futuristiche", promptModifier: "sci-fi style, futuristic, neon lighting, holographic elements, cyberpunk atmosphere" },
  { id: "collage", name: "Collage", preview: collageImg, description: "Collage misto con texture e ritagli", promptModifier: "mixed media collage style, paper textures, layered cutouts, editorial design" },
  { id: "pen-ink", name: "Pen & Ink", preview: penInkImg, description: "Illustrazione a penna e inchiostro", promptModifier: "pen and ink illustration style, detailed linework, cross-hatching, hand-drawn feel" },
  { id: "plastic-blocks", name: "Plastic Blocks", preview: plasticBlocksImg, description: "Costruzioni in blocchetti colorati stile LEGO", promptModifier: "plastic building blocks style, LEGO-like, miniature world, toy aesthetic, bright colors" },
  { id: "halftone", name: "Halftone", preview: halftoneImg, description: "Effetto mezzetinte pop art", promptModifier: "halftone dot pattern, pop art style, Ben-Day dots, comic print aesthetic" },
  { id: "motion-graphics", name: "Motion Graphics", preview: motionGraphicsImg, description: "Grafica in movimento pulita e moderna", promptModifier: "clean motion graphics, flat design, geometric shapes, smooth transitions, corporate style" },
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

// Helper to get auth headers with user's JWT token
const getAuthHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return {
    "Content-Type": "application/json",
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${token}`,
  };
};

export const StoryModeWizard = () => {
  const { voiceOptions } = useVoiceOptions();
  const { remainingStoryMode, isStoryModeUnlimited, quota, usedStoryMode } = useQuotas();
  const [step, setStep] = useState<StoryStep>("input");
  const [input, setInput] = useState<StoryModeInput>({
    imageUrl: "", imageFile: null, styleId: "cinema", styleName: "Cinema",
    stylePromptModifier: "cinematic style, anamorphic lens, professional color grading, film grain, shallow depth of field",
    description: "", language: "it", voiceId: "EXAVITQu4vr4xnSDxMaL", numScenes: 8,
    videoAspectRatio: "16:9",
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
  const [generationStartTime, setGenerationStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [voicePreviewAudio, setVoicePreviewAudio] = useState<HTMLAudioElement | null>(null);
  const [isPreviewingVoice, setIsPreviewingVoice] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const pauseRef = useRef(false);
  const cancelRef = useRef(false);

  const waitForResume = async () => {
    while (pauseRef.current && !cancelRef.current) {
      await new Promise(r => setTimeout(r, 300));
    }
  };

  const checkCancelled = () => cancelRef.current;

  const togglePause = () => {
    const next = !pauseRef.current;
    pauseRef.current = next;
    setIsPaused(next);
    toast.info(next ? "Produzione in pausa ⏸️" : "Produzione ripresa ▶️");
  };

  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const cancelGeneration = () => {
    cancelRef.current = true;
    pauseRef.current = false;
    setIsPaused(false);
    setShowCancelDialog(false);
    toast.warning("Produzione annullata ✋");
  };

  const requestCancel = () => {
    // Pause first so nothing progresses while user decides
    if (!pauseRef.current) { pauseRef.current = true; setIsPaused(true); }
    setShowCancelDialog(true);
  };

  const dismissCancel = () => {
    setShowCancelDialog(false);
    // Resume if was auto-paused
    pauseRef.current = false;
    setIsPaused(false);
  };

  const previewVoice = async (voiceId: string) => {
    if (voicePreviewAudio) { voicePreviewAudio.pause(); setVoicePreviewAudio(null); }
    if (isPreviewingVoice) { setIsPreviewingVoice(false); return; }
    setIsPreviewingVoice(true);
    try {
      const sampleText = input.language === "it" ? "Ciao, questa è un'anteprima della mia voce." :
        input.language === "es" ? "Hola, esta es una vista previa de mi voz." :
        input.language === "fr" ? "Bonjour, ceci est un aperçu de ma voix." :
        input.language === "de" ? "Hallo, dies ist eine Vorschau meiner Stimme." :
        "Hello, this is a preview of my voice.";
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ text: sampleText, voiceId, language_code: input.language }),
      });
      if (!response.ok) throw new Error("Preview failed");
      const blob = await response.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      audio.onended = () => { setIsPreviewingVoice(false); setVoicePreviewAudio(null); };
      setVoicePreviewAudio(audio);
      audio.play();
    } catch { toast.error("Errore anteprima voce"); }
    finally { setIsPreviewingVoice(false); }
  };

  // Elapsed timer
  useEffect(() => {
    if (!generationStartTime || !isGenerating) return;
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - generationStartTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [generationStartTime, isGenerating]);

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
      videoAspectRatio: config.videoAspectRatio || "16:9",
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
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ text: scene.narration, voiceId: scene.voiceId || input.voiceId, language_code: input.language }),
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
  const regenerateSceneAsset = async (index: number, type: "image" | "audio" | "video" | "sfx") => {
    if (!script) return;
    const scene = script.scenes[index];
    setRegeneratingScene({ idx: index, type });

    try {
      if (type === "image") {
        updateScene(index, "imageStatus", "generating");
        const { data, error } = await supabase.functions.invoke("generate-image", {
          body: { prompt: scene.imagePrompt, model: "flux", style: input.stylePromptModifier, aspectRatio: input.videoAspectRatio },
        });
        if (error) throw error;
        if (data?.fallback || !data?.imageUrl) {
          const message = data?.retryAfter
            ? `Generazione immagini temporaneamente limitata. Riprova tra ${data.retryAfter}s.`
            : (data?.message || "Generazione immagini temporaneamente non disponibile.");
          updateScene(index, "imageStatus", "error");
          toast.error(message);
          return;
        }
        const scenes = [...script.scenes];
        scenes[index] = { ...scenes[index], imageUrl: data.imageUrl || data.url, imageStatus: "completed" };
        setScript({ ...script, scenes });
        toast.success(`Immagine scena ${index + 1} rigenerata`);
      } else if (type === "audio") {
        updateScene(index, "audioStatus", "generating");
        const authHeaders = await getAuthHeaders();
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ text: scene.narration, voiceId: scene.voiceId || input.voiceId, language_code: input.language }),
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
            aspect_ratio: input.videoAspectRatio,
          },
        });
        if (error) throw error;
        const scenes = [...script.scenes];
        scenes[index] = { ...scenes[index], videoUrl: data.videoUrl || data.video_url, videoStatus: "completed" };
        setScript({ ...script, scenes });
        toast.success(`Video scena ${index + 1} rigenerato`);
      } else if (type === "sfx") {
        const sfxPrompt = scene.sfxPrompt || scene.mood || "ambient background";
        updateScene(index, "sfxStatus", "generating");
        const authHeaders = await getAuthHeaders();
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-sfx`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ text: sfxPrompt, duration_seconds: Math.min(scene.duration, 22) }),
        });
        if (!response.ok) throw new Error("SFX generation failed");
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const scenes = [...script.scenes];
        scenes[index] = { ...scenes[index], sfxUrl: url, sfxStatus: "completed" };
        setScript({ ...script, scenes });
        toast.success(`SFX scena ${index + 1} rigenerato`);
      }
    } catch (err: any) {
      console.error(`Regen ${type} scene ${index + 1}:`, err);
      toast.error(`Errore rigenerazione ${type} scena ${index + 1}`);
      if (type === "image") updateScene(index, "imageStatus", "error");
      else if (type === "audio") updateScene(index, "audioStatus", "error");
      else if (type === "sfx") updateScene(index, "sfxStatus", "error");
      else updateScene(index, "videoStatus", "error");
    } finally {
      setRegeneratingScene(null);
    }
  };

  // Production time estimate (seconds)
  const estimatedProductionTime = script ? (() => {
    const n = script.scenes.length;
    const imgTime = n * 15;
    const ttsTime = n * 8;
    const videoTime = n * 45;
    const sfxTime = n * 5;    // ~5s per SFX
    const musicTime = 30;
    const concatTime = 10;
    return imgTime + ttsTime + videoTime + sfxTime + musicTime + concatTime;
  })() : 0;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  // Export script as PDF
  const exportScriptPDF = async () => {
    if (!script) return;
    try {
      toast.info("Generazione PDF in corso...");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const margin = 15;
      const contentW = pageW - margin * 2;
      let y = 20;

      const checkPage = (needed: number) => {
        if (y + needed > pdf.internal.pageSize.getHeight() - 20) {
          pdf.addPage();
          y = 20;
        }
      };

      // Title
      pdf.setFontSize(22);
      pdf.setFont("helvetica", "bold");
      pdf.text(script.title, pageW / 2, y, { align: "center" });
      y += 10;

      // Synopsis
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "italic");
      const synLines = pdf.splitTextToSize(script.synopsis, contentW);
      pdf.text(synLines, margin, y);
      y += synLines.length * 5 + 5;

      // Meta
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text(`Stile: ${input.styleName}  |  Scene: ${script.scenes.length}  |  Musica: ${script.suggestedMusic}`, margin, y);
      y += 10;

      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, y, pageW - margin, y);
      y += 8;

      // Scenes
      for (let i = 0; i < script.scenes.length; i++) {
        const scene = script.scenes[i];
        checkPage(60);

        // Scene header
        pdf.setFontSize(13);
        pdf.setFont("helvetica", "bold");
        pdf.text(`Scena ${scene.sceneNumber}`, margin, y);
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.text(`${scene.duration}s  |  ${scene.cameraMovement.replace(/_/g, " ")}  |  ${scene.mood}`, margin + 25, y);
        y += 7;

        // Image thumbnail if available
        if (scene.imageUrl) {
          try {
            const img = await loadImageAsBase64(scene.imageUrl);
            checkPage(45);
            pdf.addImage(img, "JPEG", margin, y, 60, 34);
            // Narration next to image
            pdf.setFontSize(10);
            pdf.setFont("helvetica", "normal");
            const narrationLines = pdf.splitTextToSize(`🎙️ ${scene.narration}`, contentW - 65);
            pdf.text(narrationLines, margin + 64, y + 3);
            y += Math.max(36, narrationLines.length * 5) + 3;
          } catch {
            // Image failed to load, just show text
            pdf.setFontSize(10);
            const narrationLines = pdf.splitTextToSize(`🎙️ ${scene.narration}`, contentW);
            pdf.text(narrationLines, margin, y);
            y += narrationLines.length * 5 + 3;
          }
        } else {
          pdf.setFontSize(10);
          const narrationLines = pdf.splitTextToSize(`🎙️ ${scene.narration}`, contentW);
          pdf.text(narrationLines, margin, y);
          y += narrationLines.length * 5 + 3;
        }

        // Image prompt
        checkPage(15);
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "italic");
        pdf.setTextColor(120, 120, 120);
        const promptLines = pdf.splitTextToSize(`Prompt: ${scene.imagePrompt}`, contentW);
        pdf.text(promptLines, margin, y);
        pdf.setTextColor(0, 0, 0);
        y += promptLines.length * 4 + 6;

        // Separator
        if (i < script.scenes.length - 1) {
          checkPage(5);
          pdf.setDrawColor(230, 230, 230);
          pdf.line(margin, y, pageW - margin, y);
          y += 6;
        }
      }

      // Footer
      pdf.setFontSize(7);
      pdf.setTextColor(150, 150, 150);
      pdf.text(`Generato il ${new Date().toLocaleString("it-IT")}`, margin, pdf.internal.pageSize.getHeight() - 10);

      pdf.save(`${script.title.replace(/\s+/g, "-")}-script.pdf`);
      toast.success("PDF scaricato!");
    } catch (err: any) {
      console.error("PDF export error:", err);
      toast.error("Errore esportazione PDF");
    }
  };

  const loadImageAsBase64 = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = document.createElement("img");
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d")?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = reject;
      img.src = url;
    });
  };

  // Map scene mood to SFX prompt
  const moodToSfxPrompt = (mood: string): string => {
    const m = mood.toLowerCase();
    const map: Record<string, string> = {
      outdoor: "gentle wind blowing through trees, birds chirping",
      nature: "forest ambiance, gentle stream, birds singing",
      city: "city ambiance, distant traffic, crowd murmur",
      urban: "urban street sounds, footsteps, distant cars",
      rain: "rain falling on a roof, gentle thunder in the distance",
      storm: "heavy rain, thunder, wind howling",
      night: "crickets chirping, gentle night breeze, owl hooting",
      horror: "creepy atmosphere, eerie whispers, creaking wood",
      suspense: "tense atmosphere, low rumble, heartbeat",
      tension: "tense atmosphere, low rumble, rising suspense",
      war: "distant explosions, gunfire, helicopters",
      battle: "sword clashing, battle cries, shields hitting",
      space: "deep space ambiance, electronic hum, cosmic whoosh",
      ocean: "ocean waves crashing, seagulls, wind",
      beach: "waves on beach, seagulls, gentle wind",
      forest: "forest ambiance, rustling leaves, bird calls",
      desert: "desert wind, sand blowing, distant eagle cry",
      celebration: "crowd cheering, applause, festive sounds",
      romantic: "soft piano notes, gentle breeze, heartbeat",
      sad: "gentle rain, melancholic wind, distant church bell",
      happy: "cheerful atmosphere, birds singing, children laughing",
      mysterious: "mysterious ambiance, echoing footsteps, distant whispers",
      epic: "epic whoosh, rising tension, powerful rumble",
      calm: "gentle stream, soft breeze, birds in the distance",
      peaceful: "peaceful meadow, gentle wind, soft birdsong",
    };
    for (const [key, prompt] of Object.entries(map)) {
      if (m.includes(key)) return prompt;
    }
    // Fallback: use the mood itself as a prompt
    return `ambient sound for a ${mood} scene, subtle background atmosphere`;
  };

  // Generate SFX for a scene
  const generateSceneSfx = async (scene: StoryScene): Promise<string | null> => {
    const sfxPrompt = moodToSfxPrompt(scene.mood);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-sfx`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ text: sfxPrompt, duration_seconds: Math.min(scene.duration, 22) }),
      });
      if (!response.ok) throw new Error(`SFX failed: ${response.status}`);
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (err) {
      console.error("SFX generation error:", err);
      return null;
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
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-music`, {
        method: "POST",
        headers: authHeaders,
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

  // Upload PDF/text file for description
  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingDoc(true);
    try {
      if (file.type === "text/plain" || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
        const text = await file.text();
        setInput(prev => ({ ...prev, description: text.slice(0, 5000) }));
        toast.success("Testo caricato!");
      } else if (file.type === "application/pdf") {
        toast.info("Estrazione testo dal PDF...");
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = (reader.result as string).split(",")[1];
          const { data, error } = await supabase.functions.invoke("extract-pdf-text", {
            body: { pdfBase64: base64 },
          });
          if (error) throw error;
          if (data?.text) {
            setInput(prev => ({ ...prev, description: data.text.slice(0, 5000) }));
            toast.success("Testo estratto dal PDF!");
          } else {
            toast.error("Nessun testo estratto");
          }
        };
        reader.readAsDataURL(file);
      } else {
        toast.error("Formato non supportato. Usa PDF o TXT.");
      }
    } catch (err: any) {
      console.error("Doc upload error:", err);
      toast.error("Errore nel caricamento del documento");
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleGenerateAll = async () => {
    if (!script) return;

    // Warn if this is the last available project
    if (!isStoryModeUnlimited && remainingStoryMode <= 1 && remainingStoryMode > 0) {
      toast.warning("⚠️ Questo è il tuo ultimo progetto Story Mode disponibile questo mese!", { duration: 6000 });
    }

    setIsGenerating(true);
    setStep("generation");
    setGenerationProgress(0);
    setGenerationStartTime(Date.now());
    setElapsedSeconds(0);
    pauseRef.current = false;
    cancelRef.current = false;
    setIsPaused(false);
    const totalSteps = script.scenes.length * 4 + 1;
    let completed = 0;
    const tick = () => { completed++; setGenerationProgress(Math.round((completed / totalSteps) * 100)); };
    const scenes = [...script.scenes];
    const musicP = generateBackgroundMusic().then(tick);

    // Images
    for (let i = 0; i < scenes.length; i++) {
      await waitForResume();
      if (checkCancelled()) break;
      try {
        scenes[i] = { ...scenes[i], imageStatus: "generating" };
        setScript(p => p ? { ...p, scenes: [...scenes] } : p);
        const { data, error } = await supabase.functions.invoke("generate-image", { body: { prompt: scenes[i].imagePrompt, model: "flux", style: input.stylePromptModifier, aspectRatio: input.videoAspectRatio } });
        if (error) throw error;
        if (data?.fallback || !data?.imageUrl) {
          const message = data?.retryAfter
            ? `Generazione immagini temporaneamente limitata. Riprova tra ${data.retryAfter}s.`
            : (data?.message || "Generazione immagini temporaneamente non disponibile.");
          scenes[i] = { ...scenes[i], imageStatus: "error", error: message };
        } else {
          scenes[i] = { ...scenes[i], imageUrl: data.imageUrl || data.url, imageStatus: "completed" };
        }
      } catch (err: any) { scenes[i] = { ...scenes[i], imageStatus: "error", error: err.message }; }
      tick(); setScript(p => p ? { ...p, scenes: [...scenes] } : p);
    }

    // TTS narration
    for (let i = 0; i < scenes.length && !checkCancelled(); i++) {
      await waitForResume();
      if (checkCancelled()) break;
      try {
        scenes[i] = { ...scenes[i], audioStatus: "generating" };
        setScript(p => p ? { ...p, scenes: [...scenes] } : p);
        const authHeaders = await getAuthHeaders();
        const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`, {
          method: "POST", headers: authHeaders,
          body: JSON.stringify({ text: scenes[i].narration, voiceId: scenes[i].voiceId || input.voiceId, language_code: input.language }),
        });
        if (!r.ok) throw new Error("TTS failed");
        scenes[i] = { ...scenes[i], audioUrl: URL.createObjectURL(await r.blob()), audioStatus: "completed" };
      } catch (err: any) { scenes[i] = { ...scenes[i], audioStatus: "error", error: err.message }; }
      tick(); setScript(p => p ? { ...p, scenes: [...scenes] } : p);
    }

    // SFX per scene (based on mood)
    for (let i = 0; i < scenes.length && !checkCancelled(); i++) {
      await waitForResume();
      if (checkCancelled()) break;
      try {
        scenes[i] = { ...scenes[i], sfxStatus: "generating", sfxPrompt: moodToSfxPrompt(scenes[i].mood) };
        setScript(p => p ? { ...p, scenes: [...scenes] } : p);
        const sfxUrl = await generateSceneSfx(scenes[i]);
        scenes[i] = { ...scenes[i], sfxUrl: sfxUrl || undefined, sfxStatus: sfxUrl ? "completed" : "error" };
      } catch { scenes[i] = { ...scenes[i], sfxStatus: "error" }; }
      tick(); setScript(p => p ? { ...p, scenes: [...scenes] } : p);
    }

    // Video generation
    for (let i = 0; i < scenes.length && !checkCancelled(); i++) {
      await waitForResume();
      if (checkCancelled()) break;
      if (scenes[i].imageStatus !== "completed" || !scenes[i].imageUrl) { tick(); continue; }
      try {
        scenes[i] = { ...scenes[i], videoStatus: "generating" };
        setScript(p => p ? { ...p, scenes: [...scenes] } : p);
        const { data, error } = await supabase.functions.invoke("generate-video", {
          body: { prompt: `${scenes[i].imagePrompt}, ${scenes[i].cameraMovement.replace(/_/g, " ")}`, image_url: scenes[i].imageUrl, type: "image_to_video", duration: Math.min(scenes[i].duration, 10), model: "kling-2.1", aspect_ratio: input.videoAspectRatio },
        });
        if (error) throw error;
        scenes[i] = { ...scenes[i], videoUrl: data.videoUrl || data.video_url, videoStatus: "completed" };
      } catch (err: any) { scenes[i] = { ...scenes[i], videoStatus: "error", error: err.message }; }
      tick(); setScript(p => p ? { ...p, scenes: [...scenes] } : p);
    }

    if (checkCancelled()) {
      setScript(p => p ? { ...p, scenes: [...scenes] } : p);
      setStep("script");
      setIsGenerating(false);
      toast.info("Produzione annullata. Puoi riprendere dallo script.");
      return;
    }

    await musicP;
    const vids = scenes.filter(s => s.videoStatus === "completed" && s.videoUrl);
    
    if (vids.length === 1) {
      // Single video: use it directly as the final video
      setFinalVideoUrl(vids[0].videoUrl!);
      toast.success("Video finale pronto! 🎬");
    } else if (vids.length >= 2) {
      try {
        toast.info("Concatenazione e mix audio...");
        const transitions = vids.map((s) => ({
          type: s.transition || "crossfade",
          duration: s.transitionDuration || 0.5,
        }));
        const narrationUrls = scenes
          .filter(s => s.videoStatus === "completed" && s.audioUrl)
          .map(s => s.audioUrl);
        const sfxUrls = scenes
          .filter(s => s.videoStatus === "completed" && s.sfxUrl)
          .map(s => s.sfxUrl);

        const { data, error } = await supabase.functions.invoke("video-concat", {
          body: {
            videoUrls: vids.map(s => s.videoUrl),
            transition: transitions[0]?.type || "crossfade",
            transitionDuration: transitions[0]?.duration || 0.5,
            transitions,
            audioUrls: narrationUrls,
            sfxUrls,
            backgroundMusicUrl: backgroundMusicUrl,
            narrationVolume: (script.narrationVolume ?? 100) / 100,
            musicVolume: (script.musicVolume ?? 25) / 100,
            sfxVolume: 0.4,
          },
        });
        if (error) throw error;
        const finalUrl = data?.videoUrl || data?.url;
        if (finalUrl) {
          setFinalVideoUrl(finalUrl);
          toast.success("Video finale con audio mixato generato! 🎬");
        } else {
          console.error("video-concat returned no URL:", data);
          toast.error("Concatenazione completata ma nessun URL video ricevuto. Scarica le scene singolarmente.");
        }
      } catch (err) {
        console.error("Concat error:", err);
        toast.error("Errore concatenazione. Puoi scaricare le singole scene.");
      }
    } else {
      toast.warning("Nessun video completato con successo.");
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
          {!isStoryModeUnlimited && (
            <Badge variant="outline" className="text-xs">
              📊 {remainingStoryMode} rimasti
            </Badge>
          )}
          {isStoryModeUnlimited && (
            <Badge variant="outline" className="text-xs">∞</Badge>
          )}
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
                <TooltipProvider delayDuration={200}>
                  <div className="grid grid-cols-3 gap-2">
                    {VIDEO_STYLES.map(style => (
                      <Tooltip key={style.id}>
                        <TooltipTrigger asChild>
                          <button onClick={() => handleStyleSelect(style.id)} className={cn("relative overflow-hidden rounded-lg transition-all border-2 group", input.styleId === style.id ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:border-muted-foreground/30")}>
                            <img src={style.preview} alt={style.name} className="w-full aspect-[4/3] object-cover" />
                            <div className={cn("absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/70 to-transparent p-1.5", input.styleId === style.id && "from-primary/70")}>
                              <span className="text-[10px] font-semibold text-white drop-shadow-sm">{style.name}</span>
                            </div>
                            {input.styleId === style.id && (
                              <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                                <Check className="w-2.5 h-2.5 text-primary-foreground" />
                              </div>
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[200px]">
                          <p className="font-medium text-xs">{style.name}</p>
                          <p className="text-[10px] text-muted-foreground">{style.description}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </TooltipProvider>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-4">
            <Card className="border-secondary/20 bg-card/50">
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Film className="w-5 h-5 text-secondary" />Descrizione della Storia</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Textarea placeholder="Descrivi la storia che vuoi raccontare, oppure carica un PDF/TXT..." value={input.description} onChange={e => setInput(p => ({ ...p, description: e.target.value }))} className="min-h-[120px] pr-24" />
                  <label className="absolute top-2 right-2 cursor-pointer">
                    <Button variant="outline" size="sm" className="pointer-events-none" disabled={isUploadingDoc}>
                      {isUploadingDoc ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <FileText className="w-3 h-3 mr-1" />}
                      PDF/TXT
                    </Button>
                    <input type="file" accept=".pdf,.txt,.md,text/plain,application/pdf" className="hidden" onChange={handleDocUpload} disabled={isUploadingDoc} />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Lingua</Label>
                    <Select value={input.language} onValueChange={v => setInput(p => ({ ...p, language: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{LANGUAGES.map(l => <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>)}</SelectContent></Select>
                  </div>
                  <div>
                    <Label className="text-xs flex items-center gap-1"><Mic className="w-3 h-3" />Voce Narrante</Label>
                    <div className="flex gap-1.5">
                      <Select value={input.voiceId} onValueChange={v => setInput(p => ({ ...p, voiceId: v }))}>
                        <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {voiceOptions.filter(v => !v.isCloned).length > 0 && (
                            <>
                              <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Voci Standard</div>
                              {voiceOptions.filter(v => !v.isCloned).map(v => (
                                <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                              ))}
                            </>
                          )}
                          {voiceOptions.filter(v => v.isCloned).length > 0 && (
                            <>
                              <div className="px-2 py-1 mt-1 text-[10px] font-semibold text-accent uppercase tracking-wider border-t border-border pt-2">🎤 Voci Clonate</div>
                              {voiceOptions.filter(v => v.isCloned).map(v => (
                                <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                              ))}
                            </>
                          )}
                        </SelectContent>
                      </Select>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              className="shrink-0 h-10 w-10"
                              onClick={() => previewVoice(input.voiceId)}
                              disabled={isPreviewingVoice}
                            >
                              {isPreviewingVoice ? <Loader2 className="w-4 h-4 animate-spin" /> : voicePreviewAudio ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Anteprima voce</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Numero Scene: {input.numScenes} (~{input.numScenes * 8}s totali)</Label>
                  <Slider value={[input.numScenes]} onValueChange={([v]) => setInput(p => ({ ...p, numScenes: v }))} min={4} max={12} step={1} className="mt-2" />
                </div>
                <div>
                  <Label className="text-xs flex items-center gap-1"><Film className="w-3 h-3" />Formato Video</Label>
                  <div className="flex gap-2 mt-1.5">
                    {([
                      { value: "16:9" as const, label: "16:9", desc: "Landscape" },
                      { value: "4:3" as const, label: "4:3", desc: "Standard" },
                      { value: "9:16" as const, label: "9:16", desc: "Verticale" },
                    ]).map(fmt => (
                      <button
                        key={fmt.value}
                        onClick={() => setInput(p => ({ ...p, videoAspectRatio: fmt.value }))}
                        className={cn(
                          "flex-1 flex flex-col items-center gap-0.5 py-2 px-3 rounded-lg border-2 transition-all text-xs font-medium",
                          input.videoAspectRatio === fmt.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-muted-foreground/40 text-muted-foreground"
                        )}
                      >
                        <span className="font-bold">{fmt.label}</span>
                        <span className="text-[10px] opacity-70">{fmt.desc}</span>
                      </button>
                    ))}
                  </div>
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

          {/* Volume Controls */}
          <Card className="border-secondary/20 bg-card/50">
            <CardContent className="py-3 px-4 space-y-3">
              <p className="text-sm font-medium flex items-center gap-2"><Volume2 className="w-4 h-4 text-primary" />Controllo Volumi</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs flex items-center justify-between">
                    <span>🎙️ Narrazione</span>
                    <span className="font-mono text-muted-foreground">{script.narrationVolume ?? 100}%</span>
                  </Label>
                  <Slider
                    value={[script.narrationVolume ?? 100]}
                    onValueChange={([v]) => setScript({ ...script, narrationVolume: v })}
                    min={0} max={100} step={5}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs flex items-center justify-between">
                    <span>🎵 Musica di Sottofondo</span>
                    <span className="font-mono text-muted-foreground">{script.musicVolume ?? 25}%</span>
                  </Label>
                  <Slider
                    value={[script.musicVolume ?? 25]}
                    onValueChange={([v]) => setScript({ ...script, musicVolume: v })}
                    min={0} max={100} step={5}
                  />
                </div>
              </div>
            </CardContent>
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
                voices={voiceOptions}
                defaultVoiceId={input.voiceId}
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

          {/* Production time estimate */}
          <Card className="border-accent/20 bg-accent/5">
            <CardContent className="py-3 px-4 flex items-center gap-3 flex-wrap">
              <Timer className="w-5 h-5 text-accent shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Tempo stimato di produzione</p>
                <p className="text-xs text-muted-foreground">
                  {script.scenes.length} scene × (immagine ~15s + audio ~8s + video ~45s + SFX ~5s) + musica + montaggio
                </p>
              </div>
              <Badge variant="secondary" className="text-base font-bold px-3 py-1">
                <Clock className="w-4 h-4 mr-1" />
                ~{formatTime(estimatedProductionTime)}
              </Badge>
            </CardContent>
          </Card>

          <div className="flex gap-3 flex-wrap">
            <Button variant="outline" onClick={() => setStep("input")}><ChevronLeft className="w-4 h-4 mr-2" />Modifica Input</Button>
            <Button variant="outline" onClick={handleGenerateScript} disabled={isGeneratingScript}><RefreshCw className="w-4 h-4 mr-2" />Rigenera</Button>
            <Button variant="outline" onClick={saveProject} disabled={isSaving}><Save className="w-4 h-4 mr-2" />Salva Bozza</Button>
            <Button variant="outline" onClick={exportScriptPDF}><FileText className="w-4 h-4 mr-2" />Esporta PDF</Button>
            <Button onClick={handleGenerateAll} className="flex-1" size="lg"><Play className="w-5 h-5 mr-2" />Avvia Produzione (~{formatTime(estimatedProductionTime)})</Button>
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
                  <span className="text-sm font-medium flex items-center gap-2">
                    Progresso Produzione
                    {isPaused && <Badge variant="outline" className="text-[10px] animate-pulse">⏸ In pausa</Badge>}
                    {!isStoryModeUnlimited && (
                      <Badge variant="secondary" className="text-[10px]">
                        📊 {usedStoryMode}/{quota.max_story_mode_monthly} progetti usati
                      </Badge>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-7 px-3" onClick={togglePause}>
                      {isPaused ? <><Play className="w-3 h-3 mr-1" />Riprendi</> : <><Pause className="w-3 h-3 mr-1" />Pausa</>}
                    </Button>
                    <Button variant="destructive" size="sm" className="h-7 px-3" onClick={requestCancel}>
                      <Square className="w-3 h-3 mr-1" />Annulla
                    </Button>
                    <span className="text-sm text-muted-foreground">{generationProgress}%</span>
                  </div>
                </div>
                <Progress value={generationProgress} className="h-3" />
                {/* Real-time elapsed vs estimated timer */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Timer className={cn("w-4 h-4", elapsedSeconds > estimatedProductionTime ? "text-destructive" : "text-primary")} />
                    <span className="font-mono font-medium">
                      {formatTime(elapsedSeconds)}
                    </span>
                    <span className="text-muted-foreground">trascorso</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">stimato</span>
                    <span className="font-mono font-medium">~{formatTime(estimatedProductionTime)}</span>
                    <Clock className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
                {elapsedSeconds > 0 && (
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-1000",
                        elapsedSeconds > estimatedProductionTime ? "bg-destructive" : "bg-primary/60"
                      )}
                      style={{ width: `${Math.min((elapsedSeconds / estimatedProductionTime) * 100, 100)}%` }}
                    />
                  </div>
                )}
                {backgroundMusicUrl && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Music className="w-3 h-3 text-primary" />Colonna sonora generata</div>}
              </div>
            </CardContent>
          </Card>

          {/* Live preview of completed scenes */}
          {(() => {
            const completedVideos = script.scenes.filter(s => s.videoStatus === "completed" && s.videoUrl);
            if (completedVideos.length > 0) {
              return (
                <Card className="border-accent/20 bg-card/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Eye className="w-4 h-4 text-accent" />
                      Anteprima Live — {completedVideos.length}/{script.scenes.length} scene completate
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <video
                      key={completedVideos[completedVideos.length - 1].videoUrl}
                      src={completedVideos[completedVideos.length - 1].videoUrl}
                      controls
                      autoPlay
                      muted
                      className="w-full rounded-lg max-h-[300px]"
                    />
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      Ultima scena completata: Scena {completedVideos[completedVideos.length - 1].sceneNumber}
                    </p>
                  </CardContent>
                </Card>
              );
            }
            return null;
          })()}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {script.scenes.map((scene, idx) => (
              <SceneCard key={idx} scene={scene} index={idx} mode="generation" voices={voiceOptions} defaultVoiceId={input.voiceId} isEditing={false} isPreviewLoading={false} onToggleEdit={() => {}} onUpdate={() => {}} onPreviewAudio={() => {}} onDuplicate={() => {}} onDelete={() => {}} />
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
                voices={voiceOptions}
                defaultVoiceId={input.voiceId}
                isEditing={false}
                isPreviewLoading={false}
                onToggleEdit={() => {}}
                onUpdate={(field, value) => updateScene(idx, field, value)}
                onPreviewAudio={() => {}}
                onDuplicate={() => {}}
                onDelete={() => {}}
                onRegenerate={(type) => regenerateSceneAsset(idx, type)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Cancel confirmation dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annullare la produzione?</AlertDialogTitle>
            <AlertDialogDescription>
              La generazione verrà interrotta. Gli asset già completati verranno conservati e potrai riprendere dallo script.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={dismissCancel}>Continua produzione</AlertDialogCancel>
            <AlertDialogAction onClick={cancelGeneration} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sì, annulla
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
