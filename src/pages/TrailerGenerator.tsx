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
import { Loader2, Film, Play, ChevronRight, Sparkles, Music, Clapperboard } from "lucide-react";

interface TrailerScene {
  id: string;
  description: string;
  visualPrompt: string;
  mood: string;
  duration: string;
  videoUrl?: string;
  status: "pending" | "generating" | "done" | "error";
}

const TrailerGeneratorPage = () => {
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("thriller");
  const [mediaType, setMediaType] = useState("film");
  const [synopsis, setSynopsis] = useState("");
  const [scenes, setScenes] = useState<TrailerScene[]>([]);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isProducing, setIsProducing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Generate trailer script
  const generateTrailerScript = useCallback(async () => {
    if (!title.trim() || !synopsis.trim()) { toast.error("Inserisci titolo e sinossi"); return; }
    setIsGeneratingScript(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-content", {
        body: {
          prompt: `Sei un trailer editor professionista. Crea uno script per un trailer cinematografico epico per:
Titolo: "${title}"
Tipo: ${mediaType}
Genere: ${genre}
Sinossi: ${synopsis}

Il trailer deve seguire una struttura emotiva classica:
1. Setup (scena d'apertura calma/misteriosa)
2. Build-up (tensione crescente, presentazione conflitto)
3. Climax (momenti più intensi, colpi di scena)
4. Final beat (tagline finale, titolo)

Rispondi SOLO con un JSON array. Ogni scena: description (cosa succede), visualPrompt (prompt dettagliato per generazione video cinematografica), mood (calm/tense/intense/epic/mysterious), duration (5s o 9s).
Crea 6-8 scene.`,
          type: "script",
        },
      });
      if (error) throw new Error(error.message);

      const content = data?.content || data?.text || "";
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("Formato non valido");

      const parsed = JSON.parse(jsonMatch[0]);
      const newScenes: TrailerScene[] = parsed.map((s: { description: string; visualPrompt: string; mood?: string; duration?: string }, i: number) => ({
        id: `trailer-${i}`,
        description: s.description,
        visualPrompt: s.visualPrompt,
        mood: s.mood || "tense",
        duration: s.duration || "5s",
        status: "pending" as const,
      }));
      setScenes(newScenes);
      setCurrentStep(1);
      toast.success(`Trailer script: ${newScenes.length} scene`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setIsGeneratingScript(false);
    }
  }, [title, synopsis, genre, mediaType]);

  // Produce trailer videos
  const produceTrailer = useCallback(async () => {
    setIsProducing(true);
    setCurrentStep(2);
    const updated = [...scenes];

    for (let i = 0; i < updated.length; i++) {
      updated[i].status = "generating";
      setScenes([...updated]);

      try {
        const { data, error } = await supabase.functions.invoke("luma-video", {
          body: {
            prompt: `${updated[i].visualPrompt}. Cinematic ${genre} movie trailer style, dramatic lighting, film grain, anamorphic lens flare.`,
            model: "ray-2",
            aspect_ratio: "21:9",
            duration: updated[i].duration,
            resolution: "1080p",
          },
        });
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);

        const genId = data.id;
        for (let j = 0; j < 60; j++) {
          await new Promise(r => setTimeout(r, 5000));
          const { data: poll } = await supabase.functions.invoke("luma-video", { body: { generationId: genId } });
          if (poll?.status === "completed") {
            updated[i].videoUrl = poll.videoUrl;
            updated[i].status = "done";
            setScenes([...updated]);
            break;
          }
          if (poll?.status === "failed") throw new Error(poll.error);
        }
        if (updated[i].status !== "done") {
          updated[i].status = "error";
          setScenes([...updated]);
        }
      } catch (err) {
        updated[i].status = "error";
        setScenes([...updated]);
        console.error(`Trailer scene ${i} error:`, err);
      }
    }

    setIsProducing(false);
    setCurrentStep(3);
    const doneCount = updated.filter(s => s.status === "done").length;
    toast.success(`Trailer completato: ${doneCount}/${updated.length} scene`);
  }, [scenes, genre]);

  const progress = scenes.length > 0
    ? Math.round((scenes.filter(s => s.status === "done").length / scenes.length) * 100)
    : 0;

  const moodColors: Record<string, string> = {
    calm: "bg-blue-500/20 text-blue-400",
    mysterious: "bg-purple-500/20 text-purple-400",
    tense: "bg-amber-500/20 text-amber-400",
    intense: "bg-orange-500/20 text-orange-400",
    epic: "bg-red-500/20 text-red-400",
  };

  return (
    <AuthGuard>
      <PremiumGate featureName="Trailer Generator">
        <div className="min-h-screen bg-background">
          <Navbar />
          <div className="container mx-auto max-w-5xl py-8 px-4">
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                🎬 Trailer Generator
              </h1>
              <p className="text-muted-foreground">
                Genera trailer cinematografici per libri, giochi e film — Script AI → Scene → Montaggio
              </p>
            </div>

            {/* Steps */}
            <div className="flex items-center gap-2 mb-6">
              {["Concept", "Script", "Produzione", "Trailer"].map((step, i) => (
                <div key={step} className="flex items-center gap-2">
                  <Badge variant={currentStep >= i ? "default" : "outline"} className={currentStep >= i ? "bg-red-500" : ""}>
                    {i + 1}
                  </Badge>
                  <span className={`text-sm ${currentStep >= i ? "text-foreground" : "text-muted-foreground"}`}>{step}</span>
                  {i < 3 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </div>
              ))}
            </div>

            {/* Step 1 */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clapperboard className="w-5 h-5 text-red-400" /> 1. Concept
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Titolo</Label>
                    <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Il titolo del tuo progetto" />
                  </div>
                  <div>
                    <Label>Tipo</Label>
                    <Select value={mediaType} onValueChange={setMediaType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="film">Film</SelectItem>
                        <SelectItem value="book">Libro</SelectItem>
                        <SelectItem value="game">Videogioco</SelectItem>
                        <SelectItem value="series">Serie TV</SelectItem>
                        <SelectItem value="documentary">Documentario</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Genere</Label>
                    <Select value={genre} onValueChange={setGenre}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="thriller">Thriller</SelectItem>
                        <SelectItem value="action">Azione</SelectItem>
                        <SelectItem value="scifi">Sci-Fi</SelectItem>
                        <SelectItem value="horror">Horror</SelectItem>
                        <SelectItem value="drama">Dramma</SelectItem>
                        <SelectItem value="fantasy">Fantasy</SelectItem>
                        <SelectItem value="comedy">Commedia</SelectItem>
                        <SelectItem value="romance">Romance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Sinossi / Trama</Label>
                  <Textarea value={synopsis} onChange={e => setSynopsis(e.target.value)} placeholder="Descrivi la trama, i personaggi principali, il conflitto..." rows={4} />
                </div>
                <Button onClick={generateTrailerScript} disabled={isGeneratingScript} className="w-full bg-red-600 hover:bg-red-700">
                  {isGeneratingScript ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generazione script...</> : <><Sparkles className="w-4 h-4 mr-2" /> Genera Script Trailer</>}
                </Button>
              </CardContent>
            </Card>

            {/* Step 2: Script */}
            {scenes.length > 0 && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Film className="w-5 h-5 text-red-400" /> 2. Script Trailer ({scenes.length} scene)
                  </CardTitle>
                  <CardDescription>Struttura emotiva: Setup → Build-up → Climax → Final Beat</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {scenes.map((scene, i) => (
                    <div key={scene.id} className="border border-border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Scena {i + 1}</Badge>
                          <Badge className={moodColors[scene.mood] || "bg-muted text-muted-foreground"}>
                            {scene.mood}
                          </Badge>
                        </div>
                        <Badge variant={scene.status === "done" ? "default" : scene.status === "generating" ? "secondary" : scene.status === "error" ? "destructive" : "outline"}>
                          {scene.duration}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{scene.description}</p>
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
                      {scene.videoUrl && (
                        <video src={scene.videoUrl} controls className="w-full rounded max-h-48" />
                      )}
                    </div>
                  ))}
                  {!isProducing && currentStep < 2 && (
                    <Button onClick={produceTrailer} className="w-full bg-red-600 hover:bg-red-700">
                      <Play className="w-4 h-4 mr-2" /> Produci Trailer
                    </Button>
                  )}
                  {isProducing && (
                    <div className="space-y-2">
                      <Progress value={progress} />
                      <p className="text-sm text-muted-foreground text-center">
                        {scenes.filter(s => s.status === "done").length}/{scenes.length} scene
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Step 3: Result */}
            {currentStep >= 3 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Film className="w-5 h-5 text-red-400" /> 3. Trailer Prodotto
                  </CardTitle>
                  <CardDescription>Le clip sono pronte. Usa il Timeline Editor per aggiungere musica, sound design e titoli.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {scenes.filter(s => s.videoUrl).map((scene, i) => (
                      <div key={scene.id} className="relative">
                        <video src={scene.videoUrl} controls className="w-full rounded-lg" />
                        <Badge className={`absolute top-2 left-2 ${moodColors[scene.mood] || "bg-black/70"}`}>
                          {scene.mood}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  <Button onClick={() => window.location.href = "/timeline-editor"} className="w-full mt-4" variant="outline">
                    <Music className="w-4 h-4 mr-2" /> Apri nel Timeline Editor per il montaggio
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

export default TrailerGeneratorPage;
