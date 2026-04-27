import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  Loader2,
  Play,
  Pause,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { AuthGuard } from "@/components/AuthGuard";
import { Navbar } from "@/components/Navbar";

import { supabase } from "@/integrations/supabase/client";
import {
  useInworldVoices,
  fetchInworldVoicePreview,
  type InworldVoice,
} from "@/hooks/useInworldVoices";
import { SUPPORTED_LANGUAGES } from "@/hooks/useVoiceOptions";
import { splitTextForTTS, concatAudioBuffers } from "@/lib/ttsTextSplitter";
import {
  loadPreferredVoiceId,
  savePreferredVoiceId,
} from "@/lib/storyModeVoicePref";
import { detectLanguage, type SupportedLangCode } from "@/lib/languageDetector";

interface HistoryItem {
  id: string;
  voiceId: string;
  voiceName: string;
  text: string;
  langCode: string;
  url: string;
  format: "mp3" | "wav";
  bytes: number;
  createdAt: number;
  chunks: number;
}

const HISTORY_LIMIT = 8;
const CHUNK_THRESHOLD = 500; // chars before auto-split kicks in
const CHUNK_SIZE = 1500;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function TextToSpeechContent() {
  const {
    systemVoices,
    ivcVoices,
    isLoading: isLoadingVoices,
    error: voicesError,
    refresh: refreshVoices,
  } = useInworldVoices();

  const allVoices = useMemo(() => [...ivcVoices, ...systemVoices], [ivcVoices, systemVoices]);

  const [voiceId, setVoiceId] = useState<string>("");
  const [text, setText] = useState<string>(
    "Ciao! Questa è una prova della funzione text-to-speech.",
  );
  const [langCode, setLangCode] = useState<string>("it");
  const [autoSplit, setAutoSplit] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState<{ current: number; total: number } | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewBlobRef = useRef<string | null>(null);
  const playerRef = useRef<HTMLAudioElement | null>(null);

  // Load persisted voice preference
  useEffect(() => {
    if (isLoadingVoices || voiceId || allVoices.length === 0) return;
    const saved = loadPreferredVoiceId();
    const matchSaved = saved ? allVoices.find(v => v.voiceId === saved) : undefined;
    if (matchSaved) {
      setVoiceId(matchSaved.voiceId);
      return;
    }
    const firstIvc = allVoices.find(v => v.source === "IVC");
    setVoiceId((firstIvc ?? allVoices[0])?.voiceId ?? "");
  }, [isLoadingVoices, voiceId, allVoices]);

  // Persist on change
  useEffect(() => {
    if (voiceId) savePreferredVoiceId(voiceId);
  }, [voiceId]);

  // Cleanup all blob URLs on unmount
  useEffect(() => {
    return () => {
      if (previewBlobRef.current) URL.revokeObjectURL(previewBlobRef.current);
      history.forEach(h => URL.revokeObjectURL(h.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredVoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allVoices;
    return allVoices.filter(v =>
      v.displayName.toLowerCase().includes(q)
      || v.voiceId.toLowerCase().includes(q)
      || (v.langCode ?? "").toLowerCase().includes(q)
    );
  }, [allVoices, search]);

  const selectedVoice = allVoices.find(v => v.voiceId === voiceId);
  const charCount = text.length;
  const willSplit = autoSplit && charCount > CHUNK_THRESHOLD;
  const previewChunks = willSplit ? splitTextForTTS(text, CHUNK_SIZE) : [text];

  const handlePreview = async (voice: InworldVoice) => {
    setPreviewLoadingId(voice.voiceId);
    try {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      if (previewBlobRef.current) {
        URL.revokeObjectURL(previewBlobRef.current);
        previewBlobRef.current = null;
      }
      const lang = (voice.langCode?.split("_")[0] ?? langCode.toUpperCase()).slice(0, 2);
      const url = await fetchInworldVoicePreview(voice.voiceId, { langCode: lang });
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

  const callTtsOnce = async (chunkText: string): Promise<{ buffer: ArrayBuffer; mime: string; format: "mp3" | "wav" }> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Sessione non valida");

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/inworld-tts`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        text: chunkText,
        voiceId,
        languageCode: langCode,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status} – ${errBody.slice(0, 180)}`);
    }
    const json = await response.json();
    if (json.fallback) throw new Error(json.error || `Provider non disponibile`);
    if (!json.audioContent) throw new Error("Risposta senza audio");

    const binary = atob(json.audioContent);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const format: "mp3" | "wav" = json.format === "wav" ? "wav" : "mp3";
    const mime = format === "wav" ? "audio/wav" : "audio/mpeg";
    return { buffer: bytes.buffer, mime, format };
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
    const chunks = autoSplit ? splitTextForTTS(text, CHUNK_SIZE) : [text];
    setGenProgress({ current: 0, total: chunks.length });

    try {
      const buffers: ArrayBuffer[] = [];
      let mime = "audio/mpeg";
      let format: "mp3" | "wav" = "mp3";

      for (let i = 0; i < chunks.length; i++) {
        setGenProgress({ current: i + 1, total: chunks.length });
        const result = await callTtsOnce(chunks[i]);
        buffers.push(result.buffer);
        mime = result.mime;
        format = result.format;
      }

      const blob = concatAudioBuffers(buffers, mime);
      const url = URL.createObjectURL(blob);

      const item: HistoryItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        voiceId,
        voiceName: selectedVoice.displayName,
        text: text.length > 120 ? text.slice(0, 120) + "…" : text,
        langCode,
        url,
        format,
        bytes: blob.size,
        createdAt: Date.now(),
        chunks: chunks.length,
      };

      setHistory(prev => {
        const next = [item, ...prev];
        // Drop oldest beyond limit and revoke their URLs
        if (next.length > HISTORY_LIMIT) {
          const removed = next.slice(HISTORY_LIMIT);
          removed.forEach(h => URL.revokeObjectURL(h.url));
        }
        return next.slice(0, HISTORY_LIMIT);
      });

      // Auto-play newest
      setTimeout(() => {
        if (playerRef.current) {
          playerRef.current.src = url;
          playerRef.current.play().catch(() => undefined);
        }
      }, 50);

      toast.success(
        chunks.length > 1
          ? `Audio generato (${chunks.length} chunk concatenati)`
          : "Audio generato",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[tts] error:", err);
      toast.error("Generazione fallita: " + message);
    } finally {
      setIsGenerating(false);
      setGenProgress(null);
    }
  };

  const handleDownload = (item: HistoryItem) => {
    const a = document.createElement("a");
    a.href = item.url;
    a.download = `tts-${item.voiceName.replace(/\s+/g, "_")}-${item.createdAt}.${item.format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleRemove = (item: HistoryItem) => {
    URL.revokeObjectURL(item.url);
    setHistory(prev => prev.filter(h => h.id !== item.id));
    if (playingId === item.id && playerRef.current) {
      playerRef.current.pause();
      setPlayingId(null);
    }
  };

  const handlePlayHistory = (item: HistoryItem) => {
    if (!playerRef.current) return;
    if (playingId === item.id) {
      playerRef.current.pause();
      setPlayingId(null);
    } else {
      playerRef.current.src = item.url;
      playerRef.current.play().then(() => setPlayingId(item.id)).catch(() => undefined);
    }
  };

  return (
    <div className="container mx-auto max-w-6xl py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Home
          </Button>
        </Link>
        <Link to="/story-mode/voice-test">
          <Button variant="ghost" size="sm">
            Voice Test (debug routing)
          </Button>
        </Link>
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Volume2 className="h-7 w-7 text-primary" />
          Text to Speech
        </h1>
        <p className="text-muted-foreground">
          Trasforma il testo in audio con voci Inworld native (system) e clonate (IVC).
          Multilingua, anteprima istantanea e split automatico per testi lunghi.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* LEFT: Composer */}
        <Card>
          <CardHeader>
            <CardTitle>Compositore</CardTitle>
            <CardDescription>
              Scrivi il testo, scegli lingua e voce, poi genera.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Voice + language summary */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Lingua di output</Label>
                <Select value={langCode} onValueChange={setLangCode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_LANGUAGES.map(lang => (
                      <SelectItem key={lang.code} value={lang.code}>
                        <span className="mr-2">{lang.flag}</span> {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Voce selezionata</Label>
                <div className="h-10 flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 text-sm">
                  {selectedVoice ? (
                    <>
                      <span className="font-medium truncate">{selectedVoice.displayName}</span>
                      <Badge
                        variant="outline"
                        className={selectedVoice.source === "IVC" ? "border-primary text-primary" : ""}
                      >
                        {selectedVoice.source === "IVC" ? "IVC clonata" : "Inworld"}
                      </Badge>
                      {selectedVoice.langCode && (
                        <span className="text-xs text-muted-foreground ml-auto">
                          {selectedVoice.langCode}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground">Nessuna voce selezionata</span>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="tts-text">Testo</Label>
                <span className={`text-xs ${charCount > 5000 ? "text-destructive" : "text-muted-foreground"}`}>
                  {charCount} / 5000
                </span>
              </div>
              <Textarea
                id="tts-text"
                value={text}
                onChange={e => setText(e.target.value)}
                rows={8}
                placeholder="Scrivi qui il testo da convertire in audio…"
                className="resize-y"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/20 px-3 py-2">
              <div className="flex items-center gap-3">
                <Switch id="auto-split" checked={autoSplit} onCheckedChange={setAutoSplit} />
                <Label htmlFor="auto-split" className="text-sm cursor-pointer">
                  Split automatico testi lunghi
                </Label>
              </div>
              {willSplit && (
                <span className="text-xs text-muted-foreground">
                  {previewChunks.length} chunk · concatenazione automatica
                </span>
              )}
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !selectedVoice || !text.trim() || charCount > 5000}
              size="lg"
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {genProgress
                    ? `Genero chunk ${genProgress.current}/${genProgress.total}…`
                    : "Generazione…"}
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Genera audio
                </>
              )}
            </Button>

            {/* Hidden audio player for history playback */}
            <audio
              ref={playerRef}
              controls
              className="w-full"
              onPause={() => setPlayingId(null)}
              onEnded={() => setPlayingId(null)}
            />
          </CardContent>
        </Card>

        {/* RIGHT: Voices grid + history */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between">
                <CardTitle>Catalogo voci</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => refreshVoices()}
                  disabled={isLoadingVoices}
                  title="Ricarica voci"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoadingVoices ? "animate-spin" : ""}`} />
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Cerca per nome o lingua…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
            </CardHeader>
            <CardContent>
              {voicesError && (
                <Alert variant="destructive" className="mb-3">
                  <AlertTitle>Errore</AlertTitle>
                  <AlertDescription>{voicesError.slice(0, 180)}</AlertDescription>
                </Alert>
              )}
              <Tabs defaultValue="ivc" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="ivc">
                    Clonate (IVC) · {ivcVoices.length}
                  </TabsTrigger>
                  <TabsTrigger value="system">
                    Inworld · {systemVoices.length}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="ivc" className="mt-3">
                  <VoiceList
                    voices={filteredVoices.filter(v => v.source === "IVC")}
                    selectedId={voiceId}
                    onSelect={setVoiceId}
                    onPreview={handlePreview}
                    previewLoadingId={previewLoadingId}
                    isLoading={isLoadingVoices}
                    emptyText="Nessuna voce clonata. Usa 'Clona Voce' nella navbar per crearne una."
                  />
                </TabsContent>
                <TabsContent value="system" className="mt-3">
                  <VoiceList
                    voices={filteredVoices.filter(v => v.source !== "IVC")}
                    selectedId={voiceId}
                    onSelect={setVoiceId}
                    onPreview={handlePreview}
                    previewLoadingId={previewLoadingId}
                    isLoading={isLoadingVoices}
                    emptyText="Nessuna voce di sistema disponibile."
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cronologia sessione</CardTitle>
              <CardDescription>
                Ultimi {HISTORY_LIMIT} audio generati. Si svuotano alla chiusura della pagina.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  Nessun audio generato ancora.
                </p>
              ) : (
                history.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 rounded-md border border-border bg-card p-2 text-sm"
                  >
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handlePlayHistory(item)}
                      className="h-8 w-8 shrink-0"
                    >
                      {playingId === item.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-medium truncate">{item.voiceName}</span>
                        <Badge variant="outline" className="h-4 px-1 text-[10px] uppercase">
                          {item.langCode}
                        </Badge>
                        {item.chunks > 1 && (
                          <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                            {item.chunks}×
                          </Badge>
                        )}
                      </div>
                      <p className="truncate text-muted-foreground text-xs mt-0.5">
                        {item.text}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatBytes(item.bytes)} · {item.format.toUpperCase()}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDownload(item)}
                      className="h-8 w-8 shrink-0"
                      title="Scarica"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleRemove(item)}
                      className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                      title="Rimuovi"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

interface VoiceListProps {
  voices: InworldVoice[];
  selectedId: string;
  onSelect: (id: string) => void;
  onPreview: (voice: InworldVoice) => void;
  previewLoadingId: string | null;
  isLoading: boolean;
  emptyText: string;
}

function VoiceList({
  voices,
  selectedId,
  onSelect,
  onPreview,
  previewLoadingId,
  isLoading,
  emptyText,
}: VoiceListProps) {
  if (isLoading && voices.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-4 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" /> Caricamento voci…
      </div>
    );
  }
  if (voices.length === 0) {
    return <p className="text-sm text-muted-foreground italic p-3">{emptyText}</p>;
  }
  return (
    <ScrollArea className="h-[320px] pr-3">
      <div className="space-y-2">
        {voices.map(v => {
          const active = v.voiceId === selectedId;
          return (
            <div
              key={v.voiceId}
              className={`flex items-center gap-2 rounded-md border p-2 transition-colors cursor-pointer ${
                active
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:bg-muted/50"
              }`}
              onClick={() => onSelect(v.voiceId)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{v.displayName}</span>
                  {v.langCode && (
                    <span className="text-[10px] text-muted-foreground">{v.langCode}</span>
                  )}
                </div>
                {v.description && (
                  <p className="text-xs text-muted-foreground truncate">{v.description}</p>
                )}
              </div>
              <Button
                size="icon"
                variant="outline"
                onClick={e => {
                  e.stopPropagation();
                  onPreview(v);
                }}
                disabled={previewLoadingId === v.voiceId}
                className="h-8 w-8 shrink-0"
                title="Anteprima"
              >
                {previewLoadingId === v.voiceId ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

export default function TextToSpeechPage() {
  return (
    <AuthGuard>
      <Navbar />
      <TextToSpeechContent />
    </AuthGuard>
  );
}
