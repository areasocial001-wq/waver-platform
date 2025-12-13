import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, Upload, Volume2, Download, Play, Pause, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface VoiceOption {
  id: string;
  name: string;
  description: string;
}

const VOICE_OPTIONS: VoiceOption[] = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", description: "Voce femminile naturale, multilingue" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", description: "Voce maschile profonda e autorevole" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", description: "Voce maschile calda e narrativa" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", description: "Voce femminile giovane e dinamica" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", description: "Voce maschile chiara e professionale" },
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", description: "Voce femminile matura e rassicurante" },
];

export function VideoToAudioForm() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [text, setText] = useState("");
  const [selectedVoice, setSelectedVoice] = useState(VOICE_OPTIONS[0].id);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('video/')) {
        toast.error("Seleziona un file video valido");
        return;
      }
      setVideoFile(file);
      setVideoUrl(URL.createObjectURL(file));
      setGeneratedAudioUrl(null);
    }
  };

  const handleGenerateAudio = async () => {
    if (!text.trim()) {
      toast.error("Inserisci il testo da convertire in audio");
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-tts', {
        body: { text, voiceId: selectedVoice }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Convert base64 to audio URL
      const audioBlob = new Blob(
        [Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0))],
        { type: 'audio/mpeg' }
      );
      const audioUrl = URL.createObjectURL(audioBlob);
      setGeneratedAudioUrl(audioUrl);
      
      toast.success("Audio generato con successo!");
    } catch (error) {
      console.error("Error generating audio:", error);
      toast.error("Errore nella generazione audio: " + (error as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePlayPreview = () => {
    if (!videoRef.current || !audioRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      // Mute video and sync with audio
      videoRef.current.muted = true;
      videoRef.current.currentTime = 0;
      audioRef.current.currentTime = 0;
      
      Promise.all([
        videoRef.current.play(),
        audioRef.current.play()
      ]).then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.error("Playback error:", err);
        toast.error("Errore nella riproduzione");
      });
    }
  };

  const handleDownloadAudio = () => {
    if (!generatedAudioUrl) return;
    
    const link = document.createElement('a');
    link.href = generatedAudioUrl;
    link.download = 'audio_generato.mp3';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success("Audio scaricato!");
  };

  // Stop playback when video ends
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    
    const handleEnded = () => {
      setIsPlaying(false);
      if (audio) audio.pause();
    };

    if (video) {
      video.addEventListener('ended', handleEnded);
    }

    return () => {
      if (video) {
        video.removeEventListener('ended', handleEnded);
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="w-5 h-5" />
            Video to Audio
          </CardTitle>
          <CardDescription>
            Genera nuovo audio sincronizzato per i tuoi video usando ElevenLabs TTS
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Video Upload */}
          <div className="space-y-2">
            <Label>1. Carica il video</Label>
            <div 
              className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="hidden"
              />
              {videoUrl ? (
                <video 
                  ref={videoRef}
                  src={videoUrl} 
                  className="max-h-64 mx-auto rounded-lg"
                  controls={!generatedAudioUrl}
                  muted={!!generatedAudioUrl}
                />
              ) : (
                <div className="py-8">
                  <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Clicca per caricare un video o trascina qui
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Text Input */}
          <div className="space-y-2">
            <Label htmlFor="tts-text">2. Inserisci il testo da pronunciare</Label>
            <Textarea
              id="tts-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Scrivi qui il testo che vuoi far pronunciare. Questo testo verrà convertito in audio parlato e sincronizzato con il video..."
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {text.length} caratteri
            </p>
          </div>

          {/* Voice Selection */}
          <div className="space-y-2">
            <Label>3. Seleziona la voce</Label>
            <Select value={selectedVoice} onValueChange={setSelectedVoice}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona una voce" />
              </SelectTrigger>
              <SelectContent>
                {VOICE_OPTIONS.map((voice) => (
                  <SelectItem key={voice.id} value={voice.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{voice.name}</span>
                      <span className="text-xs text-muted-foreground">{voice.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Generate Button */}
          <Button 
            onClick={handleGenerateAudio} 
            disabled={isGenerating || !text.trim()}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generazione in corso...
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 mr-2" />
                Genera Audio
              </>
            )}
          </Button>

          {/* Generated Audio Preview */}
          {generatedAudioUrl && (
            <div className="space-y-4 pt-4 border-t border-border">
              <Label>4. Anteprima e Download</Label>
              
              <audio ref={audioRef} src={generatedAudioUrl} className="hidden" />
              
              <div className="flex gap-2">
                {videoUrl && (
                  <Button 
                    variant="outline" 
                    onClick={handlePlayPreview}
                    className="flex-1"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="w-4 h-4 mr-2" />
                        Pausa
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Riproduci con Video
                      </>
                    )}
                  </Button>
                )}
                
                <Button 
                  variant="outline" 
                  onClick={handleDownloadAudio}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Scarica Audio
                </Button>

                <Button 
                  variant="ghost" 
                  onClick={() => setGeneratedAudioUrl(null)}
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>

              <p className="text-sm text-muted-foreground">
                💡 Suggerimento: Scarica l'audio e usa un editor video (es. CapCut, DaVinci Resolve) per sostituire l'audio originale del tuo video.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
