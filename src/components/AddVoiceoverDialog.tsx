import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Volume2, Play, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface AddVoiceoverDialogProps {
  videoId: string;
  dialogueText?: string | null;
  onVoiceoverAdded?: (audioUrl: string) => void;
}

const VOICE_OPTIONS = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah (Femminile, Naturale)", lang: "it" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George (Maschile, Profondo)", lang: "en" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel (Maschile, Narratore)", lang: "en" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily (Femminile, Dolce)", lang: "en" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam (Maschile, Giovane)", lang: "en" },
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda (Femminile, Elegante)", lang: "en" },
];

export const AddVoiceoverDialog = ({ videoId, dialogueText, onVoiceoverAdded }: AddVoiceoverDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState(dialogueText || "");
  const [voiceId, setVoiceId] = useState(VOICE_OPTIONS[0].id);
  const [speed, setSpeed] = useState([1.0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useState<HTMLAudioElement | null>(null);

  const handleGenerate = async () => {
    if (!text.trim()) {
      toast.error("Inserisci il testo per il voiceover");
      return;
    }

    setIsGenerating(true);
    setAudioUrl(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Devi effettuare l'accesso");
        return;
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/elevenlabs-tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseKey,
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ 
          text, 
          voiceId, 
          speed: speed[0] 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Errore nella generazione audio");
      }

      const data = await response.json();
      
      if (data.audioContent) {
        const url = `data:audio/mpeg;base64,${data.audioContent}`;
        setAudioUrl(url);
        toast.success("Audio generato con successo!");
      }
    } catch (error) {
      console.error("Error generating voiceover:", error);
      toast.error(error instanceof Error ? error.message : "Errore nella generazione");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePlay = () => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.onended = () => setIsPlaying(false);
      audio.play();
      setIsPlaying(true);
    }
  };

  const handleSave = async () => {
    if (!audioUrl) return;

    try {
      // Update the video generation with the audio URL
      const { error } = await supabase
        .from("video_generations")
        .update({ 
          audio_url: audioUrl,
          dialogue_text: text 
        })
        .eq("id", videoId);

      if (error) throw error;

      toast.success("Voiceover salvato!");
      onVoiceoverAdded?.(audioUrl);
      setIsOpen(false);
    } catch (error) {
      console.error("Error saving voiceover:", error);
      toast.error("Errore nel salvataggio");
    }
  };

  const handleDownload = () => {
    if (audioUrl) {
      const link = document.createElement("a");
      link.href = audioUrl;
      link.download = `voiceover-${videoId}.mp3`;
      link.click();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Volume2 className="h-4 w-4" />
          Aggiungi Voiceover
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Genera Voiceover con ElevenLabs</DialogTitle>
          <DialogDescription>
            Aggiungi un audio parlato al tuo video usando la sintesi vocale AI
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="voiceover-text">Testo da pronunciare</Label>
            <Textarea
              id="voiceover-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Inserisci il testo che vuoi far pronunciare..."
              rows={4}
              maxLength={5000}
            />
            <p className="text-xs text-muted-foreground text-right">
              {text.length}/5000 caratteri
            </p>
          </div>

          <div className="space-y-2">
            <Label>Voce</Label>
            <Select value={voiceId} onValueChange={setVoiceId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VOICE_OPTIONS.map((voice) => (
                  <SelectItem key={voice.id} value={voice.id}>
                    {voice.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Velocità: {speed[0].toFixed(1)}x</Label>
            <Slider
              value={speed}
              onValueChange={setSpeed}
              min={0.7}
              max={1.2}
              step={0.1}
              className="w-full"
            />
          </div>

          <Button 
            onClick={handleGenerate} 
            disabled={isGenerating || !text.trim()}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generazione in corso...
              </>
            ) : (
              <>
                <Volume2 className="h-4 w-4 mr-2" />
                Genera Audio
              </>
            )}
          </Button>

          {audioUrl && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handlePlay}
                disabled={isPlaying}
              >
                <Play className="h-4 w-4" />
              </Button>
              <span className="flex-1 text-sm text-muted-foreground">
                Audio pronto
              </span>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4" />
              </Button>
              <Button size="sm" onClick={handleSave}>
                Salva
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
