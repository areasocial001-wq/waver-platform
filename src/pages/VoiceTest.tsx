import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, Loader2, Play, RefreshCw, RotateCcw, Volume2 } from "lucide-react";
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
import type { ProviderType } from "@/lib/providerConfig";
import {
  useVoiceOptions,
  type VoiceOption,
} from "@/hooks/useVoiceOptions";
import {
  useInworldVoices,
  fetchInworldVoicePreview,
  type InworldVoice,
} from "@/hooks/useInworldVoices";
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

interface UnifiedVoice {
  id: string;
  name: string;
  provider: "elevenlabs" | "inworld";
  source: "default" | "cloned" | "system" | "ivc";
  langCode?: string;
}

function decideRoute(
  voice: UnifiedVoice | undefined,
  provider: ProviderChoice,
): TestRoute {
  if (!voice) {
    return { endpoint: "elevenlabs-tts", reason: "Nessuna voce selezionata", forced: false };
  }

  // Inworld voices (SYSTEM or IVC) → always Inworld
  if (voice.provider === "inworld") {
    return {
      endpoint: "inworld-tts",
      reason: voice.source === "ivc"
        ? "Voce clonata Inworld (IVC) → Inworld"
        : "Voce nativa Inworld → Inworld",
      forced: false,
    };
  }

  const { endpoint, forcedElevenLabs, isClonedVoice } = resolveTtsEndpoint({
    preference: (provider === "auto" || (provider as string) === "elevenlabs" ? "inworld" : provider) as ProviderType,
    voiceId: voice.id,
  });

  if (isClonedVoice) {
    return {
      endpoint: "inworld-tts",
      reason: "Voce clonata → Inworld IVC",
      forced: forcedElevenLabs,
    };
  }

  return {
    endpoint,
    reason:
      endpoint === "inworld-tts"
        ? "Voce default → mappata a Inworld lato server"
        : "Voce default → Inworld",
    forced: false,
  };
}

function VoiceTestContent() {
  const { voiceOptions, isLoading: isLoadingEleven } = useVoiceOptions();
  const {
    systemVoices: inworldSystem,
    ivcVoices: inworldIvc,
    isLoading: isLoadingInworld,
    error: inworldError,
    refresh: refreshInworld,
  } = useInworldVoices();

  // Build a unified catalog
  const allVoices: UnifiedVoice[] = useMemo(() => {
    const eleven: UnifiedVoice[] = voiceOptions.map(v => ({
      id: v.id,
      name: v.name,
      provider: "elevenlabs",
      source: v.isCloned ? "cloned" : "default",
    }));
    const inworld: UnifiedVoice[] = [
      ...inworldIvc.map(v => ({
        id: v.voiceId,
        name: v.displayName,
        provider: "inworld" as const,
        source: "ivc" as const,
        langCode: v.langCode,
      })),
      ...inworldSystem.map(v => ({
        id: v.voiceId,
        name: v.displayName,
        provider: "inworld" as const,
        source: "system" as const,
        langCode: v.langCode,
      })),
    ];
    return [...eleven, ...inworld];
  }, [voiceOptions, inworldSystem, inworldIvc]);

  const [voiceId, setVoiceId] = useState<string>("");
  const [provider, setProvider] = useState<ProviderChoice>("auto");
  const [text, setText] = useState<string>(
    "Ciao, questa è la mia voce clonata Marina Official. Sto verificando la qualità dell'audio generato.",
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [lastEndpoint, setLastEndpoint] = useState<TestRoute["endpoint"] | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const [previewLang, setPreviewLang] = useState<"auto" | "IT" | "EN" | "ES" | "FR" | "DE" | "PT">("auto");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewBlobRef = useRef<string | null>(null);

  // Load persisted preference once voices are available
  useEffect(() => {
    if (isLoadingEleven || isLoadingInworld || voiceId) return;
    if (allVoices.length === 0) return;
    const saved = loadPreferredVoiceId();
    if (saved && allVoices.some(v => v.id === saved)) {
      setVoiceId(saved);
      return;
    }
    // Fallback: try to find Marina (any provider), then first IVC, then first cloned, then first
    const marina = allVoices.find(v => /marina/i.test(v.name));
    if (marina) { setVoiceId(marina.id); return; }
    const firstIvc = allVoices.find(v => v.source === "ivc");
    if (firstIvc) { setVoiceId(firstIvc.id); return; }
    const firstCloned = allVoices.find(v => v.source === "cloned");
    setVoiceId(firstCloned?.id ?? allVoices[0]?.id ?? "");
  }, [isLoadingEleven, isLoadingInworld, voiceId, allVoices]);

  // Persist on every change
  useEffect(() => {
    if (voiceId) savePreferredVoiceId(voiceId);
  }, [voiceId]);

  // Cleanup blob URLs
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (previewBlobRef.current) URL.revokeObjectURL(previewBlobRef.current);
    };
  }, [audioUrl]);

  const selectedVoice = allVoices.find(v => v.id === voiceId);
  const route = decideRoute(selectedVoice, provider);

  const handlePreview = async (id: string) => {
    setPreviewLoadingId(id);
    try {
      // Stop any currently playing preview
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      if (previewBlobRef.current) {
        URL.revokeObjectURL(previewBlobRef.current);
        previewBlobRef.current = null;
      }
      const voice = allVoices.find(v => v.id === id);
      // Use the explicit selector when set; otherwise fall back to the voice's
      // own language so IVC voices (e.g. Marina Official → IT_IT) preview in
      // their cloned accent instead of the server-side English default.
      const lang = previewLang !== "auto"
        ? previewLang
        : voice?.langCode?.split("_")[0] ?? "IT";
      const url = await fetchInworldVoicePreview(id, { langCode: lang });
      previewBlobRef.current = url;
      const audio = new Audio(url);
      previewAudioRef.current = audio;
      await audio.play();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error("Anteprima fallita: " + message);
    } finally {
      setPreviewLoadingId(null);
    }
  };

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
      if (json.fallback) throw new Error(json.error || `Provider non disponibile (${json.reason})`);
      if (!json.audioContent) throw new Error("Risposta senza audio");

      const binary = atob(json.audioContent);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const mime = json.format === "wav" ? "audio/wav" : "audio/mpeg";
      const blob = new Blob([bytes], { type: mime });
      const objectUrl = URL.createObjectURL(blob);
      setAudioUrl(objectUrl);
      setLastEndpoint(route.endpoint);

      setTimeout(() => { audioRef.current?.play().catch(() => undefined); }, 100);

      toast.success(`Audio generato via Inworld`);
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

  const clonedEleven = voiceOptions.filter(v => v.isCloned);
  const defaultEleven = voiceOptions.filter(v => !v.isCloned);

  // Helper for rendering a select item with a preview button (Inworld only)
  const renderInworldItem = (v: InworldVoice) => (
    <div key={`inw-${v.voiceId}`} className="flex items-center gap-1 pr-1">
      <SelectItem value={v.voiceId} className="flex-1">
        {v.displayName}
        {v.langCode && (
          <span className="ml-2 text-[10px] text-muted-foreground">{v.langCode}</span>
        )}
      </SelectItem>
    </div>
  );

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
            <div className="flex items-center justify-between">
              <Label htmlFor="voice">Voce</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refreshInworld()}
                disabled={isLoadingInworld}
                title="Ricarica voci Inworld"
              >
                <RefreshCw className={`h-3 w-3 ${isLoadingInworld ? "animate-spin" : ""}`} />
              </Button>
            </div>
            <Select value={voiceId} onValueChange={setVoiceId} disabled={isLoadingEleven}>
              <SelectTrigger id="voice">
                <SelectValue placeholder={isLoadingEleven ? "Caricamento voci..." : "Seleziona una voce"} />
              </SelectTrigger>
              <SelectContent>
                {clonedEleven.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-[10px] font-semibold text-accent uppercase tracking-wider">
                      🎤 Voci clonate (legacy)
                    </div>
                    {clonedEleven.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </>
                )}
                {inworldIvc.length > 0 && (
                  <>
                    <div className="px-2 py-1 mt-1 text-[10px] font-semibold text-primary uppercase tracking-wider border-t border-border pt-2">
                      🎤 Voci clonate Inworld (IVC)
                    </div>
                    {inworldIvc.map(renderInworldItem)}
                  </>
                )}
                {defaultEleven.length > 0 && (
                  <>
                    <div className="px-2 py-1 mt-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-t border-border pt-2">
                      Voci default
                    </div>
                    {defaultEleven.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </>
                )}
                {inworldSystem.length > 0 && (
                  <>
                    <div className="px-2 py-1 mt-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-t border-border pt-2">
                      Inworld (system)
                    </div>
                    {inworldSystem.map(renderInworldItem)}
                  </>
                )}
                {isLoadingInworld && (
                  <div className="px-2 py-2 text-xs text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> Caricamento voci Inworld…
                  </div>
                )}
                {inworldError && !isLoadingInworld && (
                  <div className="px-2 py-2 text-xs text-destructive">
                    Inworld non raggiungibile: {inworldError.slice(0, 80)}
                  </div>
                )}
              </SelectContent>
            </Select>

            {/* Preview button (Inworld voices only) */}
            {selectedVoice?.provider === "inworld" && (
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePreview(selectedVoice.id)}
                  disabled={previewLoadingId === selectedVoice.id}
                >
                  {previewLoadingId === selectedVoice.id ? (
                    <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Carico anteprima…</>
                  ) : (
                    <><Play className="mr-2 h-3 w-3" /> Ascolta anteprima Inworld</>
                  )}
                </Button>
                <Select
                  value={previewLang}
                  onValueChange={(v) => setPreviewLang(v as typeof previewLang)}
                >
                  <SelectTrigger className="h-8 w-[170px] text-xs">
                    <SelectValue placeholder="Lingua anteprima" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (lingua voce)</SelectItem>
                    <SelectItem value="IT">🇮🇹 Italiano</SelectItem>
                    <SelectItem value="EN">🇬🇧 English</SelectItem>
                    <SelectItem value="ES">🇪🇸 Español</SelectItem>
                    <SelectItem value="FR">🇫🇷 Français</SelectItem>
                    <SelectItem value="DE">🇩🇪 Deutsch</SelectItem>
                    <SelectItem value="PT">🇵🇹 Português</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider">Provider preferito (Story Mode)</Label>
            <Select value={provider} onValueChange={(v) => setProvider(v as ProviderChoice)}>
              <SelectTrigger id="provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (Inworld)</SelectItem>
                <SelectItem value="inworld">Inworld</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedVoice && (
            <Alert>
              <AlertTitle className="flex items-center gap-2 flex-wrap">
                Routing previsto:
                <Badge variant="secondary">
                  Inworld
                </Badge>
                {selectedVoice.source === "ivc" && (
                  <Badge variant="outline" className="border-primary text-primary">IVC</Badge>
                )}
                {selectedVoice.source === "cloned" && (
                  <Badge variant="outline" className="border-accent text-accent">Cloned</Badge>
                )}
                {route.forced && (
                  <Badge variant="outline" className="border-accent text-accent">forzato</Badge>
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
                  via Inworld
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
