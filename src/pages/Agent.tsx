import { useEffect, useRef, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { AuthGuard } from "@/components/AuthGuard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import {
  Bot, FileText, Loader2, Sparkles, CheckCircle2, AlertCircle, Play, Download,
  RefreshCw, Image as ImageIcon, Palette, Type as TypeIcon, Wand2, Copy, History,
  Save, Trash2, Mic, PenTool, Zap, Upload, FileJson,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useInworldVoices } from "@/hooks/useInworldVoices";
import { TransitionPreview } from "@/components/agent/TransitionPreview";

type SceneOverride = {
  keyword: string;
  duration: number;
  selectedIndex: number;
  broll_type?: "talking_head" | "sketch";
  suggestions: { url: string; thumb: string; source: string; id?: string }[];
};

type UserPreset = {
  id: string;
  name: string;
  base_preset: string;
  color_palette: { primary: string; secondary: string; accent: string };
  typography: string;
  transition_level: string;
  subtitle_config: { enabled: boolean; language: string; fontSize: string; position: string };
  intro_title: any;
  outro_cta: any;
  broll_mix: { talking_head: number; sketch: number };
  aspect_ratio: string;
  scene_duration_sec: number;
};

type ProjectRow = {
  id: string;
  title: string;
  brief: string;
  pdf_text: string | null;
  language: string;
  voice_id: string | null;
  target_duration: number;
  aspect_ratio: string;
  plan: any;
  plan_status: string;
  execution_status: string;
  execution_step: string | null;
  progress_pct: number;
  progress_log: Array<{ at: number; message: string }>;
  selected_assets: any[];
  scene_overrides: SceneOverride[];
  narration_url: string | null;
  final_video_url: string | null;
  json2video_project_id: string | null;
  error_message: string | null;
  style_preset: string;
  color_palette: { primary: string; secondary: string; accent: string };
  typography: string;
  transition_level: string;
  subtitle_config: { enabled: boolean; language: string; fontSize: string; position: string };
  intro_title: { enabled: boolean; text: string; duration: number } | null;
  outro_cta: { enabled: boolean; text: string; duration: number } | null;
  broll_mix: { talking_head: number; sketch: number };
  vidnoz_avatar_id: string | null;
  vidnoz_avatar_url: string | null;
  vidnoz_voice_id: string | null;
  vidnoz_voice_style: string | null;
  use_vidnoz_for_talking_head: boolean;
  image_source: "freepik" | "ai" | "piapi" | string;
  voice_quality_strict: boolean;
  created_at: string;
  heartbeat_at: string | null;
  failed_scenes: Array<{ index: number; keyword: string; reason: string; provider: string; at: number }>;
};

const IMAGE_SOURCES: { id: "freepik" | "ai" | "piapi"; label: string; hint: string }[] = [
  { id: "freepik", label: "Freepik (clean)", hint: "URL puliti via /v1/videos/{id}/download. Niente watermark." },
  { id: "ai", label: "AI (Gemini Nano)", hint: "Generazione AI: zero watermark, stile coerente." },
  { id: "piapi", label: "PiAPI / Flux", hint: "Generazione AI ad alta fedeltà via PiAPI." },
];

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "it", label: "Italiano" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "pt", label: "Português" },
];

const normalizeVoiceLang = (value?: string | null) =>
  (value || "").toLowerCase().replace("_", "-").split("-")[0];

const isVoiceNativeForLanguage = (voice: { langCode?: string; tags?: string[] }, lang: string) => {
  const target = normalizeVoiceLang(lang);
  const direct = normalizeVoiceLang(voice.langCode);
  if (direct) return direct === target;
  return (voice.tags || []).some((tag) => normalizeVoiceLang(tag) === target || tag.toLowerCase().includes(`language:${target}`));
};

const STYLE_PRESETS = [
  { id: "modern", label: "Modern", palette: { primary: "#3B82F6", secondary: "#0F172A", accent: "#F59E0B" }, font: "Inter" },
  { id: "corporate", label: "Corporate", palette: { primary: "#1E40AF", secondary: "#FFFFFF", accent: "#94A3B8" }, font: "Helvetica" },
  { id: "vibrant", label: "Vibrant", palette: { primary: "#EC4899", secondary: "#1E1B4B", accent: "#FBBF24" }, font: "Poppins" },
  { id: "minimal", label: "Minimal", palette: { primary: "#000000", secondary: "#FFFFFF", accent: "#737373" }, font: "Inter" },
  { id: "cinematic", label: "Cinematic", palette: { primary: "#F59E0B", secondary: "#000000", accent: "#DC2626" }, font: "Georgia" },
  // Reference: Agent Opus output (9:16, ~3s scenes, talking-head + sketch B-roll, cyan/blue accents)
  { id: "opus", label: "Opus-style", palette: { primary: "#00D4E0", secondary: "#0B1B2B", accent: "#2B8CD9" }, font: "Inter" },
];

// Defaults applied when user picks the "opus" preset
export const OPUS_PRESET_DEFAULTS = {
  aspect_ratio: "9:16" as const,
  transition_level: "subtle",
  scene_duration_sec: 3,
  subtitle_config: {
    enabled: true,
    language: "auto",
    fontSize: "medium",
    position: "bottom-center",
  },
  intro_title: { enabled: true, text: "", duration: 2 },
  outro_cta: { enabled: true, text: "Follow for more", duration: 2.5 },
};

const ACTIVE_PROJECT_KEY = "agent.activeProjectId";

export default function AgentPage() {
  const [activeTab, setActiveTab] = useState<"create" | "history">(
    () => (typeof window !== "undefined" && (localStorage.getItem("agent.activeTab") as any)) || "create",
  );
  // Persist inner Style/Subs/Branding tab so realtime updates don't reset it.
  const [activeStyleTab, setActiveStyleTab] = useState<string>(
    () => (typeof window !== "undefined" && localStorage.getItem("agent.activeStyleTab")) || "style",
  );
  useEffect(() => { localStorage.setItem("agent.activeTab", activeTab); }, [activeTab]);
  useEffect(() => { localStorage.setItem("agent.activeStyleTab", activeStyleTab); }, [activeStyleTab]);

  useEffect(() => {
    const projectId = typeof window !== "undefined" ? localStorage.getItem(ACTIVE_PROJECT_KEY) : null;
    if (!projectId) return;
    let cancelled = false;
    setRestoringProject(true);
    (async () => {
      const { data, error } = await supabase
        .from("agent_projects")
        .select("*")
        .eq("id", projectId)
        .maybeSingle();
      if (!cancelled) {
        if (data && !error) setProject(data as unknown as ProjectRow);
        setRestoringProject(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // creation form
  const [brief, setBrief] = useState("");
  const [language, setLanguage] = useState("it");
  const [duration, setDuration] = useState(35);
  const [aspect, setAspect] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [voiceId, setVoiceId] = useState<string>("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [extractingPdf, setExtractingPdf] = useState(false);
  const [pdfText, setPdfText] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [loadingStoryboard, setLoadingStoryboard] = useState(false);
  const [restoringProject, setRestoringProject] = useState(false);

  const [project, setProject] = useState<ProjectRow | null>(null);
  const [history, setHistory] = useState<ProjectRow[]>([]);
  const [userPresets, setUserPresets] = useState<UserPreset[]>([]);
  const [vidnozAvatars, setVidnozAvatars] = useState<Array<{ avatar_id: string; name: string; thumb: string; avatar_url: string; gender: string; category?: string; is_business?: boolean }>>([]);
  const [vidnozVoices, setVidnozVoices] = useState<Array<{ voice_id: string; name: string; language: string; country_name?: string; gender: string; preview_audio_url?: string; preview_image_url?: string; emotions?: string[]; styles?: string[] }>>([]);
  const [vidnozLoading, setVidnozLoading] = useState(false);
  const [vidnozPreview, setVidnozPreview] = useState<{ sceneIdx: number; url: string } | null>(null);
  const [vidnozPreviewLoading, setVidnozPreviewLoading] = useState<number | null>(null);
  // Voice browser: search + pagination + business-only filter for avatars
  const [voiceSearch, setVoiceSearch] = useState("");
  const [voicePage, setVoicePage] = useState(0);
  const [avatarBusinessOnly, setAvatarBusinessOnly] = useState(true);
  const [newPresetName, setNewPresetName] = useState("");
  const pollRef = useRef<number | null>(null);

  const { voices, systemVoices, isLoading: voicesLoading } = useInworldVoices();
  const nativeVoices = language === "en"
    ? systemVoices
    : voices.filter((voice) => isVoiceNativeForLanguage(voice, language));

  // realtime
  useEffect(() => {
    if (!project?.id) return;
    const channel = supabase
      .channel(`agent_project_${project.id}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "agent_projects", filter: `id=eq.${project.id}` },
        (payload) => {
          // Merge instead of replace: realtime payloads can omit large jsonb
          // fields (plan, scene_overrides) which would unmount the wizard
          // (planReady becomes false) and "kick the user out" mid-edit.
          const incoming = payload.new as Partial<ProjectRow>;
          setProject((prev) => {
            if (!prev) return incoming as ProjectRow;
            const merged: any = { ...prev };
            for (const [k, v] of Object.entries(incoming)) {
              if (v !== null && v !== undefined) merged[k] = v;
            }
            return merged as ProjectRow;
          });
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [project?.id]);

  // poll status
  useEffect(() => {
    if (!project?.json2video_project_id) return;
    if (project.final_video_url || project.execution_status === "done" || project.execution_status === "error") return;
    let cancelled = false;
    const tick = async () => {
      try {
        await supabase.functions.invoke("agent-status", { body: { projectId: project.id } });
      } catch (e) { console.warn(e); }
      if (!cancelled) pollRef.current = window.setTimeout(tick, 8000);
    };
    pollRef.current = window.setTimeout(tick, 5000);
    return () => { cancelled = true; if (pollRef.current) window.clearTimeout(pollRef.current); };
  }, [project?.id, project?.json2video_project_id, project?.execution_status, project?.final_video_url]);

  // load history when tab opens
  useEffect(() => {
    if (activeTab !== "history") return;
    (async () => {
      const { data } = await supabase
        .from("agent_projects")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (data) setHistory(data as unknown as ProjectRow[]);
    })();
  }, [activeTab, project?.id]);

  const handleDeleteProject = async (id: string, title: string) => {
    const { error } = await supabase.from("agent_projects").delete().eq("id", id);
    if (error) {
      toast.error(`Impossibile eliminare: ${error.message}`);
      return;
    }
    setHistory((prev) => prev.filter((p) => p.id !== id));
    if (project?.id === id) {
      localStorage.removeItem(ACTIVE_PROJECT_KEY);
      setProject(null);
    }
    toast.success(`Progetto "${title}" eliminato`);
  };

  // Load user-saved style presets
  const loadUserPresets = async () => {
    const { data } = await supabase
      .from("agent_user_presets")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setUserPresets(data as unknown as UserPreset[]);
  };
  useEffect(() => { loadUserPresets(); }, []);

  const VIDNOZ_CACHE_KEY = "agent.vidnoz.catalog.v2";
  const VIDNOZ_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

  const loadVidnozCatalog = async (force = false) => {
    // Try localStorage cache first (avoids edge round-trip on tab switches / re-mounts)
    if (!force) {
      try {
        const raw = localStorage.getItem(VIDNOZ_CACHE_KEY);
        if (raw) {
          const cached = JSON.parse(raw);
          if (cached?.ts && Date.now() - cached.ts < VIDNOZ_CACHE_TTL_MS) {
            if (Array.isArray(cached.avatars) && Array.isArray(cached.voices)) {
              if (vidnozAvatars.length === 0) setVidnozAvatars(cached.avatars);
              if (vidnozVoices.length === 0) setVidnozVoices(cached.voices);
              return;
            }
          }
        }
      } catch (_) { /* ignore corrupt cache */ }
    }
    if (!force && vidnozAvatars.length > 0 && vidnozVoices.length > 0) return;
    setVidnozLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("vidnoz-avatars", {
        body: force ? { refresh: true } : {},
      });
      if (error) throw error;
      const avatars = Array.isArray(data?.avatars) ? data.avatars : [];
      const voices = Array.isArray(data?.voices) ? data.voices : [];
      setVidnozAvatars(avatars);
      setVidnozVoices(voices);
      try {
        localStorage.setItem(VIDNOZ_CACHE_KEY, JSON.stringify({ ts: Date.now(), avatars, voices }));
      } catch (_) {}
    } catch (e) {
      console.error(e);
      toast.error("Impossibile caricare avatar/voci Vidnoz");
    } finally {
      setVidnozLoading(false);
    }
  };

  // Compatibility helper: voice matches the project language (2-letter prefix).
  const isVidnozVoiceCompatible = (
    v: { language?: string },
    lang?: string | null
  ) => {
    if (!lang) return true;
    const target = lang.slice(0, 2).toLowerCase();
    const vl = (v.language || "").slice(0, 2).toLowerCase();
    return vl === target;
  };

  // Auto-load Vidnoz catalog when enabled or language changes (uses cache, no refetch).
  // Avatar selection no longer triggers a reload (cache covers it).
  useEffect(() => {
    if (!project?.use_vidnoz_for_talking_head) return;
    loadVidnozCatalog(false);
    setVoicePage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.language, project?.use_vidnoz_for_talking_head]);

  // If the current selected voice is no longer compatible with the chosen language, clear it.
  useEffect(() => {
    if (!project?.vidnoz_voice_id || vidnozVoices.length === 0) return;
    const current = vidnozVoices.find((v) => v.voice_id === project.vidnoz_voice_id);
    if (current && !isVidnozVoiceCompatible(current, project.language)) {
      updateProject({ vidnoz_voice_id: null, vidnoz_voice_style: null } as any);
      toast.info(`Voce Vidnoz rimossa: non compatibile con la lingua ${project.language?.toUpperCase()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.language, vidnozVoices]);

  // Reset selected style when voice changes (emotions are voice-specific)
  useEffect(() => {
    if (!project?.vidnoz_voice_id) return;
    const v = vidnozVoices.find((x) => x.voice_id === project.vidnoz_voice_id);
    if (!v) return;
    const available = (v.emotions && v.emotions.length > 0 ? v.emotions : v.styles) || [];
    if (project.vidnoz_voice_style && !available.includes(project.vidnoz_voice_style)) {
      updateProject({ vidnoz_voice_style: null } as any);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.vidnoz_voice_id, vidnozVoices]);


  // Compute the proportional transcript slice for a given talking-head scene
  // (mirrors the splitting logic used server-side in agent-execute).
  const getSceneTranscriptSlice = (sceneIdx: number): string => {
    if (!project?.plan?.transcript) return "";
    const overrides = project.scene_overrides || [];
    const thIdxs = overrides.map((o, i) => (o?.broll_type !== "sketch" ? i : -1)).filter(i => i >= 0);
    if (!thIdxs.includes(sceneIdx)) return "";
    const totalDur = thIdxs.reduce((s, i) => s + (Number(overrides[i]?.duration) || 4), 0);
    const words = String(project.plan.transcript).split(/\s+/).filter(Boolean);
    let cursor = 0;
    for (const i of thIdxs) {
      const share = totalDur > 0 ? (Number(overrides[i]?.duration) || 4) / totalDur : 1 / thIdxs.length;
      const wc = Math.max(1, Math.round(words.length * share));
      if (i === sceneIdx) return words.slice(cursor, cursor + wc).join(" ");
      cursor += wc;
    }
    return "";
  };

  const handlePreviewVidnozScene = async (sceneIdx: number) => {
    if (!project) return;
    if (!project.vidnoz_avatar_url || !project.vidnoz_voice_id) {
      toast.error("Seleziona prima un avatar e una voce Vidnoz nel pannello Stile");
      return;
    }
    const text = getSceneTranscriptSlice(sceneIdx);
    if (!text) {
      toast.error("Nessun testo disponibile per questa scena");
      return;
    }
    setVidnozPreviewLoading(sceneIdx);
    setVidnozPreview(null);
    try {
      const { data, error } = await supabase.functions.invoke("vidnoz-talking-avatar", {
        body: {
          text,
          voice_id: project.vidnoz_voice_id,
          avatar_url: project.vidnoz_avatar_url,
          voice_style: project.vidnoz_voice_style || undefined,
        },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("Nessun URL video restituito");
      setVidnozPreview({ sceneIdx, url: data.url });
      toast.success(`Anteprima Vidnoz scena ${sceneIdx + 1} pronta`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Errore generazione anteprima Vidnoz");
    } finally {
      setVidnozPreviewLoading(null);
    }
  };

  const handlePdfUpload = async (file: File) => {
    setPdfFile(file);
    setExtractingPdf(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        const { data, error } = await supabase.functions.invoke("extract-pdf-text", { body: { pdfBase64: base64 } });
        if (error) throw error;
        setPdfText(data?.text || "");
        toast.success(`PDF analizzato (${data?.text?.length || 0} caratteri)`);
        setExtractingPdf(false);
      };
      reader.readAsDataURL(file);
    } catch (e) {
      console.error(e);
      toast.error("Estrazione PDF fallita");
      setExtractingPdf(false);
    }
  };

  const handleCreateAndPlan = async () => {
    if (!brief.trim()) { toast.error("Inserisci un brief"); return; }
    const effectiveVoiceId = language !== "en" ? (voiceId || nativeVoices[0]?.voiceId || "") : voiceId;
    // Client-side validation: only language-native Inworld voices are allowed for non-EN.
    if (language !== "en") {
      const allowed = nativeVoices.map((v) => v.voiceId);
      if (allowed.length === 0) {
        toast.error(`Nessuna voce Inworld nativa verificata per ${language.toUpperCase()}.`);
        return;
      }
      if (!allowed.includes(effectiveVoiceId)) {
        toast.error(`Voce "${effectiveVoiceId}" non valida per ${language.toUpperCase()}. Scegline una dalla lista verificata.`);
        return;
      }
    }
    setCreating(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not signed in");

      const { data: created, error } = await supabase
        .from("agent_projects")
        .insert({
          user_id: uid,
          title: "New Agent project",
          brief, pdf_text: pdfText || null, language,
          voice_id: effectiveVoiceId || null, target_duration: duration, aspect_ratio: aspect,
        })
        .select("*").single();
      if (error) throw error;

      localStorage.setItem(ACTIVE_PROJECT_KEY, created.id);
      setProject(created as unknown as ProjectRow);

      const { error: planErr } = await supabase.functions.invoke("agent-plan", { body: { projectId: created.id } });
      if (planErr) throw planErr;

      const { data: refreshed } = await supabase.from("agent_projects").select("*").eq("id", created.id).single();
      if (refreshed) setProject(refreshed as unknown as ProjectRow);

      // Auto-fetch storyboard suggestions
      await loadStoryboard(created.id);

      toast.success("Piano video pronto");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Errore");
    } finally { setCreating(false); }
  };

  const loadStoryboard = async (id: string) => {
    setLoadingStoryboard(true);
    try {
      const { error } = await supabase.functions.invoke("agent-storyboard", { body: { projectId: id } });
      if (error) throw error;
      const { data } = await supabase.from("agent_projects").select("*").eq("id", id).single();
      if (data) setProject(data as unknown as ProjectRow);
    } catch (e) {
      toast.error("Errore caricamento storyboard");
    } finally { setLoadingStoryboard(false); }
  };

  const handleConfirmAndExecute = async () => {
    if (!project) return;
    try {
      toast.info("Avvio produzione...");
      const { error } = await supabase.functions.invoke("agent-execute", { body: { projectId: project.id } });
      if (error) throw error;
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Errore esecuzione");
    }
  };

  const updateProject = async (patch: Partial<ProjectRow>) => {
    if (!project) return;
    const next = { ...project, ...patch } as ProjectRow;
    setProject(next);
    await supabase.from("agent_projects").update(patch as any).eq("id", project.id);
  };

  const handleEditTranscript = (newTranscript: string) => {
    if (!project) return;
    const updated = { ...project.plan, transcript: newTranscript };
    updateProject({ plan: updated } as any);
  };

  const handleSelectAsset = (sceneIdx: number, suggestionIdx: number) => {
    if (!project) return;
    const overrides = [...(project.scene_overrides || [])];
    overrides[sceneIdx] = { ...overrides[sceneIdx], selectedIndex: suggestionIdx };
    updateProject({ scene_overrides: overrides });
  };

  const handleSceneDuration = (sceneIdx: number, duration: number) => {
    if (!project) return;
    const overrides = [...(project.scene_overrides || [])];
    overrides[sceneIdx] = { ...overrides[sceneIdx], duration: Math.max(1, Math.min(15, duration)) };
    updateProject({ scene_overrides: overrides });
  };

  const handleApplyStylePreset = (presetId: string) => {
    const preset = STYLE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const patch: any = {
      style_preset: preset.id,
      color_palette: preset.palette,
      typography: preset.font,
    };
    // "Opus-style": curated defaults inspired by Agent Opus reference output
    if (preset.id === "opus") {
      patch.aspect_ratio = OPUS_PRESET_DEFAULTS.aspect_ratio;
      patch.transition_level = OPUS_PRESET_DEFAULTS.transition_level;
      patch.subtitle_config = OPUS_PRESET_DEFAULTS.subtitle_config;
      patch.intro_title = {
        ...OPUS_PRESET_DEFAULTS.intro_title,
        text: project?.intro_title?.text || project?.title || "",
      };
      patch.outro_cta = project?.outro_cta?.text
        ? project.outro_cta
        : OPUS_PRESET_DEFAULTS.outro_cta;
      if (Array.isArray(project?.scene_overrides) && project.scene_overrides.length > 0) {
        patch.scene_overrides = project.scene_overrides.map((s) => ({
          ...s,
          duration: OPUS_PRESET_DEFAULTS.scene_duration_sec,
        }));
      }
      toast.success("Opus-style applied: 9:16, fast cuts, cyan/blue palette, captions on");
    }
    updateProject(patch);
  };

  // Re-pace storyboard scenes to the Opus-style ~3s rhythm
  const handleRepaceOpus = () => {
    if (!project?.scene_overrides?.length) return;
    const overrides = project.scene_overrides.map((s) => ({
      ...s,
      duration: OPUS_PRESET_DEFAULTS.scene_duration_sec,
    }));
    updateProject({ scene_overrides: overrides });
    toast.success("Storyboard re-pacciato a ~3s per scena (Opus-style)");
  };

  // B-roll mix update + reload storyboard so suggestions match the new mix
  const handleBrollMixChange = async (talkingHead: number) => {
    if (!project) return;
    const mix = { talking_head: talkingHead, sketch: 100 - talkingHead };
    await updateProject({ broll_mix: mix });
  };
  const handleBrollTypeOverride = (sceneIdx: number, type: "talking_head" | "sketch") => {
    if (!project) return;
    const overrides = [...(project.scene_overrides || [])];
    overrides[sceneIdx] = { ...overrides[sceneIdx], broll_type: type };
    updateProject({ scene_overrides: overrides });
  };

  // Save current style as a personal preset
  const handleSavePreset = async () => {
    if (!project) return;
    const name = newPresetName.trim() || `My ${project.style_preset} preset`;
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    const avgDuration =
      project.scene_overrides?.length
        ? Math.round(
            (project.scene_overrides.reduce((a, s) => a + (s.duration || 3), 0) /
              project.scene_overrides.length) * 10
          ) / 10
        : 3;
    const { error } = await supabase.from("agent_user_presets").insert({
      user_id: uid,
      name,
      base_preset: project.style_preset,
      color_palette: project.color_palette,
      typography: project.typography,
      transition_level: project.transition_level,
      subtitle_config: project.subtitle_config,
      intro_title: project.intro_title,
      outro_cta: project.outro_cta,
      broll_mix: project.broll_mix || { talking_head: 50, sketch: 50 },
      aspect_ratio: project.aspect_ratio,
      scene_duration_sec: avgDuration,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`Preset "${name}" salvato`);
    setNewPresetName("");
    loadUserPresets();
  };

  const handleApplyUserPreset = async (preset: UserPreset) => {
    if (!project) return;
    const patch: any = {
      color_palette: preset.color_palette,
      typography: preset.typography,
      transition_level: preset.transition_level,
      subtitle_config: preset.subtitle_config,
      intro_title: preset.intro_title,
      outro_cta: preset.outro_cta,
      broll_mix: preset.broll_mix,
      aspect_ratio: preset.aspect_ratio,
      style_preset: preset.base_preset,
    };
    if (project.scene_overrides?.length) {
      patch.scene_overrides = project.scene_overrides.map((s) => ({
        ...s,
        duration: preset.scene_duration_sec || s.duration,
      }));
    }
    await updateProject(patch);
    toast.success(`Preset "${preset.name}" applicato`);
  };

  const handleDeleteUserPreset = async (id: string) => {
    const { error } = await supabase.from("agent_user_presets").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Preset eliminato");
    loadUserPresets();
  };

  const presetToExportPayload = (p: UserPreset) => ({
    name: p.name,
    base_preset: p.base_preset,
    color_palette: p.color_palette,
    typography: p.typography,
    transition_level: p.transition_level,
    subtitle_config: p.subtitle_config,
    intro_title: p.intro_title,
    outro_cta: p.outro_cta,
    broll_mix: p.broll_mix,
    aspect_ratio: p.aspect_ratio,
    scene_duration_sec: p.scene_duration_sec,
  });

  const downloadJson = (obj: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportPreset = (preset: UserPreset) => {
    downloadJson(
      { kind: "agent_user_preset", version: "1.0", exported_at: new Date().toISOString(), preset: presetToExportPayload(preset) },
      `agent-preset-${preset.name.toLowerCase().replace(/\s+/g, "-")}.json`
    );
    toast.success("Preset esportato");
  };

  const handleExportAllPresets = () => {
    if (userPresets.length === 0) { toast.error("Nessun preset da esportare"); return; }
    downloadJson(
      { kind: "agent_user_presets_bundle", version: "1.0", exported_at: new Date().toISOString(), presets: userPresets.map(presetToExportPayload) },
      `agent-presets-bundle-${Date.now()}.json`
    );
    toast.success(`${userPresets.length} preset esportati`);
  };

  const handleImportPresets = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const list: any[] = Array.isArray(data?.presets) ? data.presets
        : data?.preset ? [data.preset]
        : Array.isArray(data) ? data
        : [data];
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) { toast.error("Devi effettuare il login"); return; }

      const rows = list
        .filter((p) => p && p.name && p.color_palette)
        .map((p) => ({
          user_id: uid,
          name: p.name,
          base_preset: p.base_preset || "modern",
          color_palette: p.color_palette,
          typography: p.typography || "Inter",
          transition_level: p.transition_level || "subtle",
          subtitle_config: p.subtitle_config || { enabled: true, language: "auto", fontSize: "medium", position: "bottom-center" },
          intro_title: p.intro_title || null,
          outro_cta: p.outro_cta || null,
          broll_mix: p.broll_mix || { talking_head: 50, sketch: 50 },
          aspect_ratio: p.aspect_ratio || "16:9",
          scene_duration_sec: p.scene_duration_sec || 3,
        }));

      if (rows.length === 0) throw new Error("Nessun preset valido nel file");
      const { error } = await supabase.from("agent_user_presets").insert(rows);
      if (error) throw error;
      toast.success(`${rows.length} preset importati`);
      loadUserPresets();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Errore importazione");
    } finally {
      e.target.value = "";
    }
  };


  const handleDuplicate = async (p: ProjectRow) => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    const { data, error } = await supabase
      .from("agent_projects")
      .insert({
        user_id: uid,
        title: `${p.title} (copy)`,
        brief: p.brief,
        pdf_text: p.pdf_text,
        language: p.language,
        voice_id: p.voice_id,
        target_duration: p.target_duration,
        aspect_ratio: p.aspect_ratio,
        style_preset: p.style_preset,
        color_palette: p.color_palette,
        typography: p.typography,
        transition_level: p.transition_level,
        subtitle_config: p.subtitle_config,
        intro_title: p.intro_title,
        outro_cta: p.outro_cta,
        broll_mix: p.broll_mix || { talking_head: 50, sketch: 50 },
      })
      .select("*").single();
    if (error) { toast.error(error.message); return; }
    toast.success("Progetto duplicato. Modifica brief, lingua o voce e rigenera il piano.");
    setProject(data as unknown as ProjectRow);
    setBrief(data.brief);
    setLanguage(data.language);
    setVoiceId(data.voice_id || "");
    setActiveTab("create");
  };

  const handleOpenProject = (p: ProjectRow) => {
    localStorage.setItem(ACTIVE_PROJECT_KEY, p.id);
    setProject(p);
    setActiveTab("create");
  };

  const handleReset = () => {
    localStorage.removeItem(ACTIVE_PROJECT_KEY);
    setProject(null);
    setBrief(""); setPdfFile(null); setPdfText("");
  };

  const planReady = project?.plan_status === "ready" && project?.plan?.transcript;
  const isExecuting = project?.execution_status === "running" || project?.execution_status === "rendering";
  const isDone = project?.execution_status === "done" && !!project?.final_video_url;
  const hasError = project?.execution_status === "error" || project?.plan_status === "error";

  // Stale-detection: if no progress log entry has arrived in > 3 minutes
  // while the pipeline says it's "running", the background worker likely died.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isExecuting) return;
    const t = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(t);
  }, [isExecuting]);
  const lastLogAt = project?.progress_log?.length
    ? project.progress_log[project.progress_log.length - 1]?.at || 0
    : 0;
  const isStalled = isExecuting && lastLogAt > 0 && now - lastLogAt > 3 * 60 * 1000;
  const [resuming, setResuming] = useState(false);
  const handleResume = async () => {
    if (!project) return;
    setResuming(true);
    try {
      toast.info("Ripresa produzione...");
      const { error } = await supabase.functions.invoke("agent-execute", { body: { projectId: project.id } });
      if (error) throw error;
      toast.success("Produzione ripresa");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore ripresa");
    } finally {
      setResuming(false);
    }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-4">
              <Bot className="w-4 h-4" /> Video Agent
            </div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Da Brief a Video, Automatico
            </h1>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="mb-6">
            <TabsList>
              <TabsTrigger value="create" className="gap-2"><Sparkles className="w-4 h-4" /> Crea</TabsTrigger>
              <TabsTrigger value="history" className="gap-2"><History className="w-4 h-4" /> Cronologia</TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="space-y-6">
              <ErrorBoundary label="agent-create">
              {!project && (
                <Card className="p-6 space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="brief">Brief del video</Label>
                    <Textarea id="brief" placeholder="Es. Video di 30 secondi sui nostri servizi..." value={brief} onChange={(e) => setBrief(e.target.value)} rows={5} />
                  </div>

                  <div className="space-y-2">
                    <Label>Documento di riferimento (PDF, opzionale)</Label>
                    <div className="flex items-center gap-3">
                      <Input type="file" accept="application/pdf"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePdfUpload(f); }}
                        disabled={extractingPdf} />
                      {extractingPdf && <Loader2 className="w-4 h-4 animate-spin" />}
                      {pdfText && !extractingPdf && (
                        <Badge variant="secondary" className="gap-1"><CheckCircle2 className="w-3 h-3" />{pdfText.length.toLocaleString()} char</Badge>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>Lingua</Label>
                      <Select
                        value={language}
                        onValueChange={(v) => {
                          setLanguage(v);
                          // Reset voice when switching language so we re-pick a
                          // native default (avoids EN voices on IT projects, etc.)
                          setVoiceId("");
                        }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{LANGUAGES.map((l) => (<SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>))}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Durata (s)</Label>
                      <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{[15, 30, 45, 60, 90].map((d) => (<SelectItem key={d} value={String(d)}>{d}s</SelectItem>))}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Formato</Label>
                      <Select value={aspect} onValueChange={(v) => setAspect(v as any)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                          <SelectItem value="9:16">9:16 (Reel/Short)</SelectItem>
                          <SelectItem value="1:1">1:1 (Square)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        Voce narrante
                        {language !== "en" && (
                          <span className="text-[10px] uppercase tracking-wide text-primary/80">
                            nativa {language.toUpperCase()}
                          </span>
                        )}
                        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          ✓ {nativeVoices.length} voci verificate Inworld
                        </span>
                      </Label>
                      {language === "en" ? (
                        <Select
                          value={voiceId || "__auto__"}
                          onValueChange={(v) => setVoiceId(v === "__auto__" ? "" : v)}
                          disabled={voicesLoading}
                        >
                          <SelectTrigger><SelectValue placeholder="Auto" /></SelectTrigger>
                          <SelectContent className="max-h-72">
                            <SelectItem value="__auto__">Auto (default)</SelectItem>
                            {systemVoices.slice(0, 30).map((v) => (
                              <SelectItem key={v.voiceId} value={v.voiceId}>{v.displayName}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Select
                          value={voiceId || nativeVoices[0]?.voiceId || ""}
                          onValueChange={(v) => setVoiceId(v === "__auto__" ? "" : v)}
                          disabled={voicesLoading || nativeVoices.length === 0}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent className="max-h-72">
                            <SelectItem value="__auto__">Auto · pronuncia nativa</SelectItem>
                            {nativeVoices.map((v) => (
                              <SelectItem key={v.voiceId} value={v.voiceId}>{v.displayName}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {language !== "en" && (
                        <p className="text-[11px] text-muted-foreground leading-tight">
                          Modello forzato: Inworld 1.5 Max multilingue. Pronuncia garantita {language.toUpperCase()}.
                          Solo voci native della lista sono testate; in caso di errore 404 il backend ricade su una voce nativa disponibile.
                        </p>
                      )}
                    </div>
                  </div>

                  <Button size="lg" className="w-full gap-2" onClick={handleCreateAndPlan} disabled={creating || !brief.trim()}>
                    {creating ? (<><Loader2 className="w-4 h-4 animate-spin" /> Generazione piano...</>) : (<><Sparkles className="w-4 h-4" /> Genera Piano Video</>)}
                  </Button>
                </Card>
              )}

              {project && planReady && !isExecuting && !isDone && (
                <>
                  {/* Plan card */}
                  <Card className="p-6 space-y-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wide">Piano video</div>
                        <h2 className="text-2xl font-bold mt-1">{project.plan.topic}</h2>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge variant="outline">{project.plan.video_type}</Badge>
                          <Badge variant="outline">{project.plan.tone}</Badge>
                          <Badge variant="outline">~{project.plan.estimated_duration_seconds}s</Badge>
                          <Badge variant="outline">{project.plan.word_count} parole</Badge>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1">
                        <RefreshCw className="w-3.5 h-3.5" /> Nuovo
                      </Button>
                    </div>

                    <div>
                      <Label className="text-xs uppercase text-muted-foreground">Trascrizione (modificabile)</Label>
                      <Textarea value={project.plan.transcript} onChange={(e) => handleEditTranscript(e.target.value)} rows={5} className="mt-1" />
                    </div>

                    <div>
                      <Label className="text-xs uppercase text-muted-foreground">References</Label>
                      <ul className="text-sm mt-1 space-y-1">
                        {(project.plan.references || []).map((r: any, i: number) => (
                          <li key={i} className="flex items-center gap-2">
                            <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                            <span>{r.title}</span>
                            <span className="text-muted-foreground text-xs">— {r.source}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Card>

                  {/* Storyboard */}
                  <Card className="p-6 space-y-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <h3 className="text-lg font-semibold flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Storyboard shot-by-shot</h3>
                        <p className="text-xs text-muted-foreground">Anteprima ritmo, miniature Opus-style e tipo B-roll per scena</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handleRepaceOpus} disabled={!project.scene_overrides?.length} className="gap-2">
                          <Zap className="w-3.5 h-3.5" /> Re-pace ~3s (Opus)
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => loadStoryboard(project.id)} disabled={loadingStoryboard} className="gap-2">
                          {loadingStoryboard ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                          Ricarica
                        </Button>
                      </div>
                    </div>

                    {/* Rhythm bar: visual proportions of scene durations */}
                    {project.scene_overrides && project.scene_overrides.length > 0 && (() => {
                      const total = project.scene_overrides.reduce((a, s) => a + (s.duration || 0), 0);
                      const avg = total / project.scene_overrides.length;
                      return (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Ritmo storyboard ({project.scene_overrides.length} scene · totale {total.toFixed(1)}s · media {avg.toFixed(1)}s)</span>
                            <span className={avg <= 3.5 ? "text-primary font-medium" : ""}>
                              {avg <= 3.5 ? "✓ Opus-like" : "Più lento di Opus"}
                            </span>
                          </div>
                          <div className="flex w-full h-3 rounded-full overflow-hidden border border-border bg-muted">
                            {project.scene_overrides.map((s, i) => (
                              <div
                                key={i}
                                style={{ width: `${((s.duration || 0) / Math.max(total, 0.1)) * 100}%` }}
                                className={`${s.broll_type === "sketch" ? "bg-accent" : "bg-primary"} ${i > 0 ? "border-l border-background" : ""}`}
                                title={`Scena ${i + 1}: ${(s.duration || 0).toFixed(1)}s · ${s.broll_type || "talking_head"}`}
                              />
                            ))}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-primary" /> Talking-head</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-accent" /> Sketch / Blueprint</span>
                          </div>
                        </div>
                      );
                    })()}

                    {loadingStoryboard && !project.scene_overrides?.length && (
                      <div className="text-center py-8 text-sm text-muted-foreground">Caricamento suggerimenti...</div>
                    )}

                    {(project.scene_overrides || []).map((scene, sIdx) => {
                      const isSketch = scene.broll_type === "sketch";
                      return (
                        <div key={sIdx} className="border border-border rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-2">
                              <Badge>Scena {sIdx + 1}</Badge>
                              <span className="text-sm font-medium">{scene.keyword}</span>
                              <Badge variant={isSketch ? "outline" : "secondary"} className="gap-1 text-xs">
                                {isSketch ? <PenTool className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                                {isSketch ? "Sketch" : "Talking-head"}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex rounded-md border border-border overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() => handleBrollTypeOverride(sIdx, "talking_head")}
                                  className={`px-2 py-1 text-xs ${!isSketch ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                                >Real</button>
                                <button
                                  type="button"
                                  onClick={() => handleBrollTypeOverride(sIdx, "sketch")}
                                  className={`px-2 py-1 text-xs ${isSketch ? "bg-accent text-accent-foreground" : "bg-background hover:bg-muted"}`}
                                >Sketch</button>
                              </div>
                              <Label className="text-xs text-muted-foreground">Durata</Label>
                              <Input type="number" min={1} max={15} step={0.5} value={scene.duration}
                                onChange={(e) => handleSceneDuration(sIdx, Number(e.target.value))}
                                className="w-20 h-8" />
                              <span className="text-xs text-muted-foreground">s</span>
                              {!isSketch && project.use_vidnoz_for_talking_head && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 gap-1"
                                  disabled={
                                    vidnozPreviewLoading === sIdx ||
                                    !project.vidnoz_avatar_url ||
                                    !project.vidnoz_voice_id
                                  }
                                  onClick={() => handlePreviewVidnozScene(sIdx)}
                                  title={
                                    !project.vidnoz_avatar_url || !project.vidnoz_voice_id
                                      ? "Seleziona avatar e voce Vidnoz nello Stile"
                                      : "Genera anteprima Vidnoz di questa scena"
                                  }
                                >
                                  {vidnozPreviewLoading === sIdx ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Play className="w-3.5 h-3.5" />
                                  )}
                                  Anteprima Vidnoz
                                </Button>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                            {scene.suggestions?.map((s, i) => (
                              <button key={i} type="button" onClick={() => handleSelectAsset(sIdx, i)}
                                className={`relative aspect-video bg-muted rounded overflow-hidden border-2 transition ${
                                  i === scene.selectedIndex ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:border-border"
                                }`}>
                                {s.thumb && <img src={s.thumb} alt={scene.keyword} className="w-full h-full object-cover" loading="lazy" />}
                                {i === scene.selectedIndex && (
                                  <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                                    <CheckCircle2 className="w-3 h-3" />
                                  </div>
                                )}
                              </button>
                            ))}
                            {(!scene.suggestions || scene.suggestions.length === 0) && (
                              <div className="col-span-full text-xs text-muted-foreground py-2">Nessun risultato Freepik</div>
                            )}
                          </div>
                          {vidnozPreview?.sceneIdx === sIdx && (
                            <div className="space-y-1 pt-1">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs flex items-center gap-1">
                                  <Mic className="w-3 h-3" /> Anteprima Vidnoz scena {sIdx + 1}
                                </Label>
                                <button
                                  type="button"
                                  onClick={() => setVidnozPreview(null)}
                                  className="text-xs text-muted-foreground hover:text-foreground"
                                >Chiudi</button>
                              </div>
                              <video
                                src={vidnozPreview.url}
                                controls
                                className="w-full max-w-md rounded bg-black"
                                preload="metadata"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </Card>

                  {/* Style + Subtitles + Intro/Outro */}
                  <Card className="p-6">
                    <Tabs value={activeStyleTab} onValueChange={setActiveStyleTab}>
                      <TabsList>
                        <TabsTrigger value="style" className="gap-2"><Palette className="w-3.5 h-3.5" /> Stile</TabsTrigger>
                        <TabsTrigger value="subs" className="gap-2"><TypeIcon className="w-3.5 h-3.5" /> Sottotitoli</TabsTrigger>
                        <TabsTrigger value="branding" className="gap-2"><Wand2 className="w-3.5 h-3.5" /> Titolo & CTA</TabsTrigger>
                      </TabsList>

                      <TabsContent value="style" className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <Label>Preset visivo</Label>
                          <div className="flex flex-wrap gap-2">
                            {STYLE_PRESETS.map((p) => (
                              <button key={p.id} type="button" onClick={() => handleApplyStylePreset(p.id)}
                                className={`px-3 py-2 rounded-md border text-sm transition ${
                                  project.style_preset === p.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
                                }`}>
                                <div className="flex items-center gap-2">
                                  <span className="flex gap-0.5">
                                    <span className="w-3 h-3 rounded-sm" style={{ background: p.palette.primary }} />
                                    <span className="w-3 h-3 rounded-sm" style={{ background: p.palette.secondary }} />
                                    <span className="w-3 h-3 rounded-sm" style={{ background: p.palette.accent }} />
                                  </span>
                                  {p.label}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Primary</Label>
                            <Input type="color" value={project.color_palette?.primary || "#3B82F6"}
                              onChange={(e) => updateProject({ color_palette: { ...project.color_palette, primary: e.target.value } })} className="h-10" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Secondary</Label>
                            <Input type="color" value={project.color_palette?.secondary || "#0F172A"}
                              onChange={(e) => updateProject({ color_palette: { ...project.color_palette, secondary: e.target.value } })} className="h-10" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Accent</Label>
                            <Input type="color" value={project.color_palette?.accent || "#F59E0B"}
                              onChange={(e) => updateProject({ color_palette: { ...project.color_palette, accent: e.target.value } })} className="h-10" />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Tipografia</Label>
                            <Select value={project.typography} onValueChange={(v) => updateProject({ typography: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {["Inter", "Helvetica", "Arial", "Poppins", "Georgia", "Roboto", "Montserrat"].map((f) => (
                                  <SelectItem key={f} value={f}>{f}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Livello transizioni</Label>
                            <Select value={project.transition_level} onValueChange={(v) => updateProject({ transition_level: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Nessuna</SelectItem>
                                <SelectItem value="subtle">Sottile</SelectItem>
                                <SelectItem value="medium">Medio</SelectItem>
                                <SelectItem value="bold">Forte</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Image source + watermark guard */}
                        <div className="space-y-2 pt-4 border-t border-border">
                          <div className="flex items-center justify-between gap-2">
                            <Label className="flex items-center gap-2">
                              <ImageIcon className="w-3.5 h-3.5" /> Sorgente immagini
                            </Label>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              ✓ Watermark guard attivo
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {IMAGE_SOURCES.map((src) => {
                              const active = (project.image_source || "freepik") === src.id;
                              return (
                                <button
                                  key={src.id}
                                  type="button"
                                  onClick={() => updateProject({ image_source: src.id } as any)}
                                  className={`px-3 py-2 rounded-md border text-xs text-left max-w-[220px] transition ${
                                    active ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
                                  }`}
                                  title={src.hint}
                                >
                                  <div className="font-medium">{src.label}</div>
                                  <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{src.hint}</div>
                                </button>
                              );
                            })}
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-tight">
                            Output finale sempre privo di preview/watermark: il backend usa <code>/v1/videos/&#123;id&#125;/download</code>
                            per Freepik e scarta asset che contengono <code>watermark</code>/<code>preview</code> nell'URL.
                          </p>
                        </div>

                        {/* Live transitions preview (CSS, no server render) */}
                        <div className="space-y-2 pt-4 border-t border-border">
                          <Label className="flex items-center gap-2">
                            <Play className="w-3.5 h-3.5" /> Anteprima transizioni
                          </Label>
                          <TransitionPreview
                            transitionLevel={project.transition_level}
                            aspectRatio={project.aspect_ratio}
                            frames={(project.scene_overrides || [])
                              .map((s) => {
                                const sel = s.suggestions?.[s.selectedIndex] || s.suggestions?.[0];
                                return sel ? { url: sel.url, thumb: sel.thumb, keyword: s.keyword, duration: s.duration } : null;
                              })
                              .filter(Boolean) as any}
                          />
                        </div>

                        <div className="space-y-3 pt-4 border-t border-border">
                          <div className="flex items-center justify-between">
                            <Label className="flex items-center gap-2">
                              <Mic className="w-3.5 h-3.5" /> Mix B-roll: Talking-head vs Sketch
                            </Label>
                            <Badge variant="outline" className="text-xs">
                              {project.broll_mix?.talking_head ?? 50}% / {project.broll_mix?.sketch ?? 50}%
                            </Badge>
                          </div>
                          <Slider
                            value={[project.broll_mix?.talking_head ?? 50]}
                            min={0} max={100} step={10}
                            onValueChange={([v]) => handleBrollMixChange(v)}
                          />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Mic className="w-3 h-3" /> Più talking-head</span>
                            <span className="flex items-center gap-1"><PenTool className="w-3 h-3" /> Più sketch / blueprint</span>
                          </div>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {[
                              { label: "Solo Talking", th: 100 },
                              { label: "Opus-like (60/40)", th: 60 },
                              { label: "Bilanciato", th: 50 },
                              { label: "Solo Sketch", th: 0 },
                            ].map((p) => (
                              <button
                                key={p.label}
                                type="button"
                                onClick={() => handleBrollMixChange(p.th)}
                                className={`px-2 py-1 rounded text-xs border transition ${
                                  (project.broll_mix?.talking_head ?? 50) === p.th
                                    ? "border-primary bg-primary/10"
                                    : "border-border hover:bg-muted"
                                }`}
                              >{p.label}</button>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Premi "Ricarica" sullo storyboard per rigenerare le miniature col nuovo mix.
                          </p>
                        </div>

                        {/* Vidnoz talking-head replacement */}
                        <div className="space-y-3 pt-4 border-t border-border">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <Label className="flex items-center gap-2">
                              <Mic className="w-3.5 h-3.5" /> Avatar Vidnoz per scene Talking-head
                            </Label>
                            <Switch
                              checked={!!project.use_vidnoz_for_talking_head}
                              onCheckedChange={(v) => {
                                updateProject({ use_vidnoz_for_talking_head: v } as any);
                                if (v) loadVidnozCatalog();
                              }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Quando attivo, le scene marcate "Talking-head" useranno un avatar AI Vidnoz che pronuncia
                            la trascrizione invece dello stock Freepik. La narrazione TTS viene saltata (la voce è quella dell'avatar).
                          </p>

                          {project.use_vidnoz_for_talking_head && (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                  {vidnozLoading ? "Caricamento..." : `${vidnozAvatars.length} avatar · ${vidnozVoices.length} voci`}
                                </span>
                                <Button size="sm" variant="outline" onClick={() => loadVidnozCatalog(true)} disabled={vidnozLoading} className="gap-1">
                                  {vidnozLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                  Ricarica catalogo
                                </Button>
                              </div>

                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <Label className="text-xs">Avatar</Label>
                                  {vidnozAvatars.some((a) => a.is_business) && (
                                    <button
                                      type="button"
                                      onClick={() => setAvatarBusinessOnly((v) => !v)}
                                      className={`text-[10px] px-2 py-0.5 rounded-full border transition ${
                                        avatarBusinessOnly
                                          ? "bg-primary/15 border-primary/40 text-primary"
                                          : "bg-muted border-border text-muted-foreground hover:text-foreground"
                                      }`}
                                    >
                                      {avatarBusinessOnly ? "Solo business ✓" : "Solo business"}
                                    </button>
                                  )}
                                </div>
                                {vidnozAvatars.length === 0 ? (
                                  <div className="text-xs text-muted-foreground p-3 border border-dashed border-border rounded">
                                    Nessun avatar caricato. Premi "Ricarica catalogo".
                                  </div>
                                ) : (() => {
                                  const filteredAvatars = avatarBusinessOnly
                                    ? vidnozAvatars.filter((a) => a.is_business)
                                    : vidnozAvatars;
                                  const displayAvatars = filteredAvatars.length > 0 ? filteredAvatars : vidnozAvatars;
                                  return (
                                    <>
                                      {avatarBusinessOnly && filteredAvatars.length === 0 && (
                                        <div className="text-[11px] text-amber-500 mb-1">
                                          Nessun avatar business rilevato — mostro tutti.
                                        </div>
                                      )}
                                      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 max-h-64 overflow-y-auto p-1">
                                        {displayAvatars.slice(0, 80).map((av) => (
                                          <button
                                            key={av.avatar_id}
                                            type="button"
                                            onClick={() => updateProject({ vidnoz_avatar_id: av.avatar_id, vidnoz_avatar_url: av.avatar_url } as any)}
                                            className={`relative aspect-square bg-muted rounded overflow-hidden border-2 transition ${
                                              project.vidnoz_avatar_id === av.avatar_id ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:border-border"
                                            }`}
                                            title={`${av.name} (${av.gender})${av.is_business ? " · business" : ""}`}
                                          >
                                            {av.thumb && <img src={av.thumb} alt={av.name} className="w-full h-full object-cover" loading="lazy" />}
                                            {av.is_business && (
                                              <div className="absolute top-1 left-1 bg-primary/80 text-primary-foreground text-[8px] px-1 rounded">
                                                BIZ
                                              </div>
                                            )}
                                            {project.vidnoz_avatar_id === av.avatar_id && (
                                              <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                                                <CheckCircle2 className="w-3 h-3" />
                                              </div>
                                            )}
                                          </button>
                                        ))}
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="text-xs">Voce</Label>
                                  {project.language && (() => {
                                    const compatCount = vidnozVoices.filter((v) => isVidnozVoiceCompatible(v, project.language)).length;
                                    return (
                                      <span className="text-[10px] text-muted-foreground">
                                        {compatCount} compatibili con {project.language.toUpperCase()}
                                      </span>
                                    );
                                  })()}
                                </div>
                                {(() => {
                                  const compatibles = vidnozVoices.filter((v) => isVidnozVoiceCompatible(v, project.language));
                                  const q = voiceSearch.trim().toLowerCase();
                                  const filtered = q
                                    ? compatibles.filter(
                                        (v) =>
                                          v.name?.toLowerCase().includes(q) ||
                                          v.country_name?.toLowerCase().includes(q) ||
                                          v.gender?.toLowerCase().includes(q)
                                      )
                                    : compatibles;
                                  const PAGE_SIZE = 25;
                                  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
                                  const safePage = Math.min(voicePage, totalPages - 1);
                                  const pageItems = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
                                  return (
                                    <>
                                      <div className="flex gap-2">
                                        <Input
                                          placeholder="Cerca per nome, paese, genere..."
                                          value={voiceSearch}
                                          onChange={(e) => { setVoiceSearch(e.target.value); setVoicePage(0); }}
                                          className="h-8 text-xs flex-1"
                                          disabled={compatibles.length === 0}
                                        />
                                      </div>
                                      <Select
                                        value={project.vidnoz_voice_id || ""}
                                        onValueChange={(v) => updateProject({ vidnoz_voice_id: v } as any)}
                                        disabled={compatibles.length === 0}
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder={compatibles.length === 0 ? `Nessuna voce ${project.language?.toUpperCase() || ""} disponibile` : `Seleziona voce (${filtered.length} risultati)`} />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-72">
                                          {pageItems.length === 0 ? (
                                            <div className="p-3 text-xs text-muted-foreground">Nessun risultato per "{voiceSearch}"</div>
                                          ) : pageItems.map((v) => (
                                            <SelectItem key={v.voice_id} value={v.voice_id}>
                                              {v.name} · {v.language}{v.country_name ? ` (${v.country_name})` : ""} · {v.gender}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      {totalPages > 1 && (
                                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-6 px-2 text-[11px]"
                                            disabled={safePage === 0}
                                            onClick={() => setVoicePage((p) => Math.max(0, p - 1))}
                                          >
                                            ← Prec
                                          </Button>
                                          <span>Pagina {safePage + 1} / {totalPages} · {filtered.length} voci</span>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-6 px-2 text-[11px]"
                                            disabled={safePage >= totalPages - 1}
                                            onClick={() => setVoicePage((p) => Math.min(totalPages - 1, p + 1))}
                                          >
                                            Succ →
                                          </Button>
                                        </div>
                                      )}
                                      {compatibles.length === 0 && vidnozVoices.length > 0 && (
                                        <div className="text-[11px] text-amber-500">
                                          Nessuna voce nativa per {project.language?.toUpperCase()}. Cambia lingua o disattiva Vidnoz.
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}

                                {/* Rich preview panel for the selected voice */}
                                {project.vidnoz_voice_id && (() => {
                                  const v = vidnozVoices.find((x) => x.voice_id === project.vidnoz_voice_id);
                                  if (!v) return null;
                                  const emotionList = (v.emotions && v.emotions.length > 0 ? v.emotions : v.styles) || [];
                                  return (
                                    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                                      <div className="flex items-start gap-3">
                                        {v.preview_image_url ? (
                                          <img
                                            src={v.preview_image_url}
                                            alt={v.name}
                                            className="w-12 h-12 rounded-full object-cover border border-border flex-shrink-0"
                                            loading="lazy"
                                          />
                                        ) : (
                                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                            <Mic className="w-5 h-5 text-primary" />
                                          </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <div className="text-sm font-medium truncate">{v.name}</div>
                                          <div className="flex flex-wrap gap-1 mt-1">
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase">
                                              {v.language}
                                            </span>
                                            {v.country_name && (
                                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                                {v.country_name}
                                              </span>
                                            )}
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize">
                                              {v.gender}
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      {emotionList.length > 0 && (
                                        <div>
                                          <div className="text-[10px] uppercase text-muted-foreground mb-1">
                                            Emozione / Stile {project.vidnoz_voice_style && <span className="text-primary normal-case">· {project.vidnoz_voice_style}</span>}
                                          </div>
                                          <div className="flex flex-wrap gap-1">
                                            <button
                                              type="button"
                                              onClick={() => updateProject({ vidnoz_voice_style: null } as any)}
                                              className={`text-[10px] px-1.5 py-0.5 rounded border transition ${
                                                !project.vidnoz_voice_style
                                                  ? "bg-primary text-primary-foreground border-primary"
                                                  : "bg-muted border-border text-muted-foreground hover:text-foreground"
                                              }`}
                                            >
                                              neutro
                                            </button>
                                            {emotionList.slice(0, 16).map((e, i) => {
                                              const val = String(e);
                                              const active = project.vidnoz_voice_style === val;
                                              return (
                                                <button
                                                  key={i}
                                                  type="button"
                                                  onClick={() => updateProject({ vidnoz_voice_style: val } as any)}
                                                  className={`text-[10px] px-1.5 py-0.5 rounded border transition capitalize ${
                                                    active
                                                      ? "bg-primary text-primary-foreground border-primary"
                                                      : "bg-accent/30 border-border text-foreground hover:bg-accent/50"
                                                  }`}
                                                >
                                                  {val}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}

                                      {v.preview_audio_url ? (
                                        <div>
                                          <div className="text-[10px] uppercase text-muted-foreground mb-1">Sample audio</div>
                                          <audio src={v.preview_audio_url} controls className="w-full h-8" preload="none" />
                                        </div>
                                      ) : (
                                        <div className="text-[10px] text-muted-foreground italic">Nessun sample audio fornito da Vidnoz</div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>

                              {(!project.vidnoz_avatar_id || !project.vidnoz_voice_id) && (
                                <div className="text-xs text-amber-500">
                                  Seleziona un avatar e una voce per attivare Vidnoz, altrimenti il sistema userà comunque Freepik.
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Custom user presets */}
                        <div className="space-y-3 pt-4 border-t border-border">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <Label className="flex items-center gap-2"><Save className="w-3.5 h-3.5" /> Preset personalizzati</Label>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{userPresets.length} salvati</span>
                              <input
                                type="file"
                                accept="application/json,.json"
                                id="agent-preset-import"
                                className="hidden"
                                onChange={handleImportPresets}
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5"
                                onClick={() => document.getElementById("agent-preset-import")?.click()}
                              >
                                <Upload className="w-3.5 h-3.5" /> Importa JSON
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5"
                                onClick={handleExportAllPresets}
                                disabled={userPresets.length === 0}
                              >
                                <FileJson className="w-3.5 h-3.5" /> Esporta tutti
                              </Button>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Nome preset (es. Brand Opus 9:16)"
                              value={newPresetName}
                              onChange={(e) => setNewPresetName(e.target.value)}
                              className="h-9"
                            />
                            <Button size="sm" onClick={handleSavePreset} className="gap-2 shrink-0">
                              <Save className="w-3.5 h-3.5" /> Salva attuale
                            </Button>
                          </div>
                          {userPresets.length > 0 && (
                            <div className="space-y-2">
                              {userPresets.map((up) => (
                                <div key={up.id} className="flex items-center justify-between gap-2 p-2 border border-border rounded-md">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="flex gap-0.5 shrink-0">
                                      <span className="w-3 h-3 rounded-sm" style={{ background: up.color_palette.primary }} />
                                      <span className="w-3 h-3 rounded-sm" style={{ background: up.color_palette.secondary }} />
                                      <span className="w-3 h-3 rounded-sm" style={{ background: up.color_palette.accent }} />
                                    </span>
                                    <span className="text-sm font-medium truncate">{up.name}</span>
                                    <Badge variant="outline" className="text-xs shrink-0">{up.aspect_ratio}</Badge>
                                    <Badge variant="outline" className="text-xs shrink-0">~{up.scene_duration_sec}s</Badge>
                                    <Badge variant="outline" className="text-xs shrink-0">
                                      {up.broll_mix?.talking_head ?? 50}/{up.broll_mix?.sketch ?? 50}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <Button size="sm" variant="outline" onClick={() => handleApplyUserPreset(up)}>Applica</Button>
                                    <Button size="sm" variant="ghost" onClick={() => handleExportPreset(up)} title="Esporta JSON">
                                      <Download className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => handleDeleteUserPreset(up.id)}>
                                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </TabsContent>

                      <TabsContent value="subs" className="space-y-4 pt-4">
                        <div className="flex items-center justify-between">
                          <Label>Abilita sottotitoli</Label>
                          <Switch checked={project.subtitle_config?.enabled !== false}
                            onCheckedChange={(v) => updateProject({ subtitle_config: { ...project.subtitle_config, enabled: v } })} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Lingua</Label>
                            <Select value={project.subtitle_config?.language || "auto"}
                              onValueChange={(v) => updateProject({ subtitle_config: { ...project.subtitle_config, language: v } })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="auto">Auto</SelectItem>
                                {LANGUAGES.map((l) => (<SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Dimensione</Label>
                            <Select value={project.subtitle_config?.fontSize || "medium"}
                              onValueChange={(v) => updateProject({ subtitle_config: { ...project.subtitle_config, fontSize: v } })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="small">Piccolo</SelectItem>
                                <SelectItem value="medium">Medio</SelectItem>
                                <SelectItem value="large">Grande</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Posizione</Label>
                            <Select value={project.subtitle_config?.position || "bottom-center"}
                              onValueChange={(v) => updateProject({ subtitle_config: { ...project.subtitle_config, position: v } })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="bottom-center">Basso</SelectItem>
                                <SelectItem value="mid-center">Centro</SelectItem>
                                <SelectItem value="top-center">Alto</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="branding" className="space-y-6 pt-4">
                        <div className="space-y-3 border-b border-border pb-4">
                          <div className="flex items-center justify-between">
                            <Label className="text-base">Titolo iniziale</Label>
                            <Switch checked={!!project.intro_title?.enabled}
                              onCheckedChange={(v) => updateProject({ intro_title: { text: project.intro_title?.text || project.plan?.topic || "", duration: project.intro_title?.duration || 2.5, enabled: v } })} />
                          </div>
                          {project.intro_title?.enabled && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="md:col-span-2 space-y-1">
                                <Label className="text-xs">Testo</Label>
                                <Input value={project.intro_title?.text || ""}
                                  onChange={(e) => updateProject({ intro_title: { ...(project.intro_title || { duration: 2.5, enabled: true }), text: e.target.value } as any })}
                                  placeholder="Titolo del video" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Durata (s)</Label>
                                <Input type="number" min={1} max={6} step={0.5}
                                  value={project.intro_title?.duration || 2.5}
                                  onChange={(e) => updateProject({ intro_title: { ...(project.intro_title || { text: "", enabled: true }), duration: Number(e.target.value) } as any })} />
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-base">Call-to-Action finale</Label>
                            <Switch checked={!!project.outro_cta?.enabled}
                              onCheckedChange={(v) => updateProject({ outro_cta: { text: project.outro_cta?.text || "Scopri di più", duration: project.outro_cta?.duration || 3, enabled: v } })} />
                          </div>
                          {project.outro_cta?.enabled && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="md:col-span-2 space-y-1">
                                <Label className="text-xs">Testo CTA</Label>
                                <Input value={project.outro_cta?.text || ""}
                                  onChange={(e) => updateProject({ outro_cta: { ...(project.outro_cta || { duration: 3, enabled: true }), text: e.target.value } as any })}
                                  placeholder="Visita il nostro sito" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Durata (s)</Label>
                                <Input type="number" min={1} max={6} step={0.5}
                                  value={project.outro_cta?.duration || 3}
                                  onChange={(e) => updateProject({ outro_cta: { ...(project.outro_cta || { text: "", enabled: true }), duration: Number(e.target.value) } as any })} />
                              </div>
                            </div>
                          )}
                        </div>
                      </TabsContent>
                    </Tabs>
                  </Card>

                  {(() => {
                    if (!project.use_vidnoz_for_talking_head) return null;
                    const overrides = project.scene_overrides || [];
                    const thScenes = overrides.filter(o => o?.broll_type !== "sketch");
                    const thCount = thScenes.length;
                    const thSeconds = thScenes.reduce((s, o) => s + (Number(o?.duration) || 4), 0);
                    // Vidnoz pricing approx: ~€0.008 / sec (≈ $0.50/min). Update if plan changes.
                    const estEur = thSeconds * 0.008;
                    const ready = !!project.vidnoz_avatar_url && !!project.vidnoz_voice_id;
                    return (
                      <div className={`rounded-lg border p-3 text-sm flex items-start gap-2 ${
                        ready ? "border-primary/30 bg-primary/5" : "border-destructive/40 bg-destructive/5"
                      }`}>
                        {ready ? (
                          <Mic className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 mt-0.5 text-destructive shrink-0" />
                        )}
                        <div className="space-y-0.5">
                          {ready ? (
                            <>
                              <div className="font-medium">
                                Vidnoz attivo · {thCount} {thCount === 1 ? "scena" : "scene"} talking-head
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Verranno generati {thCount} clip avatar AI per un totale di ~{thSeconds.toFixed(1)}s.
                                Stima crediti Vidnoz: <strong>~€{estEur.toFixed(2)}</strong> (indicativa, dipende dal piano attivo).
                                La narrazione globale TTS sarà sostituita dalle voci degli avatar.
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="font-medium text-destructive">
                                Vidnoz attivo ma manca la configurazione
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Seleziona un avatar e una voce nel pannello <strong>Stile → Avatar Vidnoz</strong>,
                                oppure disattiva Vidnoz per usare Freepik. Senza configurazione il sistema userà comunque Freepik.
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  <Button size="lg" className="w-full gap-2" onClick={handleConfirmAndExecute}>
                    <Play className="w-4 h-4" /> Conferma e Produci Video
                  </Button>
                </>
              )}

              {project && (isExecuting || isDone) && (
                <Card className="p-6 space-y-5">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">Produzione in corso</div>
                    <h2 className="text-2xl font-bold mt-1">{project.title}</h2>
                  </div>

                  {(() => {
                    // Phase chips: detect which big stage we're in based on progress_pct + log keywords.
                    const pct = project.progress_pct || 0;
                    const logsTxt = (project.progress_log || []).map((l) => l.message?.toLowerCase() || "").join(" ");
                    const phases = [
                      { id: "plan", label: "Piano", icon: FileText, doneAt: 15 },
                      { id: "voice", label: "Voce", icon: Mic, doneAt: 45, kw: ["tts", "narr", "voice", "voce"] },
                      { id: "images", label: "Immagini", icon: ImageIcon, doneAt: 70, kw: ["freepik", "image", "asset", "scene", "immag"] },
                      { id: "transitions", label: "Transizioni", icon: Wand2, doneAt: 85, kw: ["transition", "crossfade", "json2video", "render"] },
                      { id: "render", label: "Render", icon: Play, doneAt: 100, kw: ["render", "final", "publish"] },
                    ];
                    return (
                      <>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{project.execution_step ?? "..."}</span>
                            <span className="font-medium">{pct}%</span>
                          </div>
                          <Progress value={pct} />
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {phases.map((p) => {
                            const isDone = pct >= p.doneAt;
                            const isActive = !isDone && (pct >= (phases[phases.indexOf(p) - 1]?.doneAt ?? 0) || (p.kw && p.kw.some((k) => logsTxt.includes(k))));
                            const Icon = p.icon;
                            return (
                              <Badge
                                key={p.id}
                                variant={isDone ? "default" : isActive ? "secondary" : "outline"}
                                className={`text-[11px] gap-1 ${isActive && !isDone ? "animate-pulse" : ""}`}
                              >
                                <Icon className="w-3 h-3" />
                                {p.label}
                                {isDone && <CheckCircle2 className="w-3 h-3" />}
                              </Badge>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}

                  {project.progress_log?.length > 0 && (
                    <div className="bg-muted/30 rounded-md p-3 max-h-64 overflow-y-auto text-xs font-mono space-y-1">
                      {project.progress_log.slice(-30).map((l, i) => {
                        const msg = l.message || "";
                        const lower = msg.toLowerCase();
                        const tag = lower.includes("tts") || lower.includes("voce") || lower.includes("narr")
                          ? { txt: "VOCE", cls: "text-emerald-400" }
                          : lower.includes("freepik") || lower.includes("immag") || lower.includes("asset") || lower.includes("scene")
                          ? { txt: "IMG", cls: "text-sky-400" }
                          : lower.includes("transition") || lower.includes("crossfade") || lower.includes("render") || lower.includes("json2video")
                          ? { txt: "RNDR", cls: "text-fuchsia-400" }
                          : lower.includes("⚠") || lower.includes("warn") || lower.includes("fallback")
                          ? { txt: "WARN", cls: "text-amber-400" }
                          : { txt: "•", cls: "text-muted-foreground" };
                        return (
                          <div key={i} className="flex gap-2">
                            <span className={`shrink-0 w-10 ${tag.cls}`}>[{tag.txt}]</span>
                            <span className="text-muted-foreground">{msg}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {isDone && project.final_video_url && (
                    <div className="space-y-3">
                      <video src={project.final_video_url} controls className="w-full rounded-lg bg-black" preload="metadata" />
                      <div className="flex gap-2">
                        <Button asChild className="gap-2">
                          <a href={project.final_video_url} download target="_blank" rel="noreferrer">
                            <Download className="w-4 h-4" /> Scarica
                          </a>
                        </Button>
                        <Button variant="outline" onClick={handleReset} className="gap-2">
                          <RefreshCw className="w-4 h-4" /> Nuovo progetto
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              )}

              {project && isStalled && !hasError && (
                <Card className="p-4 mt-4 border-amber-500/40 bg-amber-500/5">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm">La produzione sembra bloccata</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Nessun aggiornamento da {Math.round((now - lastLogAt) / 60000)} minuti. Il worker in background potrebbe essere stato terminato.
                        Puoi riprendere la produzione: le scene già completate non verranno rigenerate.
                      </p>
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" onClick={handleResume} disabled={resuming} className="gap-2">
                          {resuming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                          Riprendi produzione
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleReset}>Annulla</Button>
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {project && hasError && (
                <Card className="p-6 mt-4 border-destructive/30">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-semibold">Si è verificato un errore</h3>
                      <p className="text-sm text-muted-foreground mt-1">{project.error_message || "Errore sconosciuto"}</p>
                      <Button variant="outline" size="sm" onClick={handleReset} className="mt-3">Riprova</Button>
                    </div>
                  </div>
                </Card>
              )}
              </ErrorBoundary>
            </TabsContent>

            <TabsContent value="history" className="space-y-3">
              {history.length === 0 && (
                <Card className="p-10 text-center text-muted-foreground">
                  Nessun progetto ancora. Crea il primo dalla tab "Crea".
                </Card>
              )}
              {history.map((h) => (
                <Card key={h.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold truncate">{h.title}</h4>
                      <Badge variant="outline" className="text-xs">{h.language}</Badge>
                      <Badge variant="outline" className="text-xs">{h.aspect_ratio}</Badge>
                      <Badge variant={h.execution_status === "done" ? "default" : h.execution_status === "error" ? "destructive" : "secondary"} className="text-xs">
                        {h.execution_status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-1">{h.brief}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(h.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {h.final_video_url && (
                      <Button asChild size="sm" variant="outline" className="gap-1">
                        <a href={h.final_video_url} target="_blank" rel="noreferrer"><Play className="w-3.5 h-3.5" /></a>
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => handleOpenProject(h)}>Apri</Button>
                    <Button size="sm" onClick={() => handleDuplicate(h)} className="gap-1">
                      <Copy className="w-3.5 h-3.5" /> Duplica
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" className="gap-1" aria-label="Elimina progetto">
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Eliminare "{h.title}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Questa azione è irreversibile. Il progetto e tutti i suoi dati associati verranno eliminati definitivamente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteProject(h.id, h.title)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Elimina
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </AuthGuard>
  );
}
