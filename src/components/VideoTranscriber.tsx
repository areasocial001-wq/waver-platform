import React, { useState, useRef, useCallback } from "react";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Upload, 
  FileText, 
  Loader2, 
  Copy, 
  Download,
  Video,
  Languages,
  Users,
  Mic,
  MicOff,
  Save,
  Pencil,
  CheckCircle
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
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState("");
  
  // Realtime transcription state
  const [realtimeText, setRealtimeText] = useState("");
  const [committedSegments, setCommittedSegments] = useState<string[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ElevenLabs Scribe hook for realtime transcription
  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    onPartialTranscript: (data: { text: string }) => {
      setRealtimeText(data.text);
    },
    onCommittedTranscript: (data: { text: string }) => {
      setCommittedSegments(prev => [...prev, data.text]);
      setRealtimeText("");
    },
  });

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
      setIsEditing(false);
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
      setEditedText(result.text);
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

  // Realtime transcription functions
  const handleStartRealtime = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-scribe-token');
      
      if (error || !data?.token) {
        throw new Error(error?.message || "Errore nel recupero del token");
      }

      await scribe.connect({
        token: data.token,
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      
      toast.success("Registrazione avviata");
    } catch (error) {
      console.error("Realtime start error:", error);
      toast.error("Errore avvio registrazione: " + (error as Error).message);
    }
  };

  const handleStopRealtime = () => {
    scribe.disconnect();
    toast.success("Registrazione terminata");
  };

  const handleSaveRealtimeTranscription = () => {
    const fullText = [...committedSegments, realtimeText].filter(Boolean).join(" ");
    if (fullText) {
      setTranscription({ text: fullText });
      setEditedText(fullText);
      toast.success("Trascrizione salvata!");
    }
  };

  const handleClearRealtime = () => {
    setCommittedSegments([]);
    setRealtimeText("");
  };

  // Editing functions
  const handleStartEditing = () => {
    setIsEditing(true);
    setEditedText(transcription?.text || "");
  };

  const handleSaveEdit = () => {
    if (transcription) {
      setTranscription({ ...transcription, text: editedText });
      setIsEditing(false);
      toast.success("Modifiche salvate!");
    }
  };

  const handleCancelEdit = () => {
    setEditedText(transcription?.text || "");
    setIsEditing(false);
  };

  const handleCopyText = () => {
    const textToCopy = isEditing ? editedText : (transcription?.text || "");
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      toast.success("Testo copiato negli appunti!");
    }
  };

  const handleDownloadText = () => {
    const textToDownload = transcription?.text;
    if (!textToDownload) return;
    
    const blob = new Blob([textToDownload], { type: 'text/plain' });
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

  const fullRealtimeText = [...committedSegments, realtimeText].filter(Boolean).join(" ");

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Video Transcriber
        </CardTitle>
        <CardDescription>
          Estrai il testo parlato dal tuo video o usa il microfono per trascrizione in tempo reale
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs defaultValue="video" className="w-full">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="video" className="flex items-center gap-2">
              <Video className="w-4 h-4" />
              Da Video
            </TabsTrigger>
            <TabsTrigger value="realtime" className="flex items-center gap-2">
              <Mic className="w-4 h-4" />
              Tempo Reale
            </TabsTrigger>
          </TabsList>

          {/* Video Transcription Tab */}
          <TabsContent value="video" className="space-y-6 mt-4">
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
          </TabsContent>

          {/* Realtime Transcription Tab */}
          <TabsContent value="realtime" className="space-y-6 mt-4">
            <div className="text-center space-y-4">
              <div className="flex justify-center gap-4">
                {!scribe.isConnected ? (
                  <Button
                    onClick={handleStartRealtime}
                    size="lg"
                    className="gap-2"
                  >
                    <Mic className="w-5 h-5" />
                    Avvia Registrazione
                  </Button>
                ) : (
                  <Button
                    onClick={handleStopRealtime}
                    variant="destructive"
                    size="lg"
                    className="gap-2"
                  >
                    <MicOff className="w-5 h-5" />
                    Ferma Registrazione
                  </Button>
                )}
              </div>

              {scribe.isConnected && (
                <div className="flex items-center justify-center gap-2 text-sm text-green-500">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Registrazione in corso...
                </div>
              )}
            </div>

            {/* Realtime transcription display */}
            <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border min-h-[200px]">
              <div className="flex items-center justify-between">
                <Label>Trascrizione in tempo reale</Label>
                <div className="flex gap-2">
                  {fullRealtimeText && (
                    <>
                      <Button variant="outline" size="sm" onClick={handleSaveRealtimeTranscription}>
                        <Save className="w-4 h-4 mr-1" />
                        Salva
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleClearRealtime}>
                        Cancella
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div className="min-h-[120px] text-foreground">
                {committedSegments.map((segment, i) => (
                  <span key={i} className="text-foreground">
                    {segment}{" "}
                  </span>
                ))}
                {realtimeText && (
                  <span className="text-primary/70 italic">{realtimeText}</span>
                )}
                {!fullRealtimeText && !scribe.isConnected && (
                  <p className="text-muted-foreground text-center py-8">
                    Premi "Avvia Registrazione" per iniziare la trascrizione in tempo reale
                  </p>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Transcription Result */}
        {transcription && (
          <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border">
            <div className="flex items-center justify-between">
              <Label>Trascrizione</Label>
              <div className="flex gap-2">
                {!isEditing ? (
                  <>
                    <Button variant="outline" size="sm" onClick={handleStartEditing}>
                      <Pencil className="w-4 h-4 mr-1" />
                      Modifica
                    </Button>
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
                  </>
                ) : (
                  <>
                    <Button variant="default" size="sm" onClick={handleSaveEdit}>
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Salva
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                      Annulla
                    </Button>
                  </>
                )}
              </div>
            </div>

            <Textarea
              value={isEditing ? editedText : transcription.text}
              onChange={(e) => setEditedText(e.target.value)}
              readOnly={!isEditing}
              rows={8}
              className={`resize-none ${isEditing ? 'bg-background border-primary' : 'bg-background'}`}
            />

            {transcription.language && (
              <p className="text-xs text-muted-foreground">
                Lingua rilevata: {LANGUAGES.find(l => l.value === transcription.language)?.label || transcription.language}
              </p>
            )}

            {/* Word timestamps preview */}
            {transcription.words && transcription.words.length > 0 && !isEditing && (
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
