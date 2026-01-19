import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Music, Upload, Download, Loader2, Play, FileAudio, Video, Mic } from "lucide-react";
import { toast } from "sonner";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { VoiceCloneDialog } from "./VoiceCloneDialog";

interface AudioExtractorDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  videoUrl?: string;
  onAudioExtracted?: (audioUrl: string) => void;
}

type AudioFormat = "mp3" | "wav" | "aac" | "ogg";

const AUDIO_FORMATS: { value: AudioFormat; label: string; mimeType: string }[] = [
  { value: "mp3", label: "MP3 (Consigliato)", mimeType: "audio/mpeg" },
  { value: "wav", label: "WAV (Alta qualità)", mimeType: "audio/wav" },
  { value: "aac", label: "AAC", mimeType: "audio/aac" },
  { value: "ogg", label: "OGG", mimeType: "audio/ogg" },
];

export const AudioExtractorDialog = ({ 
  trigger, 
  open, 
  onOpenChange,
  videoUrl: initialVideoUrl,
  onAudioExtracted 
}: AudioExtractorDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>(initialVideoUrl || "");
  const [audioFormat, setAudioFormat] = useState<AudioFormat>("mp3");
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extractedAudioUrl, setExtractedAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFFmpegLoaded, setIsFFmpegLoaded] = useState(false);
  const [loadingFFmpeg, setLoadingFFmpeg] = useState(false);
  const [showVoiceClone, setShowVoiceClone] = useState(false);
  const [extractedAudioFile, setExtractedAudioFile] = useState<File | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const controlledOpen = open !== undefined ? open : isOpen;
  const setControlledOpen = onOpenChange || setIsOpen;

  const loadFFmpeg = async () => {
    if (ffmpegRef.current && isFFmpegLoaded) return;
    
    setLoadingFFmpeg(true);
    try {
      const ffmpeg = new FFmpeg();
      ffmpegRef.current = ffmpeg;

      ffmpeg.on("progress", ({ progress }) => {
        setProgress(Math.round(progress * 100));
      });

      // Load FFmpeg with CDN
      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      });

      setIsFFmpegLoaded(true);
      toast.success("FFmpeg caricato!");
    } catch (error) {
      console.error("Error loading FFmpeg:", error);
      toast.error("Errore nel caricamento di FFmpeg");
    } finally {
      setLoadingFFmpeg(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo", "video/x-matroska"];
      if (!validTypes.includes(file.type) && !file.name.match(/\.(mp4|webm|mov|avi|mkv)$/i)) {
        toast.error("Formato non supportato. Usa MP4, WebM, MOV, AVI o MKV");
        return;
      }
      if (file.size > 500 * 1024 * 1024) {
        toast.error("File troppo grande. Max 500MB");
        return;
      }
      setVideoFile(file);
      setVideoUrl("");
      setExtractedAudioUrl(null);
    }
  };

  const extractAudio = async () => {
    if (!videoFile && !videoUrl) {
      toast.error("Seleziona un video o inserisci un URL");
      return;
    }

    if (!isFFmpegLoaded) {
      await loadFFmpeg();
    }

    if (!ffmpegRef.current) {
      toast.error("FFmpeg non disponibile");
      return;
    }

    setIsExtracting(true);
    setProgress(0);
    setExtractedAudioUrl(null);

    try {
      const ffmpeg = ffmpegRef.current;
      const inputFileName = "input.mp4";
      const outputFileName = `output.${audioFormat}`;

      // Load video file
      if (videoFile) {
        await ffmpeg.writeFile(inputFileName, await fetchFile(videoFile));
      } else if (videoUrl) {
        const response = await fetch(videoUrl);
        const blob = await response.blob();
        await ffmpeg.writeFile(inputFileName, await fetchFile(blob));
      }

      // Extract audio based on format
      let ffmpegArgs: string[];
      switch (audioFormat) {
        case "mp3":
          ffmpegArgs = ["-i", inputFileName, "-vn", "-acodec", "libmp3lame", "-q:a", "2", outputFileName];
          break;
        case "wav":
          ffmpegArgs = ["-i", inputFileName, "-vn", "-acodec", "pcm_s16le", outputFileName];
          break;
        case "aac":
          ffmpegArgs = ["-i", inputFileName, "-vn", "-acodec", "aac", "-b:a", "192k", outputFileName];
          break;
        case "ogg":
          ffmpegArgs = ["-i", inputFileName, "-vn", "-acodec", "libvorbis", "-q:a", "4", outputFileName];
          break;
        default:
          ffmpegArgs = ["-i", inputFileName, "-vn", "-acodec", "libmp3lame", "-q:a", "2", outputFileName];
      }

      await ffmpeg.exec(ffmpegArgs);

      // Read output file
      const data = await ffmpeg.readFile(outputFileName);
      const format = AUDIO_FORMATS.find(f => f.value === audioFormat);
      const uint8Array = new Uint8Array(data as Uint8Array);
      const blob = new Blob([uint8Array], { type: format?.mimeType || "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      
      // Create a File object for voice cloning
      const audioFile = new File([blob], `extracted-audio.${audioFormat}`, { 
        type: format?.mimeType || "audio/mpeg" 
      });
      setExtractedAudioFile(audioFile);
      
      setExtractedAudioUrl(url);
      onAudioExtracted?.(url);
      toast.success("Audio estratto con successo!");

      // Cleanup
      await ffmpeg.deleteFile(inputFileName);
      await ffmpeg.deleteFile(outputFileName);
    } catch (error) {
      console.error("Error extracting audio:", error);
      toast.error("Errore nell'estrazione dell'audio");
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
    link.download = `audio-extracted.${audioFormat}`;
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
          Carica un video o inserisci un URL per estrarre la traccia audio
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6">
        {/* Load FFmpeg */}
        {!isFFmpegLoaded && (
          <Button 
            onClick={loadFFmpeg} 
            disabled={loadingFFmpeg}
            variant="outline" 
            className="w-full"
          >
            {loadingFFmpeg ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Caricamento FFmpeg...
              </>
            ) : (
              <>
                <FileAudio className="w-4 h-4 mr-2" />
                Carica FFmpeg per iniziare
              </>
            )}
          </Button>
        )}

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
                accept=".mp4,.webm,.mov,.avi,.mkv,video/*"
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
                    Clicca per selezionare o trascina un video
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Max 500MB • MP4, WebM, MOV, AVI, MKV
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Audio Format */}
          <div className="space-y-2">
            <Label>Formato Audio</Label>
            <Select value={audioFormat} onValueChange={(v) => setAudioFormat(v as AudioFormat)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUDIO_FORMATS.map((format) => (
                  <SelectItem key={format.value} value={format.value}>
                    {format.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            disabled={isExtracting || (!videoFile && !videoUrl) || !isFFmpegLoaded}
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
              <span className="font-medium">Audio Estratto</span>
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
