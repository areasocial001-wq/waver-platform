import { useEffect, useRef, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { AuthGuard } from "@/components/AuthGuard";
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
  use_vidnoz_for_talking_head: boolean;
  created_at: string;
};

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "it", label: "Italiano" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "pt", label: "Português" },
];

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

export default function AgentPage() {
  const [activeTab, setActiveTab] = useState<"create" | "history">("create");

  // creation form
  const [brief, setBrief] = useState("");
  const [language, setLanguage] = useState("en");
  const [duration, setDuration] = useState(35);
  const [aspect, setAspect] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [voiceId, setVoiceId] = useState<string>("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [extractingPdf, setExtractingPdf] = useState(false);
  const [pdfText, setPdfText] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [loadingStoryboard, setLoadingStoryboard] = useState(false);

  const [project, setProject] = useState<ProjectRow | null>(null);
  const [history, setHistory] = useState<ProjectRow[]>([]);
  const [userPresets, setUserPresets] = useState<UserPreset[]>([]);
  const [vidnozAvatars, setVidnozAvatars] = useState<Array<{ avatar_id: string; name: string; thumb: string; avatar_url: string; gender: string }>>([]);
  const [vidnozVoices, setVidnozVoices] = useState<Array<{ voice_id: string; name: string; language: string; gender: string; preview_audio_url?: string }>>([]);
  const [vidnozLoading, setVidnozLoading] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const pollRef = useRef<number | null>(null);

  const { systemVoices, isLoading: voicesLoading } = useInworldVoices();

  // realtime
  useEffect(() => {
    if (!project?.id) return;
    const channel = supabase
      .channel(`agent_project_${project.id}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "agent_projects", filter: `id=eq.${project.id}` },
        (payload) => setProject(payload.new as unknown as ProjectRow))
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

  // Load user-saved style presets
  const loadUserPresets = async () => {
    const { data } = await supabase
      .from("agent_user_presets")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setUserPresets(data as unknown as UserPreset[]);
  };
  useEffect(() => { loadUserPresets(); }, []);

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
          voice_id: voiceId || null, target_duration: duration, aspect_ratio: aspect,
        })
        .select("*").single();
      if (error) throw error;

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
    setProject(p);
    setActiveTab("create");
  };

  const handleReset = () => {
    setProject(null);
    setBrief(""); setPdfFile(null); setPdfText("");
  };

  const planReady = project?.plan_status === "ready" && project?.plan?.transcript;
  const isExecuting = project?.execution_status === "running" || project?.execution_status === "rendering";
  const isDone = project?.execution_status === "done" && !!project?.final_video_url;
  const hasError = project?.execution_status === "error" || project?.plan_status === "error";

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
                      <Select value={language} onValueChange={setLanguage}>
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
                      <Label>Voce narrante</Label>
                      <Select value={voiceId} onValueChange={setVoiceId} disabled={voicesLoading}>
                        <SelectTrigger><SelectValue placeholder="Auto" /></SelectTrigger>
                        <SelectContent className="max-h-72">
                          {systemVoices.slice(0, 30).map((v) => (
                            <SelectItem key={v.voiceId} value={v.voiceId}>{v.displayName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                        </div>
                      );
                    })}
                  </Card>

                  {/* Style + Subtitles + Intro/Outro */}
                  <Card className="p-6">
                    <Tabs defaultValue="style">
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

                        {/* B-roll Mix: % talking-head vs sketch */}
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

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{project.execution_step ?? "..."}</span>
                      <span className="font-medium">{project.progress_pct}%</span>
                    </div>
                    <Progress value={project.progress_pct} />
                  </div>

                  {project.progress_log?.length > 0 && (
                    <div className="bg-muted/30 rounded-md p-3 max-h-48 overflow-y-auto text-xs font-mono space-y-1">
                      {project.progress_log.slice(-12).map((l, i) => (
                        <div key={i} className="text-muted-foreground">{l.message}</div>
                      ))}
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
