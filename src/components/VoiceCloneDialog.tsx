import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mic, Upload, Loader2, Trash2, Play, Volume2 } from "lucide-react";
import { PremiumGate } from "@/components/PremiumGate";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useVoiceOptions, ClonedVoice } from "@/hooks/useVoiceOptions";

interface VoiceCloneDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialAudioFile?: File | null;
  initialAudioUrl?: string | null;
}

export const VoiceCloneDialog = ({ 
  trigger, 
  open, 
  onOpenChange,
  initialAudioFile,
  initialAudioUrl 
}: VoiceCloneDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { clonedVoices, refresh: refreshVoices, isLoading } = useVoiceOptions();
  const [isCloning, setIsCloning] = useState(false);
  const [cloneVoiceName, setCloneVoiceName] = useState("");
  const [cloneAudioFile, setCloneAudioFile] = useState<File | null>(null);
  const [cloneAudioUrl, setCloneAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const controlledOpen = open !== undefined ? open : isOpen;
  const setControlledOpen = onOpenChange || setIsOpen;

  useEffect(() => {
    if (controlledOpen) {
      refreshVoices();
      
      // Set initial audio if provided
      if (initialAudioFile) {
        setCloneAudioFile(initialAudioFile);
        setCloneAudioUrl(URL.createObjectURL(initialAudioFile));
      } else if (initialAudioUrl) {
        setCloneAudioUrl(initialAudioUrl);
        // Convert URL to File
        fetch(initialAudioUrl)
          .then(res => res.blob())
          .then(blob => {
            const file = new File([blob], "extracted-audio.mp3", { type: "audio/mpeg" });
            setCloneAudioFile(file);
          })
          .catch(console.error);
      }
    }
  }, [controlledOpen, initialAudioFile, initialAudioUrl, refreshVoices]);

  const previewAudio = () => {
    if (!cloneAudioUrl) return;
    
    if (isPreviewPlaying && previewAudioRef.current) {
      previewAudioRef.current.pause();
      setIsPreviewPlaying(false);
      return;
    }
    
    const audio = new Audio(cloneAudioUrl);
    previewAudioRef.current = audio;
    audio.onended = () => setIsPreviewPlaying(false);
    audio.play();
    setIsPreviewPlaying(true);
  };

  const handleCloneVoice = async () => {
    if (!cloneVoiceName.trim()) {
      toast.error("Inserisci un nome per la voce clonata");
      return;
    }
    if (!cloneAudioFile) {
      toast.error("Seleziona un file audio");
      return;
    }

    setIsCloning(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Devi effettuare l'accesso");
        return;
      }

      const formData = new FormData();
      formData.append("audio", cloneAudioFile);
      formData.append("name", cloneVoiceName);

      const response = await fetch(`${supabaseUrl}/functions/v1/elevenlabs-clone-voice`, {
        method: "POST",
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Errore nella clonazione");
      }

      const data = await response.json();
      
      // Save to database
      const { error: dbError } = await supabase
        .from('cloned_voices')
        .insert({
          user_id: session.user.id,
          elevenlabs_voice_id: data.voiceId,
          name: cloneVoiceName,
          description: "Voce clonata personalizzata",
        });

      if (dbError) {
        console.error('Error saving to database:', dbError);
        toast.error("Voce clonata ma errore nel salvataggio");
      } else {
        // Dispatch custom event to notify other components
        window.dispatchEvent(new CustomEvent("cloned-voices-updated"));
        
        toast.success("Voce clonata e salvata con successo!");
      }
      
      setCloneVoiceName("");
      setCloneAudioFile(null);
      setCloneAudioUrl(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      
      await refreshVoices();
    } catch (error) {
      console.error("Error cloning voice:", error);
      toast.error(error instanceof Error ? error.message : "Errore nella clonazione");
    } finally {
      setIsCloning(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/m4a", "audio/ogg", "audio/x-m4a"];
      if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a|ogg)$/i)) {
        toast.error("Formato non supportato. Usa MP3, WAV, M4A o OGG");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File troppo grande. Max 10MB");
        return;
      }
      setCloneAudioFile(file);
      setCloneAudioUrl(URL.createObjectURL(file));
    }
  };

  const deleteClonedVoice = async (voice: ClonedVoice) => {
    setIsDeleting(voice.id);
    try {
      const { error } = await supabase
        .from('cloned_voices')
        .delete()
        .eq('id', voice.id);

      if (error) throw error;

      window.dispatchEvent(new CustomEvent("cloned-voices-updated"));
      toast.success("Voce clonata rimossa");
      await refreshVoices();
    } catch (error) {
      console.error('Error deleting voice:', error);
      toast.error("Errore nella rimozione");
    } finally {
      setIsDeleting(null);
    }
  };

  const testVoice = async (voiceId: string, voiceName: string) => {
    if (isPlaying === voiceId) {
      audioRef.current?.pause();
      setIsPlaying(null);
      return;
    }

    setIsPlaying(voiceId);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Devi effettuare l'accesso");
        setIsPlaying(null);
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
          text: `Ciao, questa è la voce clonata ${voiceName}. Come suona?`, 
          voiceId,
          speed: 1.0,
          stability: 0.5,
          similarityBoost: 0.75,
          style: 0.5,
          languageCode: 'it',
        }),
      });

      if (!response.ok) {
        throw new Error("Errore nel test della voce");
      }

      const data = await response.json();
      if (data.audioContent) {
        const audio = new Audio(`data:audio/mpeg;base64,${data.audioContent}`);
        audioRef.current = audio;
        audio.onended = () => setIsPlaying(null);
        audio.play();
      }
    } catch (error) {
      console.error("Error testing voice:", error);
      toast.error("Errore nel test della voce");
      setIsPlaying(null);
    }
  };

  const dialogContent = (
    <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Mic className="w-5 h-5 text-primary" />
          Clona Voce Personalizzata
        </DialogTitle>
        <DialogDescription>
          Carica un campione audio per creare una voce clonata da usare nelle tue generazioni TTS
        </DialogDescription>
      </DialogHeader>

      <PremiumGate featureName="Clonazione Vocale">
      <div className="space-y-6 flex-1 overflow-hidden flex flex-col">
        {/* Clone New Voice Section */}
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Clona Nuova Voce
            </CardTitle>
            <CardDescription>
              Carica un file audio (MP3, WAV, M4A, OGG) di almeno 30 secondi per risultati migliori
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="voice-name">Nome della Voce</Label>
              <Input
                id="voice-name"
                placeholder="Es: Voce Mario"
                value={cloneVoiceName}
                onChange={(e) => setCloneVoiceName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>File Audio</Label>
              <div 
                className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".mp3,.wav,.m4a,.ogg,audio/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {cloneAudioFile ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2 text-primary">
                      <Volume2 className="w-5 h-5" />
                      <span className="font-medium">{cloneAudioFile.name}</span>
                      <span className="text-muted-foreground text-sm">
                        ({(cloneAudioFile.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    {cloneAudioUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          previewAudio();
                        }}
                      >
                        <Play className="w-4 h-4 mr-1" />
                        {isPreviewPlaying ? "Stop" : "Anteprima"}
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                    <p className="text-muted-foreground">
                      Clicca per selezionare o trascina un file audio
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Max 10MB • MP3, WAV, M4A, OGG
                    </p>
                  </div>
                )}
              </div>
            </div>

            <Button
              onClick={handleCloneVoice}
              disabled={isCloning || !cloneVoiceName.trim() || !cloneAudioFile}
              className="w-full"
            >
              {isCloning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Clonazione in corso...
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 mr-2" />
                  Clona Voce
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Cloned Voices List */}
        <div className="flex-1 overflow-hidden">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Volume2 className="w-4 h-4" />
            Voci Clonate ({clonedVoices.length})
            {isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
          </h3>
          
          {clonedVoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border rounded-lg">
              <Mic className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nessuna voce clonata</p>
              <p className="text-sm">Clona la tua prima voce personalizzata</p>
            </div>
          ) : (
            <ScrollArea className="h-[200px]">
              <div className="space-y-2 pr-4">
                {clonedVoices.map((voice) => (
                  <div
                    key={voice.id}
                    className="flex items-center justify-between p-3 bg-card border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Mic className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{voice.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(voice.created_at).toLocaleDateString('it-IT')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testVoice(voice.elevenlabs_voice_id, voice.name)}
                        disabled={isPlaying !== null && isPlaying !== voice.elevenlabs_voice_id}
                      >
                        {isPlaying === voice.elevenlabs_voice_id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteClonedVoice(voice)}
                        disabled={isDeleting === voice.id}
                        className="text-destructive hover:bg-destructive/10"
                      >
                        {isDeleting === voice.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
      </PremiumGate>
    </DialogContent>
  );

  if (trigger) {
    return (
      <Dialog open={controlledOpen} onOpenChange={setControlledOpen}>
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
        {dialogContent}
      </Dialog>
    );
  }

  return (
    <Dialog open={controlledOpen} onOpenChange={setControlledOpen}>
      {dialogContent}
    </Dialog>
  );
};
