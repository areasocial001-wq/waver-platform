import { useEffect, useRef, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Bot,
  FileText,
  Loader2,
  Sparkles,
  Upload,
  CheckCircle2,
  AlertCircle,
  Play,
  Download,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useInworldVoices } from "@/hooks/useInworldVoices";

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
  narration_url: string | null;
  final_video_url: string | null;
  json2video_project_id: string | null;
  error_message: string | null;
};

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "it", label: "Italiano" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "pt", label: "Português" },
];

const AGENT_BUCKET = "agent-uploads";

export default function AgentPage() {
  const [brief, setBrief] = useState("");
  const [language, setLanguage] = useState("en");
  const [duration, setDuration] = useState(35);
  const [aspect, setAspect] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [voiceId, setVoiceId] = useState<string>("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [extractingPdf, setExtractingPdf] = useState(false);
  const [pdfText, setPdfText] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [project, setProject] = useState<ProjectRow | null>(null);
  const pollRef = useRef<number | null>(null);

  const { systemVoices, isLoading: voicesLoading } = useInworldVoices();

  // Subscribe to realtime updates of the active project
  useEffect(() => {
    if (!project?.id) return;
    const channel = supabase
      .channel(`agent_project_${project.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "agent_projects",
          filter: `id=eq.${project.id}`,
        },
        (payload) => {
          setProject(payload.new as ProjectRow);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [project?.id]);

  // Poll JSON2Video render status while running
  useEffect(() => {
    if (!project?.json2video_project_id) return;
    if (project.execution_status !== "running" && project.execution_status !== "rendering") {
      // also poll when "running" because we transition to rendering server-side
    }
    if (project.final_video_url || project.execution_status === "done") return;
    if (project.execution_status === "error") return;

    let cancelled = false;
    const tick = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("agent-status", {
          body: { projectId: project.id },
        });
        if (error) console.warn("status poll error:", error);
        // realtime channel will pick up DB updates
      } catch (e) {
        console.warn(e);
      }
      if (!cancelled) {
        pollRef.current = window.setTimeout(tick, 8000);
      }
    };
    pollRef.current = window.setTimeout(tick, 5000);
    return () => {
      cancelled = true;
      if (pollRef.current) window.clearTimeout(pollRef.current);
    };
  }, [project?.id, project?.json2video_project_id, project?.execution_status, project?.final_video_url]);

  const handlePdfUpload = async (file: File) => {
    setPdfFile(file);
    setExtractingPdf(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        const { data, error } = await supabase.functions.invoke("extract-pdf-text", {
          body: { pdfBase64: base64 },
        });
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
    if (!brief.trim()) {
      toast.error("Inserisci un brief");
      return;
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
          brief,
          pdf_text: pdfText || null,
          language,
          voice_id: voiceId || null,
          target_duration: duration,
          aspect_ratio: aspect,
        })
        .select("*")
        .single();
      if (error) throw error;

      setProject(created as ProjectRow);

      const { error: planErr } = await supabase.functions.invoke("agent-plan", {
        body: { projectId: created.id },
      });
      if (planErr) throw planErr;

      // refresh project (realtime will also push)
      const { data: refreshed } = await supabase
        .from("agent_projects")
        .select("*")
        .eq("id", created.id)
        .single();
      if (refreshed) setProject(refreshed as ProjectRow);
      toast.success("Piano video pronto");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Errore");
    } finally {
      setCreating(false);
    }
  };

  const handleConfirmAndExecute = async () => {
    if (!project) return;
    try {
      toast.info("Avvio produzione...");
      const { error } = await supabase.functions.invoke("agent-execute", {
        body: { projectId: project.id },
      });
      if (error) throw error;
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Errore esecuzione");
    }
  };

  const handleEditTranscript = async (newTranscript: string) => {
    if (!project) return;
    const updated = { ...project.plan, transcript: newTranscript };
    await supabase.from("agent_projects").update({ plan: updated }).eq("id", project.id);
    setProject({ ...project, plan: updated });
  };

  const handleReset = () => {
    setProject(null);
    setBrief("");
    setPdfFile(null);
    setPdfText("");
  };

  const planReady = project?.plan_status === "ready" && project?.plan?.transcript;
  const isExecuting =
    project?.execution_status === "running" || project?.execution_status === "rendering";
  const isDone = project?.execution_status === "done" && !!project?.final_video_url;
  const hasError = project?.execution_status === "error" || project?.plan_status === "error";

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-8 max-w-5xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-4">
              <Bot className="w-4 h-4" />
              Video Agent
            </div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Da Brief a Video, Automatico
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
              Descrivi cosa vuoi (puoi allegare un PDF). L'agente genera un piano,
              raccoglie asset stock pertinenti, scrive la narrazione e monta il video finale.
            </p>
          </div>

          {!project && (
            <Card className="p-6 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="brief">Brief del video</Label>
                <Textarea
                  id="brief"
                  placeholder="Es. Video di presentazione di 30 secondi sui nostri servizi di safety frontline per clienti potenziali. Tono professionale e rassicurante."
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  rows={5}
                />
              </div>

              <div className="space-y-2">
                <Label>Documento di riferimento (PDF, opzionale)</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handlePdfUpload(f);
                    }}
                    disabled={extractingPdf}
                  />
                  {extractingPdf && <Loader2 className="w-4 h-4 animate-spin" />}
                  {pdfText && !extractingPdf && (
                    <Badge variant="secondary" className="gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {pdfText.length.toLocaleString()} char
                    </Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Lingua</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((l) => (
                        <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Durata (s)</Label>
                  <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[15, 30, 45, 60, 90].map((d) => (
                        <SelectItem key={d} value={String(d)}>{d}s</SelectItem>
                      ))}
                    </SelectContent>
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
                        <SelectItem key={v.voiceId} value={v.voiceId}>
                          {v.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                size="lg"
                className="w-full gap-2"
                onClick={handleCreateAndPlan}
                disabled={creating || !brief.trim()}
              >
                {creating ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Generazione piano...</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Genera Piano Video</>
                )}
              </Button>
            </Card>
          )}

          {project && planReady && !isExecuting && !isDone && (
            <Card className="p-6 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">
                    Piano video
                  </div>
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
                <Label className="text-xs uppercase text-muted-foreground">Audience</Label>
                <p className="text-sm mt-1">{project.plan.audience}</p>
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

              <div>
                <Label className="text-xs uppercase text-muted-foreground">
                  Trascrizione (modificabile)
                </Label>
                <Textarea
                  value={project.plan.transcript}
                  onChange={(e) => handleEditTranscript(e.target.value)}
                  rows={6}
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs uppercase text-muted-foreground">
                  Scene visive previste
                </Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {(project.plan.scene_keywords || []).map((k: string, i: number) => (
                    <Badge key={i} variant="secondary">{k}</Badge>
                  ))}
                </div>
              </div>

              <Button size="lg" className="w-full gap-2" onClick={handleConfirmAndExecute}>
                <Play className="w-4 h-4" /> Conferma e Produci Video
              </Button>
            </Card>
          )}

          {project && (isExecuting || isDone) && (
            <Card className="p-6 space-y-5">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  Produzione in corso
                </div>
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
                    <div key={i} className="text-muted-foreground">
                      {l.message}
                    </div>
                  ))}
                </div>
              )}

              {project.selected_assets?.length > 0 && (
                <div>
                  <Label className="text-xs uppercase text-muted-foreground">
                    Asset selezionati ({project.selected_assets.length})
                  </Label>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-2">
                    {project.selected_assets.map((a: any, i: number) => (
                      <div key={i} className="aspect-video bg-muted rounded overflow-hidden">
                        {a.thumb && (
                          <img
                            src={a.thumb}
                            alt={a.keyword}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isDone && project.final_video_url && (
                <div className="space-y-3">
                  <video
                    src={project.final_video_url}
                    controls
                    className="w-full rounded-lg bg-black"
                    preload="metadata"
                  />
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
                  <p className="text-sm text-muted-foreground mt-1">
                    {project.error_message || "Errore sconosciuto"}
                  </p>
                  <Button variant="outline" size="sm" onClick={handleReset} className="mt-3">
                    Riprova
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
