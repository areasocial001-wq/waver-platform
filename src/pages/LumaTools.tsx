import { useState, useEffect, useCallback } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Video, Image, Play, RefreshCw, Repeat, Camera, Wand2, Upload, Download, Sparkles, Eye } from "lucide-react";

// Luma generation hook
function useLumaGeneration() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [result, setResult] = useState<{ videoUrl?: string; imageUrl?: string; thumbnail?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateVideo = useCallback(async (params: Record<string, unknown>) => {
    setIsGenerating(true);
    setError(null);
    setResult(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("luma-video", { body: params });
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      
      const generationId = data.id;
      toast.success("Generazione Luma avviata!");
      
      // Start polling
      setIsPolling(true);
      const poll = async () => {
        for (let i = 0; i < 120; i++) {
          await new Promise(r => setTimeout(r, 5000));
          const { data: pollData, error: pollErr } = await supabase.functions.invoke("luma-video", {
            body: { generationId },
          });
          if (pollErr) continue;
          if (pollData?.status === "completed") {
            setResult({ videoUrl: pollData.videoUrl, thumbnail: pollData.thumbnail });
            setIsPolling(false);
            setIsGenerating(false);
            toast.success("Video Luma completato!");
            return;
          }
          if (pollData?.status === "failed") {
            throw new Error(pollData.error || "Generation failed");
          }
        }
        throw new Error("Timeout: generazione troppo lunga");
      };
      await poll();
    } catch (err) {
      setError((err as Error).message);
      toast.error((err as Error).message);
      setIsGenerating(false);
      setIsPolling(false);
    }
  }, []);

  const generateImage = useCallback(async (params: Record<string, unknown>) => {
    setIsGenerating(true);
    setError(null);
    setResult(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("luma-image", { body: params });
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      
      const generationId = data.id;
      toast.success("Generazione immagine Photon avviata!");
      
      setIsPolling(true);
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 3000));
        const { data: pollData } = await supabase.functions.invoke("luma-image", {
          body: { generationId },
        });
        if (pollData?.status === "completed") {
          setResult({ imageUrl: pollData.imageUrl });
          setIsPolling(false);
          setIsGenerating(false);
          toast.success("Immagine Photon completata!");
          return;
        }
        if (pollData?.status === "failed") {
          throw new Error(pollData.error || "Generation failed");
        }
      }
      throw new Error("Timeout");
    } catch (err) {
      setError((err as Error).message);
      toast.error((err as Error).message);
      setIsGenerating(false);
      setIsPolling(false);
    }
  }, []);

  return { isGenerating, isPolling, result, error, generateVideo, generateImage, setResult };
}

const LumaToolsPage = () => {
  const { isGenerating, isPolling, result, error, generateVideo, generateImage } = useLumaGeneration();
  
  // Video form state
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("ray-2");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [duration, setDuration] = useState("5s");
  const [loop, setLoop] = useState(false);
  const [resolution, setResolution] = useState("720p");
  const [startFrameUrl, setStartFrameUrl] = useState("");
  const [endFrameUrl, setEndFrameUrl] = useState("");
  const [extendId, setExtendId] = useState("");
  const [reverseExtend, setReverseExtend] = useState(false);
  
  // Image form state
  const [imgPrompt, setImgPrompt] = useState("");
  const [imgAspectRatio, setImgAspectRatio] = useState("16:9");
  const [characterRef, setCharacterRef] = useState("");
  const [styleRef, setStyleRef] = useState("");
  const [modifyImageRef, setModifyImageRef] = useState("");

  const handleVideoGenerate = () => {
    if (!prompt.trim()) { toast.error("Inserisci un prompt"); return; }
    const params: Record<string, unknown> = {
      prompt: prompt.trim(),
      model,
      aspect_ratio: aspectRatio,
      duration,
      loop,
      resolution,
    };
    if (startFrameUrl) {
      params.keyframes = { frame0: startFrameUrl };
      if (endFrameUrl) {
        (params.keyframes as Record<string, string>).frame1 = endFrameUrl;
      }
    } else if (endFrameUrl) {
      params.keyframes = { frame1: endFrameUrl };
    }
    if (extendId) {
      params.extend_id = extendId;
      params.reverse_extend = reverseExtend;
    }
    generateVideo(params);
  };

  const handleImageGenerate = () => {
    if (!imgPrompt.trim()) { toast.error("Inserisci un prompt"); return; }
    const params: Record<string, unknown> = {
      prompt: imgPrompt.trim(),
      aspect_ratio: imgAspectRatio,
    };
    if (characterRef) params.character_ref = characterRef;
    if (styleRef) params.style_ref = styleRef;
    if (modifyImageRef) params.modify_image_ref = modifyImageRef;
    generateImage(params);
  };

  return (
    <AuthGuard>
      <PremiumGate featureName="Luma AI Tools">
        <div className="min-h-screen bg-background">
          <Navbar />
          <div className="container mx-auto max-w-6xl py-8 px-4">
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                Luma AI Tools
              </h1>
              <p className="text-muted-foreground">
                Ray2 Video & Photon Image — Keyframe, Extend, Loop, Camera Control, Character Reference
              </p>
            </div>

            <Tabs defaultValue="video" className="w-full">
              <TabsList className="grid w-full grid-cols-5 mb-6">
                <TabsTrigger value="video" className="flex items-center gap-2">
                  <Video className="w-4 h-4" /> T2V / I2V
                </TabsTrigger>
                <TabsTrigger value="keyframe" className="flex items-center gap-2">
                  <Camera className="w-4 h-4" /> Keyframe
                </TabsTrigger>
                <TabsTrigger value="extend" className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" /> Extend
                </TabsTrigger>
                <TabsTrigger value="loop" className="flex items-center gap-2">
                  <Repeat className="w-4 h-4" /> Loop
                </TabsTrigger>
                <TabsTrigger value="photon" className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> Photon
                </TabsTrigger>
              </TabsList>

              {/* Text/Image to Video */}
              <TabsContent value="video">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Video className="w-5 h-5 text-violet-400" /> Ray2 Video Generation
                    </CardTitle>
                    <CardDescription>Genera video cinematografici con testo o immagini di partenza</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Prompt</Label>
                      <Textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Descrivi il video che vuoi creare..." rows={3} />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <Label>Modello</Label>
                        <Select value={model} onValueChange={setModel}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ray-2">Ray 2</SelectItem>
                            <SelectItem value="ray-flash-2">Ray Flash 2</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Aspect Ratio</Label>
                        <Select value={aspectRatio} onValueChange={setAspectRatio}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="16:9">16:9</SelectItem>
                            <SelectItem value="9:16">9:16</SelectItem>
                            <SelectItem value="1:1">1:1</SelectItem>
                            <SelectItem value="4:3">4:3</SelectItem>
                            <SelectItem value="3:4">3:4</SelectItem>
                            <SelectItem value="21:9">21:9</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Durata</Label>
                        <Select value={duration} onValueChange={setDuration}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5s">5 secondi</SelectItem>
                            <SelectItem value="9s">9 secondi</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Risoluzione</Label>
                        <Select value={resolution} onValueChange={setResolution}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="540p">540p</SelectItem>
                            <SelectItem value="720p">720p</SelectItem>
                            <SelectItem value="1080p">1080p</SelectItem>
                            <SelectItem value="4k">4K</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Immagine di partenza (URL, opzionale)</Label>
                      <Input value={startFrameUrl} onChange={e => setStartFrameUrl(e.target.value)} placeholder="https://..." />
                    </div>
                    <Button onClick={handleVideoGenerate} disabled={isGenerating} className="w-full">
                      {isGenerating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {isPolling ? "In attesa del risultato..." : "Avvio..."}</> : <><Play className="w-4 h-4 mr-2" /> Genera Video</>}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Keyframe */}
              <TabsContent value="keyframe">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Camera className="w-5 h-5 text-violet-400" /> Keyframe Control
                    </CardTitle>
                    <CardDescription>Controlla la narrativa definendo frame iniziale e finale. Ray2 interpola tra i due.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Prompt</Label>
                      <Textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Descrivi la transizione tra i due frame..." rows={3} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Frame Iniziale (URL immagine)</Label>
                        <Input value={startFrameUrl} onChange={e => setStartFrameUrl(e.target.value)} placeholder="https://... frame di partenza" />
                      </div>
                      <div>
                        <Label>Frame Finale (URL immagine)</Label>
                        <Input value={endFrameUrl} onChange={e => setEndFrameUrl(e.target.value)} placeholder="https://... frame di arrivo" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Modello</Label>
                        <Select value={model} onValueChange={setModel}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ray-2">Ray 2</SelectItem>
                            <SelectItem value="ray-flash-2">Ray Flash 2</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Aspect Ratio</Label>
                        <Select value={aspectRatio} onValueChange={setAspectRatio}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="16:9">16:9</SelectItem>
                            <SelectItem value="9:16">9:16</SelectItem>
                            <SelectItem value="1:1">1:1</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button onClick={handleVideoGenerate} disabled={isGenerating || (!startFrameUrl && !endFrameUrl)} className="w-full">
                      {isGenerating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generazione in corso...</> : <><Camera className="w-4 h-4 mr-2" /> Genera con Keyframe</>}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Extend */}
              <TabsContent value="extend">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <RefreshCw className="w-5 h-5 text-violet-400" /> Video Extend
                    </CardTitle>
                    <CardDescription>Estendi un video esistente in avanti o all'indietro. Inserisci l'ID di una generazione Luma precedente.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>ID Generazione da estendere</Label>
                      <Input value={extendId} onChange={e => setExtendId(e.target.value)} placeholder="es. abc123-def456-..." />
                    </div>
                    <div>
                      <Label>Prompt per l'estensione</Label>
                      <Textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Descrivi come deve continuare il video..." rows={3} />
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch checked={reverseExtend} onCheckedChange={setReverseExtend} />
                      <Label>Estendi all'indietro (Reverse Extend)</Label>
                    </div>
                    <Button onClick={handleVideoGenerate} disabled={isGenerating || !extendId} className="w-full">
                      {isGenerating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Estensione in corso...</> : <><RefreshCw className="w-4 h-4 mr-2" /> Estendi Video</>}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Loop */}
              <TabsContent value="loop">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Repeat className="w-5 h-5 text-violet-400" /> Seamless Loop
                    </CardTitle>
                    <CardDescription>Crea video in loop continuo perfetto — ideale per sfondi, UI, social media.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Prompt</Label>
                      <Textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Descrivi la scena per il loop (es. fiamme di un falò, onde del mare...)" rows={3} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Aspect Ratio</Label>
                        <Select value={aspectRatio} onValueChange={setAspectRatio}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="16:9">16:9</SelectItem>
                            <SelectItem value="9:16">9:16</SelectItem>
                            <SelectItem value="1:1">1:1</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Risoluzione</Label>
                        <Select value={resolution} onValueChange={setResolution}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="720p">720p</SelectItem>
                            <SelectItem value="1080p">1080p</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button onClick={() => { setLoop(true); handleVideoGenerate(); }} disabled={isGenerating} className="w-full">
                      {isGenerating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creazione loop...</> : <><Repeat className="w-4 h-4 mr-2" /> Crea Loop</>}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Photon Image */}
              <TabsContent value="photon">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-fuchsia-400" /> Luma Photon
                    </CardTitle>
                    <CardDescription>Generazione immagini con Character Reference e Visual Reference per consistenza visiva.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Prompt</Label>
                      <Textarea value={imgPrompt} onChange={e => setImgPrompt(e.target.value)} placeholder="Descrivi l'immagine da generare..." rows={3} />
                    </div>
                    <div>
                      <Label>Aspect Ratio</Label>
                      <Select value={imgAspectRatio} onValueChange={setImgAspectRatio}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="16:9">16:9</SelectItem>
                          <SelectItem value="9:16">9:16</SelectItem>
                          <SelectItem value="1:1">1:1</SelectItem>
                          <SelectItem value="4:3">4:3</SelectItem>
                          <SelectItem value="3:4">3:4</SelectItem>
                          <SelectItem value="21:9">21:9</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-3 border border-border rounded-lg p-4">
                      <h4 className="text-sm font-semibold flex items-center gap-2"><Eye className="w-4 h-4" /> Riferimenti (opzionale)</h4>
                      <div>
                        <Label>Character Reference (URL foto persona)</Label>
                        <Input value={characterRef} onChange={e => setCharacterRef(e.target.value)} placeholder="https://... foto del personaggio per mantenere consistenza" />
                        <p className="text-xs text-muted-foreground mt-1">Mantiene tratti facciali e identità tra diverse generazioni</p>
                      </div>
                      <div>
                        <Label>Style Reference (URL immagine di stile)</Label>
                        <Input value={styleRef} onChange={e => setStyleRef(e.target.value)} placeholder="https://... immagine da usare come riferimento stilistico" />
                        <p className="text-xs text-muted-foreground mt-1">Applica lo stile visivo dell'immagine di riferimento</p>
                      </div>
                      <div>
                        <Label>Modifica Immagine (URL immagine da editare)</Label>
                        <Input value={modifyImageRef} onChange={e => setModifyImageRef(e.target.value)} placeholder="https://... immagine esistente da modificare" />
                        <p className="text-xs text-muted-foreground mt-1">Edita un'immagine esistente con il prompt</p>
                      </div>
                    </div>
                    <Button onClick={handleImageGenerate} disabled={isGenerating} className="w-full">
                      {isGenerating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generazione Photon...</> : <><Sparkles className="w-4 h-4 mr-2" /> Genera con Photon</>}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Result Preview */}
            {(result || error) && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Risultato</CardTitle>
                </CardHeader>
                <CardContent>
                  {error && <p className="text-destructive">{error}</p>}
                  {result?.videoUrl && (
                    <div className="space-y-3">
                      <video src={result.videoUrl} controls autoPlay loop className="w-full rounded-lg max-h-[500px]" />
                      <Button asChild variant="outline" size="sm">
                        <a href={result.videoUrl} target="_blank" rel="noopener noreferrer"><Download className="w-4 h-4 mr-2" /> Scarica Video</a>
                      </Button>
                    </div>
                  )}
                  {result?.imageUrl && (
                    <div className="space-y-3">
                      <img src={result.imageUrl} alt="Generated" className="w-full rounded-lg max-h-[500px] object-contain" />
                      <Button asChild variant="outline" size="sm">
                        <a href={result.imageUrl} target="_blank" rel="noopener noreferrer"><Download className="w-4 h-4 mr-2" /> Scarica Immagine</a>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </PremiumGate>
    </AuthGuard>
  );
};

export default LumaToolsPage;
