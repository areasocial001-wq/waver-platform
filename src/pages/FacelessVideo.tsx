import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { AuthGuard } from "@/components/AuthGuard";
import { PremiumGate } from "@/components/PremiumGate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Loader2, Video, Play, ChevronRight, Mic, Image, Music, FileText, Sparkles, Eye, EyeOff } from "lucide-react";

interface SceneConfig {
  id: string;
  narration: string;
  visualPrompt: string;
  duration: string;
  imageUrl?: string;
  videoUrl?: string;
  status: "pending" | "generating" | "done" | "error";
}

const FacelessVideoPage = () => {
  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState("educational");
  const [platform, setPlatform] = useState("youtube-shorts");
  const [voiceStyle, setVoiceStyle] = useState("professional");
  const [scenes, setScenes] = useState<SceneConfig[]>([]);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isProducing, setIsProducing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [scriptApproved, setScriptApproved] = useState(false);

  // Step 1: Generate script from topic using AI
  const generateScript = useCallback(async () => {
    if (!topic.trim()) { toast.error("Inserisci un argomento"); return; }
    setIsGeneratingScript(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-content", {
        body: {
          prompt: `Crea uno script per un video faceless ${platform === "youtube-shorts" ? "YouTube Shorts (60 secondi, verticale 9:16)" : "YouTube (3-5 minuti, orizzontale 16:9)"} sull'argomento: "${topic}".
Stile: ${style}.
Rispondi SOLO con un JSON array di scene, ogni scena ha: narration (testo voiceover), visualPrompt (prompt per generare il B-roll/visual), duration (5s o 9s).
Esempio: [{"narration":"...", "visualPrompt":"...", "duration":"5s"}]
Crea ${platform === "youtube-shorts" ? "4-6" : "10-15"} scene.`,
          type: "script",
        },
      });
      if (error) throw new Error(error.message);

      // Parse scenes from AI response
      const content = data?.content || data?.text || "";
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("Formato risposta non valido");

      const parsed = JSON.parse(jsonMatch[0]);
      const newScenes: SceneConfig[] = parsed.map((s: { narration: string; visualPrompt: string; duration?: string }, i: number) => ({
        id: `scene-${i}`,
        narration: s.narration,
        visualPrompt: s.visualPrompt,
        duration: s.duration || "5s",
        status: "pending" as const,
      }));
      setScenes(newScenes);
      setCurrentStep(1);
      toast.success(`Script generato: ${newScenes.length} scene`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setIsGeneratingScript(false);
    }
  }, [topic, style, platform]);

  // Step 2: Approve script and produce videos
  const produceVideo = useCallback(async () => {
    setIsProducing(true);
    setCurrentStep(2);
    const updatedScenes = [...scenes];

    for (let i = 0; i < updatedScenes.length; i++) {
      updatedScenes[i].status = "generating";
      setScenes([...updatedScenes]);

      try {
        // Generate B-roll video for each scene
        const { data, error } = await supabase.functions.invoke("luma-video", {
          body: {
            prompt: updatedScenes[i].visualPrompt,
            model: "ray-flash-2",
            aspect_ratio: platform === "youtube-shorts" ? "9:16" : "16:9",
            duration: updatedScenes[i].duration,
            resolution: "720p",
          },
        });
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);

        // Poll for result
        const genId = data.id;
        for (let j = 0; j < 60; j++) {
          await new Promise(r => setTimeout(r, 5000));
          const { data: poll } = await supabase.functions.invoke("luma-video", { body: { generationId: genId } });
          if (poll?.status === "completed") {
            updatedScenes[i].videoUrl = poll.videoUrl;
            updatedScenes[i].status = "done";
            setScenes([...updatedScenes]);
            break;
          }
          if (poll?.status === "failed") throw new Error(poll.error);
        }
        if (updatedScenes[i].status !== "done") {
          updatedScenes[i].status = "error";
          setScenes([...updatedScenes]);
        }
      } catch (err) {
        updatedScenes[i].status = "error";
        setScenes([...updatedScenes]);
        console.error(`Scene ${i} error:`, err);
      }
    }

    setIsProducing(false);
    setCurrentStep(3);
    const doneCount = updatedScenes.filter(s => s.status === "done").length;
    toast.success(`Produzione completata: ${doneCount}/${updatedScenes.length} scene`);
  }, [scenes, platform]);

  const progress = scenes.length > 0
    ? Math.round((scenes.filter(s => s.status === "done").length / scenes.length) * 100)
    : 0;

  return (
    <AuthGuard>
      <PremiumGate featureName="Faceless Video Generator">
        <div className="min-h-screen bg-background">
          <Navbar />
          <div className="container mx-auto max-w-5xl py-8 px-4">
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                Faceless Video Generator
              </h1>
              <p className="text-muted-foreground">
                Crea video YouTube e Shorts completi senza camera — Script AI → B-Roll → Voiceover → Video finale
              </p>
            </div>

            {/* Step indicators */}
            <div className="flex items-center gap-2 mb-6">
              {["Argomento", "Script", "Produzione", "Risultato"].map((step, i) => (
                <div key={step} className="flex items-center gap-2">
                  <Badge variant={currentStep >= i ? "default" : "outline"} className={currentStep >= i ? "bg-emerald-500" : ""}>
                    {i + 1}
                  </Badge>
                  <span className={`text-sm ${currentStep >= i ? "text-foreground" : "text-muted-foreground"}`}>{step}</span>
                  {i < 3 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </div>
              ))}
            </div>

            {/* Step 1: Topic */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-400" /> 1. Argomento e Configurazione
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Argomento del video</Label>
                  <Textarea value={topic} onChange={e => setTopic(e.target.value)} placeholder="Es: 5 abitudini dei milionari che puoi adottare oggi..." rows={2} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Stile</Label>
                    <Select value={style} onValueChange={setStyle}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="educational">Educativo</SelectItem>
                        <SelectItem value="motivational">Motivazionale</SelectItem>
                        <SelectItem value="news">News/Breaking</SelectItem>
                        <SelectItem value="storytelling">Storytelling</SelectItem>
                        <SelectItem value="listicle">Lista/Listicle</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Piattaforma</Label>
                    <Select value={platform} onValueChange={setPlatform}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="youtube-shorts">YouTube Shorts</SelectItem>
                        <SelectItem value="youtube">YouTube</SelectItem>
                        <SelectItem value="tiktok">TikTok</SelectItem>
                        <SelectItem value="instagram">Instagram Reels</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Voce</Label>
                    <Select value={voiceStyle} onValueChange={setVoiceStyle}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professional">Professionale</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                        <SelectItem value="dramatic">Drammatica</SelectItem>
                        <SelectItem value="energetic">Energica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={generateScript} disabled={isGeneratingScript} className="w-full">
                  {isGeneratingScript ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generazione script...</> : <><Sparkles className="w-4 h-4 mr-2" /> Genera Script AI</>}
                </Button>
              </CardContent>
            </Card>

            {/* Step 2: Script Review */}
            {scenes.length > 0 && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="w-5 h-5 text-emerald-400" /> 2. Revisione Script ({scenes.length} scene)
                  </CardTitle>
                  <CardDescription>Rivedi e modifica lo script prima della produzione</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {scenes.map((scene, i) => (
                    <div key={scene.id} className="border border-border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">Scena {i + 1}</Badge>
                        <Badge variant={scene.status === "done" ? "default" : scene.status === "generating" ? "secondary" : scene.status === "error" ? "destructive" : "outline"}>
                          {scene.status === "done" ? "✓" : scene.status === "generating" ? "⏳" : scene.status === "error" ? "✗" : "—"} {scene.duration}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Narrazione</Label>
                          <Textarea
                            value={scene.narration}
                            onChange={e => {
                              const updated = [...scenes];
                              updated[i].narration = e.target.value;
                              setScenes(updated);
                            }}
                            rows={2}
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Visual Prompt (B-Roll)</Label>
                          <Textarea
                            value={scene.visualPrompt}
                            onChange={e => {
                              const updated = [...scenes];
                              updated[i].visualPrompt = e.target.value;
                              setScenes(updated);
                            }}
                            rows={2}
                            className="text-sm"
                          />
                        </div>
                      </div>
                      {scene.videoUrl && (
                        <video src={scene.videoUrl} controls className="w-full rounded max-h-48" />
                      )}
                    </div>
                  ))}
                  {!isProducing && currentStep < 2 && (
                    <Button onClick={produceVideo} className="w-full bg-emerald-600 hover:bg-emerald-700">
                      <Play className="w-4 h-4 mr-2" /> Approva e Produci Video
                    </Button>
                  )}
                  {isProducing && (
                    <div className="space-y-2">
                      <Progress value={progress} />
                      <p className="text-sm text-muted-foreground text-center">
                        Produzione in corso: {scenes.filter(s => s.status === "done").length}/{scenes.length} scene completate
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Step 3: Final result */}
            {currentStep >= 3 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Video className="w-5 h-5 text-emerald-400" /> 3. Video Prodotti
                  </CardTitle>
                  <CardDescription>Le clip B-Roll sono pronte. Importale nel Timeline Editor per il montaggio finale con voiceover.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {scenes.filter(s => s.videoUrl).map((scene, i) => (
                      <div key={scene.id} className="relative">
                        <video src={scene.videoUrl} controls className="w-full rounded-lg" />
                        <Badge className="absolute top-2 left-2 bg-black/70">Scena {i + 1}</Badge>
                      </div>
                    ))}
                  </div>
                  <Button onClick={() => window.location.href = "/timeline-editor"} className="w-full mt-4" variant="outline">
                    Apri nel Timeline Editor per il montaggio finale
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </PremiumGate>
    </AuthGuard>
  );
};

export default FacelessVideoPage;
