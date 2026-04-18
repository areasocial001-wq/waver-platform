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
  AlertTriangle, ShieldCheck,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { jsPDF } from "jspdf";
import { cn } from "@/lib/utils";
import { StoryScene, StoryScript, StoryStep, StoryModeInput } from "./types";
import { SceneCard } from "./SceneCard";
import { LivePreviewCard } from "./LivePreviewCard";
import { SceneDiagnosticsCard } from "./SceneDiagnosticsCard";
import { apiLogger } from "@/lib/apiLogger";
import { useVoiceOptions } from "@/hooks/useVoiceOptions";
import { useQuotas } from "@/hooks/useQuotas";
import { RenderPreviewDialog, type RenderVolumes } from "./RenderPreviewDialog";
import { measureAndValidateAspect, measureAndValidateVideoAspect } from "@/lib/aspectRatioCheck";

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
import realisticImg from "@/assets/styles/realistic.jpg";

const VIDEO_STYLES = [
  { id: "realistic", name: "Realistico", preview: realisticImg, description: "Fotorealistico, come una foto o un film dal vero", promptModifier: "photorealistic style, real photography, natural lighting, lifelike textures, shallow depth of field, 35mm film look, no illustration, no cartoon, no anime" },
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

// Cross-origin safe download via fetch + blob (returns a function that manages loading state)
const useDownloadFile = (setLoadingId: (id: string | null) => void) => {
  return async (url: string, filename: string, id?: string) => {
    setLoadingId(id || filename);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(blobUrl); a.remove(); }, 1000);
    } catch {
      window.open(url, "_blank");
    } finally {
      setLoadingId(null);
    }
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
    videoAspectRatio: "16:9", videoQuality: "hd", videoFps: "24", characterFidelity: "medium",
  });
  const [script, setScript] = useState<StoryScript | null>(null);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [regenProgress, setRegenProgress] = useState<{ current: number; total: number } | null>(null);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [videoSegments, setVideoSegments] = useState<string[]>([]);
  const [renderStatus, setRenderStatus] = useState<"idle" | "processing" | "completed" | "failed">("idle");
  const [pendingRenderId, setPendingRenderId] = useState<string | null>(null);
  const [renderStartTime, setRenderStartTime] = useState<number | null>(null);
  const [renderElapsed, setRenderElapsed] = useState(0);
  const [backgroundMusicUrl, setBackgroundMusicUrl] = useState<string | null>(null);
  const [editingSceneIndex, setEditingSceneIndex] = useState<number | null>(null);
  const [previewLoadingIndex, setPreviewLoadingIndex] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [regeneratingScene, setRegeneratingScene] = useState<{ idx: number; type: string } | null>(null);
  const [generationStartTime, setGenerationStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [isUploadingRef, setIsUploadingRef] = useState(false);
  const [refImageError, setRefImageError] = useState(false);
  const [voicePreviewAudio, setVoicePreviewAudio] = useState<HTMLAudioElement | null>(null);
  const [isPreviewingVoice, setIsPreviewingVoice] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [videoPollingInfo, setVideoPollingInfo] = useState<{ sceneIndex: number; startedAt: number; pollCount: number } | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [showRenderPreview, setShowRenderPreview] = useState(false);
  const [pendingRenderAction, setPendingRenderAction] = useState<"reassemble" | "generateAll" | null>(null);
  const downloadFile = useDownloadFile(setDownloadingId);
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

  // Poll for pending Shotstack render — extended to 10 min, with adaptive backoff
  useEffect(() => {
    if (!pendingRenderId || renderStatus !== "processing") return;
    let cancelled = false;
    const POLL_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
    const startedAt = renderStartTime || Date.now();
    const poll = async () => {
      let consecutiveErrors = 0;
      while (!cancelled) {
        // Adaptive interval: 8s for first 2 min, then 15s
        const elapsed = Date.now() - startedAt;
        if (elapsed > POLL_TIMEOUT_MS) {
          setRenderStatus("failed");
          setPendingRenderId(null);
          toast.error("Rendering scaduto dopo 10 minuti. Riprova con 'Rimonta Video Finale'.");
          break;
        }
        const interval = elapsed > 120_000 ? 15000 : 8000;
        await new Promise(r => setTimeout(r, interval));
        if (cancelled) break;
        try {
          const { data, error } = await supabase.functions.invoke("video-concat", {
            body: { pollRenderId: pendingRenderId },
          });
          if (error) {
            consecutiveErrors++;
            console.error(`Poll error (${consecutiveErrors}):`, error);
            if (consecutiveErrors >= 5) {
              setRenderStatus("failed");
              setPendingRenderId(null);
              toast.error("Errori ripetuti durante il polling. Riprova manualmente.");
              break;
            }
            continue;
          }
          consecutiveErrors = 0;
          if (data?.status === "completed" && data?.videoUrl) {
            setFinalVideoUrl(data.videoUrl);
            setRenderStatus("completed");
            setPendingRenderId(null);
            toast.success("Video finale pronto! 🎬");
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("Video pronto! 🎬", { body: "Il tuo video finale è stato renderizzato con successo.", icon: "/favicon.ico" });
            }
            setTimeout(() => saveProject(), 500);
            break;
          } else if (data?.status === "failed") {
            setRenderStatus("failed");
            setPendingRenderId(null);
            toast.error("Rendering fallito: " + (data.error || "errore sconosciuto"));
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("Rendering fallito ❌", { body: "Si è verificato un errore durante il rendering del video.", icon: "/favicon.ico" });
            }
            break;
          }
          // still processing, continue polling
        } catch (err) {
          consecutiveErrors++;
          console.error("Poll exception:", err);
        }
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [pendingRenderId, renderStatus, renderStartTime]);

  // Render elapsed timer
  useEffect(() => {
    if (renderStatus !== "processing" || !renderStartTime) return;
    const iv = setInterval(() => {
      setRenderElapsed(Math.floor((Date.now() - renderStartTime) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, [renderStatus, renderStartTime]);

  // Estimate total render time: ~15s per scene + 10s base, double for HD
  const sceneCount = script?.scenes?.length ?? 1;
  const isHD = input.videoQuality === "hd" || input.videoQuality === "fhd";
  const estimatedRenderSeconds = (sceneCount * 15 + 10) * (isHD ? 2 : 1);
  const renderProgressPct = renderStatus === "processing"
    ? Math.min(95, (renderElapsed / estimatedRenderSeconds) * 100)
    : renderStatus === "completed" ? 100 : 0;
  const renderRemainingSeconds = Math.max(0, estimatedRenderSeconds - renderElapsed);

  const [projectId, setProjectId] = useState<string | null>(null);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showProjectList, setShowProjectList] = useState(false);

  // Persist pendingRenderId to DB so polling can resume after page reload
  useEffect(() => {
    if (!projectId) return;
    supabase.from("story_mode_projects").update({
      pending_render_id: pendingRenderId,
      render_started_at: pendingRenderId && renderStartTime ? new Date(renderStartTime).toISOString() : null,
    } as any).eq("id", projectId).then(() => {});
  }, [pendingRenderId, renderStartTime, projectId]);

  useEffect(() => { loadProjectList(); }, []);

  const loadProjectList = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("story_mode_projects")
      .select("id, title, status, created_at, updated_at")
      .eq("user_id", user.id).order("updated_at", { ascending: false }).limit(20);
    if (data) setSavedProjects(data);
  };

  const persistProject = async (overrides?: {
    script?: StoryScript | null;
    step?: StoryStep;
    finalVideoUrl?: string | null;
    backgroundMusicUrl?: string | null;
  }) => {
    const { data: { user } } = await supabase.auth.getUser();
    const scriptToSave = overrides?.script ?? script;
    const stepToSave = overrides?.step ?? step;
    const finalVideoUrlToSave = overrides?.finalVideoUrl ?? finalVideoUrl;
    const backgroundMusicUrlToSave = overrides?.backgroundMusicUrl ?? backgroundMusicUrl;
    if (!user || !scriptToSave) return;
    setIsSaving(true);
    try {
      const storageUrl = (window as any).__storyRefStorageUrl || "";
      const persistedImageUrl = storageUrl || (input.imageUrl && input.imageUrl.startsWith("http") ? input.imageUrl : "");
      const normalizedScenes = scriptToSave.scenes.map((scene) => {
        if (scene.videoUrl && scene.videoStatus !== "completed") {
          return {
            ...scene,
            videoStatus: "completed" as const,
            videoGeneratingStartedAt: undefined,
            error: scene.error === "Generazione video troppo lenta, riprova" ? scene.error : undefined,
          };
        }
        return scene;
      });
      const derivedStatus = finalVideoUrlToSave
        ? "completed"
        : stepToSave === "generation"
          ? "generating"
          : stepToSave === "complete"
            ? "completed"
            : "draft";
      const projectData = {
        user_id: user.id, title: scriptToSave.title, synopsis: scriptToSave.synopsis,
        suggested_music: scriptToSave.suggestedMusic, scenes: normalizedScenes as any,
        input_config: {
          ...input,
          imageFile: null,
          imageUrl: persistedImageUrl,
        } as any,
        status: derivedStatus,
        final_video_url: finalVideoUrlToSave, background_music_url: backgroundMusicUrlToSave,
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

  const saveProject = async () => {
    await persistProject();
  };

  const [isReconciling, setIsReconciling] = useState(false);

  const reconcileProject = async () => {
    if (!script) {
      toast.error("Nessun progetto da riconciliare");
      return;
    }
    setIsReconciling(true);
    try {
      const scenes = [...script.scenes];
      let fixedScenes = 0;
      let clearedErrors = 0;

      const STUCK_MS = 15 * 60 * 1000;
      const next = scenes.map((s) => {
        const updated = { ...s };
        // 1) videoUrl present but status not "completed" → fix
        if (updated.videoUrl && updated.videoStatus !== "completed") {
          updated.videoStatus = "completed";
          updated.videoGeneratingStartedAt = undefined;
          fixedScenes++;
        }
        // 2) "generating" without start timestamp or stuck → reset to idle
        if (
          updated.videoStatus === "generating" &&
          (!updated.videoGeneratingStartedAt ||
            Date.now() - updated.videoGeneratingStartedAt > STUCK_MS) &&
          !updated.videoUrl
        ) {
          updated.videoStatus = "idle";
          updated.videoGeneratingStartedAt = undefined;
          fixedScenes++;
        }
        // 3) clear stale RLS / generic errors when the asset is actually present
        if (
          updated.error &&
          updated.videoUrl &&
          updated.videoStatus === "completed"
        ) {
          updated.error = undefined;
          clearedErrors++;
        }
        // 4) align audio/sfx status with presence of url
        if (updated.audioUrl && updated.audioStatus !== "completed") {
          updated.audioStatus = "completed";
        }
        if (updated.sfxUrl && updated.sfxStatus !== "completed") {
          updated.sfxStatus = "completed";
        }
        return updated;
      });

      const newScript = { ...script, scenes: next };
      setScript(newScript);

      // Final video already present? → push step to "complete"
      const hasFinal = !!finalVideoUrl;
      const allDone = next.every((s) => !!s.videoUrl && s.videoStatus === "completed");
      let nextStep: StoryStep = step;
      if (hasFinal) {
        nextStep = "complete";
        setStep("complete");
      } else if (allDone && step === "generation") {
        nextStep = "complete";
        setStep("complete");
      }

      await persistProject({ script: newScript, step: nextStep });

      const parts: string[] = [];
      if (fixedScenes) parts.push(`${fixedScenes} scene riallineate`);
      if (clearedErrors) parts.push(`${clearedErrors} errori obsoleti rimossi`);
      if (hasFinal) parts.push("status → completed");
      toast.success(parts.length ? `Riconciliato: ${parts.join(", ")}` : "Tutto già coerente ✅");
    } catch (err: any) {
      toast.error(`Errore riconciliazione: ${err?.message || "sconosciuto"}`);
    } finally {
      setIsReconciling(false);
    }
  };

  const loadProject = async (id: string) => {
    // Select only needed columns - avoid fetching the entire row (scenes JSONB can be huge)
    const { data, error } = await supabase
      .from("story_mode_projects")
      .select("id, title, synopsis, suggested_music, scenes, input_config, status, final_video_url, background_music_url, pending_render_id, render_started_at")
      .eq("id", id)
      .single();
    if (error || !data) { toast.error("Errore nel caricamento"); return; }
    setProjectId(data.id);
    const config = data.input_config as any;
    const imageUrl = config.imageUrl || "";
    const isStale = imageUrl && (imageUrl.startsWith("blob:") || imageUrl.startsWith("data:"));
    setRefImageError(isStale);
    setInput({
      imageUrl: isStale ? "" : imageUrl, imageFile: null, styleId: config.styleId || "cinema",
      styleName: config.styleName || "Cinema", stylePromptModifier: config.stylePromptModifier || "",
      description: config.description || "", language: config.language || "it",
      voiceId: config.voiceId || "EXAVITQu4vr4xnSDxMaL", numScenes: config.numScenes || 8,
      videoAspectRatio: config.videoAspectRatio || "16:9", videoQuality: config.videoQuality || "hd", videoFps: config.videoFps || "24", characterFidelity: config.characterFidelity || "medium",
    });
    if (isStale) {
      toast.warning("L'immagine di riferimento salvata non è più valida. Ricaricala prima di generare.");
    }
    if (imageUrl && imageUrl.startsWith("http")) {
      (window as any).__storyRefStorageUrl = imageUrl;
    }
    const loadedScenesRaw = (data.scenes as any) || [];

    // Auto-cleanup: reset scenes stuck in "generating" for > 20 minutes
    const STUCK_AUTO_RESET_MS = 20 * 60 * 1000;
    let autoResetCount = 0;
    const loadedScenes = loadedScenesRaw.map((s: any) => {
      if (
        s?.videoStatus === "generating" &&
        s?.videoGeneratingStartedAt &&
        Date.now() - s.videoGeneratingStartedAt > STUCK_AUTO_RESET_MS
      ) {
        autoResetCount++;
        return { ...s, videoStatus: "idle", videoGeneratingStartedAt: undefined, error: undefined };
      }
      return s;
    });

    setScript({ title: data.title, synopsis: data.synopsis || "", scenes: loadedScenes, suggestedMusic: data.suggested_music || "" });
    setFinalVideoUrl(data.final_video_url);
    setBackgroundMusicUrl(data.background_music_url);
    if (data.status === "completed") setStep("complete");
    else if (data.status === "generating") setStep("generation");
    else setStep("script");
    setShowProjectList(false);
    toast.success(`Progetto "${data.title}" caricato`);

    // Resume polling if a render was in progress and is still within 10 min window
    const pendingRid = (data as any).pending_render_id;
    const renderStartedAt = (data as any).render_started_at;
    if (pendingRid && renderStartedAt && !data.final_video_url) {
      const startedMs = new Date(renderStartedAt).getTime();
      const elapsed = Date.now() - startedMs;
      if (elapsed < 10 * 60 * 1000) {
        setPendingRenderId(pendingRid);
        setRenderStartTime(startedMs);
        setRenderElapsed(Math.floor(elapsed / 1000));
        setRenderStatus("processing");
        setStep("complete");
        toast.info(`Ripristino polling rendering (${Math.floor(elapsed / 1000)}s trascorsi)…`);
      } else {
        // Timeout exceeded — clear stale render id
        supabase.from("story_mode_projects").update({ pending_render_id: null, render_started_at: null } as any).eq("id", data.id).then(() => {});
        toast.warning("Il rendering precedente è scaduto. Usa 'Solo concat finale' per riprovare.");
      }
    }

    if (autoResetCount > 0) {
      toast.info(`${autoResetCount} ${autoResetCount === 1 ? "scena bloccata da oltre 20 minuti è stata sbloccata" : "scene bloccate da oltre 20 minuti sono state sbloccate"} automaticamente. Puoi rigenerarle.`);
      // Persist the reset so reloading doesn't show them stuck again
      supabase.from("story_mode_projects").update({ scenes: loadedScenes as any }).eq("id", data.id).then(() => {});
    }

    // Background migration: move heavy inline assets (data:/blob:) into storage
    // so the JSONB row stays small and assets persist across sessions.
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { migrateSceneAssets } = await import("@/lib/sceneAssetMigration");
        const { scenes: migrated, migratedCount } = await migrateSceneAssets(loadedScenes, data.id, user.id);

        // Detect scenes whose audioUrl was a dead blob: (now empty after migration)
        // and the original had a blob url → re-generate narration via TTS so the audio track survives.
        const scenesNeedingAudio: number[] = [];
        migrated.forEach((s, i) => {
          const original = loadedScenes[i];
          const hadBlobAudio = typeof original?.audioUrl === "string" && original.audioUrl.startsWith("blob:");
          if (hadBlobAudio && !s.audioUrl && s.narration) {
            scenesNeedingAudio.push(i);
          }
        });

        let reuploadedAudio = 0;
        if (scenesNeedingAudio.length > 0) {
          toast.info(`Rigenerazione audio scaduto per ${scenesNeedingAudio.length} ${scenesNeedingAudio.length === 1 ? "scena" : "scene"}…`);
          const authHeaders = await getAuthHeaders();
          for (const i of scenesNeedingAudio) {
            try {
              const sc = migrated[i];
              const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`, {
                method: "POST", headers: authHeaders,
                body: JSON.stringify({ text: sc.narration, voiceId: sc.voiceId || config.voiceId || "EXAVITQu4vr4xnSDxMaL", language_code: config.language || "it" }),
              });
              if (!r.ok) continue;
              const blob = await r.blob();
              const storageUrl = await uploadBlobToStorage(blob, "story-narration", "mp3", `Narrazione Scena ${sc.sceneNumber}`);
              migrated[i] = { ...migrated[i], audioUrl: storageUrl, audioStatus: "completed" };
              reuploadedAudio++;
            } catch (e) {
              console.warn(`Audio re-upload failed for scene ${i + 1}:`, e);
            }
          }
        }

        if (migratedCount > 0 || reuploadedAudio > 0) {
          await supabase.from("story_mode_projects")
            .update({ scenes: migrated as any })
            .eq("id", data.id);
          setScript(prev => prev ? { ...prev, scenes: migrated } : prev);
          if (migratedCount > 0) toast.success(`${migratedCount} asset spostati nello storage per liberare spazio`);
          if (reuploadedAudio > 0) toast.success(`${reuploadedAudio} ${reuploadedAudio === 1 ? "audio rigenerato" : "audio rigenerati"} dopo URL blob scaduto`);
        }
      } catch (err) {
        console.warn("Background asset migration failed:", err);
      }
    })();
  };

  const deleteProject = async (id: string) => {
    const { error } = await supabase.from("story_mode_projects").delete().eq("id", id);
    if (error) { toast.error("Errore nell'eliminazione"); return; }
    if (projectId === id) setProjectId(null);
    toast.success("Progetto eliminato");
    loadProjectList();
  };

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingRef(true);
    setRefImageError(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Devi essere autenticato per caricare immagini"); return; }
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("story-references").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("story-references").getPublicUrl(path);
      const publicUrl = urlData.publicUrl;
      // Also read as base64 for the edge function (which needs inline image data)
      const reader = new FileReader();
      reader.onload = () => {
        setInput(prev => ({ ...prev, imageUrl: reader.result as string, imageFile: file }));
        // Store the storage URL so we can persist it
        (window as any).__storyRefStorageUrl = publicUrl;
      };
      reader.readAsDataURL(file);
      toast.success("Immagine di riferimento caricata!");
    } catch (err: any) {
      console.error("Upload reference error:", err);
      toast.error("Errore nel caricamento dell'immagine");
      // Fallback: use base64 directly
      const reader = new FileReader();
      reader.onload = () => {
        setInput(prev => ({ ...prev, imageUrl: reader.result as string, imageFile: file }));
      };
      reader.readAsDataURL(file);
    } finally {
      setIsUploadingRef(false);
    }
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

  // Reset a scene that has been stuck in videoStatus="generating" so the user can retry
  const unstuckScene = (index: number) => {
    if (!script) return;
    const scenes = [...script.scenes];
    scenes[index] = {
      ...scenes[index],
      videoStatus: "idle",
      videoGeneratingStartedAt: undefined,
      error: undefined,
    };
    setScript({ ...script, scenes });
  };

  // Regenerate single scene asset
  const regenerateSceneAsset = async (index: number, type: "image" | "audio" | "video" | "sfx") => {
    if (!script) return;
    const scene = script.scenes[index];
    setRegeneratingScene({ idx: index, type });

    try {
      if (type === "image") {
        if (!input.imageUrl && refImageError) {
          toast.error("Ricarica l'immagine di riferimento prima di generare.");
          return;
        }
        updateScene(index, "imageStatus", "generating");
        const referenceImageUrl = input.imageUrl || undefined;
        // Force explicit width/height matching the requested aspect ratio so Flux generates true vertical/horizontal frames
        // instead of letterboxed outputs that Kling/Veo would later have to "fit" into the target canvas.
        const fluxDims = input.videoAspectRatio === "9:16"
          ? { width: 720, height: 1280 }
          : input.videoAspectRatio === "4:3"
          ? { width: 1024, height: 768 }
          : { width: 1280, height: 720 };
        const { data, error } = await supabase.functions.invoke("generate-image", {
          body: { prompt: scene.imagePrompt, model: "flux", style: input.stylePromptModifier, aspectRatio: input.videoAspectRatio, ...fluxDims, ...(referenceImageUrl ? { referenceImageUrl, characterFidelity: input.characterFidelity } : {}) },
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
        const newImageUrl = data.imageUrl || data.url;
        const aspectCheck = await measureAndValidateAspect(newImageUrl, input.videoAspectRatio);
        const scenes = [...script.scenes];
        scenes[index] = {
          ...scenes[index],
          imageUrl: newImageUrl,
          imageStatus: "completed",
          imageWidth: aspectCheck?.width,
          imageHeight: aspectCheck?.height,
          imageAspectWarning: aspectCheck?.mismatch ? aspectCheck.warning : undefined,
        };
        setScript({ ...script, scenes });
        if (aspectCheck?.mismatch) {
          toast.warning(`Scena ${index + 1}: ${aspectCheck.warning}`, { duration: 6000 });
        } else {
          toast.success(`Immagine scena ${index + 1} rigenerata`);
        }
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
        const storageUrl = await uploadBlobToStorage(blob, "story-narration", "mp3", `Narrazione Scena ${index + 1}`);
        const scenes = [...script.scenes];
        scenes[index] = { ...scenes[index], audioUrl: storageUrl, audioStatus: "completed" };
        setScript({ ...script, scenes });
        toast.success(`Audio scena ${index + 1} rigenerato`);
      } else if (type === "video") {
        if (!scene.imageUrl) { toast.error("Genera prima l'immagine"); return; }
        const startedAt = Date.now();
        const scenes0 = [...script.scenes];
        scenes0[index] = { ...scenes0[index], videoStatus: "generating", videoGeneratingStartedAt: startedAt };
        setScript({ ...script, scenes: scenes0 });
        const orientationHint = input.videoAspectRatio === "9:16"
          ? ", vertical 9:16 portrait composition, full vertical frame"
          : input.videoAspectRatio === "16:9"
          ? ", horizontal 16:9 cinematic frame"
          : "";
        const { data, error } = await supabase.functions.invoke("generate-video", {
          body: {
            prompt: `${scene.imagePrompt}, ${scene.cameraMovement.replace(/_/g, " ")}${orientationHint}`,
            image_url: scene.imageUrl, type: "image_to_video",
            duration: Math.min(scene.duration, 10), model: "kling-2.1",
            aspect_ratio: input.videoAspectRatio,
          },
        });
        if (error) throw error;

        // Handle async video generation (polling for operationId) — same as handleGenerateAll
        let videoUrl: string | undefined = data?.videoUrl || data?.video_url || data?.output;
        if (!videoUrl && data?.operationId && (data.status === "starting" || data.status === "processing")) {
          console.log(`[Regen] Scene ${index + 1}: polling operationId ${data.operationId}`);
          const pollingStart = Date.now();
          setVideoPollingInfo({ sceneIndex: index, startedAt: pollingStart, pollCount: 0 });
          const MAX_POLL_WALL_MS = 12 * 60 * 1000;
          const maxPolls = 144; // 144 * 5s = 12 minutes
          let consecutiveNetErrors = 0;
          const maxNetErrors = 10;
          try {
            for (let poll = 0; poll < maxPolls; poll++) {
              if (Date.now() - pollingStart > MAX_POLL_WALL_MS) {
                apiLogger.error("Kling", "video_timeout", "Timeout 12min su rigenerazione scena", {
                  operationId: data.operationId,
                  sceneNumber: index + 1,
                  totalDurationMs: Date.now() - pollingStart,
                  pollCount: poll,
                  context: "regenerateSceneAsset",
                }).catch(() => {});
                throw new Error("Generazione video troppo lenta, riprova");
              }
              await new Promise(r => setTimeout(r, 5000));
              setVideoPollingInfo({ sceneIndex: index, startedAt: pollingStart, pollCount: poll + 1 });
              try {
                const { data: pollData, error: pollError } = await supabase.functions.invoke("generate-video", {
                  body: { operationId: data.operationId },
                });
                if (pollError) {
                  consecutiveNetErrors++;
                  if (consecutiveNetErrors >= maxNetErrors) {
                    throw new Error(`Polling fallito dopo ${maxNetErrors} errori di rete`);
                  }
                  await new Promise(r => setTimeout(r, 2000 * consecutiveNetErrors));
                  continue;
                }
                consecutiveNetErrors = 0;
                if (pollData?.status === "succeeded") {
                  videoUrl = pollData.output || pollData.videoUrl || pollData.video_url;
                  break;
                } else if (pollData?.status === "failed") {
                  throw new Error(pollData.error || "Video generation failed");
                }
              } catch (pollErr: any) {
                if (
                  pollErr.message?.includes("Polling fallito") ||
                  pollErr.message?.includes("Video generation failed") ||
                  pollErr.message?.includes("Generazione video troppo lenta")
                ) throw pollErr;
                consecutiveNetErrors++;
                if (consecutiveNetErrors >= maxNetErrors) {
                  throw new Error(`Polling fallito dopo ${maxNetErrors} errori di rete`);
                }
                await new Promise(r => setTimeout(r, 2000 * consecutiveNetErrors));
              }
            }
          } finally {
            setVideoPollingInfo(null);
          }
          if (!videoUrl) {
            throw new Error("Generazione video troppo lenta, riprova");
          }
        }

        if (!videoUrl) throw new Error("Nessun URL video ricevuto dopo la generazione");
        const videoCheck = await measureAndValidateVideoAspect(videoUrl, input.videoAspectRatio).catch(() => null);
        const scenes = [...script.scenes];
        scenes[index] = {
          ...scenes[index],
          videoUrl,
          videoStatus: "completed",
          videoGeneratingStartedAt: undefined,
          videoWidth: videoCheck?.width,
          videoHeight: videoCheck?.height,
          videoAspectWarning: videoCheck?.mismatch ? videoCheck.warning : undefined,
        };
        setScript({ ...script, scenes });
        if (videoCheck?.mismatch) {
          toast.warning(`Scena ${index + 1}: ${videoCheck.warning}`, { duration: 6000 });
        } else {
          toast.success(`Video scena ${index + 1} rigenerato`);
        }
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
        const storageUrl = await uploadBlobToStorage(blob, "story-sfx", "mp3", `SFX Scena ${index + 1}`);
        const scenes = [...script.scenes];
        scenes[index] = { ...scenes[index], sfxUrl: storageUrl, sfxStatus: "completed" };
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

  // Quality/FPS rendering multiplier
  const renderingMultiplier = (() => {
    const qMul = input.videoQuality === "fhd" ? 1.8 : input.videoQuality === "sd" ? 0.6 : 1;
    const fMul = input.videoFps === "60" ? 1.5 : input.videoFps === "30" ? 1.1 : 1;
    return qMul * fMul;
  })();

  // Production time estimate (seconds)
  const estimatedProductionTime = script ? (() => {
    const n = script.scenes.length;
    const imgTime = n * 15;
    const ttsTime = n * 8;
    const videoTime = n * 45;
    const sfxTime = n * 5;
    const musicTime = 30;
    const concatTime = Math.round(10 * renderingMultiplier);
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
      const storageUrl = await uploadBlobToStorage(blob, "story-sfx", "mp3", `SFX Scena`);
      return storageUrl;
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
      if (data?.fallback || data?.error === "AI_SERVICE_UNAVAILABLE") {
        toast.error(data.message || "Servizio AI temporaneamente non disponibile. Riprova tra qualche istante.");
        return;
      }
      if (data?.error) throw new Error(data.error);
      if (!data?.scenes) throw new Error("Risposta AI non valida");
      const enrichedScenes = data.scenes.map((s: StoryScene) => ({
        ...s, imageStatus: "idle" as const, videoStatus: "idle" as const, audioStatus: "idle" as const,
      }));
      setScript({ ...data, scenes: enrichedScenes });
      setStep("script");
      toast.success("Script generato!");
    } catch (err: any) { toast.error(err.message || "Errore generazione script"); }
    finally { setIsGeneratingScript(false); }
  };

  // Upload a blob to Supabase storage with retry (max 3 attempts, exponential backoff)
  const uploadBlobToStorage = async (blob: Blob, folder: string, ext: string = "mp3", sceneLabel?: string): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Utente non autenticato");
    const fileName = `${user.id}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const arrayBuffer = await blob.arrayBuffer();
    const maxAttempts = 3;
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const { error } = await supabase.storage.from("audio-uploads").upload(fileName, new Uint8Array(arrayBuffer), {
        contentType: ext === "mp3" ? "audio/mpeg" : "audio/wav",
        upsert: true,
      });
      if (!error) {
        const { data: urlData } = supabase.storage.from("audio-uploads").getPublicUrl(fileName);
        return urlData.publicUrl;
      }
      lastError = error;
      const label = sceneLabel || folder;
      console.warn(`Upload ${label} tentativo ${attempt}/${maxAttempts} fallito:`, error.message);
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
      }
    }
    const label = sceneLabel || folder;
    throw new Error(`Upload fallito per "${label}" dopo ${maxAttempts} tentativi: ${lastError?.message}`);
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
      const storageUrl = await uploadBlobToStorage(blob, "story-music", "mp3", "Colonna sonora");
      setBackgroundMusicUrl(storageUrl);
      toast.success("Colonna sonora generata! 🎵");
      return storageUrl;
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

  // Check if a scene has any failed or missing assets
  const sceneHasIssues = (s: StoryScene) =>
    s.imageStatus === "error" || s.audioStatus === "error" ||
    s.videoStatus === "error" || s.sfxStatus === "error" ||
    (!s.imageUrl && s.imageStatus !== "generating") ||
    (!s.audioUrl && s.audioStatus !== "generating") ||
    (!s.videoUrl && s.videoStatus !== "generating");

  const failedOrMissingScenes = (scenes: StoryScene[]) =>
    scenes.map((s, i) => ({ scene: s, index: i })).filter(({ scene }) => sceneHasIssues(scene));

  // Auto-regenerate all scenes that are in error or missing state
  const handleAutoRegenerateErrors = async () => {
    if (!script) return;
    const errorScenes = failedOrMissingScenes(script.scenes);
    if (errorScenes.length === 0) {
      toast.info("Tutte le scene sono complete!");
      return;
    }
    toast.info(`Rigenerazione di ${errorScenes.length} scene con problemi...`);
    setIsGenerating(true);
    setRegenProgress({ current: 0, total: errorScenes.length });
    for (let i = 0; i < errorScenes.length; i++) {
      const { scene, index } = errorScenes[i];
      setRegenProgress({ current: i, total: errorScenes.length });
      if (scene.imageStatus === "error" || (!scene.imageUrl && scene.imageStatus !== "generating")) {
        await regenerateSceneAsset(index, "image");
      }
      if (scene.audioStatus === "error" || (!scene.audioUrl && scene.audioStatus !== "generating")) {
        await regenerateSceneAsset(index, "audio");
      }
      if (scene.sfxStatus === "error" || (!scene.sfxUrl && scene.sfxStatus !== "generating")) {
        await regenerateSceneAsset(index, "sfx");
      }
      if (scene.videoStatus === "error" || (!scene.videoUrl && scene.videoStatus !== "generating")) {
        await regenerateSceneAsset(index, "video");
      }
    }
    setRegenProgress(null);
    setIsGenerating(false);
    toast.success("Rigenerazione completata!");
  };

  // Regenerate every scene whose image has an aspect-ratio warning (e.g. Flux returned 1024x1024 for 9:16)
  const handleRegenerateNonCompliantImages = async () => {
    if (!script) return;
    const nonCompliant = script.scenes
      .map((s, i) => ({ scene: s, index: i }))
      .filter(({ scene }) => !!scene.imageAspectWarning);
    if (nonCompliant.length === 0) {
      toast.info("Tutte le immagini rispettano il formato richiesto.");
      return;
    }
    toast.info(`Rigenerazione di ${nonCompliant.length} ${nonCompliant.length === 1 ? "immagine non conforme" : "immagini non conformi"}...`);
    setIsGenerating(true);
    setRegenProgress({ current: 0, total: nonCompliant.length });
    for (let i = 0; i < nonCompliant.length; i++) {
      setRegenProgress({ current: i, total: nonCompliant.length });
      await regenerateSceneAsset(nonCompliant[i].index, "image");
    }
    setRegenProgress(null);
    setIsGenerating(false);
    toast.success("Rigenerazione immagini non conformi completata!");
  };

  // Regenerate every scene whose video has an aspect-ratio warning (e.g. Kling returned 16:9 for a 9:16 request)
  const handleRegenerateNonCompliantVideos = async () => {
    if (!script) return;
    const nonCompliant = script.scenes
      .map((s, i) => ({ scene: s, index: i }))
      .filter(({ scene }) => !!scene.videoAspectWarning);
    if (nonCompliant.length === 0) {
      toast.info("Tutti i video rispettano il formato richiesto.");
      return;
    }
    toast.info(`Rigenerazione di ${nonCompliant.length} ${nonCompliant.length === 1 ? "video non conforme" : "video non conformi"}...`);
    setIsGenerating(true);
    setRegenProgress({ current: 0, total: nonCompliant.length });
    for (let i = 0; i < nonCompliant.length; i++) {
      setRegenProgress({ current: i, total: nonCompliant.length });
      await regenerateSceneAsset(nonCompliant[i].index, "video");
    }
    setRegenProgress(null);
    setIsGenerating(false);
    toast.success("Rigenerazione video non conformi completata!");
  };

  // Re-assemble final video from existing scene assets (no re-generation)
  const handleReassemble = async (volumeOverrides?: RenderVolumes) => {
    if (!script) return;
    const vids = script.scenes.filter(s => s.videoStatus === "completed" && s.videoUrl);
    if (vids.length < 2) {
      toast.error("Servono almeno 2 scene video completate per il montaggio.");
      return;
    }
    setIsGenerating(true);
    setFinalVideoUrl(null);
    setRenderStatus("idle");
    setPendingRenderId(null);
    toast.info("Rimontaggio video finale in corso...");
    try {
      const transitions = vids.map((s) => ({
        type: s.transition || "crossfade",
        duration: s.transitionDuration || 0.5,
      }));
      // Build positional narration array aligned with video clips
      const narrationUrls = vids.map(s => s.audioUrl || "");
      const sfxUrls = vids.map(s => s.sfxUrl || "");

      const resolvedVideoUrls = await Promise.all(
        vids.map(async (s) => {
          const url = s.videoUrl!;
          if (url.startsWith("storage://")) {
            const path = url.replace("storage://", "");
            const bucketName = path.split("/")[0];
            const filePath = path.substring(bucketName.length + 1);
            const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
            return urlData.publicUrl;
          }
          if (url.includes("/functions/v1/video-proxy")) {
            try {
              const { data: { session } } = await supabase.auth.getSession();
              const token = session?.access_token;
              const res = await fetch(url, {
                headers: token ? { Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } : {},
              });
              if (!res.ok) return url;
              const blob = await res.blob();
              const fileName = `story-videos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`;
              const arrayBuffer = await blob.arrayBuffer();
              const { error: upErr } = await supabase.storage.from("generated-videos").upload(fileName, new Uint8Array(arrayBuffer), { contentType: "video/mp4", upsert: true });
              if (upErr) return url;
              const { data: urlData } = supabase.storage.from("generated-videos").getPublicUrl(fileName);
              return urlData.publicUrl;
            } catch { return url; }
          }
          return url;
        })
      );
      const validVideoUrls = resolvedVideoUrls.filter((u): u is string => !!u && u.startsWith("http"));
      if (validVideoUrls.length < 2) {
        toast.error("Non abbastanza URL video validi per il montaggio.");
        setIsGenerating(false);
        return;
      }
      const clipDurations = vids.map(s => Math.min(s.duration, 10));
      const { data, error } = await supabase.functions.invoke("video-concat", {
        body: {
          videoUrls: validVideoUrls,
          clipDurations,
          transition: transitions[0]?.type || "crossfade",
          transitionDuration: transitions[0]?.duration || 0.5,
          transitions,
          resolution: input.videoQuality || "hd",
          aspectRatio: input.videoAspectRatio || "16:9",
          fps: input.videoFps || "24",
          audioUrls: narrationUrls.some(u => !!u) ? narrationUrls : undefined,
          sfxUrls: sfxUrls.some(u => !!u) ? sfxUrls : undefined,
          sfxVolume: (volumeOverrides?.sfxVolume ?? 70) / 100,
          backgroundMusicUrl: backgroundMusicUrl || undefined,
          musicVolume: (volumeOverrides?.musicVolume ?? script.musicVolume ?? 25) / 100,
          narrationVolume: (volumeOverrides?.narrationVolume ?? script.narrationVolume ?? 100) / 100,
        },
      });
      if (error) throw error;
      const finalUrl = data?.videoUrl || data?.url;
      if (data?.segments && Array.isArray(data.segments)) setVideoSegments(data.segments);

      // Warn user about skipped audio assets
      if (data?.skippedAssets && Array.isArray(data.skippedAssets) && data.skippedAssets.length > 0) {
        const types = [...new Set(data.skippedAssets.map((a: { type: string }) => a.type))].join(", ");
        toast.warning(`⚠️ ${data.skippedAssets.length} asset audio scartati (${types}): URL temporanei scaduti.`, { duration: 8000 });
        console.warn("Skipped assets:", data.skippedAssets);
      }

      if (data?.method === "shotstack-pending" && data?.renderId) {
        // CRITICAL: do NOT set finalVideoUrl when pending
        setPendingRenderId(data.renderId);
        setRenderStatus("processing");
        setRenderStartTime(Date.now());
        setRenderElapsed(0);
        if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
        setStep("complete");
        toast.info("Rendering in corso su Shotstack… il video apparirà automaticamente.");
        setTimeout(() => saveProject(), 500);
      } else if (finalUrl && data?.method === "shotstack") {
        setFinalVideoUrl(finalUrl);
        setRenderStatus("completed");
        setStep("complete");
        toast.success("Video finale rimontato con audio mixato! 🎬");
        setTimeout(() => saveProject(), 500);
      } else {
        toast.error("Rimontaggio non riuscito — il backend non ha restituito un video unito. Riprova fra qualche secondo.");
        setStep("complete");
      }
    } catch (err: any) {
      console.error("Reassemble error:", err);
      toast.error("Errore nel rimontaggio: " + (err.message || "sconosciuto"));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateAll = async () => {
    if (!script) return;
    if (!input.imageUrl && refImageError) {
      toast.error("Ricarica l'immagine di riferimento prima di generare.");
      return;
    }

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
    const referenceImageUrl = input.imageUrl || undefined;
    const musicP = generateBackgroundMusic().then(tick);

    // Images
    for (let i = 0; i < scenes.length; i++) {
      await waitForResume();
      if (checkCancelled()) break;
      try {
        scenes[i] = { ...scenes[i], imageStatus: "generating" };
        setScript(p => p ? { ...p, scenes: [...scenes] } : p);
        const fluxDims = input.videoAspectRatio === "9:16"
          ? { width: 720, height: 1280 }
          : input.videoAspectRatio === "4:3"
          ? { width: 1024, height: 768 }
          : { width: 1280, height: 720 };
        const { data, error } = await supabase.functions.invoke("generate-image", { body: { prompt: scenes[i].imagePrompt, model: "flux", style: input.stylePromptModifier, aspectRatio: input.videoAspectRatio, ...fluxDims, ...(referenceImageUrl ? { referenceImageUrl, characterFidelity: input.characterFidelity } : {}) } });
        if (error) throw error;
        if (data?.fallback || !data?.imageUrl) {
          const message = data?.retryAfter
            ? `Generazione immagini temporaneamente limitata. Riprova tra ${data.retryAfter}s.`
            : (data?.message || "Generazione immagini temporaneamente non disponibile.");
          scenes[i] = { ...scenes[i], imageStatus: "error", error: message };
        } else {
          const newImageUrl = data.imageUrl || data.url;
          const aspectCheck = await measureAndValidateAspect(newImageUrl, input.videoAspectRatio);
          scenes[i] = {
            ...scenes[i],
            imageUrl: newImageUrl,
            imageStatus: "completed",
            imageWidth: aspectCheck?.width,
            imageHeight: aspectCheck?.height,
            imageAspectWarning: aspectCheck?.mismatch ? aspectCheck.warning : undefined,
          };
          if (aspectCheck?.mismatch) {
            console.warn(`[Story Mode] Scene ${i + 1} aspect mismatch:`, aspectCheck.warning);
          }
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
        const blob = await r.blob();
        const sceneLabel = `Narrazione Scena ${i + 1}`;
        const storageUrl = await uploadBlobToStorage(blob, "story-narration", "mp3", sceneLabel);
        scenes[i] = { ...scenes[i], audioUrl: storageUrl, audioStatus: "completed" };
      } catch (err: any) {
        const msg = err.message || "Errore sconosciuto";
        toast.error(`Scena ${i + 1}: errore audio – ${msg}`);
        scenes[i] = { ...scenes[i], audioStatus: "error", error: msg };
      }
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
      } catch (err: any) {
        toast.error(`Scena ${i + 1}: errore SFX – ${err?.message || "sconosciuto"}`);
        scenes[i] = { ...scenes[i], sfxStatus: "error" };
      }
      tick(); setScript(p => p ? { ...p, scenes: [...scenes] } : p);
    }

    // Video generation
    for (let i = 0; i < scenes.length && !checkCancelled(); i++) {
      await waitForResume();
      if (checkCancelled()) break;
      if (scenes[i].imageStatus !== "completed" || !scenes[i].imageUrl) { tick(); continue; }
      try {
        scenes[i] = { ...scenes[i], videoStatus: "generating", videoGeneratingStartedAt: Date.now() };
        setScript(p => p ? { ...p, scenes: [...scenes] } : p);
        const orientationHint = input.videoAspectRatio === "9:16"
          ? ", vertical 9:16 portrait composition, full vertical frame"
          : input.videoAspectRatio === "16:9"
          ? ", horizontal 16:9 cinematic frame"
          : "";
        const { data, error } = await supabase.functions.invoke("generate-video", {
          body: { prompt: `${scenes[i].imagePrompt}, ${scenes[i].cameraMovement.replace(/_/g, " ")}${orientationHint}`, image_url: scenes[i].imageUrl, type: "image_to_video", duration: Math.min(scenes[i].duration, 10), model: "kling-2.1", aspect_ratio: input.videoAspectRatio },
        });
        if (error) throw error;

        // Handle async video generation (polling for operationId)
        let videoUrl = data.videoUrl || data.video_url || data.output;
        if (!videoUrl && data.operationId && (data.status === "starting" || data.status === "processing")) {
          console.log(`Scene ${i + 1}: polling operationId ${data.operationId}`);
          const pollingStart = Date.now();
          setVideoPollingInfo({ sceneIndex: i, startedAt: pollingStart, pollCount: 0 });
          // Hard safety timeout: 12 minutes max wall-clock from polling start
          const MAX_POLL_WALL_MS = 12 * 60 * 1000;
          const maxPolls = 144; // 144 * 5s = 12 minutes (matches wall-clock guard)
          let consecutiveNetErrors = 0;
          const maxNetErrors = 10;
          for (let poll = 0; poll < maxPolls; poll++) {
            if (checkCancelled()) break;
            // Wall-clock guard: covers cases where backoff sleeps inflate per-poll time
            if (Date.now() - pollingStart > MAX_POLL_WALL_MS) {
              apiLogger.error("Kling", "video_timeout", "Timeout 12min su generazione batch", {
                operationId: data.operationId,
                sceneNumber: i + 1,
                totalDurationMs: Date.now() - pollingStart,
                pollCount: poll,
                context: "handleGenerateAll",
              }).catch(() => {});
              throw new Error("Generazione video troppo lenta, riprova");
            }
            await new Promise(r => setTimeout(r, 5000)); // wait 5s between polls
            setVideoPollingInfo({ sceneIndex: i, startedAt: pollingStart, pollCount: poll + 1 });
            try {
              const { data: pollData, error: pollError } = await supabase.functions.invoke("generate-video", {
                body: { operationId: data.operationId },
              });
              if (pollError) {
                consecutiveNetErrors++;
                console.error(`Poll error (${consecutiveNetErrors}/${maxNetErrors}):`, pollError);
                if (consecutiveNetErrors >= maxNetErrors) {
                  throw new Error(`Polling fallito dopo ${maxNetErrors} errori di rete consecutivi per scena ${i + 1}`);
                }
                // Backoff on network errors: wait extra time
                await new Promise(r => setTimeout(r, 2000 * consecutiveNetErrors));
                continue;
              }
              consecutiveNetErrors = 0; // reset on success
              if (pollData.status === "succeeded") {
                videoUrl = pollData.output || pollData.videoUrl || pollData.video_url;
                break;
              } else if (pollData.status === "failed") {
                throw new Error(pollData.error || "Video generation failed");
              }
            } catch (pollErr: any) {
              if (
                pollErr.message?.includes("Polling fallito") ||
                pollErr.message?.includes("Video generation failed") ||
                pollErr.message?.includes("Generazione video troppo lenta")
              ) throw pollErr;
              consecutiveNetErrors++;
              console.error(`Poll network error (${consecutiveNetErrors}/${maxNetErrors}):`, pollErr);
              if (consecutiveNetErrors >= maxNetErrors) {
                throw new Error(`Polling fallito dopo ${maxNetErrors} errori di rete consecutivi per scena ${i + 1}`);
              }
              await new Promise(r => setTimeout(r, 2000 * consecutiveNetErrors));
            }
            // still processing, continue polling
          }
          setVideoPollingInfo(null);
          // Loop ended without success and no exception → polls exhausted
          if (!videoUrl) {
            throw new Error("Generazione video troppo lenta, riprova");
          }
        }

        if (!videoUrl) throw new Error("Nessun URL video ricevuto dopo la generazione");
        const videoCheck = await measureAndValidateVideoAspect(videoUrl, input.videoAspectRatio).catch(() => null);
        scenes[i] = {
          ...scenes[i],
          videoUrl,
          videoStatus: "completed",
          videoGeneratingStartedAt: undefined,
          videoWidth: videoCheck?.width,
          videoHeight: videoCheck?.height,
          videoAspectWarning: videoCheck?.mismatch ? videoCheck.warning : undefined,
        };
        if (videoCheck?.mismatch) {
          console.warn(`[Story Mode] Scene ${i + 1} video aspect mismatch:`, videoCheck.warning);
        }
      } catch (err: any) {
        scenes[i] = { ...scenes[i], videoStatus: "error", error: err.message, videoGeneratingStartedAt: undefined };
        if (err.message?.includes("Generazione video troppo lenta")) {
          toast.error(`Scena ${i + 1}: Generazione video troppo lenta, riprova`);
        }
      }
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
        // Build positional narration/sfx arrays aligned with video clips
        const narrationUrls = vids.map(s => s.audioUrl || "");
        const sfxUrls = vids.map(s => s.sfxUrl || "");

        // Resolve storage:// and video-proxy URLs to public URLs for Shotstack compatibility
        const resolvedVideoUrls = await Promise.all(
          vids.map(async (s) => {
            const url = s.videoUrl!;
            if (url.startsWith("storage://")) {
              const path = url.replace("storage://", "");
              const bucketName = path.split("/")[0];
              const filePath = path.substring(bucketName.length + 1);
              const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
              return urlData.publicUrl;
            }
            // Video-proxy URLs need to be fetched with auth and re-uploaded
            if (url.includes("/functions/v1/video-proxy")) {
              try {
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;
                const res = await fetch(url, {
                  headers: token ? { Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } : {},
                });
                if (!res.ok) return url;
                const blob = await res.blob();
                const fileName = `story-videos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`;
                const arrayBuffer = await blob.arrayBuffer();
                const { error: upErr } = await supabase.storage.from("generated-videos").upload(fileName, new Uint8Array(arrayBuffer), { contentType: "video/mp4", upsert: true });
                if (upErr) return url;
                const { data: urlData } = supabase.storage.from("generated-videos").getPublicUrl(fileName);
                return urlData.publicUrl;
              } catch { return url; }
            }
            return url;
          })
        );

        // Filter out any null/empty URLs
        const validVideoUrls = resolvedVideoUrls.filter((u): u is string => !!u && u.startsWith("http"));
        if (validVideoUrls.length < 2) {
          setFinalVideoUrl(vids[0].videoUrl!);
          toast.success("Video finale pronto! 🎬");
          return;
        }

        // Collect clip durations for Shotstack
        const clipDurations = vids.map(s => Math.min(s.duration, 10));

        const { data, error } = await supabase.functions.invoke("video-concat", {
          body: {
            videoUrls: validVideoUrls,
            clipDurations,
            transition: transitions[0]?.type || "crossfade",
            transitionDuration: transitions[0]?.duration || 0.5,
            transitions,
            resolution: input.videoQuality || "hd",
            aspectRatio: input.videoAspectRatio || "16:9",
            fps: input.videoFps || "24",
            audioUrls: narrationUrls.some(u => !!u) ? narrationUrls : undefined,
            sfxUrls: sfxUrls.some(u => !!u) ? sfxUrls : undefined,
            sfxVolume: 0.7,
            backgroundMusicUrl: backgroundMusicUrl || undefined,
            musicVolume: (script.musicVolume ?? 25) / 100,
            narrationVolume: (script.narrationVolume ?? 100) / 100,
          },
        });
        if (error) throw error;
        const finalUrl = data?.videoUrl || data?.url;
        if (data?.segments && Array.isArray(data.segments)) {
          setVideoSegments(data.segments);
        }

        // Warn user about skipped audio assets (blob URLs unreachable from server)
        if (data?.skippedAssets && Array.isArray(data.skippedAssets) && data.skippedAssets.length > 0) {
          const types = [...new Set(data.skippedAssets.map((a: { type: string }) => a.type))].join(", ");
          toast.warning(`⚠️ ${data.skippedAssets.length} asset audio scartati (${types}): URL temporanei scaduti. Ricarica/rigenera per includerli nel video finale.`, { duration: 8000 });
          console.warn("Skipped assets:", data.skippedAssets);
        }

        if (data?.method === "shotstack-pending" && data?.renderId) {
          // CRITICAL: do NOT set finalVideoUrl when pending — that would expose
          // the raw first-scene URL as if it were the final video.
          setPendingRenderId(data.renderId);
          setRenderStatus("processing");
          setRenderStartTime(Date.now());
          setRenderElapsed(0);
          if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
          toast.info("Rendering finale in corso… apparirà automaticamente quando pronto.");
        } else if (finalUrl && data?.method === "shotstack") {
          // Only set finalVideoUrl when Shotstack confirms the merged video is ready
          setFinalVideoUrl(finalUrl);
          setRenderStatus("completed");
          toast.success("Video finale con audio mixato generato! 🎬");
        } else if (finalUrl) {
          // Fallback method (segments) — explicit message that this is NOT a merged video
          setVideoSegments(data?.segments || [finalUrl]);
          toast.warning("Concat non disponibile — scarica le scene singolarmente.");
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
          {script && (
            <Button
              variant="outline"
              size="sm"
              onClick={reconcileProject}
              disabled={isReconciling || isSaving}
              title="Ricontrolla scene con video presente, corregge stati incoerenti e completa il progetto"
            >
              {isReconciling ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              <span className="hidden sm:inline ml-1">Riconcilia</span>
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
              <CardContent className="space-y-3">
                {refImageError && !input.imageUrl && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                    <RotateCcw className="w-4 h-4 shrink-0" />
                    <span>L'immagine di riferimento precedente non è più valida. Ricaricala prima di generare.</span>
                  </div>
                )}
                {isUploadingRef ? (
                  <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-primary/30 rounded-lg bg-primary/5">
                    <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
                    <span className="text-sm text-muted-foreground">Caricamento in corso...</span>
                  </div>
                ) : input.imageUrl ? (
                  <div className="relative">
                    <img src={input.imageUrl} alt="Reference" className="w-full rounded-lg object-contain max-h-64 bg-muted/20" />
                    <Button variant="secondary" size="sm" className="absolute top-2 right-2" onClick={() => { setInput(p => ({ ...p, imageUrl: "", imageFile: null })); setRefImageError(false); (window as any).__storyRefStorageUrl = ""; }}><RotateCcw className="w-3 h-3 mr-1" />Cambia</Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-primary/30 rounded-lg cursor-pointer hover:bg-primary/5 transition-colors">
                    <Upload className="w-8 h-8 text-primary/50 mb-2" />
                    <span className="text-sm text-muted-foreground">Carica un'immagine di riferimento</span>
                    <span className="text-xs text-muted-foreground mt-1">(opzionale)</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </label>
                )}
                {input.imageUrl && (
                  <div>
                    <Label className="text-xs flex items-center gap-1 mb-1.5">🎯 Fedeltà al Personaggio</Label>
                    <div className="flex gap-2">
                      {([
                        { value: "low" as const, label: "Bassa", desc: "Ispirazione libera" },
                        { value: "medium" as const, label: "Media", desc: "Somiglianza bilanciata" },
                        { value: "high" as const, label: "Alta", desc: "Massima fedeltà" },
                      ]).map(f => (
                        <button
                          key={f.value}
                          onClick={() => setInput(p => ({ ...p, characterFidelity: f.value }))}
                          className={cn(
                            "flex-1 flex flex-col items-center gap-0.5 py-2 px-2 rounded-lg border-2 transition-all text-xs font-medium",
                            input.characterFidelity === f.value
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:border-muted-foreground/40 text-muted-foreground"
                          )}
                        >
                          <span className="font-bold">{f.label}</span>
                          <span className="text-[10px] opacity-70">{f.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
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

          {/* Volume & Quality Controls */}
          <Card className="border-secondary/20 bg-card/50">
            <CardContent className="py-3 px-4 space-y-3">
              <p className="text-sm font-medium flex items-center gap-2"><Volume2 className="w-4 h-4 text-primary" />Controllo Volumi & Qualità</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                <div className="space-y-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Label className="text-xs flex items-center gap-1 cursor-help"><Film className="w-3 h-3" />Qualità ℹ️</Label>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[220px] text-xs">
                        <p><b>SD 480p</b> — Leggero, rendering veloce. Ideale per bozze e anteprime.</p>
                        <p className="mt-1"><b>HD 720p</b> — Buon equilibrio tra qualità e velocità. Consigliato.</p>
                        <p className="mt-1"><b>FHD 1080p</b> — Massima qualità, rendering più lento. Per il prodotto finale.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <div className="flex gap-1.5 mt-1">
                    {([
                      { value: "sd" as const, label: "SD", desc: "480p" },
                      { value: "hd" as const, label: "HD", desc: "720p" },
                      { value: "fhd" as const, label: "FHD", desc: "1080p" },
                    ]).map(q => (
                      <button
                        key={q.value}
                        onClick={() => setInput(p => ({ ...p, videoQuality: q.value }))}
                        className={cn(
                          "flex-1 flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-lg border-2 transition-all text-xs font-medium",
                          input.videoQuality === q.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-muted-foreground/40 text-muted-foreground"
                        )}
                      >
                        <span className="font-bold text-[11px]">{q.label}</span>
                        <span className="text-[9px] opacity-70">{q.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Label className="text-xs flex items-center gap-1 cursor-help"><Film className="w-3 h-3" />Framerate ℹ️</Label>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[220px] text-xs">
                        <p><b>24fps</b> — Look cinematografico classico. Il più usato per film e cortometraggi.</p>
                        <p className="mt-1"><b>30fps</b> — Standard per web e social media. Buona fluidità.</p>
                        <p className="mt-1"><b>60fps</b> — Ultra fluido, ideale per azioni rapide. File più pesanti.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <div className="flex gap-1.5 mt-1">
                    {([
                      { value: "24" as const, label: "24", desc: "Cinema" },
                      { value: "30" as const, label: "30", desc: "Standard" },
                      { value: "60" as const, label: "60", desc: "Fluido" },
                    ]).map(f => (
                      <button
                        key={f.value}
                        onClick={() => setInput(p => ({ ...p, videoFps: f.value }))}
                        className={cn(
                          "flex-1 flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-lg border-2 transition-all text-xs font-medium",
                          input.videoFps === f.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-muted-foreground/40 text-muted-foreground"
                        )}
                      >
                        <span className="font-bold text-[11px]">{f.label}fps</span>
                        <span className="text-[9px] opacity-70">{f.desc}</span>
                      </button>
                    ))}
                  </div>
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
                aspectRatio={input.videoAspectRatio}
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
                onRegenerate={(type) => regenerateSceneAsset(idx, type)}
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
                <p className="text-xs text-muted-foreground mt-0.5">
                  🎬 Rendering: <span className="font-medium text-foreground">{input.videoQuality.toUpperCase()}</span> • <span className="font-medium text-foreground">{input.videoFps}fps</span>
                  {renderingMultiplier > 1.2 && <span className="text-amber-500 ml-1">⚠️ rendering più lento ({Math.round(renderingMultiplier * 100 - 100)}% in più)</span>}
                  {renderingMultiplier < 0.8 && <span className="text-green-500 ml-1">⚡ rendering veloce</span>}
                </p>
              </div>
              <Badge variant="secondary" className="text-base font-bold px-3 py-1">
                <Clock className="w-4 h-4 mr-1" />
                ~{formatTime(estimatedProductionTime)}
              </Badge>
            </CardContent>
          </Card>

          {/* Asset status summary */}
          {script.scenes.some(s => s.imageUrl || s.audioUrl || s.videoUrl) && (() => {
            const total = script.scenes.length;
            const readyCount = script.scenes.filter(s => s.imageStatus === "completed" && s.audioStatus === "completed" && s.videoStatus === "completed").length;
            const errorCount = script.scenes.filter(s => s.imageStatus === "error" || s.audioStatus === "error" || s.videoStatus === "error" || s.sfxStatus === "error").length;
            const pendingCount = total - readyCount - errorCount;
            return (
              <div className="flex items-center gap-3 flex-wrap text-xs p-2 rounded-lg bg-muted/30 border border-border/50">
                <span className="font-medium text-foreground">Stato asset:</span>
                <Badge variant="secondary" className="gap-1 text-[11px]">
                  <Check className="w-3 h-3 text-green-500" />{readyCount}/{total} pronte
                </Badge>
                {errorCount > 0 && (
                  <Badge variant="destructive" className="gap-1 text-[11px]">
                    ✗ {errorCount} in errore
                  </Badge>
                )}
                {pendingCount > 0 && (
                  <Badge variant="outline" className="gap-1 text-[11px] text-muted-foreground">
                    — {pendingCount} da generare
                  </Badge>
                )}
              </div>
            );
          })()}

          <div className="flex gap-3 flex-wrap">
            <Button variant="outline" onClick={() => setStep("input")}><ChevronLeft className="w-4 h-4 mr-2" />Modifica Input</Button>
            <Button variant="outline" onClick={handleGenerateScript} disabled={isGeneratingScript}><RefreshCw className="w-4 h-4 mr-2" />Rigenera Script</Button>
            <Button variant="outline" onClick={saveProject} disabled={isSaving}><Save className="w-4 h-4 mr-2" />Salva Bozza</Button>
            <Button variant="outline" onClick={exportScriptPDF}><FileText className="w-4 h-4 mr-2" />Esporta PDF</Button>
            {/* Auto-regenerate error scenes */}
            {(() => {
              const issues = failedOrMissingScenes(script.scenes);
              return issues.length > 0 ? (
                <Button variant="destructive" onClick={handleAutoRegenerateErrors} disabled={isGenerating}>
                  {isGenerating && regenProgress ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  {isGenerating && regenProgress
                    ? `Rigenerando ${regenProgress.current + 1}/${regenProgress.total}…`
                    : `Rigenera Scene Fallite (${issues.length})`}
                </Button>
              ) : null;
            })()}
            {/* Regenerate non-compliant aspect-ratio images */}
            {(() => {
              const nonCompliant = script.scenes.filter(s => !!s.imageAspectWarning);
              return nonCompliant.length > 0 ? (
                <Button
                  variant="outline"
                  onClick={handleRegenerateNonCompliantImages}
                  disabled={isGenerating}
                  className="border-amber-500/50 text-amber-600 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                >
                  {isGenerating && regenProgress ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <AlertTriangle className="w-4 h-4 mr-2" />}
                  Rigenera Immagini Non Conformi ({nonCompliant.length})
                </Button>
              ) : null;
            })()}
            {/* Regenerate non-compliant aspect-ratio videos */}
            {(() => {
              const nonCompliantVids = script.scenes.filter(s => !!s.videoAspectWarning);
              return nonCompliantVids.length > 0 ? (
                <Button
                  variant="outline"
                  onClick={handleRegenerateNonCompliantVideos}
                  disabled={isGenerating}
                  className="border-amber-500/50 text-amber-600 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                >
                  {isGenerating && regenProgress ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <AlertTriangle className="w-4 h-4 mr-2" />}
                  Rigenera Video Non Conformi ({nonCompliantVids.length})
                </Button>
              ) : null;
            })()}
            {/* "Solo concat finale" — skip scene generation, montaggio diretto da scene già completate */}
            {(() => {
              const completedVids = script.scenes.filter(s => s.videoStatus === "completed" && s.videoUrl);
              if (completedVids.length < 2) return null;
              return (
                <Button
                  variant="default"
                  onClick={() => { setPendingRenderAction("reassemble"); setShowRenderPreview(true); }}
                  disabled={isGenerating || renderStatus === "processing"}
                  className="bg-primary/90 hover:bg-primary"
                  title={`Salta la generazione delle scene e monta direttamente il video finale dalle ${completedVids.length} scene già pronte`}
                >
                  {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Film className="w-4 h-4 mr-2" />}
                  🎬 Solo concat finale ({completedVids.length} scene pronte)
                </Button>
              );
            })()}
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
                {/* Video polling indicator */}
                {videoPollingInfo && script.scenes[videoPollingInfo.sceneIndex] && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20 animate-pulse">
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        ⏳ Scena {videoPollingInfo.sceneIndex + 1}: rendering in corso...
                      </p>
                      <p className="text-xs text-muted-foreground">
                        In attesa da {videoPollingInfo.pollCount * 5}s — controllo #{videoPollingInfo.pollCount}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Live preview of completed scenes */}
          <LivePreviewCard scenes={script.scenes} totalScenes={script.scenes.length} aspectRatio={input.videoAspectRatio} />

          {/* Diagnostic card: video/audio/sfx health + detected aspect ratio */}
          <SceneDiagnosticsCard scenes={script.scenes} expectedAspectRatio={input.videoAspectRatio} />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {script.scenes.map((scene, idx) => (
              <SceneCard key={idx} scene={scene} index={idx} mode="generation" aspectRatio={input.videoAspectRatio} voices={voiceOptions} defaultVoiceId={input.voiceId} isEditing={false} isPreviewLoading={false} onToggleEdit={() => {}} onUpdate={() => {}} onPreviewAudio={() => {}} onDuplicate={() => {}} onDelete={() => {}} onUnstuck={() => unstuckScene(idx)} />
            ))}
          </div>
        </div>
      )}

      {/* Step 4: Complete */}
      {step === "complete" && !script && (
        <Card className="border-accent/20 bg-card/50">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-muted/30 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-1">Caricamento progetto…</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Lo script non è ancora disponibile. Se il problema persiste, torna indietro e riprova.
              </p>
            </div>
            <Button variant="outline" onClick={() => setStep("input")}>
              <RotateCcw className="w-4 h-4 mr-2" />Torna all'inizio
            </Button>
          </CardContent>
        </Card>
      )}
      {step === "complete" && script && (
        <div className="space-y-6">
          {/* Render status badge */}
          {renderStatus === "processing" && (
            <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <p className="text-sm font-medium">Rendering in lavorazione…</p>
                </div>
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">In lavorazione</Badge>
              </div>
              <Progress value={renderProgressPct} className="h-2" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{Math.round(renderProgressPct)}% completato</span>
                <span className="flex items-center gap-1">
                  <Timer className="w-3 h-3" />
                  {renderRemainingSeconds > 60
                    ? `~${Math.ceil(renderRemainingSeconds / 60)} min rimanenti`
                    : `~${renderRemainingSeconds}s rimanenti`}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {sceneCount} scene · {isHD ? "Alta qualità" : "Qualità standard"} · Tempo stimato ~{Math.ceil(estimatedRenderSeconds / 60)} min
              </p>
            </div>
          )}
          {renderStatus === "failed" && !finalVideoUrl && (
            <div className="flex items-center gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/5">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <div className="flex-1">
                <p className="text-sm font-medium">Rendering fallito</p>
                <p className="text-xs text-muted-foreground">Puoi riprovare con il bottone "Rimonta Video Finale".</p>
              </div>
              <Badge variant="destructive">Fallito</Badge>
            </div>
          )}
          {renderStatus === "completed" && finalVideoUrl && (
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-green-500/10 text-green-400 border-green-500/20"><Check className="w-3 h-3 mr-1" />Completato</Badge>
            </div>
          )}

          {/* Diagnostic card also available in complete step for post-mortem checks */}
          <SceneDiagnosticsCard scenes={script.scenes} expectedAspectRatio={input.videoAspectRatio} />

          {finalVideoUrl ? (
            <Card className="border-primary/20 bg-card/50">
              <CardHeader><CardTitle className="text-xl flex items-center gap-2"><Film className="w-6 h-6 text-primary" />{script.title}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <video src={finalVideoUrl} controls className="w-full rounded-lg max-h-[500px]" />
                {backgroundMusicUrl && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <Music className="w-5 h-5 text-primary shrink-0" />
                    <div className="flex-1"><p className="text-sm font-medium">Colonna Sonora</p><audio src={backgroundMusicUrl} controls className="w-full mt-1 h-8" /></div>
                    <Button variant="outline" size="sm" disabled={downloadingId === "music"} onClick={() => downloadFile(backgroundMusicUrl, "soundtrack.mp3", "music")}>
                      {downloadingId === "music" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                    </Button>
                  </div>
                )}
                <div className="flex gap-3 flex-wrap">
                  <Button disabled={downloadingId === "final"} onClick={() => downloadFile(finalVideoUrl, `${script.title}.mp4`, "final")}>
                    {downloadingId === "final" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}Scarica Video
                  </Button>
                  <Button variant="outline" onClick={() => setStep("script")}>
                    <Pencil className="w-4 h-4 mr-2" />Modifica & Rigenera
                  </Button>
                  <Button variant="outline" onClick={() => { setStep("input"); setScript(null); setFinalVideoUrl(null); setVideoSegments([]); setBackgroundMusicUrl(null); setGenerationProgress(0); setProjectId(null); setRenderStatus("idle"); setPendingRenderId(null); }}><RotateCcw className="w-4 h-4 mr-2" />Nuova Storia</Button>
                </div>
                {videoSegments.length > 1 && (
                  <div className="pt-3 border-t border-border/50">
                    <p className="text-sm text-muted-foreground mb-2">Scarica scene singole:</p>
                    <div className="flex flex-wrap gap-2">
                      {videoSegments.map((segUrl, i) => (
                        <Button key={i} variant="outline" size="sm" disabled={downloadingId === `seg-${i}`} onClick={() => downloadFile(segUrl, `scena-${i + 1}.mp4`, `seg-${i}`)}>
                          {downloadingId === `seg-${i}` ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Download className="w-3 h-3 mr-1" />}Scena {i + 1}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-accent/20 bg-card/50">
              <CardContent className="pt-6 text-center space-y-3">
                <p className="text-muted-foreground">Nessun video finale generato. Modifica le scene e rimetti in produzione:</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {script.scenes.filter(s => s.videoStatus === "completed" && s.videoUrl).map((s, i) => (
                    <Button key={i} variant="outline" size="sm" disabled={downloadingId === `scene-${i}`} onClick={() => downloadFile(s.videoUrl!, `scena-${s.sceneNumber}.mp4`, `scene-${i}`)}>
                      {downloadingId === `scene-${i}` ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Download className="w-3 h-3 mr-1" />}Scena {s.sceneNumber}
                    </Button>
                  ))}
                </div>
                {/* Failed/missing scenes banner */}
                {(() => {
                  const issues = failedOrMissingScenes(script.scenes);
                  if (issues.length === 0) return null;
                  const details = issues.map(({ scene, index }) => {
                    const missing: string[] = [];
                    if (scene.imageStatus === "error" || !scene.imageUrl) missing.push("Img");
                    if (scene.audioStatus === "error" || !scene.audioUrl) missing.push("Audio");
                    if (scene.videoStatus === "error" || !scene.videoUrl) missing.push("Video");
                    if (scene.sfxStatus === "error") missing.push("SFX");
                    return `Scena ${scene.sceneNumber}: ${missing.join(", ")}`;
                  });
                  return (
                    <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5 space-y-2 text-left">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
                        <p className="text-sm font-medium">{issues.length} scene con asset mancanti o in errore</p>
                      </div>
                      <ul className="text-xs text-muted-foreground space-y-0.5 ml-7">
                        {details.map((d, i) => <li key={i}>• {d}</li>)}
                      </ul>
                      <Button variant="destructive" size="sm" onClick={handleAutoRegenerateErrors} disabled={isGenerating} className="ml-7">
                        {isGenerating && regenProgress ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                        {isGenerating && regenProgress
                          ? `Rigenerando ${regenProgress.current + 1}/${regenProgress.total}…`
                          : `Rigenera Solo Scene Fallite (${issues.length})`}
                      </Button>
                    </div>
                  );
                })()}
                <div className="flex gap-3 justify-center flex-wrap">
                  <Button onClick={() => setStep("script")}>
                    <Pencil className="w-4 h-4 mr-2" />Modifica & Rigenera
                  </Button>
                  {script.scenes.filter(s => s.videoStatus === "completed" && s.videoUrl).length >= 2 && (
                    <Button variant="secondary" onClick={() => { setPendingRenderAction("reassemble"); setShowRenderPreview(true); }} disabled={isGenerating}>
                      {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Film className="w-4 h-4 mr-2" />}
                      Rimonta Video Finale
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => { setStep("input"); setScript(null); setFinalVideoUrl(null); setVideoSegments([]); setBackgroundMusicUrl(null); setProjectId(null); setRenderStatus("idle"); setPendingRenderId(null); }}><RotateCcw className="w-4 h-4 mr-2" />Nuova Storia</Button>
                </div>
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
                aspectRatio={input.videoAspectRatio}
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
                onUnstuck={() => unstuckScene(idx)}
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

      {/* Render preview dialog */}
      {script && (
        <RenderPreviewDialog
          open={showRenderPreview}
          onOpenChange={setShowRenderPreview}
          scenes={script.scenes}
          script={script}
          input={input}
          backgroundMusicUrl={backgroundMusicUrl}
          onConfirmRender={(volumes) => {
            if (pendingRenderAction === "reassemble") {
              handleReassemble(volumes);
            }
            setPendingRenderAction(null);
          }}
          onRegenerateScene={async (sceneIndex, type) => {
            await regenerateSceneAsset(sceneIndex, type);
          }}
        />
      )}
    </div>
  );
};
