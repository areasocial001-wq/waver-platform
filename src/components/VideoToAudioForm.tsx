import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Loader2, Upload, Volume2, Download, Play, Pause, RefreshCw, Scissors, Zap, Mic } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AudioWaveform } from "./AudioWaveform";
import { AudioEqualizer, EqualizerSettings, DEFAULT_EQUALIZER_SETTINGS } from "./AudioEqualizer";
import { VideoExporter } from "./VideoExporter";
import { AudioEffects, AudioEffectsSettings, DEFAULT_EFFECTS_SETTINGS } from "./AudioEffects";
import { AudioMixer, AudioMixerSettings, DEFAULT_MIXER_SETTINGS } from "./AudioMixer";
import { useVoiceOptions, DEFAULT_VOICE_OPTIONS, SUPPORTED_LANGUAGES } from "@/hooks/useVoiceOptions";
import { Globe } from "lucide-react";

// Constants for optimal speed calculation
// Baseline: ~15 characters per second at 1.0x speed for comfortable speech
const CHARS_PER_SECOND_BASELINE = 15;

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
};

export function VideoToAudioForm() {
  const { voiceOptions, hasClonedVoices } = useVoiceOptions();
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [text, setText] = useState("");
  const [selectedVoice, setSelectedVoice] = useState(DEFAULT_VOICE_OPTIONS[0].id);
  const [selectedLanguage, setSelectedLanguage] = useState("it"); // Default to Italian
  const [speed, setSpeed] = useState(1.0);
  const [isAutoSpeed, setIsAutoSpeed] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [equalizerSettings, setEqualizerSettings] = useState<EqualizerSettings>(DEFAULT_EQUALIZER_SETTINGS);
  const [effectsSettings, setEffectsSettings] = useState<AudioEffectsSettings>(DEFAULT_EFFECTS_SETTINGS);
  const [mixerSettings, setMixerSettings] = useState<AudioMixerSettings>(DEFAULT_MIXER_SETTINGS);
  
  // Segment selection
  const [segmentStart, setSegmentStart] = useState(0);
  const [segmentEnd, setSegmentEnd] = useState(0);
  const [isSelectingSegment, setIsSelectingSegment] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const playbackInterval = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Calculate optimal speed based on text length and segment duration
  const calculateOptimalSpeed = useCallback(() => {
    if (segmentDuration <= 0 || text.length === 0) return 1.0;
    
    // Expected duration at 1.0x speed
    const expectedDuration = text.length / CHARS_PER_SECOND_BASELINE;
    
    // Calculate speed needed to fit the segment
    let optimalSpeed = expectedDuration / segmentDuration;
    
    // Clamp to ElevenLabs supported range (0.7 - 1.2)
    optimalSpeed = Math.max(0.7, Math.min(1.2, optimalSpeed));
    
    return Number(optimalSpeed.toFixed(2));
  }, [text, segmentDuration]);

  // Auto-update speed when text or segment changes
  useEffect(() => {
    if (isAutoSpeed && segmentDuration > 0 && text.length > 0) {
      const optimal = calculateOptimalSpeed();
      setSpeed(optimal);
    }
  }, [text, segmentDuration, isAutoSpeed, calculateOptimalSpeed]);

  const handleGenerateAudio = async () => {
    if (!text.trim()) {
      toast.error("Inserisci il testo da convertire in audio");
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-tts', {
        body: { text, voiceId: selectedVoice, speed, languageCode: selectedLanguage }
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

  // Track audio playback time for waveform
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setAudioCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setAudioDuration(audio.duration);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [generatedAudioUrl]);

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
              
              {/* Timeline with visual segment indicator */}
              <div className="space-y-2">
                <div className="relative h-8">
                  {/* Timeline background */}
                  <div className="absolute inset-0 h-2 top-3 bg-muted rounded-full overflow-hidden">
                    {/* Unselected area before segment */}
                    <div 
                      className="absolute h-full bg-muted-foreground/20"
                      style={{ 
                        left: 0, 
                        width: `${(segmentStart / videoDuration) * 100}%` 
                      }}
                    />
                    {/* Selected segment */}
                    <div 
                      className="absolute h-full bg-primary"
                      style={{ 
                        left: `${(segmentStart / videoDuration) * 100}%`,
                        width: `${((segmentEnd - segmentStart) / videoDuration) * 100}%`
                      }}
                    />
                    {/* Unselected area after segment */}
                    <div 
                      className="absolute h-full bg-muted-foreground/20"
                      style={{ 
                        left: `${(segmentEnd / videoDuration) * 100}%`,
                        width: `${((videoDuration - segmentEnd) / videoDuration) * 100}%`
                      }}
                    />
                  </div>
                  
                  {/* Slider overlay */}
                  <Slider
                    value={[segmentStart, segmentEnd]}
                    min={0}
                    max={videoDuration}
                    step={0.01}
                    onValueChange={handleSegmentChange}
                    className="absolute inset-0 w-full [&_.relative]:bg-transparent [&_[data-orientation=horizontal]>.bg-primary]:bg-transparent"
                  />
                </div>
                
                {/* Time markers */}
                <div className="flex justify-between text-xs">
                  <span className="text-primary font-medium">Inizio: {formatTime(segmentStart)}</span>
                  <span className="text-muted-foreground">Durata: {formatTime(segmentDuration)}</span>
                  <span className="text-primary font-medium">Fine: {formatTime(segmentEnd)}</span>
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

          {/* Voice, Language and Speed Selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Lingua
              </Label>
              <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona lingua" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      <span className="flex items-center gap-2">
                        <span>{lang.flag}</span>
                        <span>{lang.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Forza la pronuncia nella lingua selezionata
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Voce
                {hasClonedVoices && (
                  <span className="text-xs text-primary flex items-center gap-1">
                    <Mic className="w-3 h-3" />
                    Clonate disponibili
                  </span>
                )}
              </Label>
              <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona una voce" />
                </SelectTrigger>
                <SelectContent>
                  {hasClonedVoices && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                        <Mic className="w-3 h-3" />
                        Voci Clonate
                      </div>
                      {voiceOptions.filter(v => v.isCloned).map((voice) => (
                        <SelectItem key={voice.id} value={voice.id}>
                          <div className="flex flex-col">
                            <span className="font-medium text-primary">{voice.name}</span>
                            <span className="text-xs text-muted-foreground">{voice.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">
                        Voci Predefinite
                      </div>
                    </>
                  )}
                  {voiceOptions.filter(v => !v.isCloned).map((voice) => (
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
              <div className="flex items-center justify-between">
                <Label>Velocità parlato: {speed.toFixed(2)}x</Label>
                <Button
                  type="button"
                  variant={isAutoSpeed ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setIsAutoSpeed(!isAutoSpeed);
                    if (!isAutoSpeed && segmentDuration > 0 && text.length > 0) {
                      setSpeed(calculateOptimalSpeed());
                    }
                  }}
                  className="h-7 text-xs"
                >
                  <Zap className="w-3 h-3 mr-1" />
                  {isAutoSpeed ? "Auto" : "Manuale"}
                </Button>
              </div>
              <Slider
                value={[speed]}
                min={0.7}
                max={1.2}
                step={0.01}
                onValueChange={(values) => {
                  setSpeed(values[0]);
                  setIsAutoSpeed(false);
                }}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Lento (0.7x)</span>
                <span>Normale (1.0x)</span>
                <span>Veloce (1.2x)</span>
              </div>
              {segmentDuration > 0 && text.length > 0 && (
                <div className="mt-2 p-2 bg-muted/50 rounded text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Durata stimata audio:</span>
                    <span className="font-medium">{formatTime(text.length / CHARS_PER_SECOND_BASELINE / speed)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Durata segmento:</span>
                    <span className="font-medium">{formatTime(segmentDuration)}</span>
                  </div>
                  {isAutoSpeed && (
                    <p className="text-primary/80 mt-1">
                      ⚡ Velocità calcolata automaticamente
                    </p>
                  )}
                </div>
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
              
              {/* Audio Waveform Visualization */}
              <AudioWaveform 
                audioUrl={generatedAudioUrl}
                isPlaying={isPlaying}
                currentTime={audioCurrentTime}
                duration={audioDuration}
              />

              {/* Audio Equalizer */}
              <AudioEqualizer
                audioElement={audioRef.current}
                settings={equalizerSettings}
                onSettingsChange={setEqualizerSettings}
              />

              {/* Audio Effects */}
              <AudioEffects
                settings={effectsSettings}
                onSettingsChange={setEffectsSettings}
              />

              {/* Audio Mixer */}
              <AudioMixer
                settings={mixerSettings}
                onSettingsChange={setMixerSettings}
                hasOriginalAudio={!!videoUrl}
              />
              
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

              {/* Video Export */}
              {videoUrl && (
                <VideoExporter
                  videoUrl={videoUrl}
                  audioUrl={generatedAudioUrl}
                  segmentStart={segmentStart}
                  segmentEnd={segmentEnd}
                  mixerSettings={mixerSettings}
                  effectsSettings={effectsSettings}
                />
              )}

              <p className="text-sm text-muted-foreground">
                💡 Suggerimento: Usa l'equalizzatore per regolare le frequenze audio, poi esporta il video con il nuovo audio integrato.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
