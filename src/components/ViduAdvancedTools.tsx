import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Upload, X, Play, ArrowRightLeft, Mic, ZoomIn, Image as ImageIcon,
  Loader2, CheckCircle2, AlertCircle, Images
} from "lucide-react";

// ==================== Shared Helpers ====================

const useViduPolling = () => {
  const [status, setStatus] = useState<'idle' | 'processing' | 'succeeded' | 'failed'>('idle');
  const [result, setResult] = useState<{ videoUrl?: string; coverUrl?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const poll = async (taskId: string) => {
    setStatus('processing');
    setError(null);
    setResult(null);

    const maxAttempts = 120;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 5000));
      try {
        const { data, error: invokeErr } = await supabase.functions.invoke('vidu-video', {
          body: { action: 'poll', task_id: taskId }
        });
        if (invokeErr) throw invokeErr;

        if (data.status === 'succeeded') {
          setStatus('succeeded');
          setResult({ videoUrl: data.output, coverUrl: data.coverUrl });
          toast.success("Video Vidu completato!");
          return data;
        } else if (data.status === 'failed') {
          setStatus('failed');
          setError(data.error || 'Generazione fallita');
          toast.error("Generazione fallita", { description: data.error });
          return null;
        }
      } catch (err: any) {
        console.error("Poll error:", err);
      }
    }
    setStatus('failed');
    setError('Timeout: generazione troppo lunga');
    toast.error("Timeout raggiunto");
    return null;
  };

  return { status, result, error, poll, setStatus };
};

const ImageUploadBox = ({ 
  label, preview, onUpload, onRemove, accept = "image/*" 
}: { 
  label: string; preview: string; onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void; 
  onRemove: () => void; accept?: string;
}) => (
  <div className="space-y-2">
    <Label>{label}</Label>
    {preview ? (
      <div className="relative rounded-lg overflow-hidden border border-border">
        <img src={preview} alt={label} className="w-full h-40 object-cover" />
        <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={onRemove}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    ) : (
      <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors bg-muted/30">
        <Upload className="h-8 w-8 text-muted-foreground mb-2" />
        <span className="text-sm text-muted-foreground">Carica immagine</span>
        <input type="file" accept={accept} className="hidden" onChange={onUpload} />
      </label>
    )}
  </div>
);

const StatusIndicator = ({ status, error, result }: { 
  status: string; error: string | null; result: { videoUrl?: string; coverUrl?: string } | null 
}) => {
  if (status === 'idle') return null;
  return (
    <div className="space-y-3">
      {status === 'processing' && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          <div className="flex-1">
            <p className="text-sm font-medium">Elaborazione in corso...</p>
            <p className="text-xs text-muted-foreground">Polling ogni 5 secondi</p>
          </div>
        </div>
      )}
      {status === 'succeeded' && result?.videoUrl && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-green-500">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm font-medium">Completato!</span>
          </div>
          <video src={result.videoUrl} controls className="w-full rounded-lg border border-border" />
          <Button variant="outline" size="sm" asChild>
            <a href={result.videoUrl} target="_blank" rel="noopener noreferrer">Scarica Video</a>
          </Button>
        </div>
      )}
      {status === 'failed' && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <span className="text-sm text-destructive">{error || 'Errore sconosciuto'}</span>
        </div>
      )}
    </div>
  );
};

const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

// ==================== Reference to Video ====================

const Ref2VideoTab = () => {
  const [prompt, setPrompt] = useState("");
  const [refImages, setRefImages] = useState<{ file: File; preview: string }[]>([]);
  const [model, setModel] = useState("viduq3-pro");
  const [duration, setDuration] = useState("5");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [resolution, setResolution] = useState("720p");
  const [isLoading, setIsLoading] = useState(false);
  const polling = useViduPolling();

  const handleAddImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const available = 5 - refImages.length;
    if (available <= 0) { toast.error("Max 5 immagini"); return; }
    const newImgs: typeof refImages = [];
    for (const f of Array.from(files).slice(0, available)) {
      if (!f.type.startsWith('image/')) continue;
      const preview = await fileToBase64(f);
      newImgs.push({ file: f, preview });
    }
    setRefImages(prev => [...prev, ...newImgs]);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) { toast.error("Inserisci un prompt"); return; }
    if (refImages.length === 0) { toast.error("Carica almeno un'immagine di riferimento"); return; }
    setIsLoading(true);
    try {
      // Upload images to storage and get URLs
      const imageUrls: string[] = [];
      for (const img of refImages) {
        const blob = await (await fetch(img.preview)).blob();
        const path = `vidu-ref/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
        const { data: uploadData, error: uploadErr } = await supabase.storage.from('edited-frames').upload(path, blob);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from('edited-frames').getPublicUrl(path);
        imageUrls.push(urlData.publicUrl);
      }

      const { data, error } = await supabase.functions.invoke('vidu-video', {
        body: { action: 'ref2video', prompt, reference_images: imageUrls, model, duration: parseInt(duration), aspect_ratio: aspectRatio, resolution }
      });
      if (error) throw error;
      if (data.task_id) {
        toast.success("Generazione avviata!");
        await polling.poll(data.task_id);
      }
    } catch (err: any) {
      toast.error("Errore: " + (err.message || err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Prompt</Label>
        <Textarea placeholder="Descrivi il video che vuoi generare con le immagini di riferimento..." value={prompt} onChange={e => setPrompt(e.target.value)} className="min-h-[100px]" />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Immagini di Riferimento ({refImages.length}/5)</Label>
          {refImages.length < 5 && (
            <label className="cursor-pointer">
              <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-accent">
                <Upload className="h-3 w-3" /> Aggiungi
              </Badge>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleAddImages} />
            </label>
          )}
        </div>
        {refImages.length > 0 ? (
          <div className="grid grid-cols-5 gap-2">
            {refImages.map((img, i) => (
              <div key={i} className="relative rounded-lg overflow-hidden border border-border">
                <img src={img.preview} alt={`Ref ${i + 1}`} className="w-full h-24 object-cover" />
                <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-5 w-5" onClick={() => setRefImages(prev => prev.filter((_, j) => j !== i))}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 bg-muted/30">
            <Images className="h-8 w-8 text-muted-foreground mb-2" />
            <span className="text-sm text-muted-foreground">Carica immagini di riferimento</span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={handleAddImages} />
          </label>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label>Modello</Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="viduq3-pro">Q3 Pro</SelectItem>
              <SelectItem value="viduq3-turbo">Q3 Turbo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Durata</Label>
          <Select value={duration} onValueChange={setDuration}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5s</SelectItem>
              <SelectItem value="8">8s</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
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
        <div className="space-y-2">
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

      <Button onClick={handleGenerate} disabled={isLoading || polling.status === 'processing'} className="w-full">
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
        Genera Reference to Video
      </Button>

      <StatusIndicator status={polling.status} error={polling.error} result={polling.result} />
    </div>
  );
};

// ==================== Start-End to Video ====================

const StartEnd2VideoTab = () => {
  const [prompt, setPrompt] = useState("");
  const [startPreview, setStartPreview] = useState("");
  const [endPreview, setEndPreview] = useState("");
  const [startFile, setStartFile] = useState<File | null>(null);
  const [endFile, setEndFile] = useState<File | null>(null);
  const [model, setModel] = useState("viduq3-pro");
  const [duration, setDuration] = useState("5");
  const [resolution, setResolution] = useState("720p");
  const [isLoading, setIsLoading] = useState(false);
  const polling = useViduPolling();

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>, type: 'start' | 'end') => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const preview = await fileToBase64(file);
    if (type === 'start') { setStartFile(file); setStartPreview(preview); }
    else { setEndFile(file); setEndPreview(preview); }
  };

  const handleGenerate = async () => {
    if (!startFile || !endFile) { toast.error("Carica sia lo start che l'end frame"); return; }
    setIsLoading(true);
    try {
      // Upload images
      const uploadImg = async (preview: string, label: string) => {
        const blob = await (await fetch(preview)).blob();
        const path = `vidu-startend/${label}-${Date.now()}.jpg`;
        const { error: uploadErr } = await supabase.storage.from('edited-frames').upload(path, blob);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from('edited-frames').getPublicUrl(path);
        return urlData.publicUrl;
      };

      const startUrl = await uploadImg(startPreview, 'start');
      const endUrl = await uploadImg(endPreview, 'end');

      const { data, error } = await supabase.functions.invoke('vidu-video', {
        body: { action: 'startend2video', prompt: prompt || undefined, start_image_url: startUrl, end_image_url: endUrl, model, duration: parseInt(duration), resolution }
      });
      if (error) throw error;
      if (data.task_id) {
        toast.success("Generazione avviata!");
        await polling.poll(data.task_id);
      }
    } catch (err: any) {
      toast.error("Errore: " + (err.message || err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Prompt (opzionale)</Label>
        <Textarea placeholder="Descrivi la transizione tra i due frame..." value={prompt} onChange={e => setPrompt(e.target.value)} className="min-h-[80px]" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ImageUploadBox label="Start Frame" preview={startPreview} onUpload={e => handleImage(e, 'start')} onRemove={() => { setStartFile(null); setStartPreview(""); }} />
        <ImageUploadBox label="End Frame" preview={endPreview} onUpload={e => handleImage(e, 'end')} onRemove={() => { setEndFile(null); setEndPreview(""); }} />
      </div>

      {startPreview && endPreview && (
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <span className="text-xs">Start</span>
          <ArrowRightLeft className="h-4 w-4" />
          <span className="text-xs">End</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Modello</Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="viduq3-pro">Q3 Pro</SelectItem>
              <SelectItem value="viduq3-turbo">Q3 Turbo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Durata</Label>
          <Select value={duration} onValueChange={setDuration}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5s</SelectItem>
              <SelectItem value="8">8s</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
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

      <Button onClick={handleGenerate} disabled={isLoading || polling.status === 'processing'} className="w-full">
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRightLeft className="h-4 w-4 mr-2" />}
        Genera Start-End Video
      </Button>

      <StatusIndicator status={polling.status} error={polling.error} result={polling.result} />
    </div>
  );
};

// ==================== Lip Sync ====================

const LipSyncTab = () => {
  const [creationId, setCreationId] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [model, setModel] = useState("viduq3-pro");
  const [isLoading, setIsLoading] = useState(false);
  const polling = useViduPolling();

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioFile(file);
    // Upload to storage
    try {
      const path = `vidu-audio/${Date.now()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage.from('audio-uploads').upload(path, file);
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from('audio-uploads').getPublicUrl(path);
      setAudioUrl(urlData.publicUrl);
      toast.success("Audio caricato");
    } catch (err: any) {
      toast.error("Errore upload audio: " + err.message);
    }
  };

  const handleGenerate = async () => {
    if (!creationId.trim()) { toast.error("Inserisci il Creation ID"); return; }
    if (!audioUrl.trim()) { toast.error("Carica o inserisci l'URL audio"); return; }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('vidu-video', {
        body: { action: 'lipsync', creation_id: creationId, audio_url: audioUrl, model }
      });
      if (error) throw error;
      if (data.task_id) {
        toast.success("Lip Sync avviato!");
        await polling.poll(data.task_id);
      }
    } catch (err: any) {
      toast.error("Errore: " + (err.message || err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <p className="text-sm text-amber-200">
          <strong>Nota:</strong> Il Lip Sync richiede un <code>creation_id</code> di un video Vidu già generato.
          Puoi trovarlo nei risultati delle generazioni precedenti.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Creation ID (video Vidu esistente)</Label>
        <Input placeholder="Es: abc123..." value={creationId} onChange={e => setCreationId(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>Audio</Label>
        <div className="flex gap-2">
          <Input placeholder="URL audio o carica file..." value={audioUrl} onChange={e => setAudioUrl(e.target.value)} className="flex-1" />
          <label className="cursor-pointer">
            <Button variant="outline" size="icon" asChild>
              <span><Upload className="h-4 w-4" /></span>
            </Button>
            <input type="file" accept="audio/*" className="hidden" onChange={handleAudioUpload} />
          </label>
        </div>
        {audioFile && <p className="text-xs text-muted-foreground">File: {audioFile.name}</p>}
      </div>

      <div className="space-y-2">
        <Label>Modello</Label>
        <Select value={model} onValueChange={setModel}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="viduq3-pro">Q3 Pro</SelectItem>
            <SelectItem value="viduq3-turbo">Q3 Turbo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button onClick={handleGenerate} disabled={isLoading || polling.status === 'processing'} className="w-full">
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mic className="h-4 w-4 mr-2" />}
        Avvia Lip Sync
      </Button>

      <StatusIndicator status={polling.status} error={polling.error} result={polling.result} />
    </div>
  );
};

// ==================== Upscale ====================

const UpscaleTab = () => {
  const [creationId, setCreationId] = useState("");
  const [model, setModel] = useState("viduq3-pro");
  const [isLoading, setIsLoading] = useState(false);
  const polling = useViduPolling();

  const handleUpscale = async () => {
    if (!creationId.trim()) { toast.error("Inserisci il Creation ID"); return; }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('vidu-video', {
        body: { action: 'upscale', creation_id: creationId, model }
      });
      if (error) throw error;
      if (data.task_id) {
        toast.success("Upscale avviato!");
        await polling.poll(data.task_id);
      }
    } catch (err: any) {
      toast.error("Errore: " + (err.message || err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <p className="text-sm text-amber-200">
          <strong>Nota:</strong> L'upscale richiede un <code>creation_id</code> di un video Vidu già generato.
          Il video verrà migliorato in risoluzione superiore.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Creation ID (video Vidu esistente)</Label>
        <Input placeholder="Es: abc123..." value={creationId} onChange={e => setCreationId(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>Modello</Label>
        <Select value={model} onValueChange={setModel}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="viduq3-pro">Q3 Pro</SelectItem>
            <SelectItem value="viduq3-turbo">Q3 Turbo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button onClick={handleUpscale} disabled={isLoading || polling.status === 'processing'} className="w-full">
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ZoomIn className="h-4 w-4 mr-2" />}
        Avvia Upscale
      </Button>

      <StatusIndicator status={polling.status} error={polling.error} result={polling.result} />
    </div>
  );
};

// ==================== Main Component ====================

export const ViduAdvancedTools = () => {
  return (
    <Tabs defaultValue="ref2video" className="w-full">
      <TabsList className="grid w-full grid-cols-4 mb-6 bg-card/50 border border-border p-1">
        <TabsTrigger value="ref2video" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
          <Images className="w-4 h-4" />
          <span className="hidden md:inline">Reference</span>
        </TabsTrigger>
        <TabsTrigger value="startend" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
          <ArrowRightLeft className="w-4 h-4" />
          <span className="hidden md:inline">Start-End</span>
        </TabsTrigger>
        <TabsTrigger value="lipsync" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
          <Mic className="w-4 h-4" />
          <span className="hidden md:inline">Lip Sync</span>
        </TabsTrigger>
        <TabsTrigger value="upscale" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
          <ZoomIn className="w-4 h-4" />
          <span className="hidden md:inline">Upscale</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="ref2video">
        <Card className="border-primary/20 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Images className="w-5 h-5 text-primary" />
              Reference to Video
            </CardTitle>
            <CardDescription>
              Genera un video mantenendo la consistenza visiva delle immagini di riferimento fornite
            </CardDescription>
          </CardHeader>
          <CardContent><Ref2VideoTab /></CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="startend">
        <Card className="border-accent/20 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-accent" />
              Start-End to Video
            </CardTitle>
            <CardDescription>
              Crea un video di transizione fluida tra un frame iniziale e uno finale
            </CardDescription>
          </CardHeader>
          <CardContent><StartEnd2VideoTab /></CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="lipsync">
        <Card className="border-secondary/20 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="w-5 h-5 text-secondary" />
              Lip Sync
            </CardTitle>
            <CardDescription>
              Sincronizza le labbra di un video Vidu esistente con un file audio
            </CardDescription>
          </CardHeader>
          <CardContent><LipSyncTab /></CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="upscale">
        <Card className="border-green-500/20 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ZoomIn className="w-5 h-5 text-green-500" />
              Upscale Video
            </CardTitle>
            <CardDescription>
              Migliora la risoluzione di un video Vidu esistente
            </CardDescription>
          </CardHeader>
          <CardContent><UpscaleTab /></CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};
