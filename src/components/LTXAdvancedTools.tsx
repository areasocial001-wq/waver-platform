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
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Upload, X, Play, Music, Scissors, ArrowRight, Loader2, CheckCircle2, AlertCircle, Video
} from "lucide-react";

// ==================== Shared Helpers ====================

const StatusIndicator = ({ status, error, videoUrl }: {
  status: string; error: string | null; videoUrl: string | null;
}) => {
  if (status === 'idle') return null;
  return (
    <div className="space-y-3">
      {status === 'processing' && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          <div className="flex-1">
            <p className="text-sm font-medium">Generazione in corso...</p>
            <p className="text-xs text-muted-foreground">LTX restituisce il video direttamente, attendere...</p>
          </div>
        </div>
      )}
      {status === 'succeeded' && videoUrl && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-green-500">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm font-medium">Completato!</span>
          </div>
          <video src={videoUrl} controls className="w-full rounded-lg border border-border" />
          <Button variant="outline" size="sm" asChild>
            <a href={videoUrl} target="_blank" rel="noopener noreferrer">Scarica Video</a>
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

// ==================== Audio to Video ====================

const Audio2VideoTab = () => {
  const [audioUrl, setAudioUrl] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("ltx-2-3-pro");
  const [resolution, setResolution] = useState("1920x1080");
  const [guidanceScale, setGuidanceScale] = useState([3.0]);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'processing' | 'succeeded' | 'failed'>('idle');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioFile(file);
    try {
      const path = `ltx-audio/${Date.now()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage.from('audio-uploads').upload(path, file);
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from('audio-uploads').getPublicUrl(path);
      setAudioUrl(urlData.publicUrl);
      toast.success("Audio caricato!");
    } catch (err: any) {
      toast.error("Errore upload audio: " + err.message);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
    try {
      const path = `ltx-images/${Date.now()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage.from('edited-frames').upload(path, file);
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from('edited-frames').getPublicUrl(path);
      setImageUrl(urlData.publicUrl);
    } catch (err: any) {
      toast.error("Errore upload immagine: " + err.message);
    }
  };

  const handleGenerate = async () => {
    if (!audioUrl) { toast.error("Carica un file audio"); return; }
    setIsLoading(true);
    setStatus('processing');
    setError(null);
    setVideoUrl(null);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('ltx-video', {
        body: {
          action: 'audio2video',
          audio_uri: audioUrl,
          image_uri: imageUrl || undefined,
          prompt: prompt || undefined,
          resolution,
          guidance_scale: guidanceScale[0],
          model,
        }
      });
      if (invokeErr) throw invokeErr;
      if (data?.error) throw new Error(data.error);
      setStatus('succeeded');
      setVideoUrl(data.output);
      toast.success("Video generato con successo!");
    } catch (err: any) {
      setStatus('failed');
      setError(err.message || 'Errore sconosciuto');
      toast.error("Errore: " + (err.message || err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>File Audio *</Label>
        {audioFile ? (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
            <Music className="h-5 w-5 text-primary" />
            <span className="text-sm flex-1 truncate">{audioFile.name}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setAudioFile(null); setAudioUrl(""); }}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 bg-muted/30">
            <Upload className="h-6 w-6 text-muted-foreground mb-1" />
            <span className="text-sm text-muted-foreground">Carica audio (MP3, WAV, etc.)</span>
            <input type="file" accept="audio/*" className="hidden" onChange={handleAudioUpload} />
          </label>
        )}
      </div>

      <div className="space-y-2">
        <Label>Immagine Iniziale (opzionale)</Label>
        {imagePreview ? (
          <div className="relative rounded-lg overflow-hidden border border-border">
            <img src={imagePreview} alt="Preview" className="w-full h-40 object-cover" />
            <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={() => { setImageFile(null); setImagePreview(""); setImageUrl(""); }}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 bg-muted/30">
            <Upload className="h-6 w-6 text-muted-foreground mb-1" />
            <span className="text-sm text-muted-foreground">Immagine opzionale per guidare il video</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </label>
        )}
      </div>

      <div className="space-y-2">
        <Label>Prompt (opzionale)</Label>
        <Textarea placeholder="Descrivi il video da generare dall'audio..." value={prompt} onChange={e => setPrompt(e.target.value)} className="min-h-[80px]" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Modello</Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ltx-2-3-pro">LTX 2.3 Pro</SelectItem>
              <SelectItem value="ltx-2-3-fast">LTX 2.3 Fast</SelectItem>
              <SelectItem value="ltx-2-pro">LTX 2 Pro</SelectItem>
              <SelectItem value="ltx-2-fast">LTX 2 Fast</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Risoluzione</Label>
          <Select value={resolution} onValueChange={setResolution}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1920x1080">1080p (16:9)</SelectItem>
              <SelectItem value="1280x720">720p (16:9)</SelectItem>
              <SelectItem value="1080x1920">1080p (9:16)</SelectItem>
              <SelectItem value="1080x1080">1080p (1:1)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Guidance Scale: {guidanceScale[0].toFixed(1)}</Label>
          <Slider value={guidanceScale} onValueChange={setGuidanceScale} min={1} max={10} step={0.5} className="mt-3" />
        </div>
      </div>

      <Button onClick={handleGenerate} disabled={isLoading} className="w-full">
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Music className="h-4 w-4 mr-2" />}
        Genera Audio to Video
      </Button>

      <StatusIndicator status={status} error={error} videoUrl={videoUrl} />
    </div>
  );
};

// ==================== Retake ====================

const RetakeTab = () => {
  const [videoUri, setVideoUri] = useState("");
  const [startTime, setStartTime] = useState("0");
  const [duration, setDuration] = useState("3");
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState("replace_audio_and_video");
  const [model, setModel] = useState("ltx-2-3-pro");
  const [resolution, setResolution] = useState("1920x1080");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'processing' | 'succeeded' | 'failed'>('idle');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!videoUri.trim()) { toast.error("Inserisci l'URL del video"); return; }
    if (!duration) { toast.error("Inserisci la durata della sezione"); return; }
    setIsLoading(true);
    setStatus('processing');
    setError(null);
    setVideoUrl(null);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('ltx-video', {
        body: {
          action: 'retake',
          video_uri: videoUri,
          start_time: parseFloat(startTime),
          duration: parseFloat(duration),
          prompt: prompt || undefined,
          mode,
          resolution,
          model,
        }
      });
      if (invokeErr) throw invokeErr;
      if (data?.error) throw new Error(data.error);
      setStatus('succeeded');
      setVideoUrl(data.output);
      toast.success("Retake completato!");
    } catch (err: any) {
      setStatus('failed');
      setError(err.message || 'Errore sconosciuto');
      toast.error("Errore: " + (err.message || err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
        <p className="text-sm text-muted-foreground">
          <strong>Retake</strong> ti permette di ri-generare una porzione specifica di un video esistente, mantenendo il resto invariato.
        </p>
      </div>

      <div className="space-y-2">
        <Label>URL Video Sorgente *</Label>
        <Input placeholder="https://... URL del video da modificare" value={videoUri} onChange={e => setVideoUri(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>Prompt (opzionale)</Label>
        <Textarea placeholder="Descrivi cosa vuoi nella sezione ri-generata..." value={prompt} onChange={e => setPrompt(e.target.value)} className="min-h-[80px]" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label>Start Time (sec)</Label>
          <Input type="number" min={0} step={0.5} value={startTime} onChange={e => setStartTime(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Durata (sec)</Label>
          <Input type="number" min={1} max={8} step={0.5} value={duration} onChange={e => setDuration(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Modalità</Label>
          <Select value={mode} onValueChange={setMode}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="replace_audio_and_video">Audio + Video</SelectItem>
              <SelectItem value="replace_video_only">Solo Video</SelectItem>
              <SelectItem value="replace_audio_only">Solo Audio</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Modello</Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ltx-2-3-pro">LTX 2.3 Pro</SelectItem>
              <SelectItem value="ltx-2-3-fast">LTX 2.3 Fast</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button onClick={handleGenerate} disabled={isLoading} className="w-full">
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Scissors className="h-4 w-4 mr-2" />}
        Esegui Retake
      </Button>

      <StatusIndicator status={status} error={error} videoUrl={videoUrl} />
    </div>
  );
};

// ==================== Extend ====================

const ExtendTab = () => {
  const [videoUri, setVideoUri] = useState("");
  const [duration, setDuration] = useState("4");
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState("end");
  const [model, setModel] = useState("ltx-2-3-pro");
  const [useContext, setUseContext] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'processing' | 'succeeded' | 'failed'>('idle');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!videoUri.trim()) { toast.error("Inserisci l'URL del video"); return; }
    setIsLoading(true);
    setStatus('processing');
    setError(null);
    setVideoUrl(null);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('ltx-video', {
        body: {
          action: 'extend',
          video_uri: videoUri,
          duration: parseFloat(duration),
          prompt: prompt || undefined,
          mode,
          model,
          context: useContext,
        }
      });
      if (invokeErr) throw invokeErr;
      if (data?.error) throw new Error(data.error);
      setStatus('succeeded');
      setVideoUrl(data.output);
      toast.success("Estensione completata!");
    } catch (err: any) {
      setStatus('failed');
      setError(err.message || 'Errore sconosciuto');
      toast.error("Errore: " + (err.message || err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
        <p className="text-sm text-muted-foreground">
          <strong>Extend</strong> allunga un video esistente aggiungendo nuovi secondi all'inizio o alla fine.
        </p>
      </div>

      <div className="space-y-2">
        <Label>URL Video Sorgente *</Label>
        <Input placeholder="https://... URL del video da estendere" value={videoUri} onChange={e => setVideoUri(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>Prompt (opzionale)</Label>
        <Textarea placeholder="Descrivi cosa vuoi nel segmento esteso..." value={prompt} onChange={e => setPrompt(e.target.value)} className="min-h-[80px]" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label>Durata Extra (sec)</Label>
          <Input type="number" min={1} max={8} step={1} value={duration} onChange={e => setDuration(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Direzione</Label>
          <Select value={mode} onValueChange={setMode}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="end">Alla Fine</SelectItem>
              <SelectItem value="start">All'Inizio</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Modello</Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ltx-2-3-pro">LTX 2.3 Pro</SelectItem>
              <SelectItem value="ltx-2-3-fast">LTX 2.3 Fast</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Usa Contesto</Label>
          <div className="flex items-center gap-2 mt-2">
            <Switch checked={useContext} onCheckedChange={setUseContext} />
            <span className="text-sm text-muted-foreground">{useContext ? 'Sì' : 'No'}</span>
          </div>
        </div>
      </div>

      <Button onClick={handleGenerate} disabled={isLoading} className="w-full">
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRight className="h-4 w-4 mr-2" />}
        Estendi Video
      </Button>

      <StatusIndicator status={status} error={error} videoUrl={videoUrl} />
    </div>
  );
};

// ==================== Main Component ====================

export const LTXAdvancedTools = () => {
  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5 text-orange-500" />
          LTX Video - Strumenti Avanzati
        </CardTitle>
        <CardDescription>
          Audio-to-Video, Retake parziale e Extend per i video generati con LTX.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="audio2video" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="audio2video" className="gap-1">
              <Music className="h-3.5 w-3.5" />
              Audio → Video
            </TabsTrigger>
            <TabsTrigger value="retake" className="gap-1">
              <Scissors className="h-3.5 w-3.5" />
              Retake
            </TabsTrigger>
            <TabsTrigger value="extend" className="gap-1">
              <ArrowRight className="h-3.5 w-3.5" />
              Extend
            </TabsTrigger>
          </TabsList>

          <TabsContent value="audio2video">
            <Audio2VideoTab />
          </TabsContent>
          <TabsContent value="retake">
            <RetakeTab />
          </TabsContent>
          <TabsContent value="extend">
            <ExtendTab />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
