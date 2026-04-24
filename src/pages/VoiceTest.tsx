import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, Loader2, Play, RotateCcw, Volume2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AuthGuard } from "@/components/AuthGuard";
import { Navbar } from "@/components/Navbar";

import { supabase } from "@/integrations/supabase/client";
import {
  useVoiceOptions,
  INWORLD_VOICE_OPTIONS,
  type VoiceOption,
} from "@/hooks/useVoiceOptions";
import { resolveTtsEndpoint } from "@/lib/ttsRouting";
import {
  loadPreferredVoiceId,
  savePreferredVoiceId,
} from "@/lib/storyModeVoicePref";

type ProviderChoice = "auto" | "elevenlabs" | "inworld";

interface TestRoute {
  endpoint: "elevenlabs-tts" | "inworld-tts";
  reason: string;
  forced: boolean;
}

function decideRoute(
  voice: VoiceOption | undefined,
  provider: ProviderChoice,
): TestRoute {
  if (!voice) {
    return { endpoint: "elevenlabs-tts", reason: "Nessuna voce selezionata", forced: false };
  }

  // Inworld native voice → always Inworld
  const isInworldNative = INWORLD_VOICE_OPTIONS.some(v => v.id === voice.id);
  if (isInworldNative) {
    return {
      endpoint: "inworld-tts",
      reason: "Voce nativa Inworld",
      forced: false,
    };
  }

  const { endpoint, forcedElevenLabs, isClonedVoice } = resolveTtsEndpoint({
    preference: provider === "auto" ? "elevenlabs" : provider,
    voiceId: voice.id,
  });

  if (isClonedVoice) {
    return {
      endpoint: "elevenlabs-tts",
      reason: forcedElevenLabs
        ? "Voce clonata ElevenLabs (forzata su ElevenLabs anche se hai scelto Inworld — i timbri clonati non sono trasferibili)"
        : "Voce clonata ElevenLabs",
      forced: forcedElevenLabs,
    };
  }

  return {
    endpoint,
    reason:
      endpoint === "inworld-tts"
        ? "Voce ElevenLabs default → mappata a Inworld lato server"
        : "Voce ElevenLabs default → ElevenLabs",
    forced: false,
  };
}

function VoiceTestContent() {
  const { voiceOptions, isLoading } = useVoiceOptions();
  const allVoices: VoiceOption[] = useMemo(
    () => [...voiceOptions, ...INWORLD_VOICE_OPTIONS],
    [voiceOptions],
  );

  const [voiceId, setVoiceId] = useState<string>("");
  const [provider, setProvider] = useState<ProviderChoice>("auto");
  const [text, setText] = useState<string>(
    "Ciao, questa è la mia voce clonata Marina Official. Sto verificando la qualità dell'audio generato.",
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [lastEndpoint, setLastEndpoint] = useState<TestRoute["endpoint"] | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load persisted preference once voices are available
  useEffect(() => {
    if (isLoading || voiceId) return;
    const saved = loadPreferredVoiceId();
    if (saved && allVoices.some(v => v.id === saved)) {
      setVoiceId(saved);
      return;
    }
    // Fallback: try to find Marina, then first cloned, then first default
    const marina = allVoices.find(v => /marina/i.test(v.name));
    if (marina) {
      setVoiceId(marina.id);
      return;
    }
    const firstCloned = voiceOptions.find(v => v.isCloned);
    setVoiceId(firstCloned?.id ?? voiceOptions[0]?.id ?? "");
  }, [isLoading, voiceId, allVoices, voiceOptions]);

  // Persist on every change
  useEffect(() => {
    if (voiceId) savePreferredVoiceId(voiceId);
  }, [voiceId]);

  // Cleanup blob URLs
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const selectedVoice = allVoices.find(v => v.id === voiceId);
  const route = decideRoute(selectedVoice, provider);

  const handleGenerate = async () => {
    if (!selectedVoice) {
      toast.error("Seleziona una voce");
      return;
    }
    if (!text.trim()) {
      toast.error("Inserisci del testo da sintetizzare");
      return;
    }

    setIsGenerating(true);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessione non valida");

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${route.endpoint}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          text,
          voiceId: selectedVoice.id,
          languageCode: "it",
          language_code: "it",
        }),
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => "");
        throw new Error(`HTTP ${response.status} – ${errBody.slice(0, 180)}`);
      }

      const json = await response.json();

      // Both endpoints can return a structured fallback signal instead of audio
      if (json.fallback) {
        throw new Error(json.error || `Provider non disponibile (${json.reason})`);
      }
      if (!json.audioContent) {
        throw new Error("Risposta senza audio");
      }

      // Decode base64 → blob (chunked to avoid stack overflow on large payloads)
      const binary = atob(json.audioContent);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
      const mime = json.format === "wav" ? "audio/wav" : "audio/mpeg";
      const blob = new Blob([bytes], { type: mime });
      const objectUrl = URL.createObjectURL(blob);
      setAudioUrl(objectUrl);
      setLastEndpoint(route.endpoint);

      // Auto-play
      setTimeout(() => {
        audioRef.current?.play().catch(() => undefined);
      }, 100);

      toast.success(`Audio generato via ${route.endpoint === "inworld-tts" ? "Inworld" : "ElevenLabs"}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[voice-test] error:", err);
      toast.error("Generazione fallita: " + message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReplay = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => undefined);
  };

  const handleDownload = () => {
    if (!audioUrl || !selectedVoice) return;
    const a = document.createElement("a");
    a.href = audioUrl;
    const ext = lastEndpoint === "inworld-tts" ? "wav" : "mp3";
    a.download = `tts-${selectedVoice.name.replace(/\s+/g, "_")}-${Date.now()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const clonedVoices = voiceOptions.filter(v => v.isCloned);
  const defaultElevenVoices = voiceOptions.filter(v => !v.isCloned);

  return (
    <div className="container mx-auto max-w-3xl py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/story-mode">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Torna a Story Mode
          </Button>
        </Link>
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Volume2 className="h-7 w-7 text-primary" />
          Voice Test
        </h1>
        <p className="text-muted-foreground">
          Verifica che una voce (es. Marina Official) venga instradata correttamente al provider TTS giusto e ascolta il risultato.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configurazione</CardTitle>
          <CardDescription>
            La preferenza voce viene salvata automaticamente in questo browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="voice">Voce</Label>
            <Select value={voiceId} onValueChange={setVoiceId} disabled={isLoading}>
              <SelectTrigger id="voice">
                <SelectValue placeholder={isLoading ? "Caricamento voci..." : "Seleziona una voce"} />
              </SelectTrigger>
              <SelectContent>
                {clonedVoices.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-[10px] font-semibold text-accent uppercase tracking-wider">
                      🎤 Voci clonate
                    </div>
                    {clonedVoices.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </>
                )}
                {defaultElevenVoices.length > 0 && (
                  <>
                    <div className="px-2 py-1 mt-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-t border-border pt-2">
                      ElevenLabs default
                    </div>
                    {defaultElevenVoices.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </>
                )}
                <div className="px-2 py-1 mt-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-t border-border pt-2">
                  Inworld
                </div>
                {INWORLD_VOICE_OPTIONS.map(v => (
                  <SelectItem key={`inw-${v.id}`} value={v.id}>{v.name} (Inworld)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider">Provider preferito (Story Mode)</Label>
            <Select value={provider} onValueChange={(v) => setProvider(v as ProviderChoice)}>
              <SelectTrigger id="provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (default ElevenLabs)</SelectItem>
                <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                <SelectItem value="inworld">Inworld</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedVoice && (
            <Alert>
              <AlertTitle className="flex items-center gap-2">
                Routing previsto:
                <Badge variant={route.endpoint === "elevenlabs-tts" ? "default" : "secondary"}>
                  {route.endpoint === "elevenlabs-tts" ? "ElevenLabs" : "Inworld"}
                </Badge>
                {route.forced && (
                  <Badge variant="outline" className="border-accent text-accent">
                    forzato
                  </Badge>
                )}
              </AlertTitle>
              <AlertDescription className="mt-1 text-xs">
                {route.reason}. Endpoint: <code className="font-mono">{route.endpoint}</code>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="text">Testo da sintetizzare</Label>
            <Textarea
              id="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              maxLength={5000}
            />
            <p className="text-xs text-muted-foreground">{text.length} / 5000 caratteri</p>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !voiceId || !text.trim()}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generazione in corso...</>
            ) : (
              <><Play className="mr-2 h-4 w-4" /> Generate TTS</>
            )}
          </Button>
        </CardContent>
      </Card>

      {audioUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Risultato
              {lastEndpoint && (
                <Badge variant="outline">
                  via {lastEndpoint === "inworld-tts" ? "Inworld" : "ElevenLabs"}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>Riproduci, riascolta o scarica il file generato.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <audio ref={audioRef} src={audioUrl} controls className="w-full" />
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleReplay} variant="secondary">
                <RotateCcw className="mr-2 h-4 w-4" /> Riascolta
              </Button>
              <Button onClick={handleDownload} variant="outline">
                <Download className="mr-2 h-4 w-4" /> Scarica
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function VoiceTestPage() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />
        <VoiceTestContent />
      </div>
    </AuthGuard>
  );
}
