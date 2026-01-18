import React, { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { 
  Upload, 
  FileText, 
  Loader2, 
  Copy, 
  Download,
  Video,
  Languages,
  Users
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Supported languages for transcription
const LANGUAGES = [
  { value: "auto", label: "Rilevamento automatico" },
  { value: "it", label: "Italiano" },
  { value: "en", label: "Inglese" },
  { value: "es", label: "Spagnolo" },
  { value: "fr", label: "Francese" },
  { value: "de", label: "Tedesco" },
  { value: "pt", label: "Portoghese" },
  { value: "ru", label: "Russo" },
  { value: "zh", label: "Cinese" },
  { value: "ja", label: "Giapponese" },
  { value: "ko", label: "Coreano" },
  { value: "ar", label: "Arabo" },
];

interface TranscriptionWord {
  text: string;
  start: number;
  end: number;
  speaker?: string;
}

interface TranscriptionResult {
  text: string;
  words?: TranscriptionWord[];
  language?: string;
  duration?: number;
}

export function VideoTranscriber() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [language, setLanguage] = useState("auto");
  const [enableDiarization, setEnableDiarization] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState<TranscriptionResult | null>(null);
  const [progress, setProgress] = useState<string>("");
  
  const videoRef = useRef<HTMLVideoElement>(null);
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
      setTranscription(null);
    }
  };

  const extractAudioFromVideo = useCallback(async (videoFile: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(videoFile);
      
      video.onloadedmetadata = async () => {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const mediaElement = audioContext.createMediaElementSource(video);
        const destination = audioContext.createMediaStreamDestination();
        mediaElement.connect(destination);
        
        const mediaRecorder = new MediaRecorder(destination.stream, {
          mimeType: 'audio/webm'
        });
        
        const chunks: Blob[] = [];
        
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunks.push(e.data);
          }
        };
        
        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(chunks, { type: 'audio/webm' });
          URL.revokeObjectURL(video.src);
          resolve(audioBlob);
        };
        
        mediaRecorder.onerror = (e) => {
          reject(e);
        };
        
        mediaRecorder.start();
        video.play();
        
        video.onended = () => {
          mediaRecorder.stop();
          audioContext.close();
        };
      };
      
      video.onerror = () => {
        reject(new Error("Errore nel caricamento del video"));
      };
    });
  }, []);

  const handleTranscribe = async () => {
    if (!videoFile) {
      toast.error("Carica un video da trascrivere");
      return;
    }

    setIsTranscribing(true);
    setProgress("Estrazione audio dal video...");

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Devi essere autenticato per trascrivere video");
      }

      // Extract audio from video
      let audioBlob: Blob;
      try {
        audioBlob = await extractAudioFromVideo(videoFile);
      } catch (extractError) {
        // Fallback: use the video file directly (some APIs can handle video files)
        console.warn("Audio extraction failed, using video file directly:", extractError);
        audioBlob = videoFile;
      }

      setProgress("Caricamento audio...");

      // Upload to Supabase Storage
      const fileName = `${user.id}/${Date.now()}-audio.webm`;
      const { error: uploadError } = await supabase.storage
        .from('audio-uploads')
        .upload(fileName, audioBlob, {
          contentType: 'audio/webm',
          upsert: true
        });

      if (uploadError) {
        throw new Error(`Errore upload: ${uploadError.message}`);
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('audio-uploads')
        .getPublicUrl(fileName);

      setProgress("Trascrizione in corso...");

      // Call AIML API for transcription
      const { data, error } = await supabase.functions.invoke('aiml-api', {
        body: {
          operation: 'stt',
          audio_url: publicUrl,
          language: language !== 'auto' ? language : undefined,
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Parse the transcription result
      const result: TranscriptionResult = {
        text: data.text || data.transcription || '',
        words: data.words,
        language: data.language,
        duration: data.duration
      };

      setTranscription(result);
      toast.success("Trascrizione completata!");

      // Cleanup: delete the uploaded audio file
      await supabase.storage
        .from('audio-uploads')
        .remove([fileName]);

    } catch (error) {
      console.error("Transcription error:", error);
      toast.error("Errore nella trascrizione: " + (error as Error).message);
    } finally {
      setIsTranscribing(false);
      setProgress("");
    }
  };

  const handleCopyText = () => {
    if (transcription?.text) {
      navigator.clipboard.writeText(transcription.text);
      toast.success("Testo copiato negli appunti!");
    }
  };

  const handleDownloadText = () => {
    if (!transcription?.text) return;
    
    const blob = new Blob([transcription.text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'trascrizione.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success("File scaricato!");
  };

  const handleDownloadSRT = () => {
    if (!transcription?.words || transcription.words.length === 0) {
      toast.error("Timestamps non disponibili per questo video");
      return;
    }

    // Generate SRT format
    let srtContent = '';
    let index = 1;
    let currentSegment = '';
    let segmentStart = transcription.words[0].start;
    
    transcription.words.forEach((word, i) => {
      currentSegment += word.text + ' ';
      
      // Create a new segment every ~5 seconds or at end
      const isEndOfSegment = 
        i === transcription.words!.length - 1 ||
        (transcription.words![i + 1]?.start - segmentStart > 5);
      
      if (isEndOfSegment) {
        const formatTime = (seconds: number) => {
          const h = Math.floor(seconds / 3600);
          const m = Math.floor((seconds % 3600) / 60);
          const s = Math.floor(seconds % 60);
          const ms = Math.floor((seconds % 1) * 1000);
          return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
        };
        
        srtContent += `${index}\n`;
        srtContent += `${formatTime(segmentStart)} --> ${formatTime(word.end)}\n`;
        srtContent += `${currentSegment.trim()}\n\n`;
        
        index++;
        currentSegment = '';
        if (transcription.words![i + 1]) {
          segmentStart = transcription.words![i + 1].start;
        }
      }
    });

    const blob = new Blob([srtContent], { type: 'text/srt' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sottotitoli.srt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success("File SRT scaricato!");
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Video Transcriber
        </CardTitle>
        <CardDescription>
          Estrai il testo parlato dal tuo video usando AI speech-to-text
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
              />
            ) : (
              <div className="py-8">
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Clicca per caricare un video o trascina qui
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Formati supportati: MP4, WebM, MOV, AVI
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Languages className="w-4 h-4" />
              Lingua
            </Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona lingua" />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Riconoscimento speaker
            </Label>
            <div className="flex items-center space-x-2 pt-2">
              <Switch
                id="diarization"
                checked={enableDiarization}
                onCheckedChange={setEnableDiarization}
              />
              <Label htmlFor="diarization" className="text-sm text-muted-foreground">
                Identifica diversi speaker
              </Label>
            </div>
          </div>
        </div>

        {/* Transcribe Button */}
        <Button
          onClick={handleTranscribe}
          disabled={!videoFile || isTranscribing}
          className="w-full"
          size="lg"
        >
          {isTranscribing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {progress || "Trascrizione..."}
            </>
          ) : (
            <>
              <Video className="w-4 h-4 mr-2" />
              Trascrivi Video
            </>
          )}
        </Button>

        {/* Transcription Result */}
        {transcription && (
          <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border">
            <div className="flex items-center justify-between">
              <Label>Trascrizione</Label>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyText}>
                  <Copy className="w-4 h-4 mr-1" />
                  Copia
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadText}>
                  <Download className="w-4 h-4 mr-1" />
                  TXT
                </Button>
                {transcription.words && transcription.words.length > 0 && (
                  <Button variant="outline" size="sm" onClick={handleDownloadSRT}>
                    <Download className="w-4 h-4 mr-1" />
                    SRT
                  </Button>
                )}
              </div>
            </div>

            <Textarea
              value={transcription.text}
              readOnly
              rows={8}
              className="resize-none bg-background"
            />

            {transcription.language && (
              <p className="text-xs text-muted-foreground">
                Lingua rilevata: {LANGUAGES.find(l => l.value === transcription.language)?.label || transcription.language}
              </p>
            )}

            {/* Word timestamps preview */}
            {transcription.words && transcription.words.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm">Timeline parole</Label>
                <div className="max-h-48 overflow-y-auto space-y-1 text-xs">
                  {transcription.words.slice(0, 50).map((word, i) => (
                    <span
                      key={i}
                      className="inline-block mr-1 px-1.5 py-0.5 bg-primary/10 rounded text-foreground cursor-help"
                      title={`${formatTime(word.start)} - ${formatTime(word.end)}${word.speaker ? ` (${word.speaker})` : ''}`}
                    >
                      {word.text}
                    </span>
                  ))}
                  {transcription.words.length > 50 && (
                    <span className="text-muted-foreground">
                      ... e altre {transcription.words.length - 50} parole
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
