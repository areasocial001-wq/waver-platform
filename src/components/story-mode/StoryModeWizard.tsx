import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { getStoredAudioProvider } from "@/lib/audioProviderRouter";
import type { ProviderType } from "@/lib/providerConfig";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AssetWaveform } from "./AssetWaveform";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Upload, Sparkles, Play, Check, ChevronRight, ChevronLeft,
  Film, Image, Volume2, Loader2, Download, RotateCcw, Pencil, Music, RefreshCw,
  Save, FolderOpen, Trash2, Clock, Eye, FileText, Timer, Mic, Square, Pause,
  AlertTriangle, ShieldCheck, ListChecks, AudioLines, Wand2,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { jsPDF } from "jspdf";
import { cn } from "@/lib/utils";
import { StoryScene, StoryScript, StoryStep, StoryModeInput, AssetVersion, AssetVersionHistory, MAX_VERSION_HISTORY } from "./types";
import { SceneCard } from "./SceneCard";
import { BulkTransitionPanel } from "./BulkTransitionPanel";
import { LivePreviewCard } from "./LivePreviewCard";
import { SceneDiagnosticsCard } from "./SceneDiagnosticsCard";
import { PreFlightAudioPanel, computePreFlight, type BatchProgress, type ExpiredAudioItem, type MeasuredAudioDuration } from "./PreFlightAudioPanel";
import { PreFlightVideoPanel, type ProblematicVideoItem, type MeasuredDuration } from "./PreFlightVideoPanel";
import { apiLogger } from "@/lib/apiLogger";
import { useVoiceOptions, INWORLD_VOICE_OPTIONS, DEFAULT_VOICE_OPTIONS } from "@/hooks/useVoiceOptions";
import { useInworldVoices } from "@/hooks/useInworldVoices";
import { resolveTtsEndpoint } from "@/lib/ttsRouting";
import { useQuotas } from "@/hooks/useQuotas";
import { RenderPreviewDialog, type RenderVolumes } from "./RenderPreviewDialog";
import { measureAndValidateAspect, measureAndValidateVideoAspect } from "@/lib/aspectRatioCheck";
import { isAutoRecoveryEnabled, isLockCharacterDefaultEnabled, loadLockCharacterDefaultFromSupabase } from "@/lib/storyModePreferences";
import { getAudioMix } from "@/lib/storyModeAudioMix";
import { appendMusicRetryEntry, loadMusicRetryLog, resetMusicRetryLog, type MusicRetryLog } from "@/lib/musicRetryLog";
import { estimateProjectCost, formatEur, getPricePerSecond } from "@/lib/videoCostEstimator";
import { logVideoCost } from "@/lib/videoCostLogger";
import { getCostAlertThreshold } from "@/lib/costAlertThreshold";
import { buildRenderReport, type RenderReport } from "@/lib/storyModeRenderReport";
import { MusicRetryStatusCard } from "./MusicRetryStatusCard";
import { RenderReportCard } from "./RenderReportCard";
import { MusicSkippedCard, type MusicSkipState } from "./MusicSkippedCard";
import { AudioProviderBadge, type AudioProviderState } from "./AudioProviderBadge";
import { withElevenlabsSlot } from "@/lib/elevenlabsLimiter";
import { buildImageRegenerationPrompt, buildVideoRegenerationPrompt } from "@/lib/storyModePromptBuilder";
import { VIDEO_PROVIDERS, PROVIDER_DISPLAY_ORDER, type VideoProviderType } from "@/lib/videoProviderConfig";
import { applySceneFieldUpdate, applySceneAssetCommit, applyBulkTransition } from "@/lib/storyModeSceneUpdate";

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
  pending_render_id?: string | null;
  render_started_at?: string | null;
}

const MAX_RECOVERY_ATTEMPTS = 3;

// Helper to get auth headers with user's JWT token
const getAuthHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    throw new Error("AUTH_REQUIRED");
  }
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

/**
 * Verify the bytes look like a real MP3 (ID3 tag or MPEG sync 0xFFEx/0xFFFx).
 * Used to fail-fast when ElevenLabs returns a corrupted/empty payload that
 * would otherwise be uploaded silently and produce a mute final video.
 */
const isLikelyMp3Bytes = (bytes: Uint8Array): boolean => {
  if (bytes.length < 4) return false;
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true; // ID3
  if (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0) return true; // MPEG sync
  return false;
};

/**
 * Convert an ElevenLabs edge-function response into an audio Blob.
 *
 * Both `elevenlabs-tts` and `elevenlabs-music` return JSON of the form
 * `{ audioContent: <base64 mp3>, format: "mp3" }`. Calling `response.blob()`
 * directly would yield a JSON-as-text blob (not playable audio) which, once
 * uploaded to storage and fed to Shotstack, results in a SILENT track in the
 * final render. This helper decodes the base64 payload to a real MP3 Blob and
 * THROWS if the decoded bytes are not a valid MP3 — letting the retry wrapper
 * try again instead of uploading garbage.
 */
/**
 * Sentinel error: edge function returned a graceful fallback (e.g. ElevenLabs
 * rate limit / insufficient credits). Caller should swallow it and continue
 * the render WITHOUT that audio track instead of failing the whole story.
 */
class AudioFallbackError extends Error {
  reason: string;
  status?: number;
  constructor(reason: string, message: string, status?: number) {
    super(message);
    this.name = "AudioFallbackError";
    this.reason = reason;
    this.status = status;
  }
}

/**
 * WeakMap that lets `audioResponseToBlob` attach the provider/fallback metadata
 * (parsed from the edge-function JSON envelope) to the produced Blob so callers
 * upstream can read it without changing the function signature.
 */
const audioBlobProviderInfo = new WeakMap<Blob, {
  provider: "elevenlabs" | "aiml" | "openai" | "inworld";
  fallbackUsed: boolean;
  fallbackReason?: string;
}>();

export const getAudioBlobProvider = (b: Blob) => audioBlobProviderInfo.get(b);

const audioResponseToBlob = async (response: Response): Promise<Blob> => {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await response.json();
    // Edge function signaled a graceful fallback (rate limit, no credits, etc.)
    if (data?.fallback === true) {
      throw new AudioFallbackError(
        data?.reason || "audio_fallback",
        data?.error || "Audio non disponibile",
        data?.status,
      );
    }
    const base64: string | undefined = data?.audioContent;
    if (!base64 || typeof base64 !== "string") {
      throw new Error("Risposta audio non valida: campo audioContent mancante");
    }
    // One-shot toast when AIML kicked in as fallback (ElevenLabs out of credits/rate-limited).
    if (data?.fallbackUsed === true && (data?.provider === "aiml" || data?.provider === "openai") && typeof window !== "undefined") {
      const w = window as unknown as { __aimlFallbackToastShown?: boolean };
      if (!w.__aimlFallbackToastShown) {
        w.__aimlFallbackToastShown = true;
        import("sonner").then(({ toast }) => {
          toast.info(
            data?.provider === "openai"
              ? "🔄 Audio generato via OpenAI (provider primario non disponibile)"
              : "🔄 Audio generato via AI/ML API (provider primario non disponibile)",
            {
            description: data?.fallbackReason === "elevenlabs_rate_limited"
              ? "Limite di richieste raggiunto. Provider alternativo attivo."
              : "Crediti del provider primario esauriti. Audio prodotto con il provider di backup.",
            duration: 7000,
          });
        }).catch(() => { /* ignore */ });
      }
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    if (!isLikelyMp3Bytes(bytes) && data?.format !== "wav") {
      throw new Error(`MP3 non valido (${bytes.length} bytes, header non riconosciuto)`);
    }
    const mime = data?.format === "wav" ? "audio/wav" : "audio/mpeg";
    const blob = new Blob([bytes], { type: mime });
    const provider: "elevenlabs" | "aiml" | "openai" | "inworld" =
      data?.provider === "aiml" ? "aiml" :
      data?.provider === "openai" ? "openai" :
      data?.provider === "inworld" ? "inworld" :
      "elevenlabs";
    audioBlobProviderInfo.set(blob, {
      provider,
      fallbackUsed: data?.fallbackUsed === true,
      fallbackReason: typeof data?.fallbackReason === "string" ? data.fallbackReason : undefined,
    });
    return blob;
  }
  return response.blob();
};

/**
 * Fetch an audio endpoint and decode the response with up to N retries.
 * Logs every attempt to apiLogger so the user sees the trail in the logs panel.
 * Retries on network errors, non-2xx status, or invalid MP3 payload.
 * Does NOT retry on AudioFallbackError — that's already a "give up gracefully" signal.
 */
const fetchAudioWithRetry = async (
  url: string,
  init: RequestInit,
  apiName: "ElevenLabs TTS" | "ElevenLabs Music",
  operation: string,
  options: { maxAttempts?: number; baseDelayMs?: number } = {},
): Promise<Blob> => {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelay = options.baseDelayMs ?? 1200;
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const startedAt = Date.now();
    try {
      const response = await fetch(url, init);
      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(`HTTP ${response.status}${errText ? ` – ${errText.slice(0, 120)}` : ""}`);
      }
      const blob = await audioResponseToBlob(response);
      apiLogger.success(apiName, operation, `Tentativo ${attempt}/${maxAttempts} OK (${blob.size} bytes)`, { attempt, bytes: blob.size }, Date.now() - startedAt).catch(() => {});
      return blob;
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Fallback responses are deterministic — retrying won't help.
      if (lastError instanceof AudioFallbackError) {
        apiLogger.warning(apiName, operation, `Fallback: ${lastError.reason} (${lastError.message})`, { reason: lastError.reason, status: lastError.status }).catch(() => {});
        throw lastError;
      }
      apiLogger.warning(apiName, operation, `Tentativo ${attempt}/${maxAttempts} fallito: ${lastError.message}`, { attempt, error: lastError.message, duration_ms: Date.now() - startedAt }).catch(() => {});
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, baseDelay * attempt));
      }
    }
  }
  apiLogger.error(apiName, operation, `Audio non recuperabile dopo ${maxAttempts} tentativi: ${lastError?.message}`, { attempts: maxAttempts }).catch(() => {});
  throw lastError || new Error("Audio fetch failed");
};

const getReadableAuthError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return message === "AUTH_REQUIRED"
    ? "Devi accedere per generare audio con Story Mode."
    : message;
};

/** Measure real duration (s) of an audio Blob via hidden <audio> metadata load. */
const measureAudioBlobDuration = (blob: Blob): Promise<number> => {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const d = isFinite(audio.duration) ? audio.duration : 0;
      URL.revokeObjectURL(url);
      resolve(d);
    };
    audio.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
    audio.src = url;
  });
};

/**
 * Round + clamp a measured TTS duration into a valid scene length the video
 * generator can produce (Kling supports 5 or 10 seconds only). Adds 0.5s of
 * safety padding so the voice never gets cut at the tail.
 */
const adaptDurationToVoice = (measuredSeconds: number, currentSceneDuration: number): number => {
  if (!measuredSeconds || measuredSeconds <= 0) return currentSceneDuration;
  const padded = measuredSeconds + 0.5;
  return padded <= 6 ? 5 : 10;
};

export const StoryModeWizard = () => {
  const { voiceOptions } = useVoiceOptions();
  const { systemVoices: inworldSystemVoices, ivcVoices: inworldIvcVoices, isLoading: isLoadingInworldVoices, refresh: refreshInworldVoices } = useInworldVoices();
  // Combined set of all Inworld voice IDs (SYSTEM + IVC + legacy hardcoded)
  // used everywhere we need to know "is this an Inworld voice?".
  const allInworldVoiceIds = useMemo(() => {
    const ids = new Set<string>();
    INWORLD_VOICE_OPTIONS.forEach(v => ids.add(v.id));
    inworldSystemVoices.forEach(v => ids.add(v.voiceId));
    inworldIvcVoices.forEach(v => ids.add(v.voiceId));
    return ids;
  }, [inworldSystemVoices, inworldIvcVoices]);
  // Unified per-scene voice list: ElevenLabs (default + cloned) + Inworld IVC + Inworld system.
  // Used by every SceneCard so the user can pick a cloned IVC voice (e.g. Marina Official)
  // for an individual scene during the Generation phase, not only as global narrator.
  const sceneVoiceOptions = useMemo(() => {
    const eleven = voiceOptions.map(v => ({
      id: v.id,
      name: v.isCloned ? `🎤 ${v.name}` : v.name,
    }));
    const ivc = inworldIvcVoices.map(v => ({
      id: v.voiceId,
      name: `🎤 ${v.displayName} (Inworld IVC)`,
    }));
    const system = (inworldSystemVoices.length > 0
      ? inworldSystemVoices.map(v => ({ id: v.voiceId, name: `${v.displayName} (Inworld)` }))
      : INWORLD_VOICE_OPTIONS.map(v => ({ id: v.id, name: `${v.name} (Inworld)` })));
    // De-duplicate by id (an Inworld voice could in theory share an ID with another entry)
    const seen = new Set<string>();
    return [...eleven, ...ivc, ...system].filter(v => {
      if (seen.has(v.id)) return false;
      seen.add(v.id);
      return true;
    });
  }, [voiceOptions, inworldIvcVoices, inworldSystemVoices]);
  const { remainingStoryMode, isStoryModeUnlimited, quota, usedStoryMode } = useQuotas();
  const [step, setStep] = useState<StoryStep>("input");
  const [input, setInput] = useState<StoryModeInput>(() => {
    // Restore the user's preferred voice from localStorage if available
    let initialVoiceId = "EXAVITQu4vr4xnSDxMaL";
    try {
      const saved = localStorage.getItem("storyMode.preferredVoiceId");
      if (saved) initialVoiceId = saved;
    } catch { /* ignore */ }
    return {
      imageUrl: "", imageFile: null, styleId: "cinema", styleName: "Cinema",
      stylePromptModifier: "cinematic style, anamorphic lens, professional color grading, film grain, shallow depth of field",
      description: "", language: "it", voiceId: initialVoiceId, ttsProvider: "auto", numScenes: 8,
      videoAspectRatio: "16:9", videoQuality: "hd", videoFps: "24", characterFidelity: "medium",
      videoModel: "auto",
    };
  });
  const [script, setScript] = useState<StoryScript | null>(null);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [regenProgress, setRegenProgress] = useState<{ current: number; total: number } | null>(null);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [videoSegments, setVideoSegments] = useState<string[]>([]);
  const [renderStatus, setRenderStatus] = useState<"idle" | "starting" | "processing" | "completed" | "failed">("idle");
  const [pendingRenderId, setPendingRenderId] = useState<string | null>(null);
  const [renderStartTime, setRenderStartTime] = useState<number | null>(null);
  const [renderElapsed, setRenderElapsed] = useState(0);
  const [renderPollInfo, setRenderPollInfo] = useState<{
    attempts: number;
    lastCheckedAt: number | null;
    lastStatus: string | null;
    consecutiveErrors: number;
    nextCheckInMs: number;
  }>({ attempts: 0, lastCheckedAt: null, lastStatus: null, consecutiveErrors: 0, nextCheckInMs: 0 });
  const [renderTick, setRenderTick] = useState(0);
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
  const [showBatchAudioRegenDialog, setShowBatchAudioRegenDialog] = useState(false);
  const [batchAudioStats, setBatchAudioStats] = useState<{ blob: number; total: number; pct: number } | null>(null);
  const [isBatchRegenAudio, setIsBatchRegenAudio] = useState(false);
  // Detailed progress for the pre-flight regen panels (audio + video). Null = idle.
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
  // Track which projectIds have already triggered auto-recovery so a re-render doesn't loop
  const autoRecoveryFiredRef = useRef<Set<string>>(new Set());
  // Detailed list of expired audio assets (per-scene), used by the batch dialog for selective regeneration
  const [batchAudioDetails, setBatchAudioDetails] = useState<Array<{
    key: string;
    realIdx: number;
    sceneNumber: number;
    type: "audio" | "sfx" | "music";
  }>>([]);
  const [batchSelectedKeys, setBatchSelectedKeys] = useState<Set<string>>(new Set());
  // Final failure dialog: shown when auto-recovery exhausts MAX_RECOVERY_ATTEMPTS
  const [showRecoveryFailureDialog, setShowRecoveryFailureDialog] = useState(false);
  const [recoveryFailureAssets, setRecoveryFailureAssets] = useState<Array<{ type: string; index?: number; sceneNumber?: number }>>([]);
  const [recoveryFailureContext, setRecoveryFailureContext] = useState<"reassemble" | "generateAll" | null>(null);
  const [savedProjectsTick, setSavedProjectsTick] = useState(0);
  // Global user pref: lock character identity by default on every regeneration.
  // Hydrated from localStorage immediately, then refreshed from Supabase.
  const [lockCharacterDefault, setLockCharacterDefault] = useState<boolean>(isLockCharacterDefaultEnabled());
  useEffect(() => {
    void loadLockCharacterDefaultFromSupabase().then(setLockCharacterDefault);
  }, []);
  const downloadFile = useDownloadFile(setDownloadingId);
  const pauseRef = useRef(false);
  const cancelRef = useRef(false);
  const recoveryAttemptsRef = useRef(0);
  // Tracks how many times we already retried regenerating background music after
  // the post-render verification failed. Capped at 1 — if it still fails, we
  // surface a warning to the user instead of looping forever.
  const musicRetryRef = useRef(0);
  const MAX_MUSIC_RETRIES = 1;
  const [musicVerification, setMusicVerification] = useState<{
    audible: boolean | null;
    checkedAt: number | null;
    retried: boolean;
    sizeBytes?: number;
    contentType?: string;
  } | null>(null);
  // Persistent log of every verifyMusic / regenerate / reassemble attempt for the
  // current project. Survives reloads via localStorage (see lib/musicRetryLog.ts).
  const [musicRetryLog, setMusicRetryLog] = useState<MusicRetryLog>(() => loadMusicRetryLog(null));
  // Post-render audio QA report — built automatically once the render completes.
  const [renderReport, setRenderReport] = useState<RenderReport | null>(null);
  const [renderReportLoading, setRenderReportLoading] = useState(false);
  // Set when generateBackgroundMusic gives up because of an ElevenLabs fallback
  // (rate limit / no credits / etc.). Cleared after a successful retry.
  const [musicSkip, setMusicSkip] = useState<MusicSkipState | null>(null);
  const [retryingMusicOnly, setRetryingMusicOnly] = useState(false);
  // Tracks which provider produced the most recent audio per op (TTS / music / SFX),
  // so we can surface a small badge in the UI when the AIML fallback kicks in.
  const [audioProviders, setAudioProviders] = useState<{
    tts: AudioProviderState | null;
    music: AudioProviderState | null;
    sfx: AudioProviderState | null;
  }>({ tts: null, music: null, sfx: null });

  const resolveRenderVideoSource = useCallback(async (url: string) => {
    if (!url) return null;

    if (url.startsWith("storage://")) {
      const path = url.replace("storage://", "");
      const bucketName = path.split("/")[0];
      const filePath = path.substring(bucketName.length + 1);
      const { data, error } = await supabase.storage.from(bucketName).createSignedUrl(filePath, 60 * 60 * 2);
      return error || !data?.signedUrl ? null : data.signedUrl;
    }

    if (url.includes("/functions/v1/video-proxy")) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } : {},
        });

        if (!res.ok) return null;

        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const payload = await res.json().catch(() => null);
          if (payload?.error) return null;
        }

        return url;
      } catch {
        return null;
      }
    }

    return url.startsWith("http") ? url : null;
  }, []);

  const prepareRenderVideoSources = useCallback(async (scenes: StoryScene[]) => {
    const resolved = await Promise.all(
      scenes.map(async (scene, index) => ({
        index,
        sceneNumber: scene.sceneNumber,
        resolvedUrl: scene.videoUrl ? await resolveRenderVideoSource(scene.videoUrl) : null,
      }))
    );

    const invalidSceneNumbers = resolved
      .filter((item) => !item.resolvedUrl)
      .map((item) => item.sceneNumber);

    // Indexes (in original `scenes` array) of valid clips — caller MUST use these
    // to filter clipDurations/audioUrls/sfxUrls/transitions in parallel, otherwise
    // arrays go out of sync and Shotstack drops the last clip.
    const validIndexes = resolved
      .filter((item) => !!item.resolvedUrl)
      .map((item) => item.index);

    return {
      validVideoUrls: resolved.map((item) => item.resolvedUrl).filter((url): url is string => !!url),
      validIndexes,
      invalidSceneNumbers,
    };
  }, [resolveRenderVideoSource]);

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

  /**
   * Resolve which TTS edge function to call based on the project provider
   * preference and the voice ID. Inworld voices and Inworld preference go
   * to "inworld-tts"; cloned ElevenLabs voices always stay on ElevenLabs.
   */
  const getTtsEndpointFor = useCallback((voiceId: string) => {
    const isInworldVoice = allInworldVoiceIds.has(voiceId);
    const pref = input.ttsProvider ?? "auto";
    // Inworld voices (SYSTEM or IVC) always go to Inworld
    if (isInworldVoice) return "inworld-tts";
    // For ElevenLabs voice IDs: defer to resolveTtsEndpoint which correctly
    // forces ElevenLabs for cloned voices (like "Marina") even when the user
    // picked Inworld — cloned timbres cannot be reproduced by another provider.
    const { endpoint } = resolveTtsEndpoint({
      preference: (pref === "auto" || (pref as string) === "elevenlabs" ? "inworld" : pref) as ProviderType,
      voiceId,
    });
    return endpoint;
  }, [input.ttsProvider, allInworldVoiceIds]);

  const ttsUrl = useCallback((voiceId: string) =>
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${getTtsEndpointFor(voiceId)}`,
    [getTtsEndpointFor],
  );

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
      const response = await withElevenlabsSlot(() => fetch(ttsUrl(voiceId), {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ text: sampleText, voiceId, language_code: input.language, languageCode: input.language }),
      }));
      if (!response.ok) {
        const errBody = await response.text().catch(() => "");
        console.error("[previewVoice] HTTP", response.status, errBody);
        throw new Error(`Preview failed (${response.status})`);
      }
      const blob = await audioResponseToBlob(response);
      const audio = new Audio(URL.createObjectURL(blob));
      audio.onended = () => { setIsPreviewingVoice(false); setVoicePreviewAudio(null); };
      setVoicePreviewAudio(audio);
      audio.play();
    } catch (e) {
      console.error("[previewVoice] error:", e);
      toast.error("Errore anteprima voce");
    }
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
    setRenderPollInfo({ attempts: 0, lastCheckedAt: null, lastStatus: "queued", consecutiveErrors: 0, nextCheckInMs: 8000 });
    const poll = async () => {
      let consecutiveErrors = 0;
      let attempts = 0;
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
        setRenderPollInfo(p => ({ ...p, nextCheckInMs: interval }));
        await new Promise(r => setTimeout(r, interval));
        if (cancelled) break;
        attempts++;
        try {
          const { data, error } = await supabase.functions.invoke("video-concat", {
            body: { pollRenderId: pendingRenderId },
          });
          if (error) {
            consecutiveErrors++;
            console.error(`Poll error (${consecutiveErrors}):`, error);
            setRenderPollInfo(p => ({ ...p, attempts, lastCheckedAt: Date.now(), lastStatus: "error", consecutiveErrors }));
            if (consecutiveErrors >= 5) {
              setRenderStatus("failed");
              setPendingRenderId(null);
              toast.error("Errori ripetuti durante il polling. Riprova manualmente.");
              break;
            }
            continue;
          }
          consecutiveErrors = 0;
          setRenderPollInfo(p => ({ ...p, attempts, lastCheckedAt: Date.now(), lastStatus: data?.status ?? "processing", consecutiveErrors: 0 }));
          if (data?.status === "completed" && data?.videoUrl) {
            setFinalVideoUrl(data.videoUrl);
            setRenderStatus("completed");
            setPendingRenderId(null);
            toast.success("Video finale pronto! 🎬");
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("Video pronto! 🎬", { body: "Il tuo video finale è stato renderizzato con successo.", icon: "/favicon.ico" });
            }
            setTimeout(() => saveProject(), 500);
            // Fire-and-forget post-render music verification (does not block UI).
            // If the rendered MP4 has no audible track and we did request music,
            // regenerate music + reassemble once.
            void verifyAndRetryMusic(data.videoUrl);
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
          setRenderPollInfo(p => ({ ...p, attempts, lastCheckedAt: Date.now(), lastStatus: "error", consecutiveErrors }));
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
      setRenderTick(t => t + 1);
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
  const isRenderActive = renderStatus === "starting" || renderStatus === "processing" || !!pendingRenderId;
  const showRenderDiagnostics = isRenderActive || renderStatus === "failed" || renderPollInfo.attempts > 0 || !!renderPollInfo.lastStatus || !!renderPollInfo.lastCheckedAt;

  const [projectId, setProjectId] = useState<string | null>(null);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showProjectList, setShowProjectList] = useState(false);

  // Re-hydrate per-project music retry log whenever we switch project.
  useEffect(() => {
    setMusicRetryLog(loadMusicRetryLog(projectId ?? null));
  }, [projectId]);

  // Persist pendingRenderId to DB so polling can resume after page reload
  useEffect(() => {
    if (!projectId) return;
    supabase.from("story_mode_projects").update({
      pending_render_id: pendingRenderId,
      render_started_at: pendingRenderId && renderStartTime ? new Date(renderStartTime).toISOString() : null,
    } as any).eq("id", projectId).then(() => {});
  }, [pendingRenderId, renderStartTime, projectId]);

  // ── Auto-save transition/duration edits to backend (debounced 1.5s) ─────
  // Only fires when the per-scene transition fingerprint changes — so editing
  // a transition or scene duration on the review/generation step is persisted
  // silently within ~1.5s, even if the user never clicks "Salva progetto".
  // Skips: no project loaded yet, or no script.
  const transitionFingerprint = script
    ? JSON.stringify(
        script.scenes.map((s) => [
          s.transition ?? null,
          s.transitionDuration ?? null,
          s.duration,
          s.voiceId ?? null,
        ]),
      )
    : "";
  const lastSavedFingerprintRef = useRef<string>("");
  // Seed the ref when a project is loaded so the first edit triggers save,
  // but the initial hydrate doesn't.
  useEffect(() => {
    if (projectId && script && lastSavedFingerprintRef.current === "") {
      lastSavedFingerprintRef.current = transitionFingerprint;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, script]);
  useEffect(() => {
    if (!projectId || !script) return;
    if (transitionFingerprint === lastSavedFingerprintRef.current) return;
    const handle = window.setTimeout(async () => {
      // Re-check inside the timer in case state changed.
      if (transitionFingerprint === lastSavedFingerprintRef.current) return;
      try {
        const { error } = await supabase
          .from("story_mode_projects")
          .update({ scenes: script.scenes as any })
          .eq("id", projectId);
        if (!error) {
          lastSavedFingerprintRef.current = transitionFingerprint;
        }
      } catch (_) {
        // Silent — auto-save shouldn't interrupt the user.
      }
    }, 1500);
    return () => window.clearTimeout(handle);
  }, [transitionFingerprint, projectId, script]);

  useEffect(() => { loadProjectList(); }, []);

  const loadProjectList = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("story_mode_projects")
      .select("id, title, status, created_at, updated_at, pending_render_id, render_started_at")
      .eq("user_id", user.id).order("updated_at", { ascending: false }).limit(20);
    if (data) setSavedProjects(data as any);
  };

  // Tick every 30s to refresh "Xm trascorsi" badge in the saved-projects list
  useEffect(() => {
    if (!showProjectList) return;
    const hasActive = savedProjects.some(p => p.pending_render_id);
    if (!hasActive) return;
    const t = setInterval(() => setSavedProjectsTick(v => v + 1), 30000);
    return () => clearInterval(t);
  }, [showProjectList, savedProjects]);


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
      videoModel: config.videoModel || "auto",
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
              const _voiceId = sc.voiceId || config.voiceId || "EXAVITQu4vr4xnSDxMaL";
              const r = await withElevenlabsSlot(() => fetch(ttsUrl(_voiceId), {
                method: "POST", headers: authHeaders,
                body: JSON.stringify({ text: sc.narration, voiceId: _voiceId, language_code: config.language || "it", languageCode: config.language || "it" }),
              }));
              if (!r.ok) continue;
              const blob = await audioResponseToBlob(r);
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
    // Use functional updater to avoid stale-state overwrites: long-running
    // async flows (regen image/video/audio) must NOT clobber edits the user
    // makes on other scenes (e.g. changing a transition) while they wait.
    setScript((prev) => applySceneFieldUpdate(prev, index, field, value));
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
      const _voiceId = scene.voiceId || input.voiceId;
      const response = await withElevenlabsSlot(() => fetch(ttsUrl(_voiceId), {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ text: scene.narration, voiceId: _voiceId, language_code: input.language, languageCode: input.language }),
      }));
      if (!response.ok) throw new Error("TTS preview failed");
      const blob = await audioResponseToBlob(response);
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

  // Push a previous asset URL into the per-scene version history (newest first, capped).
  const pushVersionHistory = (
    scene: StoryScene,
    type: "image" | "audio" | "video" | "sfx",
    prevUrl: string | undefined,
    correctionNote?: string,
  ): AssetVersionHistory => {
    const history: AssetVersionHistory = { ...(scene.versionHistory || {}) };
    if (!prevUrl) return history;
    const entry: AssetVersion = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      url: prevUrl,
      createdAt: Date.now(),
      correctionNote,
    };
    const list = history[type] || [];
    // Avoid duplicate entries for the same url (e.g. rapid double-regens with same fallback)
    const filtered = list.filter(v => v.url !== prevUrl);
    history[type] = [entry, ...filtered].slice(0, MAX_VERSION_HISTORY);
    return history;
  };

  // Regenerate single scene asset
  // `correctionNote` (optional, image+video) is appended to the original prompt to guide the regen.
  const regenerateSceneAsset = async (
    index: number,
    type: "image" | "audio" | "video" | "sfx",
    correctionNote?: string,
    options?: { lockCharacter?: boolean },
  ) => {
    if (!script) return;
    const scene = script.scenes[index];
    setRegeneratingScene({ idx: index, type });

    // Effective lock-character: explicit option wins → fallback to sticky scene pref → fallback to global default.
    const effectiveLockCharacter =
      options?.lockCharacter ?? scene.lockCharacter ?? lockCharacterDefault;

    try {
      if (type === "image") {
        if (!input.imageUrl && refImageError) {
          toast.error("Ricarica l'immagine di riferimento prima di generare.");
          return;
        }
        updateScene(index, "imageStatus", "generating");
        const referenceImageUrl = input.imageUrl || undefined;
        const fluxDims = input.videoAspectRatio === "9:16"
          ? { width: 720, height: 1280 }
          : input.videoAspectRatio === "4:3"
          ? { width: 1024, height: 768 }
          : { width: 1280, height: 720 };
        const { prompt: guidedPrompt, effectiveCorrectionNote } = buildImageRegenerationPrompt({
          scene,
          stylePrompt: input.stylePromptModifier,
          aspectRatio: input.videoAspectRatio,
          previousCorrectionNote: scene.lastImageCorrectionNote,
          nextCorrectionNote: correctionNote,
          lockCharacter: effectiveLockCharacter,
        });
        const { data, error } = await supabase.functions.invoke("generate-image", {
          body: { prompt: guidedPrompt, model: "flux", style: input.stylePromptModifier, aspectRatio: input.videoAspectRatio, ...fluxDims, ...(referenceImageUrl ? { referenceImageUrl, characterFidelity: input.characterFidelity } : {}) },
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
        setScript((prev) => {
          if (!prev) return prev;
          const scenes = [...prev.scenes];
          const p = scenes[index];
          if (!p) return prev;
          const newHistory = pushVersionHistory(p, "image", p.imageUrl && p.imageUrl !== newImageUrl ? p.imageUrl : undefined, p.lastImageCorrectionNote);
          scenes[index] = {
            ...p,
            // Keep previous image as backup so the user can compare or rollback (legacy single-slot).
            previousImageUrl: p.imageUrl && p.imageUrl !== newImageUrl ? p.imageUrl : p.previousImageUrl,
            imageUrl: newImageUrl,
            imageStatus: "completed",
            imageWidth: aspectCheck?.width,
            imageHeight: aspectCheck?.height,
            imageAspectWarning: aspectCheck?.mismatch ? aspectCheck.warning : undefined,
            lastImageCorrectionNote: effectiveCorrectionNote || p.lastImageCorrectionNote,
            versionHistory: newHistory,
          };
          return { ...prev, scenes };
        });
        if (aspectCheck?.mismatch) {
          toast.warning(`Scena ${index + 1}: ${aspectCheck.warning}`, { duration: 6000 });
        } else {
          toast.success(`Immagine scena ${index + 1} rigenerata${effectiveCorrectionNote ? " con correzione" : ""}`);
        }
      } else if (type === "audio") {
        updateScene(index, "audioStatus", "generating");
        const authHeaders = await getAuthHeaders();
        const _voiceId = scene.voiceId || input.voiceId;
        const response = await withElevenlabsSlot(() => fetch(ttsUrl(_voiceId), {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ text: scene.narration, voiceId: _voiceId, language_code: input.language, languageCode: input.language }),
        }));
        if (!response.ok) throw new Error("TTS failed");
        const blob = await audioResponseToBlob(response);
        const storageUrl = await uploadBlobToStorage(blob, "story-narration", "mp3", `Narrazione Scena ${index + 1}`);
        setScript((prev) => {
          if (!prev) return prev;
          const scenes = [...prev.scenes];
          const prevA = scenes[index];
          if (!prevA) return prev;
          const newHistoryA = pushVersionHistory(prevA, "audio", prevA.audioUrl && prevA.audioUrl !== storageUrl ? prevA.audioUrl : undefined);
          scenes[index] = {
            ...prevA,
            previousAudioUrl: prevA.audioUrl && prevA.audioUrl !== storageUrl ? prevA.audioUrl : prevA.previousAudioUrl,
            audioUrl: storageUrl,
            audioStatus: "completed",
            versionHistory: newHistoryA,
          };
          return { ...prev, scenes };
        });
        toast.success(`Audio scena ${index + 1} rigenerato`);
      } else if (type === "video") {
        if (!scene.imageUrl) { toast.error("Genera prima l'immagine"); return; }
        const startedAt = Date.now();
        setScript((prev) => {
          if (!prev) return prev;
          const scenes0 = [...prev.scenes];
          if (!scenes0[index]) return prev;
          scenes0[index] = { ...scenes0[index], videoStatus: "generating", videoGeneratingStartedAt: startedAt };
          return { ...prev, scenes: scenes0 };
        });
        const { prompt: guidedVideoPrompt, effectiveCorrectionNote: effectiveVideoCorrection } = buildVideoRegenerationPrompt({
          scene,
          stylePrompt: input.stylePromptModifier,
          aspectRatio: input.videoAspectRatio,
          previousCorrectionNote: scene.lastVideoCorrectionNote,
          nextCorrectionNote: correctionNote,
          lockCharacter: effectiveLockCharacter,
        });
        const { data, error } = await supabase.functions.invoke("generate-video", {
          body: {
            prompt: guidedVideoPrompt,
            image_url: scene.imageUrl, type: "image_to_video",
            duration: Math.min(scene.duration, 10), model: "kling-2.1",
            aspect_ratio: input.videoAspectRatio,
            ...(input.videoModel && input.videoModel !== "auto" ? { preferredProvider: input.videoModel } : {}),
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
        setScript((prev) => {
          if (!prev) return prev;
          const scenes = [...prev.scenes];
          const prevV = scenes[index];
          if (!prevV) return prev;
          const newHistoryV = pushVersionHistory(prevV, "video", prevV.videoUrl && prevV.videoUrl !== videoUrl ? prevV.videoUrl : undefined, prevV.lastVideoCorrectionNote);
          scenes[index] = {
            ...prevV,
            previousVideoUrl: prevV.videoUrl && prevV.videoUrl !== videoUrl ? prevV.videoUrl : prevV.previousVideoUrl,
            videoUrl,
            videoStatus: "completed",
            videoGeneratingStartedAt: undefined,
            videoWidth: videoCheck?.width,
            videoHeight: videoCheck?.height,
            videoAspectWarning: videoCheck?.mismatch ? videoCheck.warning : undefined,
            lastVideoCorrectionNote: effectiveVideoCorrection || prevV.lastVideoCorrectionNote,
            versionHistory: newHistoryV,
          };
          return { ...prev, scenes };
        });
        // Logga costo stimato di questa rigenerazione
        void logVideoCost({
          provider: input.videoModel ?? "auto",
          secondsBilled: Math.min(scene.duration, 10),
          storyProjectId: projectId ?? null,
          sceneIndex: index,
          status: "success",
          metadata: {
            source: "regen_single_scene",
            prompt: scene.videoPrompt || scene.imagePrompt || scene.description,
            requestedDuration: scene.duration,
            sceneTitle: scene.title,
          },
        });
        if (videoCheck?.mismatch) {
          toast.warning(`Scena ${index + 1}: ${videoCheck.warning}`, { duration: 6000 });
        } else {
          toast.success(`Video scena ${index + 1} rigenerato${effectiveVideoCorrection ? " con correzione" : ""}`);
        }
      } else if (type === "sfx") {
        const sfxPrompt = scene.sfxPrompt || scene.mood || "ambient background";
        updateScene(index, "sfxStatus", "generating");
        const authHeaders = await getAuthHeaders();
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-sfx`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ text: sfxPrompt, duration_seconds: Math.min(scene.duration, 22), provider: getStoredAudioProvider("sound_effects") }),
        });
        const ct = response.headers.get("content-type") || "";
        if (!response.ok || ct.includes("application/json")) {
          const info = ct.includes("application/json") ? await response.json().catch(() => ({})) : {};
          const reason = (info as any)?.reason || `http_${response.status}`;
          throw new Error(`SFX non disponibile (${reason})`);
        }
        const blob = await response.blob();
        const storageUrl = await uploadBlobToStorage(blob, "story-sfx", "mp3", `SFX Scena ${index + 1}`);
        setScript((prev) => {
          if (!prev) return prev;
          const scenes = [...prev.scenes];
          const prevS = scenes[index];
          if (!prevS) return prev;
          const newHistoryS = pushVersionHistory(prevS, "sfx", prevS.sfxUrl && prevS.sfxUrl !== storageUrl ? prevS.sfxUrl : undefined);
          scenes[index] = {
            ...prevS,
            previousSfxUrl: prevS.sfxUrl && prevS.sfxUrl !== storageUrl ? prevS.sfxUrl : prevS.previousSfxUrl,
            sfxUrl: storageUrl,
            sfxStatus: "completed",
            versionHistory: newHistoryS,
          };
          return { ...prev, scenes };
        });
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

  // Discard the previous (backup) version of an asset, keeping the new one as final.
  const keepNewAsset = (index: number, type: "image" | "audio" | "video" | "sfx") => {
    if (!script) return;
    const scenes = [...script.scenes];
    const s = { ...scenes[index] };
    if (type === "image") delete s.previousImageUrl;
    else if (type === "audio") delete s.previousAudioUrl;
    else if (type === "video") delete s.previousVideoUrl;
    else delete s.previousSfxUrl;
    scenes[index] = s;
    setScript({ ...script, scenes });
    toast.success(`Nuovo ${type} scena ${index + 1} confermato`);
  };

  // Roll back to a previous version. If `versionUrl` is given, restore that specific entry from history.
  // Otherwise, restore the legacy single-slot `previousXxxUrl`.
  // The currently active asset is pushed onto the history stack so it's not lost (round-trip safe).
  const rollbackAsset = (
    index: number,
    type: "image" | "audio" | "video" | "sfx",
    versionUrl?: string,
  ) => {
    if (!script) return;
    const scenes = [...script.scenes];
    const s = { ...scenes[index] };
    let targetUrl: string | undefined;
    let currentUrl: string | undefined;

    if (type === "image") currentUrl = s.imageUrl;
    else if (type === "audio") currentUrl = s.audioUrl;
    else if (type === "video") currentUrl = s.videoUrl;
    else currentUrl = s.sfxUrl;

    if (versionUrl) {
      targetUrl = versionUrl;
    } else {
      if (type === "image") targetUrl = s.previousImageUrl;
      else if (type === "audio") targetUrl = s.previousAudioUrl;
      else if (type === "video") targetUrl = s.previousVideoUrl;
      else targetUrl = s.previousSfxUrl;
    }
    if (!targetUrl) return;

    // Push current asset to history before swapping (so it can be restored back).
    s.versionHistory = pushVersionHistory(s, type, currentUrl);
    // Remove the restored entry from history (avoid duplicate of "current").
    if (s.versionHistory[type]) {
      s.versionHistory[type] = s.versionHistory[type]!.filter(v => v.url !== targetUrl);
    }

    if (type === "image") {
      s.imageUrl = targetUrl;
      delete s.previousImageUrl;
      delete s.imageAspectWarning;
      s.imageWidth = undefined;
      s.imageHeight = undefined;
    } else if (type === "audio") {
      s.audioUrl = targetUrl;
      delete s.previousAudioUrl;
    } else if (type === "video") {
      s.videoUrl = targetUrl;
      delete s.previousVideoUrl;
      delete s.videoAspectWarning;
      s.videoWidth = undefined;
      s.videoHeight = undefined;
    } else {
      s.sfxUrl = targetUrl;
      delete s.previousSfxUrl;
    }
    scenes[index] = s;
    setScript({ ...script, scenes });
    toast.info(`Versione ${type} scena ${index + 1} ripristinata`);
  };

  // Permanently delete a specific entry from the version history.
  const deleteVersion = (
    index: number,
    type: "image" | "audio" | "video" | "sfx",
    versionUrl: string,
  ) => {
    if (!script) return;
    const scenes = [...script.scenes];
    const s = { ...scenes[index] };
    if (!s.versionHistory?.[type]) return;
    s.versionHistory = {
      ...s.versionHistory,
      [type]: s.versionHistory[type]!.filter(v => v.url !== versionUrl),
    };
    scenes[index] = s;
    setScript({ ...script, scenes });
    toast.success(`Versione ${type} eliminata dallo storico`);
  };

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

  // Infer a CONTINUOUS ambience bed (wind, sea, forest, rain) from scene content.
  // This is meant to play softly under the entire scene — never punctual hits.
  const inferAmbiencePrompt = (scene: Pick<StoryScene, "mood" | "narration" | "imagePrompt" | "ambiencePrompt">): string => {
    const explicit = scene.ambiencePrompt?.trim();
    if (explicit) return explicit;

    const combined = `${scene.narration || ""} ${scene.imagePrompt || ""} ${scene.mood || ""}`.toLowerCase();

    if (/(mare|sea|ocean|beach|spiaggia|shore|coast|waves?|onde?|surf|seagull|gabbian|scogliera)/i.test(combined)) {
      return "continuous gentle seaside ambience: soft sea waves and coastal wind, distant seabirds, no horror stingers, no impacts, no music, smooth uninterrupted bed";
    }
    if (/(forest|woods|bosco|foresta|leaves|foglie|river|stream|creek|ruscello)/i.test(combined)) {
      return "continuous natural ambience: soft wind through leaves, distant birds, light water movement, no music, no cinematic hits, smooth uninterrupted bed";
    }
    if (/(rain|pioggia|storm|tempesta|thunder|tuono)/i.test(combined)) {
      return "continuous weather ambience: soft steady rain and controlled wind bed, far thunder, no jump scares, no music, smooth uninterrupted bed";
    }
    if (/(vento|wind|breeze|aria)/i.test(combined)) {
      return "continuous gentle wind ambience: light breeze through open space, no impacts, no music, smooth uninterrupted bed";
    }

    const m = (scene.mood || "").toLowerCase();
    const ambienceMap: Record<string, string> = {
      outdoor: "gentle wind through trees, soft birds in the distance, no music, continuous bed",
      nature: "soft forest ambience, gentle stream, birds singing, continuous bed",
      city: "low city ambience, distant traffic, light crowd murmur, continuous bed",
      urban: "low urban ambience, distant cars, faint city hum, continuous bed",
      night: "soft night ambience: crickets, gentle breeze, very low and steady",
      ocean: "soft ocean waves and wind, continuous bed, no impacts",
      beach: "soft beach waves and gentle wind, continuous bed",
      forest: "soft forest ambience: rustling leaves, distant birds, continuous bed",
      desert: "soft desert wind, very steady, continuous bed",
      space: "deep low space ambience, soft electronic hum, continuous bed",
      calm: "soft natural ambience: gentle breeze, distant birds, continuous bed",
      peaceful: "soft meadow ambience: gentle wind, soft birdsong, continuous bed",
    };
    for (const [key, prompt] of Object.entries(ambienceMap)) {
      if (m.includes(key)) return prompt;
    }
    // Generic safe fallback — never horror/dramatic.
    return `subtle environmental ambience matching a ${scene.mood || "neutral"} scene, soft continuous background bed, no music, no stingers, no loud cinematic hits`;
  };

  // Infer PUNCTUAL sound effects only when the scene clearly has discrete events
  // (footsteps, doors, impacts). Returns null when nothing punctual is needed —
  // in that case we skip SFX generation entirely so it never fights with voice.
  const inferSfxPrompt = (scene: Pick<StoryScene, "mood" | "narration" | "imagePrompt" | "sfxPrompt">): string | null => {
    const explicit = scene.sfxPrompt?.trim();
    if (explicit) return explicit;

    const combined = `${scene.narration || ""} ${scene.imagePrompt || ""}`.toLowerCase();
    if (/(footstep|passi|porta\b|door|bussare|knock|spada|sword|shot|sparo|explosion|esplosione|crash|schianto|campana|bell|telefono|phone|clock|orologio|gun|fire|fuoco)/i.test(combined)) {
      return "subtle punctual sound effects matching the scene actions, low volume, no music, no continuous bed, just discrete hits";
    }
    return null;
  };

  /** @deprecated kept for backward compatibility — alias to ambience prompt. */
  const inferAmbientSfxPrompt = inferAmbiencePrompt;

  // Generate punctual SFX for a scene (returns null if no SFX is needed)
  const generateSceneSfx = async (scene: StoryScene): Promise<string | null> => {
    const sfxPrompt = inferSfxPrompt(scene);
    if (!sfxPrompt) return null;
    try {
      const authHeaders = await getAuthHeaders();
      const response = await withElevenlabsSlot(() => fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-sfx`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ text: sfxPrompt, duration_seconds: Math.min(scene.duration, 12), provider: getStoredAudioProvider("sound_effects") }),
      }));
      const ct = response.headers.get("content-type") || "";
      if (!response.ok || ct.includes("application/json")) {
        const info = ct.includes("application/json") ? await response.json().catch(() => ({})) : {};
        console.warn("SFX skipped:", (info as any)?.reason || response.status, (info as any)?.providerMessage);
        return null;
      }
      const blob = await response.blob();
      const storageUrl = await uploadBlobToStorage(blob, "story-sfx", "mp3", `SFX Scena`);
      return storageUrl;
    } catch (err) {
      console.error("SFX generation error:", err);
      return null;
    }
  };

  // Generate continuous ambience bed for a scene (always returns a prompt).
  const generateSceneAmbience = async (scene: StoryScene): Promise<string | null> => {
    const ambiencePrompt = inferAmbiencePrompt(scene);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await withElevenlabsSlot(() => fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-sfx`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ text: ambiencePrompt, duration_seconds: Math.min(scene.duration, 22), provider: getStoredAudioProvider("sound_effects") }),
      }));
      const ct = response.headers.get("content-type") || "";
      if (!response.ok || ct.includes("application/json")) {
        const info = ct.includes("application/json") ? await response.json().catch(() => ({})) : {};
        console.warn("Ambience skipped:", (info as any)?.reason || response.status, (info as any)?.providerMessage);
        return null;
      }
      const blob = await response.blob();
      const storageUrl = await uploadBlobToStorage(blob, "story-ambience", "mp3", `Ambience Scena`);
      return storageUrl;
    } catch (err) {
      console.error("Ambience generation error:", err);
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
      // Total video duration = sum of every scene (capped to 300s by the edge fn).
      // We deliberately request ONE long unified track instead of per-scene tracks
      // so the music never restarts/cuts between scenes during crossfades.
      const totalDuration = Math.min(
        Math.max(script.scenes.reduce((a, s) => a + s.duration, 0), 10),
        300,
      );
      toast.info(`Generazione colonna sonora unica (${totalDuration}s)…`);
      const authHeaders = await getAuthHeaders();
      // Funnel through the global ElevenLabs concurrency limiter (max 2 in-flight)
      // so this music call never collides with parallel TTS/SFX/ambience calls.
      const blob = await withElevenlabsSlot(() => fetchAudioWithRetry(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-music`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ prompt: script.suggestedMusic, category: "music", duration: totalDuration, provider: getStoredAudioProvider("music_generation") }),
        },
        "ElevenLabs Music",
        "story-mode/background",
        { maxAttempts: 3 },
      ));
      const storageUrl = await uploadBlobToStorage(blob, "story-music", "mp3", "Colonna sonora");
      const provInfo = getAudioBlobProvider(blob);
      setAudioProviders(prev => ({
        ...prev,
        music: {
          op: "music",
          provider: provInfo?.provider ?? "elevenlabs",
          fallbackUsed: provInfo?.fallbackUsed === true,
          reason: provInfo?.fallbackReason,
          at: Date.now(),
        },
      }));
      setBackgroundMusicUrl(storageUrl);
      setMusicSkip(null); // success → clear any previous skip banner
      toast.success("Colonna sonora generata! 🎵");
      return storageUrl;
    } catch (err: any) {
      console.error("Music error:", err);
      if (err?.name === "AudioFallbackError") {
        const reason = err.reason as string;
        const friendly =
          reason === "elevenlabs_rate_limited"
            ? "Provider audio ha rifiutato la richiesta musica per limite di richieste concorrenti. Story Mode procede senza colonna sonora."
            : reason === "elevenlabs_insufficient_credits" || reason === "elevenlabs_unauthorized"
              ? "Crediti del provider audio insufficienti per generare la musica. Story Mode procede senza colonna sonora."
              : `Musica non disponibile (${reason}). Story Mode procede senza colonna sonora.`;
        toast.warning(friendly);
        setMusicSkip({ reason, message: friendly, at: Date.now() });
        return null;
      }
      toast.error(`Errore colonna sonora: ${err?.message || "sconosciuto"}`);
      setMusicSkip({
        reason: "generic_error",
        message: `Errore colonna sonora: ${err?.message || "sconosciuto"}`,
        at: Date.now(),
      });
      return null;
    }
  };

  /**
   * Manual retry triggered from the MusicSkippedCard. Regenerates only the
   * background music and, if a final video already exists, re-runs the
   * post-render verify+retry flow so the new track gets remixed in.
   */
  const retryMusicOnly = async () => {
    if (retryingMusicOnly) return;
    setRetryingMusicOnly(true);
    try {
      const newUrl = await generateBackgroundMusic();
      if (newUrl && finalVideoUrl) {
        // Reset the verify-retry counter so the manual retry isn't blocked by
        // the cap from a previous automatic attempt.
        musicRetryRef.current = 0;
        await verifyAndRetryMusic(finalVideoUrl);
      }
    } finally {
      setRetryingMusicOnly(false);
    }
  };

  /**
   * Post-render music verification: probes the rendered MP4 server-side for an
   * audible audio track, and — when we DID send a backgroundMusicUrl but the
   * track ends up missing/silent — regenerates only the music and triggers a
   * single reassemble retry. Capped by MAX_MUSIC_RETRIES to avoid infinite loops.
   */
  const verifyAndRetryMusic = async (renderedVideoUrl: string): Promise<void> => {
    if (!renderedVideoUrl) return;
    const pid = projectId ?? null;
    setMusicRetryLog(appendMusicRetryEntry(pid, { stage: "verify-start", note: renderedVideoUrl.slice(0, 80) }));
    try {
      const { data, error } = await supabase.functions.invoke("video-concat", {
        body: { verifyMusic: { renderedVideoUrl } },
      });
      if (error) {
        console.warn("[music-verify] probe error:", error);
        setMusicRetryLog(appendMusicRetryEntry(pid, { stage: "verify-error", note: String(error.message || error) }));
        // Still trigger an audio report so the user has SOMETHING to inspect.
        void runRenderReport(renderedVideoUrl, null);
        return;
      }
      const audible = !!data?.audible;
      setMusicVerification({
        audible,
        checkedAt: Date.now(),
        retried: musicRetryRef.current > 0,
        sizeBytes: data?.sizeBytes,
        contentType: data?.contentType,
      });
      setMusicRetryLog(appendMusicRetryEntry(pid, {
        stage: audible ? "verify-ok" : "verify-missing",
        audible,
        sizeBytes: data?.sizeBytes,
        contentType: data?.contentType,
      }));
      // Always run the audio QA report after a verify pass.
      void runRenderReport(renderedVideoUrl, audible);

      // Only attempt a retry when we asked for music in the first place
      // and the verification says the audio track is missing.
      if (audible || !backgroundMusicUrl || !script?.suggestedMusic) {
        if (audible) {
          console.log("[music-verify] OK — audio track detected in final render.");
        }
        return;
      }
      if (musicRetryRef.current >= MAX_MUSIC_RETRIES) {
        toast.warning("⚠️ La colonna sonora risulta ancora mancante nel video finale dopo il retry. Puoi rigenerare manualmente la musica.", { duration: 8000 });
        setMusicRetryLog(appendMusicRetryEntry(pid, { stage: "max-retries", attempt: musicRetryRef.current }));
        return;
      }
      musicRetryRef.current += 1;
      toast.info(`🎵 Colonna sonora non rilevata nel render — rigenerazione e nuovo montaggio (tentativo ${musicRetryRef.current}/${MAX_MUSIC_RETRIES})…`, { duration: 6000 });
      setMusicRetryLog(appendMusicRetryEntry(pid, { stage: "regenerate-start", attempt: musicRetryRef.current - 1 }));
      const newMusicUrl = await generateBackgroundMusic();
      if (!newMusicUrl) {
        toast.error("Impossibile rigenerare la colonna sonora. Riprova manualmente più tardi.");
        setMusicRetryLog(appendMusicRetryEntry(pid, { stage: "regenerate-failed", attempt: musicRetryRef.current - 1 }));
        return;
      }
      setMusicRetryLog(appendMusicRetryEntry(pid, { stage: "regenerate-ok", attempt: musicRetryRef.current - 1, note: newMusicUrl.slice(0, 80) }));
      setMusicRetryLog(appendMusicRetryEntry(pid, { stage: "reassemble-start", attempt: musicRetryRef.current - 1 }));
      // Reassemble — handleReassemble reads the latest backgroundMusicUrl from state,
      // which generateBackgroundMusic just updated via setBackgroundMusicUrl.
      setTimeout(() => handleReassemble(), 500);
    } catch (err) {
      console.warn("[music-verify] unexpected error:", err);
      setMusicRetryLog(appendMusicRetryEntry(pid, { stage: "verify-error", note: String((err as Error)?.message || err) }));
    }
  };

  /** Build the post-render audio QA report for the current project. Safe to call
   *  multiple times — the latest report replaces the previous one. */
  const runRenderReport = async (videoUrl: string, musicAudible: boolean | null): Promise<void> => {
    if (!script) return;
    setRenderReportLoading(true);
    try {
      const mix = getAudioMix();
      const report = await buildRenderReport({
        videoUrl,
        scenes: script.scenes.map((s) => ({
          sceneNumber: s.sceneNumber,
          audioUrl: s.audioUrl,
          ambienceUrl: s.ambienceUrl,
          sfxUrl: s.sfxUrl,
        })),
        backgroundMusicUrl,
        headroom: mix.headroom,
        musicAudible,
      });
      setRenderReport(report);
    } catch (err) {
      console.warn("[render-report] failed:", err);
    } finally {
      setRenderReportLoading(false);
    }
  };


  const recoverSkippedAudioAssets = async (
    skipped: { type: string; index?: number; url: string }[],
  ): Promise<boolean> => {
    if (!script || !skipped?.length) return false;
    let recovered = 0;
    toast.info(`Recupero automatico di ${skipped.length} ${skipped.length === 1 ? "asset audio scaduto" : "asset audio scaduti"}…`);

    // Group by type — vids order in concat == filtered scenes with completed video
    const vids = script.scenes.filter(s => s.videoStatus === "completed" && s.videoUrl);

    for (const item of skipped) {
      try {
        if ((item.type === "narration" || item.type === "sfx") && typeof item.index === "number") {
          // Map back from vids[index] to the real script.scenes index
          const targetVid = vids[item.index];
          if (!targetVid) continue;
          const realIdx = script.scenes.findIndex(s => s.sceneNumber === targetVid.sceneNumber);
          if (realIdx < 0) continue;
          await regenerateSceneAsset(realIdx, item.type === "narration" ? "audio" : "sfx");
          recovered++;
        } else if (item.type === "ambience" && typeof item.index === "number") {
          // Ambience isn't yet wired through regenerateSceneAsset — regenerate inline.
          const targetVid = vids[item.index];
          if (!targetVid) continue;
          const realIdx = script.scenes.findIndex(s => s.sceneNumber === targetVid.sceneNumber);
          if (realIdx < 0) continue;
          const newUrl = await generateSceneAmbience(script.scenes[realIdx]);
          if (newUrl) {
            setScript(prev => {
              if (!prev) return prev;
              const updatedScenes = [...prev.scenes];
              updatedScenes[realIdx] = { ...updatedScenes[realIdx], ambienceUrl: newUrl, ambienceStatus: "completed" };
              return { ...prev, scenes: updatedScenes };
            });
            recovered++;
          }
        } else if (item.type === "music") {
          const newUrl = await generateBackgroundMusic();
          if (newUrl) recovered++;
        }
      } catch (err) {
        console.warn(`Auto-recovery failed for ${item.type}#${item.index}:`, err);
      }
    }

    if (recovered > 0) {
      toast.success(`${recovered} ${recovered === 1 ? "asset audio rigenerato" : "asset audio rigenerati"}`);
      // Persist updated scene assets so the next concat picks the new storage URLs
      setTimeout(() => saveProject(), 300);
    }
    return recovered > 0;
  };

  /**
   * Append a failed recovery event to story_mode_projects.recovery_history (analytics).
   * Read current array, append new entry, write back. Best-effort — no-op if no projectId.
   */
  const logRecoveryFailure = async (
    context: "reassemble" | "generateAll",
    assets: Array<{ type: string; index?: number; sceneNumber?: number; url?: string }>,
    attempts: number,
  ) => {
    if (!projectId) return;
    try {
      const { data: row } = await supabase
        .from("story_mode_projects")
        .select("recovery_history")
        .eq("id", projectId)
        .single();
      const prev = Array.isArray((row as any)?.recovery_history) ? (row as any).recovery_history : [];
      const entry = {
        timestamp: new Date().toISOString(),
        context,
        attempts,
        assets: assets.map(a => ({
          type: a.type,
          sceneNumber: a.sceneNumber ?? null,
          urlKind: a.url?.startsWith("blob:") ? "blob" : a.url ? "remote" : "unknown",
        })),
      };
      // Cap history at 50 entries to avoid unbounded growth
      const next = [...prev, entry].slice(-50);
      await supabase.from("story_mode_projects").update({ recovery_history: next } as any).eq("id", projectId);
    } catch (err) {
      console.warn("Failed to log recovery history:", err);
    }
  };

  /**
   * Pre-render check: scan all completed video scenes for blob: audio URLs.
   * If >50% are blob, open a confirm dialog to batch-regenerate them all
   * instead of forcing the user to click "Rigenera" one-by-one in the dialog.
   */
  const preRenderAudioCheck = (): boolean => {
    if (!script) return true;
    const vids = script.scenes.filter(s => s.videoStatus === "completed" && s.videoUrl);
    if (vids.length === 0) return true;
    const isBlob = (u?: string | null) => !!u && u.startsWith("blob:");
    let blobCount = 0;
    let totalCount = 0;
    const details: Array<{ key: string; realIdx: number; sceneNumber: number; type: "audio" | "sfx" | "music" }> = [];
    vids.forEach(s => {
      const realIdx = script.scenes.findIndex(x => x.sceneNumber === s.sceneNumber);
      if (s.audioUrl) {
        totalCount++;
        if (isBlob(s.audioUrl)) {
          blobCount++;
          details.push({ key: `audio-${s.sceneNumber}`, realIdx, sceneNumber: s.sceneNumber, type: "audio" });
        }
      }
      if (s.sfxUrl) {
        totalCount++;
        if (isBlob(s.sfxUrl)) {
          blobCount++;
          details.push({ key: `sfx-${s.sceneNumber}`, realIdx, sceneNumber: s.sceneNumber, type: "sfx" });
        }
      }
    });
    if (backgroundMusicUrl) {
      totalCount++;
      if (isBlob(backgroundMusicUrl)) {
        blobCount++;
        details.push({ key: "music-global", realIdx: -1, sceneNumber: 0, type: "music" });
      }
    }
    if (totalCount === 0 || blobCount === 0) return true;
    const pct = Math.round((blobCount / totalCount) * 100);
    if (pct > 50) {
      setBatchAudioStats({ blob: blobCount, total: totalCount, pct });
      setBatchAudioDetails(details);
      setBatchSelectedKeys(new Set(details.map(d => d.key)));
      setShowBatchAudioRegenDialog(true);
      return false;
    }
    return true;
  };

  // Open render preview only after the audio check passes
  const openRenderPreview = (action: "reassemble" | "generateAll") => {
    setPendingRenderAction(action);
    if (preRenderAudioCheck()) {
      setShowRenderPreview(true);
    }
  };

  // Batch-regenerate selected blob: audio assets across the project
  const handleBatchRegenAudio = async () => {
    if (!script) return;
    const selected = batchAudioDetails.filter(d => batchSelectedKeys.has(d.key));
    if (selected.length === 0) {
      toast.warning("Nessun asset selezionato");
      return;
    }
    setIsBatchRegenAudio(true);
    const total = selected.length;
    toast.info(`Rigenerazione batch di ${total} audio scaduti…`);
    let done = 0;
    for (const t of selected) {
      try {
        if (t.type === "music") {
          await generateBackgroundMusic();
        } else {
          await regenerateSceneAsset(t.realIdx, t.type);
        }
        done++;
      } catch (e) {
        console.warn("Batch regen failed:", e);
      }
    }
    setIsBatchRegenAudio(false);
    setShowBatchAudioRegenDialog(false);
    setBatchAudioStats(null);
    setBatchAudioDetails([]);
    setBatchSelectedKeys(new Set());
    toast.success(`${done}/${total} audio rigenerati`);
    setTimeout(() => saveProject(), 300);
    setShowRenderPreview(true);
  };

  // Unified handler used by the pre-flight panels AND auto-recovery on reload.
  // Updates `batchProgress` step-by-step so the UI shows e.g. "Voce scena 3/8…".
  const runAudioBatchRegen = async (items: ExpiredAudioItem[]): Promise<number> => {
    if (items.length === 0) return 0;
    setIsBatchRegenAudio(true);
    let done = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const label =
        it.type === "music"
          ? `Musica di sottofondo`
          : it.type === "audio"
            ? `Voce scena ${it.sceneNumber}`
            : `SFX scena ${it.sceneNumber}`;
      setBatchProgress({ current: i, total: items.length, label });
      try {
        if (it.type === "music") await generateBackgroundMusic();
        else await regenerateSceneAsset(it.sceneIndex, it.type);
        done++;
      } catch (e) {
        console.warn("Pre-flight audio regen failed:", e);
      }
    }
    setBatchProgress({ current: items.length, total: items.length, label: "Completato" });
    setTimeout(() => setBatchProgress(null), 800);
    setIsBatchRegenAudio(false);
    setTimeout(() => saveProject(), 300);
    return done;
  };

  const runVideoBatchRegen = async (items: ProblematicVideoItem[]): Promise<number> => {
    if (items.length === 0) return 0;
    let done = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      setBatchProgress({ current: i, total: items.length, label: `Video scena ${it.sceneNumber}` });
      try {
        await regenerateSceneAsset(it.sceneIndex, "video");
        done++;
      } catch (e) {
        console.warn("Pre-flight video regen failed:", e);
      }
    }
    setBatchProgress({ current: items.length, total: items.length, label: "Completato" });
    setTimeout(() => setBatchProgress(null), 800);
    setTimeout(() => saveProject(), 300);
    return done;
  };

  // Auto-recovery on reload: when a saved project is loaded and contains blob:
  // assets (audio OR video — only existed in the previous browser session),
  // automatically kick off regeneration so the user doesn't have to click manually.
  // Respects the user-level toggle (Settings → Story Mode → Auto-recovery).
  useEffect(() => {
    if (!projectId || !script || step !== "script") return;
    if (autoRecoveryFiredRef.current.has(projectId)) return;
    if (isBatchRegenAudio || batchProgress) return;
    if (!isAutoRecoveryEnabled()) return;

    const expiredAudio: ExpiredAudioItem[] = [];
    const expiredVideo: ProblematicVideoItem[] = [];
    script.scenes.forEach((s, i) => {
      if (s.audioUrl?.startsWith("blob:")) {
        expiredAudio.push({ type: "audio", sceneIndex: i, sceneNumber: s.sceneNumber });
      }
      if (s.sfxUrl?.startsWith("blob:")) {
        expiredAudio.push({ type: "sfx", sceneIndex: i, sceneNumber: s.sceneNumber });
      }
      if (s.videoUrl?.startsWith("blob:")) {
        expiredVideo.push({ sceneIndex: i, sceneNumber: s.sceneNumber, reasons: ["blob"] });
      }
    });
    if (backgroundMusicUrl?.startsWith("blob:")) {
      expiredAudio.push({ type: "music", sceneIndex: -1, sceneNumber: 0 });
    }

    const totalExpired = expiredAudio.length + expiredVideo.length;
    if (totalExpired === 0) return;

    autoRecoveryFiredRef.current.add(projectId);
    toast.info(`Recupero automatico di ${totalExpired} asset scaduti dalla sessione precedente…`);
    (async () => {
      let doneAudio = 0;
      let doneVideo = 0;
      if (expiredAudio.length > 0) doneAudio = await runAudioBatchRegen(expiredAudio);
      if (expiredVideo.length > 0) doneVideo = await runVideoBatchRegen(expiredVideo);
      const total = doneAudio + doneVideo;
      if (total > 0) toast.success(`Auto-recovery: ${total}/${totalExpired} asset rigenerati`);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, step]);

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

  // Detect transient network errors (Veo/Kling cold starts, edge function fetch failures)
  // worth auto-retrying before marking the asset definitively broken.
  const isTransientError = (err: any): boolean => {
    const msg = (err?.message || String(err) || "").toLowerCase();
    const name = (err?.name || "").toLowerCase();
    return (
      name.includes("functionsfetcherror") ||
      msg.includes("failed to fetch") ||
      msg.includes("failed to send a request") ||
      msg.includes("network") ||
      msg.includes("timed out") ||
      msg.includes("etimedout") ||
      msg.includes("econnreset") ||
      msg.includes("503") ||
      msg.includes("504") ||
      msg.includes("temporarily")
    );
  };

  // Concurrency-bounded promise pool — runs at most `limit` tasks in parallel
  const runWithConcurrency = async <T,>(items: T[], limit: number, worker: (item: T, idx: number) => Promise<void>) => {
    const queue = items.map((item, idx) => ({ item, idx }));
    const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
      while (queue.length > 0) {
        const next = queue.shift();
        if (!next) break;
        try {
          await worker(next.item, next.idx);
        } catch (err) {
          // Errors are owned by the worker — never let them break the pool
          console.error("[Pool] worker error swallowed:", err);
        }
      }
    });
    await Promise.all(runners);
  };

  // Auto-regenerate all scenes that are in error or missing state
  // - Parallel (max 3 scene worker simultanei) → ~3x più veloce su 8+ scene
  // - Retry automatico fino a 2 volte su errori di rete transienti (FunctionsFetchError, Failed to fetch, 503/504, timeout)
  // - Una scena in errore non blocca le altre
  // - Re-read dello stato React fra image→video step per evitare stale closure
  const REGEN_CONCURRENCY = 3;
  const REGEN_MAX_RETRIES = 2;

  const handleAutoRegenerateErrors = async () => {
    if (!script) return;
    const errorScenes = failedOrMissingScenes(script.scenes);
    if (errorScenes.length === 0) {
      toast.info("Tutte le scene sono complete!");
      return;
    }
    toast.info(`Rigenerazione di ${errorScenes.length} scene (max ${REGEN_CONCURRENCY} in parallelo, retry automatico ×${REGEN_MAX_RETRIES})...`);
    setIsGenerating(true);
    setRegenProgress({ current: 0, total: errorScenes.length });

    const failures: { sceneNumber: number; type: string; error: string; attempts: number }[] = [];
    const completedSet = new Set<number>(); // sceneNumbers fully successful
    let completedCount = 0;

    // safeRegen with retry on transient errors (FunctionsFetchError / Failed to fetch / 503 etc.)
    const safeRegen = async (sceneIdx: number, sceneNumber: number, type: "image" | "audio" | "video" | "sfx"): Promise<boolean> => {
      let attempt = 0;
      let lastErr: any = null;
      while (attempt <= REGEN_MAX_RETRIES) {
        try {
          await regenerateSceneAsset(sceneIdx, type);
          if (attempt > 0) {
            console.log(`[AutoRegen] Scene ${sceneNumber} ${type} riuscito al tentativo ${attempt + 1}`);
          }
          return true;
        } catch (err: any) {
          lastErr = err;
          const transient = isTransientError(err);
          console.warn(`[AutoRegen] Scene ${sceneNumber} ${type} attempt ${attempt + 1}/${REGEN_MAX_RETRIES + 1} failed (transient=${transient})`, err);
          if (!transient || attempt >= REGEN_MAX_RETRIES) break;
          // Exponential backoff: 1.5s, 3s
          const backoff = 1500 * Math.pow(2, attempt);
          await new Promise((r) => setTimeout(r, backoff));
          attempt++;
        }
      }
      const msg = lastErr?.message || String(lastErr);
      failures.push({ sceneNumber, type, error: msg, attempts: attempt + 1 });
      toast.error(`Scena ${sceneNumber} (${type}) fallita dopo ${attempt + 1} tentativ${attempt + 1 === 1 ? "o" : "i"}`, {
        description: msg.slice(0, 120),
        duration: 5000,
      });
      return false;
    };

    // Per-scene worker that handles all 4 asset types in correct order (image → audio → sfx → video)
    const sceneWorker = async ({ index }: { scene: StoryScene; index: number }) => {
      // Re-read latest scene snapshot (in case other parallel workers mutated state)
      const latest = await new Promise<StoryScene | null>((resolve) => {
        setScript((cur) => {
          resolve(cur?.scenes[index] ?? null);
          return cur;
        });
      });
      if (!latest) return;
      const sceneNumber = latest.sceneNumber;
      let allOk = true;

      if (latest.imageStatus === "error" || (!latest.imageUrl && latest.imageStatus !== "generating")) {
        const ok = await safeRegen(index, sceneNumber, "image");
        if (!ok) allOk = false;
      }
      if (latest.audioStatus === "error" || (!latest.audioUrl && latest.audioStatus !== "generating")) {
        const ok = await safeRegen(index, sceneNumber, "audio");
        if (!ok) allOk = false;
      }
      if ((latest.sfxStatus === "error" || (!latest.sfxUrl && latest.sfxStatus !== "generating")) && latest.sfxPrompt) {
        const ok = await safeRegen(index, sceneNumber, "sfx");
        if (!ok) allOk = false;
      }

      // Video step needs current image (just regenerated above)
      const afterImg = await new Promise<StoryScene | null>((resolve) => {
        setScript((cur) => {
          resolve(cur?.scenes[index] ?? null);
          return cur;
        });
      });
      if (afterImg && (afterImg.videoStatus === "error" || (!afterImg.videoUrl && afterImg.videoStatus !== "generating"))) {
        if (!afterImg.imageUrl) {
          failures.push({ sceneNumber, type: "video", error: "Immagine mancante dopo rigenerazione", attempts: 0 });
          toast.error(`Scena ${sceneNumber} (video) saltata: immagine non disponibile`);
          allOk = false;
        } else {
          const ok = await safeRegen(index, sceneNumber, "video");
          if (!ok) allOk = false;
        }
      }

      if (allOk) completedSet.add(sceneNumber);
      completedCount++;
      setRegenProgress({ current: completedCount, total: errorScenes.length });
    };

    try {
      await runWithConcurrency(errorScenes, REGEN_CONCURRENCY, sceneWorker);
    } finally {
      setRegenProgress(null);
      setIsGenerating(false);
    }

    const successCount = completedSet.size;
    if (failures.length === 0) {
      toast.success(`Rigenerazione completata! (${successCount}/${errorScenes.length} scene)`);
    } else {
      toast.warning(`Rigenerazione parziale: ${successCount}/${errorScenes.length} ok, ${failures.length} asset falliti`, {
        description: failures.slice(0, 3).map((f) => `S${f.sceneNumber} ${f.type}${f.attempts > 1 ? ` (${f.attempts}×)` : ""}`).join(" • ") + (failures.length > 3 ? ` +${failures.length - 3}` : ""),
        duration: 10000,
      });
    }
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
    setRenderStatus("starting");
    setPendingRenderId(null);
    setRenderStartTime(Date.now());
    setRenderElapsed(0);
    setRenderPollInfo({ attempts: 0, lastCheckedAt: null, lastStatus: "preparing", nextCheckInMs: 0, consecutiveErrors: 0 });
    toast.info("Rimontaggio video finale in corso...");
    try {
      const transitions = vids.map((s) => ({
        type: s.transition || "crossfade",
        duration: s.transitionDuration || 0.5,
      }));
      // Build positional narration array aligned with video clips
      const narrationUrls = vids.map(s => s.audioUrl || "");
      const sfxUrls = vids.map(s => s.sfxUrl || "");
      const ambienceUrls = vids.map(s => s.ambienceUrl || "");

      const { validVideoUrls, validIndexes, invalidSceneNumbers } = await prepareRenderVideoSources(vids);
      if (invalidSceneNumbers.length > 0) {
        toast.error(`Video sorgente non più validi nelle scene ${invalidSceneNumbers.join(", ")}. Rigenera quelle scene prima del render.`, { duration: 8000 });
        setRenderStatus("failed");
        setIsGenerating(false);
        return;
      }
      if (validVideoUrls.length < 2) {
        toast.error("Non abbastanza URL video validi per il montaggio.");
        setRenderStatus("failed");
        setIsGenerating(false);
        return;
      }
      // Keep parallel arrays in sync with validVideoUrls
      const alignedDurations = validIndexes.map(i => Math.min(vids[i].duration, 10));
      const alignedNarration = validIndexes.map(i => narrationUrls[i] || "");
      const alignedSfx = validIndexes.map(i => sfxUrls[i] || "");
      const alignedAmbience = validIndexes.map(i => ambienceUrls[i] || "");
      const alignedTransitions = validIndexes.map(i => transitions[i]);
      const { data, error } = await supabase.functions.invoke("video-concat", {
        body: {
          videoUrls: validVideoUrls,
          clipDurations: alignedDurations,
          transition: alignedTransitions[0]?.type || "crossfade",
          transitionDuration: alignedTransitions[0]?.duration || 0.5,
          transitions: alignedTransitions,
          resolution: input.videoQuality || "hd",
          aspectRatio: input.videoAspectRatio || "16:9",
          fps: input.videoFps || "24",
          audioUrls: alignedNarration.some(u => !!u) ? alignedNarration : undefined,
          sfxUrls: alignedSfx.some(u => !!u) ? alignedSfx : undefined,
          sfxVolume: (volumeOverrides?.sfxVolume ?? 22) / 100,
          ambienceUrls: alignedAmbience.some(u => !!u) ? alignedAmbience : undefined,
          ambienceVolume: (volumeOverrides?.ambienceVolume ?? 18) / 100,
          backgroundMusicUrl: backgroundMusicUrl || undefined,
          musicVolume: (volumeOverrides?.musicVolume ?? script.musicVolume ?? 25) / 100,
          narrationVolume: (volumeOverrides?.narrationVolume ?? script.narrationVolume ?? 100) / 100,
          autoMix: volumeOverrides?.autoMix ?? true,
          lufsTarget: volumeOverrides?.lufsTarget ?? -14,
        },
      });
      if (error) throw error;
      const finalUrl = data?.videoUrl || data?.url;
      if (data?.segments && Array.isArray(data.segments)) setVideoSegments(data.segments);

      // Auto-recover skipped (blob:) audio assets and re-trigger concat once (max 3 attempts)
      if (data?.skippedAssets && Array.isArray(data.skippedAssets) && data.skippedAssets.length > 0) {
        if (recoveryAttemptsRef.current >= MAX_RECOVERY_ATTEMPTS) {
          toast.error(`❌ Recupero audio fallito dopo ${MAX_RECOVERY_ATTEMPTS} tentativi.`, { duration: 6000 });
          recoveryAttemptsRef.current = 0;
          // Map skipped assets back to scene numbers for the failure dialog
          const vids = script?.scenes.filter(s => s.videoStatus === "completed" && s.videoUrl) ?? [];
          const enriched = data.skippedAssets.map((a: { type: string; index?: number; url: string }) => ({
            ...a,
            sceneNumber: typeof a.index === "number" ? vids[a.index]?.sceneNumber : undefined,
          }));
          setRecoveryFailureAssets(enriched);
          setRecoveryFailureContext("reassemble");
          setShowRecoveryFailureDialog(true);
          // Persist failure to recovery_history for analytics
          logRecoveryFailure("reassemble", enriched, MAX_RECOVERY_ATTEMPTS);
        } else {
          const recovered = await recoverSkippedAudioAssets(data.skippedAssets);
          if (recovered) {
            recoveryAttemptsRef.current += 1;
            toast.info(`Ri-tentativo concat con audio rigenerati… (tentativo ${recoveryAttemptsRef.current}/${MAX_RECOVERY_ATTEMPTS})`);
            setIsGenerating(false);
            setTimeout(() => handleReassemble(volumeOverrides), 500);
            return;
          }
          const types = [...new Set(data.skippedAssets.map((a: { type: string }) => a.type))].join(", ");
          toast.warning(`⚠️ ${data.skippedAssets.length} asset audio scartati (${types}): URL temporanei scaduti.`, { duration: 8000 });
          console.warn("Skipped assets (recovery failed):", data.skippedAssets);
        }
      } else {
        // Successful concat with no skipped assets — reset retry counter
        recoveryAttemptsRef.current = 0;
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
        setRenderStatus("failed");
        setStep("complete");
      }
    } catch (err: any) {
      console.error("Reassemble error:", err);
      toast.error("Errore nel rimontaggio: " + (err.message || "sconosciuto"));
      setRenderStatus("failed");
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
    musicRetryRef.current = 0;
    setMusicVerification(null);
    setMusicRetryLog(resetMusicRetryLog(projectId ?? null));
    setRenderReport(null);

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
    const musicP = generateBackgroundMusic().then((url) => {
      tick();
      return url;
    });

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

    // TTS narration — also adapts scene.duration to match the real measured voice length,
    // so the video segment is generated with the right runtime and the narration is never cut.
    for (let i = 0; i < scenes.length && !checkCancelled(); i++) {
      await waitForResume();
      if (checkCancelled()) break;
      try {
        scenes[i] = { ...scenes[i], audioStatus: "generating" };
        setScript(p => p ? { ...p, scenes: [...scenes] } : p);
        const authHeaders = await getAuthHeaders();
        const _voiceId = scenes[i].voiceId || input.voiceId;
        const blob = await withElevenlabsSlot(() => fetchAudioWithRetry(
          ttsUrl(_voiceId),
          {
            method: "POST", headers: authHeaders,
            body: JSON.stringify({ text: scenes[i].narration, voiceId: _voiceId, language_code: input.language, languageCode: input.language }),
          },
          "ElevenLabs TTS",
          `story-mode/scene-${i + 1}`,
          { maxAttempts: 3 },
        ));
        const sceneLabel = `Narrazione Scena ${i + 1}`;
        const storageUrl = await uploadBlobToStorage(blob, "story-narration", "mp3", sceneLabel);
        const ttsProv = getAudioBlobProvider(blob);
        if (ttsProv) {
          setAudioProviders(prev => ({
            ...prev,
            tts: {
              op: "tts",
              provider: ttsProv.provider,
              fallbackUsed: ttsProv.fallbackUsed,
              reason: ttsProv.fallbackReason,
              at: Date.now(),
            },
          }));
        }

        // Measure the real audio duration and adapt scene.duration if the voice is
        // significantly longer/shorter than the originally planned scene length.
        const measured = await measureAudioBlobDuration(blob);
        const adapted = adaptDurationToVoice(measured, scenes[i].duration);
        if (adapted !== scenes[i].duration) {
          apiLogger.info("StoryMode", "voice-sync", `Scena ${i + 1}: durata adattata ${scenes[i].duration}s → ${adapted}s (voce ${measured.toFixed(1)}s)`).catch(() => {});
          toast.info(`Scena ${i + 1}: durata regolata a ${adapted}s per allineare la voce (${measured.toFixed(1)}s)`);
        }
        scenes[i] = {
          ...scenes[i],
          audioUrl: storageUrl,
          audioStatus: "completed",
          duration: adapted,
          audioDuration: measured || undefined,
        };
      } catch (err: any) {
        const msg = err.message || "Errore sconosciuto";
        toast.error(`Scena ${i + 1}: errore audio – ${msg}`);
        scenes[i] = { ...scenes[i], audioStatus: "error", error: msg };
      }
      tick(); setScript(p => p ? { ...p, scenes: [...scenes] } : p);
    }

    // Ambience bed (continuous wind/sea/forest) — always generated, low volume.
    // Punctual SFX is generated only when the scene clearly has discrete events;
    // otherwise we skip it so it never overlaps with the voice.
    for (let i = 0; i < scenes.length && !checkCancelled(); i++) {
      await waitForResume();
      if (checkCancelled()) break;
      try {
        const ambiencePrompt = inferAmbiencePrompt(scenes[i]);
        scenes[i] = { ...scenes[i], ambienceStatus: "generating", ambiencePrompt };
        setScript(p => p ? { ...p, scenes: [...scenes] } : p);
        const ambienceUrl = await generateSceneAmbience(scenes[i]);
        scenes[i] = { ...scenes[i], ambienceUrl: ambienceUrl || undefined, ambienceStatus: ambienceUrl ? "completed" : "error" };
      } catch (err: any) {
        toast.error(`Scena ${i + 1}: errore ambience – ${err?.message || "sconosciuto"}`);
        scenes[i] = { ...scenes[i], ambienceStatus: "error" };
      }

      // Punctual SFX (only if needed)
      try {
        const sfxPrompt = inferSfxPrompt(scenes[i]);
        if (sfxPrompt) {
          scenes[i] = { ...scenes[i], sfxStatus: "generating", sfxPrompt };
          setScript(p => p ? { ...p, scenes: [...scenes] } : p);
          const sfxUrl = await generateSceneSfx(scenes[i]);
          scenes[i] = { ...scenes[i], sfxUrl: sfxUrl || undefined, sfxStatus: sfxUrl ? "completed" : "error" };
        } else {
          // Mark as completed-but-empty so the UI doesn't show an error pill
          scenes[i] = { ...scenes[i], sfxStatus: "idle", sfxUrl: undefined };
        }
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
          body: {
            prompt: `${scenes[i].imagePrompt}, ${scenes[i].cameraMovement.replace(/_/g, " ")}${orientationHint}`,
            image_url: scenes[i].imageUrl,
            type: "image_to_video",
            duration: Math.min(scenes[i].duration, 10),
            model: "kling-2.1",
            aspect_ratio: input.videoAspectRatio,
            ...(input.videoModel && input.videoModel !== "auto" ? { preferredProvider: input.videoModel } : {}),
          },
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
        // Logga costo stimato della generazione batch
        void logVideoCost({
          provider: input.videoModel ?? "auto",
          secondsBilled: Math.min(scenes[i].duration, 10),
          storyProjectId: projectId ?? null,
          sceneIndex: i,
          status: "success",
          metadata: {
            source: "batch_generate_all",
            prompt: scenes[i].videoPrompt || scenes[i].imagePrompt || scenes[i].description,
            requestedDuration: scenes[i].duration,
            sceneTitle: scenes[i].title,
          },
        });
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

    const resolvedBackgroundMusicUrl = (await musicP) || backgroundMusicUrl;
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
        // Build positional narration/sfx/ambience arrays aligned with video clips
        const narrationUrls = vids.map(s => s.audioUrl || "");
        const sfxUrls = vids.map(s => s.sfxUrl || "");
        const ambienceUrls = vids.map(s => s.ambienceUrl || "");

        const { validVideoUrls, validIndexes, invalidSceneNumbers } = await prepareRenderVideoSources(vids);
        if (invalidSceneNumbers.length > 0) {
          toast.error(`Video sorgente non più validi nelle scene ${invalidSceneNumbers.join(", ")}. Rigenera quelle scene prima del render.`, { duration: 8000 });
          setRenderStatus("failed");
          setPendingRenderId(null);
          return;
        }
        if (validVideoUrls.length < 2) {
          toast.error("Non abbastanza clip valide per completare il render finale.");
          setRenderStatus("failed");
          setPendingRenderId(null);
          return;
        }

        // Keep parallel arrays in sync with validVideoUrls (avoid scene drops)
        const alignedDurations = validIndexes.map(i => Math.min(vids[i].duration, 10));
        const alignedNarration = validIndexes.map(i => narrationUrls[i] || "");
        const alignedSfx = validIndexes.map(i => sfxUrls[i] || "");
        const alignedAmbience = validIndexes.map(i => ambienceUrls[i] || "");
        const alignedTransitions = validIndexes.map(i => transitions[i]);

        const globalMix = getAudioMix();
        const { data, error } = await supabase.functions.invoke("video-concat", {
          body: {
            videoUrls: validVideoUrls,
            clipDurations: alignedDurations,
            transition: alignedTransitions[0]?.type || "crossfade",
            transitionDuration: alignedTransitions[0]?.duration || 0.5,
            transitions: alignedTransitions,
            resolution: input.videoQuality || "hd",
            aspectRatio: input.videoAspectRatio || "16:9",
            fps: input.videoFps || "24",
            audioUrls: alignedNarration.some(u => !!u) ? alignedNarration : undefined,
            sfxUrls: alignedSfx.some(u => !!u) ? alignedSfx : undefined,
            sfxVolume: globalMix.sfxVolume / 100,
            ambienceUrls: alignedAmbience.some(u => !!u) ? alignedAmbience : undefined,
            ambienceVolume: globalMix.ambienceVolume / 100,
            backgroundMusicUrl: resolvedBackgroundMusicUrl || undefined,
            musicVolume: (script.musicVolume ?? 25) / 100,
            narrationVolume: (script.narrationVolume ?? 100) / 100,
            autoMix: true,
            lufsTarget: -14,
          },
        });
        if (error) throw error;
        const finalUrl = data?.videoUrl || data?.url;
        if (data?.segments && Array.isArray(data.segments)) {
          setVideoSegments(data.segments);
        }

        // Auto-recover skipped (blob:) audio assets and re-trigger concat once via reassemble (max 3 attempts)
        if (data?.skippedAssets && Array.isArray(data.skippedAssets) && data.skippedAssets.length > 0) {
          if (recoveryAttemptsRef.current >= MAX_RECOVERY_ATTEMPTS) {
            toast.error(`❌ Recupero audio fallito dopo ${MAX_RECOVERY_ATTEMPTS} tentativi.`, { duration: 6000 });
            recoveryAttemptsRef.current = 0;
            const vids = script?.scenes.filter(s => s.videoStatus === "completed" && s.videoUrl) ?? [];
            const enriched = data.skippedAssets.map((a: { type: string; index?: number; url: string }) => ({
              ...a,
              sceneNumber: typeof a.index === "number" ? vids[a.index]?.sceneNumber : undefined,
            }));
            setRecoveryFailureAssets(enriched);
            setRecoveryFailureContext("generateAll");
            setShowRecoveryFailureDialog(true);
            logRecoveryFailure("generateAll", enriched, MAX_RECOVERY_ATTEMPTS);
          } else {
            const recovered = await recoverSkippedAudioAssets(data.skippedAssets);
            if (recovered) {
              recoveryAttemptsRef.current += 1;
              toast.info(`Ri-tentativo concat con audio rigenerati… (tentativo ${recoveryAttemptsRef.current}/${MAX_RECOVERY_ATTEMPTS})`);
              setStep("complete");
              setIsGenerating(false);
              setTimeout(() => handleReassemble(), 500);
              return;
            }
            const types = [...new Set(data.skippedAssets.map((a: { type: string }) => a.type))].join(", ");
            toast.warning(`⚠️ ${data.skippedAssets.length} asset audio scartati (${types}): URL temporanei scaduti. Ricarica/rigenera per includerli nel video finale.`, { duration: 8000 });
            console.warn("Skipped assets (recovery failed):", data.skippedAssets);
          }
        } else {
          recoveryAttemptsRef.current = 0;
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

      {(isRenderActive || (renderStatus === "failed" && !finalVideoUrl)) && (
        <Card className="border-primary/30 bg-primary/5 sticky top-3 z-20 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-primary/10">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                {isRenderActive ? (
                  <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {renderStatus === "starting"
                      ? "Preparazione montaggio…"
                      : isRenderActive ? "Render finale in corso…" : "Rendering finale fallito"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {renderStatus === "starting"
                      ? "Verifica asset e invio a Shotstack…"
                      : isRenderActive
                        ? `${sceneCount} scene · ${isHD ? "Alta qualità" : "Qualità standard"} · aggiornamento automatico appena pronto`
                        : "Puoi riprovare con il bottone Rimonta Video Finale."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isRenderActive && (
                  step !== "complete" ? (
                    <Button
                      variant="default"
                      size="sm"
                      className="h-8"
                      onClick={() => setStep("complete")}
                    >
                      <Film className="w-3.5 h-3.5 mr-1.5" />
                      Vai al render
                    </Button>
                  ) : (
                    <Badge variant="outline" className="h-8 px-3 inline-flex items-center">
                      <Film className="w-3.5 h-3.5 mr-1.5" />
                      Sei nel render
                    </Badge>
                  )
                )}
                <Badge variant={isRenderActive ? "secondary" : "destructive"}>
                  {isRenderActive ? "Rendering" : "Errore"}
                </Badge>
              </div>
            </div>

            {showRenderDiagnostics && (
              <>
                {isRenderActive && (
                  <>
                    <Progress value={renderProgressPct} className="h-2" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground gap-3 flex-wrap">
                      <span>{Math.round(renderProgressPct)}% completato</span>
                      <span className="flex items-center gap-1">
                        <Timer className="w-3 h-3" />
                        {renderRemainingSeconds > 60
                          ? `~${Math.ceil(renderRemainingSeconds / 60)} min rimanenti`
                          : `~${renderRemainingSeconds}s rimanenti`}
                      </span>
                    </div>
                  </>
                )}

                {/* Detailed Shotstack polling info */}
                {(() => {
                  // Use renderTick so "Xs fa" updates every second
                  void renderTick;
                  const lastCheckedSec = renderPollInfo.lastCheckedAt
                    ? Math.max(0, Math.floor((Date.now() - renderPollInfo.lastCheckedAt) / 1000))
                    : null;
                  const nextCheckSec = renderPollInfo.lastCheckedAt
                    ? Math.max(0, Math.ceil((renderPollInfo.nextCheckInMs - (Date.now() - renderPollInfo.lastCheckedAt)) / 1000))
                    : Math.ceil(renderPollInfo.nextCheckInMs / 1000);
                  const statusLabel = (() => {
                    switch (renderPollInfo.lastStatus) {
                      case "completed": return "✅ pronto";
                      case "failed": return "❌ errore";
                      case "error": return "⚠️ errore polling";
                      case "queued": return "🟡 in coda";
                      case "fetching": return "📥 download asset";
                      case "rendering": return "🎬 in rendering";
                      case "saving": return "💾 salvataggio";
                      case "processing":
                      default: return "⏳ in elaborazione";
                    }
                  })();
                  return (
                    <div className="flex items-center justify-between gap-3 flex-wrap text-[11px] text-muted-foreground border-t border-border/40 pt-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <span className="font-medium text-foreground">Shotstack:</span>
                          {statusLabel}
                        </span>
                        <span>•</span>
                        <span>Tentativi: <span className="tabular-nums font-medium text-foreground">{renderPollInfo.attempts}</span></span>
                        {renderPollInfo.consecutiveErrors > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-destructive">Errori consecutivi: {renderPollInfo.consecutiveErrors}/5</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span>
                          Ultimo check: {lastCheckedSec === null ? "—" : lastCheckedSec === 0 ? "ora" : `${lastCheckedSec}s fa`}
                        </span>
                        <span>•</span>
                        <span>
                          Prossimo: {nextCheckSec <= 0 ? "in corso…" : `tra ~${nextCheckSec}s`}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </CardContent>
        </Card>
      )}

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
                {savedProjects.map(p => {
                  // Active render badge: pending_render_id set + render_started_at < 15min ago (else stale)
                  const renderStartMs = p.render_started_at ? new Date(p.render_started_at).getTime() : 0;
                  const _tick = savedProjectsTick; // re-eval on tick to refresh elapsed
                  const elapsedMin = renderStartMs ? Math.floor((Date.now() - renderStartMs) / 60000) : 0;
                  const isActiveRender = !!p.pending_render_id && renderStartMs > 0 && elapsedMin < 15;
                  return (
                  <div key={p.id} className={cn("flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors", projectId === p.id ? "border-primary bg-primary/5" : "border-border")} onClick={() => loadProject(p.id)}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className="text-xs">{p.status}</Badge>
                        {isActiveRender && (
                          <Badge variant="default" className="text-xs bg-primary/20 text-primary border-primary/40 animate-pulse flex items-center gap-1">
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            Rendering ({elapsedMin}m)
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(p.updated_at).toLocaleDateString("it-IT")}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="shrink-0" onClick={(e) => { e.stopPropagation(); deleteProject(p.id); }}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                  );
                })}
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
                    <div className="flex gap-1.5 mb-1.5">
                      <Select
                        value={input.ttsProvider ?? "auto"}
                        onValueChange={(v) => {
                          const provider = v as "auto" | "elevenlabs" | "inworld";
                          setInput(p => {
                            // If switching provider invalidates the current voice, reset to a safe default.
                            // Consider both hardcoded SYSTEM voices and dynamically-loaded IVC voices
                            // (otherwise selecting a cloned voice like Marina Official gets reset
                            // when toggling provider).
                            const isInworldVoice =
                              INWORLD_VOICE_OPTIONS.some(x => x.id === p.voiceId) ||
                              allInworldVoiceIds.has(p.voiceId);
                            let nextVoiceId = p.voiceId;
                            if (provider === "inworld" && !isInworldVoice) nextVoiceId = "Sarah";
                            if (provider !== "inworld" && isInworldVoice) nextVoiceId = "EXAVITQu4vr4xnSDxMaL";
                            return { ...p, ttsProvider: provider, voiceId: nextVoiceId };
                          });
                        }}
                      >
                        <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">⚡ Auto (Inworld TTS)</SelectItem>
                          <SelectItem value="inworld">🤖 Inworld TTS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-1.5">
                      <Select value={input.voiceId} onValueChange={v => {
                        setInput(p => ({ ...p, voiceId: v }));
                        try { localStorage.setItem("storyMode.preferredVoiceId", v); } catch { /* ignore */ }
                      }}>
                        <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {input.ttsProvider === "inworld" ? (
                            <>
                              {inworldIvcVoices.length > 0 && (
                                <>
                                  <div className="px-2 py-1 text-[10px] font-semibold text-primary uppercase tracking-wider">🎤 Voci clonate Inworld (IVC)</div>
                                  {inworldIvcVoices.map(v => (
                                    <SelectItem key={`ivc-${v.voiceId}`} value={v.voiceId}>{v.displayName}</SelectItem>
                                  ))}
                                </>
                              )}
                              <div className="px-2 py-1 mt-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-t border-border pt-2">Voci Inworld (system)</div>
                              {(inworldSystemVoices.length > 0 ? inworldSystemVoices.map(v => ({ id: v.voiceId, name: v.displayName, description: v.description ?? "" })) : INWORLD_VOICE_OPTIONS).map(v => (
                                <SelectItem key={v.id} value={v.id}>{v.name}{v.description ? <> — <span className="text-muted-foreground">{v.description}</span></> : null}</SelectItem>
                              ))}
                            </>
                          ) : (
                            <>
                              {voiceOptions.filter(v => !v.isCloned).length > 0 && (
                                <>
                                  <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Voci default</div>
                                  {voiceOptions.filter(v => !v.isCloned).map(v => (
                                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                                  ))}
                                </>
                              )}
                              {voiceOptions.filter(v => v.isCloned).length > 0 && (
                                <>
                                  <div className="px-2 py-1 mt-1 text-[10px] font-semibold text-accent uppercase tracking-wider border-t border-border pt-2">🎤 Voci Clonate (legacy)</div>
                                  {voiceOptions.filter(v => v.isCloned).map(v => (
                                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                                  ))}
                                </>
                              )}
                              {inworldIvcVoices.length > 0 && (
                                <>
                                  <div className="px-2 py-1 mt-1 text-[10px] font-semibold text-primary uppercase tracking-wider border-t border-border pt-2">🎤 Voci clonate Inworld (IVC) — useranno Inworld</div>
                                  {inworldIvcVoices.map(v => (
                                    <SelectItem key={`ivc-mix-${v.voiceId}`} value={v.voiceId}>{v.displayName}</SelectItem>
                                  ))}
                                </>
                              )}
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
                <div>
                  <Label className="text-xs flex items-center gap-1">
                    <Film className="w-3 h-3" />Modello video
                    {input.videoModel && input.videoModel !== "auto" && (
                      <Badge variant="secondary" className="ml-1 text-[9px] px-1 py-0 h-4">
                        {VIDEO_PROVIDERS[input.videoModel as VideoProviderType]?.shortName ?? input.videoModel}
                      </Badge>
                    )}
                  </Label>
                  <Select
                    value={input.videoModel ?? "auto"}
                    onValueChange={(v) => setInput(p => ({ ...p, videoModel: v }))}
                  >
                    <SelectTrigger className="mt-1.5 h-9 text-xs">
                      <SelectValue placeholder="Auto (consigliato)" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[400px]">
                      {(() => {
                        // Group providers by category for readable submenu
                        const groups: Record<string, VideoProviderType[]> = {};
                        PROVIDER_DISPLAY_ORDER.forEach((id) => {
                          const info = VIDEO_PROVIDERS[id];
                          if (!info) return;
                          const cat = info.category || "Altri";
                          (groups[cat] ||= []).push(id);
                        });
                        const catOrder = ["Auto", "Luma", "Runway", "Kling", "Sora", "Veo", "MiniMax", "PixVerse", "Wan", "Seedance", "PiAPI", "LTX", "Vidu", "Freepik", "Altri"];
                        const sortedCats = Object.keys(groups).sort(
                          (a, b) => (catOrder.indexOf(a) === -1 ? 999 : catOrder.indexOf(a)) - (catOrder.indexOf(b) === -1 ? 999 : catOrder.indexOf(b))
                        );
                        return sortedCats.map((cat) => (
                          <div key={cat}>
                            <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-t border-border first:border-t-0">
                              {cat}
                            </div>
                            {groups[cat].map((id) => {
                              const info = VIDEO_PROVIDERS[id];
                              return (
                                <SelectItem key={id} value={id} className="text-xs">
                                  <span className="font-medium">{info.shortName ?? info.name}</span>
                                  {info.description && (
                                    <span className="text-muted-foreground ml-1.5">— {info.description}</span>
                                  )}
                                </SelectItem>
                              );
                            })}
                          </div>
                        ));
                      })()}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Auto sceglie il provider più adatto per scena. I provider VEO/Sora/Kling Pro hanno costi più elevati.
                  </p>
                  {(() => {
                    const provider = input.videoModel ?? "auto";
                    const sceneDurations = Array(input.numScenes).fill(8);
                    const est = estimateProjectCost(provider, sceneDurations);
                    const pricePerSec = getPricePerSecond(provider);
                    const isPremium = pricePerSec >= 0.20;
                    const isMid = pricePerSec >= 0.10 && pricePerSec < 0.20;
                    const threshold = getCostAlertThreshold();
                    const overThreshold = est.totalEur > threshold;
                    // Suggerimento smart: provider più economico + risparmio stimato
                    const cheaperPps = 0.05; // Luma Ray 2 / Kling 2.1
                    const cheaperTotal = +(cheaperPps * input.numScenes * 8).toFixed(2);
                    const savings = +(est.totalEur - cheaperTotal).toFixed(2);
                    const reducedDurationTotal = +(pricePerSec * input.numScenes * 5).toFixed(2);
                    const reducedSavings = +(est.totalEur - reducedDurationTotal).toFixed(2);
                    return (
                      <div
                        className={cn(
                          "mt-2 rounded-md border p-2.5 text-xs",
                          overThreshold || isPremium
                            ? "border-destructive/50 bg-destructive/10 text-destructive-foreground"
                            : isMid
                              ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-200"
                              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold">💰 Costo stimato video</span>
                          <span className="text-base font-bold tabular-nums">{formatEur(est.totalEur)}</span>
                        </div>
                        <div className="mt-1 opacity-80">
                          {input.numScenes} scene × ~8s × {formatEur(pricePerSec)}/sec
                        </div>
                        {overThreshold && (
                          <div className="mt-2 rounded border border-destructive/40 bg-destructive/20 p-2 space-y-1">
                            <div className="font-semibold flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" /> Sopra la tua soglia di {formatEur(threshold)}
                            </div>
                            <div className="text-[11px] opacity-90">Suggerimenti:</div>
                            <ul className="text-[11px] opacity-90 list-disc list-inside space-y-0.5">
                              {savings > 0 && (
                                <li>
                                  Cambia provider a <strong>Luma Ray 2</strong> o <strong>Kling 2.1</strong>: ~{formatEur(cheaperTotal)} (risparmi {formatEur(savings)}).
                                </li>
                              )}
                              {reducedSavings > 0 && (
                                <li>
                                  Riduci la durata media a 5s: ~{formatEur(reducedDurationTotal)} (risparmi {formatEur(reducedSavings)}).
                                </li>
                              )}
                              <li>
                                Modifica la soglia in <a href="/costs" className="underline font-medium">Costi generazioni</a>.
                              </li>
                            </ul>
                          </div>
                        )}
                        {!overThreshold && est.warning && (
                          <div className="mt-1.5 text-[11px] font-medium">{est.warning}</div>
                        )}
                        {!overThreshold && isPremium && (
                          <div className="mt-1.5 text-[11px] opacity-90">
                            Suggerito: <strong>Luma Ray 2</strong> (~{formatEur(0.05 * input.numScenes * 8)}) o <strong>Kling 2.5</strong> per scene non chiave.
                          </div>
                        )}
                      </div>
                    );
                  })()}
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

          {/* Global "apply to all scenes" transition control */}
          <BulkTransitionPanel
            sceneCount={script.scenes.length}
            onApply={(type, duration) => {
              setScript((prev) => {
                const next = applyBulkTransition(prev, type, duration);
                if (next) {
                  toast.success(`Transizione "${type}" applicata a ${next.scenes.length} scene`);
                }
                return next;
              });
            }}
          />

          <div className="grid gap-3">
            {script.scenes.map((scene, idx) => (
              <SceneCard
                key={`scene-${idx}-${scene.sceneNumber}`}
                scene={scene}
                index={idx}
                mode="review"
                aspectRatio={input.videoAspectRatio}
                voices={sceneVoiceOptions}
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
                onRegenerate={(type, opts) => regenerateSceneAsset(idx, type, opts?.correctionNote, { lockCharacter: opts?.lockCharacter })}
                stylePromptModifier={input.stylePromptModifier}
                videoAspectRatio={input.videoAspectRatio}
                lockCharacterDefault={lockCharacterDefault}
                onKeepNew={(type) => keepNewAsset(idx, type)}
                onRollback={(type, versionUrl) => rollbackAsset(idx, type, versionUrl)}
                onDeleteVersion={(type, versionUrl) => deleteVersion(idx, type, versionUrl)}
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

          {/* Bulk character-lock toggle — applies scene.lockCharacter sticky pref to ALL scenes in one click */}
          {(() => {
            const total = script.scenes.length;
            const locked = script.scenes.filter((s) => s.lockCharacter === true).length;
            const allLocked = total > 0 && locked === total;
            const noneLocked = locked === 0;
            return (
              <Card className="border-dashed">
                <CardContent className="py-3 px-4 flex flex-wrap items-center gap-3 justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                    <div className="text-sm">
                      <span className="font-medium">Blocca identità personaggio</span>
                      <span className="text-muted-foreground ml-2">
                        ({locked}/{total} scene con preferenza sticky)
                      </span>
                    </div>
                    {lockCharacterDefault && (
                      <Badge variant="outline" className="text-xs">
                        default progetto attivo
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={allLocked}
                      onClick={() => {
                        const next = script.scenes.map((s) => ({ ...s, lockCharacter: true }));
                        setScript({ ...script, scenes: next });
                        toast.success(`Blocco identità attivato su tutte le ${total} scene`);
                      }}
                    >
                      <ShieldCheck className="w-4 h-4 mr-2" />
                      Applica a tutte le scene
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={noneLocked}
                      onClick={() => {
                        const next = script.scenes.map((s) => {
                          const { lockCharacter: _omit, ...rest } = s;
                          return rest as StoryScene;
                        });
                        setScript({ ...script, scenes: next });
                        toast.success(`Preferenza sticky rimossa da tutte le scene${lockCharacterDefault ? " (resta attivo il default progetto)" : ""}`);
                      }}
                    >
                      Rimuovi da tutte
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Pre-flight audio check — surfaces missing/blob assets BEFORE wasting render credits */}
          <PreFlightAudioPanel
            scenes={script.scenes}
            backgroundMusicUrl={backgroundMusicUrl}
            progress={batchProgress}
            onRegenerateExpired={async (items) => { await runAudioBatchRegen(items); }}
            onAudioDurationMeasured={(r: MeasuredAudioDuration) => {
              setScript((prev) => {
                if (!prev) return prev;
                const next = [...prev.scenes];
                const cur = next[r.sceneIndex];
                if (!cur) return prev;
                if (cur.audioDuration === r.measured && cur.audioDurationWarning === r.warning) return prev;
                next[r.sceneIndex] = {
                  ...cur,
                  audioDuration: r.measured,
                  audioDurationWarning: r.mismatch ? r.warning : undefined,
                };
                return { ...prev, scenes: next };
              });
            }}
          />

          {/* Pre-flight video check — flags missing/blob/aspect/format/duration clips before render */}
          <PreFlightVideoPanel
            scenes={script.scenes}
            expectedAspect={input.videoAspectRatio}
            progress={batchProgress}
            autoRecoveryEnabled={isAutoRecoveryEnabled()}
            onRegenerateProblematic={async (items) => { await runVideoBatchRegen(items); }}
            onDurationMeasured={(r: MeasuredDuration) => {
              // Persist measured duration + warning on the scene so the badge survives re-renders
              setScript(prev => {
                if (!prev) return prev;
                const next = [...prev.scenes];
                const cur = next[r.sceneIndex];
                if (!cur) return prev;
                // Skip when nothing changed (avoid re-render loop)
                if (cur.videoDuration === r.measured && cur.videoDurationWarning === r.warning) return prev;
                next[r.sceneIndex] = {
                  ...cur,
                  videoDuration: r.measured,
                  videoDurationWarning: r.mismatch ? r.warning : undefined,
                };
                return { ...prev, scenes: next };
              });
            }}
          />

          <div className="flex gap-3 flex-wrap">
            <Button variant="outline" onClick={() => setStep("input")}><ChevronLeft className="w-4 h-4 mr-2" />Modifica Input</Button>
            <Button variant="outline" onClick={handleGenerateScript} disabled={isGeneratingScript}><RefreshCw className="w-4 h-4 mr-2" />Rigenera Script</Button>
            <Button variant="outline" onClick={saveProject} disabled={isSaving}><Save className="w-4 h-4 mr-2" />Salva Bozza</Button>
            <Button variant="outline" onClick={exportScriptPDF}><FileText className="w-4 h-4 mr-2" />Esporta PDF</Button>
            {/* Auto-regenerate error scenes — button + preview popover */}
            {(() => {
              const issues = failedOrMissingScenes(script.scenes);
              if (issues.length === 0) return null;

              // Per-scene breakdown of which assets are missing/failed
              const breakdown = issues.map(({ scene, index }) => {
                const missing: { type: "image" | "audio" | "sfx" | "video"; reason: string }[] = [];
                if (scene.imageStatus === "error") missing.push({ type: "image", reason: "errore" });
                else if (!scene.imageUrl) missing.push({ type: "image", reason: "mancante" });
                if (scene.audioStatus === "error") missing.push({ type: "audio", reason: "errore" });
                else if (!scene.audioUrl) missing.push({ type: "audio", reason: "mancante" });
                if (scene.sfxStatus === "error") missing.push({ type: "sfx", reason: "errore" });
                else if (scene.sfxPrompt && !scene.sfxUrl) missing.push({ type: "sfx", reason: "mancante" });
                if (scene.videoStatus === "error") missing.push({ type: "video", reason: "errore" });
                else if (!scene.videoUrl) missing.push({ type: "video", reason: "mancante" });
                return { sceneNumber: scene.sceneNumber, index, missing };
              });

              const iconFor = (t: string) => {
                if (t === "image") return <Image className="w-3 h-3" />;
                if (t === "audio") return <Volume2 className="w-3 h-3" />;
                if (t === "sfx") return <AudioLines className="w-3 h-3" />;
                return <Film className="w-3 h-3" />;
              };

              return (
                <div className="flex items-center gap-1">
                  <Button variant="destructive" onClick={handleAutoRegenerateErrors} disabled={isGenerating}>
                    {isGenerating && regenProgress ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                    {isGenerating && regenProgress
                      ? `Rigenerando ${regenProgress.current}/${regenProgress.total}…`
                      : `Rigenera Scene Fallite (${issues.length})`}
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="destructive"
                        size="icon"
                        disabled={isGenerating}
                        title="Mostra dettaglio scene fallite"
                        className="shrink-0"
                      >
                        <ListChecks className="w-4 h-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-80 p-0">
                      <div className="p-3 border-b border-border">
                        <p className="font-semibold text-sm flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-destructive" />
                          {issues.length} scene con problemi
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Rigenera in batch (max {REGEN_CONCURRENCY} parallele, retry ×{REGEN_MAX_RETRIES}) o apri la singola scena.
                        </p>
                      </div>
                      <ScrollArea className="max-h-72">
                        <ul className="divide-y divide-border">
                          {breakdown.map((b) => (
                            <li key={b.sceneNumber} className="p-3 flex items-start justify-between gap-2 hover:bg-muted/40 transition-colors">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-foreground">Scena {b.sceneNumber}</p>
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {b.missing.map((m, i) => (
                                    <Badge
                                      key={i}
                                      variant={m.reason === "errore" ? "destructive" : "outline"}
                                      className="gap-1 text-[10px] py-0 px-1.5 h-5"
                                    >
                                      {iconFor(m.type)}
                                      <span className="capitalize">{m.type}</span>
                                      <span className="opacity-70">· {m.reason}</span>
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 shrink-0"
                                onClick={() => {
                                  setEditingSceneIndex(b.index);
                                  // Scroll the scene card into view
                                  setTimeout(() => {
                                    const cards = document.querySelectorAll("[data-scene-card]");
                                    cards[b.index]?.scrollIntoView({ behavior: "smooth", block: "center" });
                                  }, 50);
                                }}
                                title="Apri questa scena"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </ScrollArea>
                      <div className="p-2 border-t border-border bg-muted/30">
                        <Button
                          size="sm"
                          variant="destructive"
                          className="w-full"
                          onClick={handleAutoRegenerateErrors}
                          disabled={isGenerating}
                        >
                          <Wand2 className="w-3.5 h-3.5 mr-2" />
                          Rigenera tutte ({issues.length})
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              );
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
                  onClick={() => openRenderPreview("reassemble")}
                  disabled={isGenerating || renderStatus === "processing"}
                  className="bg-primary/90 hover:bg-primary"
                  title={`Salta la generazione delle scene e monta direttamente il video finale dalle ${completedVids.length} scene già pronte`}
                >
                  {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Film className="w-4 h-4 mr-2" />}
                  🎬 Solo concat finale ({completedVids.length} scene pronte)
                </Button>
              );
            })()}
            {(() => {
              const pf = computePreFlight(script.scenes, backgroundMusicUrl);
              return (
                <Button
                  onClick={handleGenerateAll}
                  className="flex-1"
                  size="lg"
                  disabled={!pf.ok}
                  title={pf.ok ? undefined : `${pf.blockingCount} asset audio bloccanti — risolvi prima del render`}
                >
                  <Play className="w-5 h-5 mr-2" />
                  {pf.ok
                    ? `Avvia Produzione (~${formatTime(estimatedProductionTime)})`
                    : `Bloccato (${pf.blockingCount} asset audio)`}
                </Button>
              );
            })()}
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
              <SceneCard
                key={idx}
                scene={scene}
                index={idx}
                mode="generation"
                aspectRatio={input.videoAspectRatio}
                voices={sceneVoiceOptions}
                defaultVoiceId={input.voiceId}
                isEditing={false}
                isPreviewLoading={false}
                onToggleEdit={() => {}}
                onUpdate={() => {}}
                onPreviewAudio={() => {}}
                onDuplicate={() => {}}
                onDelete={() => {}}
                onRegenerate={(type, opts) => regenerateSceneAsset(idx, type, opts?.correctionNote, { lockCharacter: opts?.lockCharacter })}
                stylePromptModifier={input.stylePromptModifier}
                videoAspectRatio={input.videoAspectRatio}
                lockCharacterDefault={lockCharacterDefault}
                onKeepNew={(type) => keepNewAsset(idx, type)}
                onRollback={(type, versionUrl) => rollbackAsset(idx, type, versionUrl)}
                onDeleteVersion={(type, versionUrl) => deleteVersion(idx, type, versionUrl)}
                onUnstuck={() => unstuckScene(idx)}
              />
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
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">Colonna Sonora</p>
                        <AudioProviderBadge state={audioProviders.music} />
                        {musicVerification?.audible === true && (
                          <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px]">
                            <Check className="w-3 h-3 mr-1" />Inclusa nel render
                          </Badge>
                        )}
                        {musicVerification?.audible === false && (
                          <Badge variant="destructive" className="text-[10px]">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            {musicVerification.retried ? "Ancora mancante dopo retry" : "Non rilevata nel render"}
                          </Badge>
                        )}
                      </div>
                      <audio src={backgroundMusicUrl} controls className="w-full mt-1 h-8" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button variant="outline" size="sm" disabled={downloadingId === "music"} onClick={() => downloadFile(backgroundMusicUrl, "soundtrack.mp3", "music")}>
                        {downloadingId === "music" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                      </Button>
                      {musicVerification?.audible === false && (
                        <Button variant="outline" size="sm" onClick={async () => {
                          musicRetryRef.current = 0;
                          setMusicVerification(null);
                          setMusicRetryLog(appendMusicRetryEntry(projectId ?? null, { stage: "manual-retry" }));
                          const newUrl = await generateBackgroundMusic();
                          if (newUrl) {
                            setMusicRetryLog(appendMusicRetryEntry(projectId ?? null, { stage: "regenerate-ok", note: newUrl.slice(0, 80) }));
                            setTimeout(() => handleReassemble(), 500);
                          } else {
                            setMusicRetryLog(appendMusicRetryEntry(projectId ?? null, { stage: "regenerate-failed" }));
                          }
                        }}>
                          <RefreshCw className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                {/* Active audio providers summary — shows ElevenLabs vs AIML fallback at a glance */}
                {(audioProviders.tts || audioProviders.music || audioProviders.sfx) && (
                  <div className="flex flex-col gap-2 p-3 rounded-lg border border-border/60 bg-muted/20">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Provider audio attivi
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <AudioProviderBadge state={audioProviders.tts} />
                        <AudioProviderBadge state={audioProviders.music} />
                        <AudioProviderBadge state={audioProviders.sfx} />
                      </div>
                    </div>
                    {(audioProviders.tts?.fallbackUsed || audioProviders.music?.fallbackUsed || audioProviders.sfx?.fallbackUsed) && (
                      <p className="text-xs text-amber-400 leading-relaxed">
                        ⚠️ Fallback attivo: provider primario non disponibile, parte dell'audio è stata generata da AI/ML API come backup.
                      </p>
                    )}
                  </div>
                )}
                {/* Music skipped (rate limit / no credits) — manual retry button */}
                <MusicSkippedCard
                  state={musicSkip}
                  retrying={retryingMusicOnly}
                  onRetry={retryMusicOnly}
                />
                {/* Persistent music retry status + post-render audio QA report */}
                {(musicRetryLog.entries.length > 0 || finalVideoUrl) && (
                  <MusicRetryStatusCard
                    log={musicRetryLog}
                    busy={isGenerating}
                    onManualRetry={async () => {
                      if (!finalVideoUrl) return;
                      setMusicRetryLog(appendMusicRetryEntry(projectId ?? null, { stage: "manual-retry" }));
                      await verifyAndRetryMusic(finalVideoUrl);
                    }}
                    onClear={() => setMusicRetryLog(resetMusicRetryLog(projectId ?? null))}
                  />
                )}
                {(renderReport || renderReportLoading) && (
                  <RenderReportCard
                    report={renderReport}
                    loading={renderReportLoading}
                    onRerun={finalVideoUrl ? () => runRenderReport(finalVideoUrl, musicVerification?.audible ?? null) : undefined}
                  />
                )}
                <div className="flex gap-3 flex-wrap">
                  <Button disabled={downloadingId === "final"} onClick={() => downloadFile(finalVideoUrl, `${script.title}.mp4`, "final")}>
                    {downloadingId === "final" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}Scarica Video
                  </Button>
                  <Button variant="outline" onClick={() => setStep("script")}>
                    <Pencil className="w-4 h-4 mr-2" />Modifica & Rigenera
                  </Button>
                  <Button variant="outline" onClick={() => { setStep("input"); setScript(null); setFinalVideoUrl(null); setVideoSegments([]); setBackgroundMusicUrl(null); setGenerationProgress(0); setProjectId(null); setRenderStatus("idle"); setPendingRenderId(null); setMusicSkip(null); }}><RotateCcw className="w-4 h-4 mr-2" />Nuova Storia</Button>
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
                    <Button variant="secondary" onClick={() => openRenderPreview("reassemble")} disabled={isGenerating}>
                      {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Film className="w-4 h-4 mr-2" />}
                      Rimonta Video Finale
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => { setStep("input"); setScript(null); setFinalVideoUrl(null); setVideoSegments([]); setBackgroundMusicUrl(null); setProjectId(null); setRenderStatus("idle"); setPendingRenderId(null); setMusicSkip(null); }}><RotateCcw className="w-4 h-4 mr-2" />Nuova Storia</Button>
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
                voices={sceneVoiceOptions}
                defaultVoiceId={input.voiceId}
                isEditing={false}
                isPreviewLoading={false}
                onToggleEdit={() => {}}
                onUpdate={(field, value) => updateScene(idx, field, value)}
                onPreviewAudio={() => {}}
                onDuplicate={() => {}}
                onDelete={() => {}}
                onRegenerate={(type, opts) => regenerateSceneAsset(idx, type, opts?.correctionNote, { lockCharacter: opts?.lockCharacter })}
                stylePromptModifier={input.stylePromptModifier}
                videoAspectRatio={input.videoAspectRatio}
                lockCharacterDefault={lockCharacterDefault}
                onKeepNew={(type) => keepNewAsset(idx, type)}
                onRollback={(type, versionUrl) => rollbackAsset(idx, type, versionUrl)}
                onDeleteVersion={(type, versionUrl) => deleteVersion(idx, type, versionUrl)}
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
          onRegenerateAudio={async ({ type, sceneIndex }) => {
            if (type === "music") {
              await generateBackgroundMusic();
              return;
            }
            if (typeof sceneIndex !== "number" || !script) return;
            // sceneIndex from dialog is the index inside `vids` (completed videos), map to real scene index
            const vids = script.scenes.filter(s => s.videoStatus === "completed" && s.videoUrl);
            const targetVid = vids[sceneIndex];
            if (!targetVid) return;
            const realIdx = script.scenes.findIndex(s => s.sceneNumber === targetVid.sceneNumber);
            if (realIdx < 0) return;
            await regenerateSceneAsset(realIdx, type === "narration" ? "audio" : "sfx");
          }}
        />
      )}

      {/* Pre-render batch audio regen confirmation — with detailed per-scene preview */}
      <AlertDialog open={showBatchAudioRegenDialog} onOpenChange={(o) => { if (!isBatchRegenAudio) setShowBatchAudioRegenDialog(o); }}>
        <AlertDialogContent className="max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
              Audio scaduti rilevati
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                {batchAudioStats && (
                  <p className="text-sm">
                    <strong className="text-foreground">{batchAudioStats.blob} su {batchAudioStats.total}</strong> asset audio ({batchAudioStats.pct}%) sono URL temporanei del browser e <strong>non saranno inclusi</strong> nel video finale.
                  </p>
                )}
                <p className="text-xs">Seleziona quali rigenerare ora (puoi scegliere tutto o solo alcuni):</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          {batchAudioDetails.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  className="text-primary hover:underline disabled:opacity-50"
                  disabled={isBatchRegenAudio}
                  onClick={() => setBatchSelectedKeys(new Set(batchAudioDetails.map(d => d.key)))}
                >
                  Seleziona tutto
                </button>
                <button
                  type="button"
                  className="text-muted-foreground hover:underline disabled:opacity-50"
                  disabled={isBatchRegenAudio}
                  onClick={() => setBatchSelectedKeys(new Set())}
                >
                  Deseleziona tutto
                </button>
                <span className="text-muted-foreground">
                  {batchSelectedKeys.size}/{batchAudioDetails.length} selezionati
                </span>
              </div>
              <ScrollArea className="h-56 rounded-md border bg-muted/30 p-2">
                <div className="space-y-1">
                  {batchAudioDetails.map((d) => {
                    const checked = batchSelectedKeys.has(d.key);
                    const typeLabel = d.type === "audio" ? "🎙️ Voce narrante" : d.type === "sfx" ? "🔊 Effetto sonoro (SFX)" : "🎵 Musica di sottofondo";
                    const sceneLabel = d.type === "music" ? "Globale" : `Scena ${d.sceneNumber}`;
                    return (
                      <label
                        key={d.key}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-2 py-2 text-sm cursor-pointer transition-colors",
                          checked ? "bg-primary/10" : "hover:bg-muted/50",
                          isBatchRegenAudio && "pointer-events-none opacity-60",
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          disabled={isBatchRegenAudio}
                          onCheckedChange={(v) => {
                            setBatchSelectedKeys((prev) => {
                              const next = new Set(prev);
                              if (v) next.add(d.key); else next.delete(d.key);
                              return next;
                            });
                          }}
                        />
                        <span className="flex-1">{typeLabel}</span>
                        <Badge variant="outline" className="text-xs">{sceneLabel}</Badge>
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isBatchRegenAudio}
              onClick={() => {
                setShowBatchAudioRegenDialog(false);
                setBatchAudioStats(null);
                setBatchAudioDetails([]);
                setBatchSelectedKeys(new Set());
                // User chose to skip — open render preview anyway (they can decide there)
                setShowRenderPreview(true);
              }}
            >
              No, procedi così
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isBatchRegenAudio || batchSelectedKeys.size === 0}
              onClick={(e) => { e.preventDefault(); handleBatchRegenAudio(); }}
            >
              {isBatchRegenAudio ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Rigenerazione…</>
              ) : (
                <><RefreshCw className="w-4 h-4 mr-2" />Rigenera selezionati ({batchSelectedKeys.size})</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Final recovery failure dialog: shown when auto-recovery exhausts MAX_RECOVERY_ATTEMPTS */}
      <AlertDialog open={showRecoveryFailureDialog} onOpenChange={setShowRecoveryFailureDialog}>
        <AlertDialogContent className="max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Recupero audio fallito ({MAX_RECOVERY_ATTEMPTS}/{MAX_RECOVERY_ATTEMPTS} tentativi)
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p className="text-sm">
                  Dopo {MAX_RECOVERY_ATTEMPTS} tentativi automatici di rigenerazione, i seguenti asset audio risultano ancora non raggiungibili da Shotstack e <strong>non sono stati inclusi</strong> nel video finale:
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          {recoveryFailureAssets.length > 0 && (
            <ScrollArea className="h-64 rounded-md border bg-muted/30 p-2">
              <div className="space-y-1">
                {recoveryFailureAssets.map((a, i) => {
                  const typeLabel = a.type === "narration" ? "🎙️ Voce narrante" : a.type === "sfx" ? "🔊 Effetto sonoro (SFX)" : a.type === "music" ? "🎵 Musica di sottofondo" : `❓ ${a.type}`;
                  const sceneLabel = a.type === "music" ? "Globale" : a.sceneNumber ? `Scena ${a.sceneNumber}` : "Sconosciuto";
                  // Resolve the freshest URL we have for this asset (script state > backend skipped url)
                  let playUrl: string | null = null;
                  if (a.type === "music") {
                    playUrl = backgroundMusicUrl ?? null;
                  } else if (a.sceneNumber && script) {
                    const scene = script.scenes.find(s => s.sceneNumber === a.sceneNumber);
                    if (scene) {
                      playUrl = a.type === "narration" ? (scene.audioUrl ?? null) : (scene.sfxUrl ?? null);
                    }
                  }
                  if (!playUrl) playUrl = (a as any).url ?? null;
                  const isBlob = !!playUrl && playUrl.startsWith("blob:");
                  return (
                    <div key={`${a.type}-${a.index ?? i}`} className="flex flex-col gap-2 rounded-md px-2 py-2 text-sm bg-destructive/5">
                      <div className="flex items-center gap-3">
                        <span className="flex-1">{typeLabel}</span>
                        <Badge variant="outline" className="text-xs">{sceneLabel}</Badge>
                        {isBlob && <Badge variant="secondary" className="text-xs">blob</Badge>}
                      </div>
                      <AssetWaveform url={playUrl} />
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          <p className="text-xs text-muted-foreground">
            Suggerimento: rigenera manualmente questi asset dalle card delle scene (o dal pannello musica per la colonna sonora), poi rilancia il rendering finale.
          </p>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowRecoveryFailureDialog(false);
              setRecoveryFailureAssets([]);
              setRecoveryFailureContext(null);
            }}>
              Chiudi
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                // Pre-select the failed assets in the batch dialog, then open it
                if (!script) return;
                const vids = script.scenes.filter(s => s.videoStatus === "completed" && s.videoUrl);
                const details: Array<{ key: string; realIdx: number; sceneNumber: number; type: "audio" | "sfx" | "music" }> = [];
                recoveryFailureAssets.forEach((a) => {
                  if (a.type === "music") {
                    details.push({ key: "music-global", realIdx: -1, sceneNumber: 0, type: "music" });
                  } else if (typeof a.index === "number") {
                    const targetVid = vids[a.index];
                    if (!targetVid) return;
                    const realIdx = script.scenes.findIndex(s => s.sceneNumber === targetVid.sceneNumber);
                    if (realIdx < 0) return;
                    const t: "audio" | "sfx" = a.type === "narration" ? "audio" : "sfx";
                    details.push({ key: `${t}-${targetVid.sceneNumber}`, realIdx, sceneNumber: targetVid.sceneNumber, type: t });
                  }
                });
                if (details.length > 0) {
                  setBatchAudioDetails(details);
                  setBatchSelectedKeys(new Set(details.map(d => d.key)));
                  setBatchAudioStats({ blob: details.length, total: details.length, pct: 100 });
                  setShowRecoveryFailureDialog(false);
                  setRecoveryFailureAssets([]);
                  // Save context so after batch regen the user is taken back to the right action
                  setPendingRenderAction(recoveryFailureContext);
                  setRecoveryFailureContext(null);
                  setShowBatchAudioRegenDialog(true);
                } else {
                  setShowRecoveryFailureDialog(false);
                }
              }}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Rigenera manualmente e rilancia
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
