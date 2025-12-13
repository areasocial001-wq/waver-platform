import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Loader2, Upload, Volume2, Download, Play, Pause, RefreshCw, Scissors } from "lucide-react";
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

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
};

export function VideoToAudioForm() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [text, setText] = useState("");
  const [selectedVoice, setSelectedVoice] = useState(VOICE_OPTIONS[0].id);
  const [speed, setSpeed] = useState(1.0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Segment selection
  const [segmentStart, setSegmentStart] = useState(0);
  const [segmentEnd, setSegmentEnd] = useState(0);
  const [isSelectingSegment, setIsSelectingSegment] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const playbackInterval = useRef<NodeJS.Timeout | null>(null);

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
      setSegmentStart(0);
      setSegmentEnd(0);
    }
  };

  const handleVideoLoaded = () => {
    if (videoRef.current) {
      const duration = videoRef.current.duration;
      setVideoDuration(duration);
      setSegmentEnd(duration);
    }
  };

  const handleSegmentChange = (values: number[]) => {
    setSegmentStart(values[0]);
    setSegmentEnd(values[1]);
    
    // Preview the segment start position
    if (videoRef.current) {
      videoRef.current.currentTime = values[0];
    }
  };

  const handleSetCurrentAsStart = () => {
    if (videoRef.current) {
      const currentTime = videoRef.current.currentTime;
      setSegmentStart(currentTime);
      if (currentTime >= segmentEnd) {
        setSegmentEnd(videoDuration);
      }
    }
  };

  const handleSetCurrentAsEnd = () => {
    if (videoRef.current) {
      const currentTime = videoRef.current.currentTime;
      setSegmentEnd(currentTime);
      if (currentTime <= segmentStart) {
        setSegmentStart(0);
      }
    }
  };

  const segmentDuration = segmentEnd - segmentStart;

  const handleGenerateAudio = async () => {
    if (!text.trim()) {
      toast.error("Inserisci il testo da convertire in audio");
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-tts', {
        body: { text, voiceId: selectedVoice, speed }
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
      if (playbackInterval.current) {
        clearInterval(playbackInterval.current);
      }
      setIsPlaying(false);
    } else {
      // Mute video and sync with audio at segment start
      videoRef.current.muted = true;
      videoRef.current.currentTime = segmentStart;
      audioRef.current.currentTime = 0;
      
      Promise.all([
        videoRef.current.play(),
        audioRef.current.play()
      ]).then(() => {
        setIsPlaying(true);
        
        // Monitor playback to stop at segment end
        playbackInterval.current = setInterval(() => {
          if (videoRef.current && videoRef.current.currentTime >= segmentEnd) {
            videoRef.current.pause();
            audioRef.current?.pause();
            setIsPlaying(false);
            if (playbackInterval.current) {
              clearInterval(playbackInterval.current);
            }
          }
        }, 100);
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playbackInterval.current) {
        clearInterval(playbackInterval.current);
      }
    };
  }, []);

  // Stop playback when video ends or reaches segment end
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    
    const handleEnded = () => {
      setIsPlaying(false);
      if (audio) audio.pause();
      if (playbackInterval.current) {
        clearInterval(playbackInterval.current);
      }
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
                  controls
                  muted={!!generatedAudioUrl}
                  onLoadedMetadata={handleVideoLoaded}
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

          {/* Segment Selection - Only show when video is loaded */}
          {videoUrl && videoDuration > 0 && (
            <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Scissors className="w-4 h-4" />
                  2. Seleziona segmento video
                </Label>
                <span className="text-sm text-muted-foreground">
                  Durata segmento: {formatTime(segmentDuration)}
                </span>
              </div>
              
              <div className="space-y-2">
                <Slider
                  value={[segmentStart, segmentEnd]}
                  min={0}
                  max={videoDuration}
                  step={0.01}
                  onValueChange={handleSegmentChange}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Inizio: {formatTime(segmentStart)}</span>
                  <span>Fine: {formatTime(segmentEnd)}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleSetCurrentAsStart}
                >
                  Imposta inizio qui
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleSetCurrentAsEnd}
                >
                  Imposta fine qui
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setSegmentStart(0);
                    setSegmentEnd(videoDuration);
                  }}
                >
                  Reset
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                💡 Naviga nel video con i controlli, poi clicca i pulsanti per impostare inizio e fine del segmento.
              </p>
            </div>
          )}

          {/* Text Input */}
          <div className="space-y-2">
            <Label htmlFor="tts-text">{videoUrl ? "3" : "2"}. Inserisci il testo da pronunciare</Label>
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

          {/* Voice and Speed Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{videoUrl ? "4" : "3"}. Seleziona la voce</Label>
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

            <div className="space-y-2">
              <Label>Velocità parlato: {speed.toFixed(1)}x</Label>
              <Slider
                value={[speed]}
                min={0.7}
                max={1.2}
                step={0.05}
                onValueChange={(values) => setSpeed(values[0])}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Lento (0.7x)</span>
                <span>Normale (1.0x)</span>
                <span>Veloce (1.2x)</span>
              </div>
              {segmentDuration > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  💡 Regola la velocità per adattare l'audio alla durata del segmento ({formatTime(segmentDuration)})
                </p>
              )}
            </div>
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
              <Label>{videoUrl ? "5" : "4"}. Anteprima e Download</Label>
              
              <audio ref={audioRef} src={generatedAudioUrl} className="hidden" />
              
              <div className="flex gap-2 flex-wrap">
                {videoUrl && (
                  <Button 
                    variant="outline" 
                    onClick={handlePlayPreview}
                    className="flex-1 min-w-[200px]"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="w-4 h-4 mr-2" />
                        Pausa
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Riproduci con Video {segmentStart > 0 || segmentEnd < videoDuration ? "(segmento)" : ""}
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
