import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Music, Upload, Download, Loader2, Play, FileAudio, Video, Mic } from "lucide-react";
import { toast } from "sonner";
import { VoiceCloneDialog } from "./VoiceCloneDialog";

interface AudioExtractorDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  videoUrl?: string;
  onAudioExtracted?: (audioUrl: string) => void;
}

export const AudioExtractorDialog = ({ 
  trigger, 
  open, 
  onOpenChange,
  videoUrl: initialVideoUrl,
  onAudioExtracted 
}: AudioExtractorDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl] = useState<string>(initialVideoUrl || "");
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extractedAudioUrl, setExtractedAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showVoiceClone, setShowVoiceClone] = useState(false);
  const [extractedAudioFile, setExtractedAudioFile] = useState<File | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const controlledOpen = open !== undefined ? open : isOpen;
  const setControlledOpen = onOpenChange || setIsOpen;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo", "video/x-matroska"];
      if (!validTypes.includes(file.type) && !file.name.match(/\.(mp4|webm|mov|avi|mkv)$/i)) {
        toast.error("Formato non supportato. Usa MP4, WebM, MOV, AVI o MKV");
        return;
      }
      if (file.size > 100 * 1024 * 1024) {
        toast.error("File troppo grande. Max 100MB per l'estrazione browser");
        return;
      }
      setVideoFile(file);
      setExtractedAudioUrl(null);
    }
  };

  // Convert AudioBuffer to WAV Blob
  const audioBufferToWav = (buffer: AudioBuffer): Blob => {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    
    const dataLength = buffer.length * blockAlign;
    const bufferLength = 44 + dataLength;
    
    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, bufferLength - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);
    
    // Write audio data
    const channels: Float32Array[] = [];
    for (let i = 0; i < numChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }
    
    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channels[channel][i]));
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset, intSample, true);
        offset += 2;
      }
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  };

  const extractAudio = async () => {
    if (!videoFile && !videoUrl) {
      toast.error("Seleziona un video");
      return;
    }

    setIsExtracting(true);
    setProgress(0);
    setExtractedAudioUrl(null);

    try {
      toast.info("Estrazione audio in corso...");
      setProgress(10);
      
      const fileToProcess = videoFile || await fetch(videoUrl).then(r => r.blob()).then(b => new File([b], 'video.mp4'));
      
      setProgress(20);
      
      // Use Web Audio API to decode and extract audio
      const audioContext = new AudioContext();
      const arrayBuffer = await fileToProcess.arrayBuffer();
      
      setProgress(40);
      
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      setProgress(70);
      
      // Convert to WAV
      const wavBlob = audioBufferToWav(audioBuffer);
      const url = URL.createObjectURL(wavBlob);
      
      setProgress(90);
      
      // Create a File object for voice cloning
      const audioFile = new File([wavBlob], `extracted-audio.wav`, { type: 'audio/wav' });
      setExtractedAudioFile(audioFile);
      
      setExtractedAudioUrl(url);
      onAudioExtracted?.(url);
      
      setProgress(100);
      toast.success("Audio estratto con successo!");
      
      await audioContext.close();
    } catch (error) {
      console.error("Error extracting audio:", error);
      toast.error("Errore nell'estrazione. Assicurati che il video contenga audio.");
    } finally {
      setIsExtracting(false);
      setProgress(0);
    }
  };

  const playAudio = () => {
    if (!extractedAudioUrl) return;

    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    const audio = new Audio(extractedAudioUrl);
    audioRef.current = audio;
    audio.onended = () => setIsPlaying(false);
    audio.play();
    setIsPlaying(true);
  };

  const downloadAudio = () => {
    if (!extractedAudioUrl) return;

    const link = document.createElement("a");
    link.href = extractedAudioUrl;
    link.download = `audio-extracted.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Download avviato!");
  };

  const dialogContent = (
    <DialogContent className="max-w-xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Music className="w-5 h-5 text-primary" />
          Estrai Audio dal Video
        </DialogTitle>
        <DialogDescription>
          Carica un video per estrarre la traccia audio (formato WAV)
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6">
        {/* Video Input */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Carica Video</Label>
            <div 
              className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp4,.webm,.mov,video/*"
                onChange={handleFileChange}
                className="hidden"
              />
              {videoFile ? (
                <div className="flex items-center justify-center gap-2 text-primary">
                  <Video className="w-5 h-5" />
                  <span className="font-medium">{videoFile.name}</span>
                  <span className="text-muted-foreground text-sm">
                    ({(videoFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Clicca per selezionare un video
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Max 100MB • MP4, WebM, MOV
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Progress */}
          {isExtracting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Estrazione in corso...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {/* Extract Button */}
          <Button
            onClick={extractAudio}
            disabled={isExtracting || !videoFile}
            className="w-full"
          >
            {isExtracting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Estrazione in corso...
              </>
            ) : (
              <>
                <Music className="w-4 h-4 mr-2" />
                Estrai Audio
              </>
            )}
          </Button>
        </div>

        {/* Extracted Audio */}
        {extractedAudioUrl && (
          <div className="p-4 bg-card border rounded-lg space-y-3">
            <div className="flex items-center gap-2 text-primary">
              <FileAudio className="w-5 h-5" />
              <span className="font-medium">Audio Estratto (WAV)</span>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={playAudio} className="flex-1">
                <Play className="w-4 h-4 mr-2" />
                {isPlaying ? "Stop" : "Riproduci"}
              </Button>
              <Button variant="outline" onClick={downloadAudio} className="flex-1">
                <Download className="w-4 h-4 mr-2" />
                Scarica
              </Button>
            </div>
            
            {/* Use for Voice Cloning */}
            <Button 
              onClick={() => setShowVoiceClone(true)} 
              className="w-full"
              variant="default"
            >
              <Mic className="w-4 h-4 mr-2" />
              Usa per Clonare Voce
            </Button>
          </div>
        )}
        
        {/* Voice Clone Dialog with extracted audio */}
        <VoiceCloneDialog
          open={showVoiceClone}
          onOpenChange={setShowVoiceClone}
          initialAudioFile={extractedAudioFile}
          initialAudioUrl={extractedAudioUrl || undefined}
        />
      </div>
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
