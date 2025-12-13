import React, { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Film, Download, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface VideoExporterProps {
  videoUrl: string;
  audioUrl: string;
  segmentStart: number;
  segmentEnd: number;
  equalizerEnabled?: boolean;
}

type ExportQuality = 'low' | 'medium' | 'high';
type ExportFormat = 'webm' | 'mp4';

const QUALITY_CONFIG: Record<ExportQuality, { bitrate: number; label: string }> = {
  low: { bitrate: 1000000, label: 'Bassa (1 Mbps)' },
  medium: { bitrate: 2500000, label: 'Media (2.5 Mbps)' },
  high: { bitrate: 5000000, label: 'Alta (5 Mbps)' },
};

const FORMAT_CONFIG: Record<ExportFormat, { 
  mimeType: string; 
  extension: string; 
  label: string;
  fallbackMimeType?: string;
}> = {
  webm: { 
    mimeType: 'video/webm;codecs=vp9,opus', 
    extension: 'webm', 
    label: 'WebM (VP9)' 
  },
  mp4: { 
    mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 
    extension: 'mp4', 
    label: 'MP4 (H.264)',
    fallbackMimeType: 'video/mp4'
  },
};

// Check if format is supported
const isFormatSupported = (format: ExportFormat): boolean => {
  const config = FORMAT_CONFIG[format];
  return MediaRecorder.isTypeSupported(config.mimeType) || 
         (config.fallbackMimeType ? MediaRecorder.isTypeSupported(config.fallbackMimeType) : false);
};

export function VideoExporter({ 
  videoUrl, 
  audioUrl, 
  segmentStart, 
  segmentEnd,
}: VideoExporterProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [quality, setQuality] = useState<ExportQuality>('medium');
  const [format, setFormat] = useState<ExportFormat>('webm');
  const [supportedFormats, setSupportedFormats] = useState<ExportFormat[]>([]);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Check supported formats on mount
  useEffect(() => {
    const formats: ExportFormat[] = [];
    if (isFormatSupported('webm')) formats.push('webm');
    if (isFormatSupported('mp4')) formats.push('mp4');
    setSupportedFormats(formats);
    
    // Default to first supported format
    if (formats.length > 0 && !formats.includes(format)) {
      setFormat(formats[0]);
    }
  }, []);

  const getMimeType = (fmt: ExportFormat): string => {
    const config = FORMAT_CONFIG[fmt];
    if (MediaRecorder.isTypeSupported(config.mimeType)) {
      return config.mimeType;
    }
    if (config.fallbackMimeType && MediaRecorder.isTypeSupported(config.fallbackMimeType)) {
      return config.fallbackMimeType;
    }
    // Ultimate fallback
    return 'video/webm';
  };

  const handleExport = useCallback(async () => {
    if (!videoUrl || !audioUrl) {
      toast.error("Video e audio sono necessari per l'esportazione");
      return;
    }

    setIsExporting(true);
    setExportProgress(0);

    try {
      // Create offscreen elements
      const video = document.createElement('video');
      video.src = videoUrl;
      video.muted = true;
      video.crossOrigin = 'anonymous';

      const audio = document.createElement('audio');
      audio.src = audioUrl;
      audio.crossOrigin = 'anonymous';

      // Wait for both to load
      await Promise.all([
        new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => resolve();
          video.onerror = () => reject(new Error('Errore caricamento video'));
        }),
        new Promise<void>((resolve, reject) => {
          audio.onloadedmetadata = () => resolve();
          audio.onerror = () => reject(new Error('Errore caricamento audio'));
        }),
      ]);

      // Create canvas for video capture
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Impossibile creare contesto canvas');
      }

      // Create audio context for audio capture
      const audioContext = new AudioContext();
      const audioSource = audioContext.createMediaElementSource(audio);
      const audioDestination = audioContext.createMediaStreamDestination();
      audioSource.connect(audioDestination);
      audioSource.connect(audioContext.destination);

      // Create video stream from canvas
      const videoStream = canvas.captureStream(30);
      
      // Combine video and audio streams
      const combinedStream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...audioDestination.stream.getAudioTracks(),
      ]);

      // Get actual mime type to use
      const mimeType = getMimeType(format);
      const actualFormat = mimeType.includes('mp4') ? 'mp4' : 'webm';
      const extension = FORMAT_CONFIG[actualFormat].extension;

      // Set up MediaRecorder
      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: QUALITY_CONFIG[quality].bitrate,
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      const segmentDuration = segmentEnd - segmentStart;
      let recordingComplete = false;

      mediaRecorder.onstop = () => {
        recordingComplete = true;
        const blobType = actualFormat === 'mp4' ? 'video/mp4' : 'video/webm';
        const blob = new Blob(chunks, { type: blobType });
        const url = URL.createObjectURL(blob);
        
        // Download the file
        const link = document.createElement('a');
        link.href = url;
        link.download = `video_con_nuovo_audio_${Date.now()}.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        setIsExporting(false);
        setExportProgress(100);
        toast.success(`Video esportato con successo in formato ${extension.toUpperCase()}!`);
        
        // Cleanup
        audioContext.close();
      };

      // Start recording
      video.currentTime = segmentStart;
      audio.currentTime = 0;
      
      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve();
      });

      mediaRecorder.start(100);
      
      await Promise.all([
        video.play(),
        audio.play(),
      ]);

      // Update progress and render frames
      const renderFrame = () => {
        if (recordingComplete) return;
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const elapsed = video.currentTime - segmentStart;
        const progress = Math.min((elapsed / segmentDuration) * 100, 100);
        setExportProgress(progress);

        if (video.currentTime >= segmentEnd || video.ended || audio.ended) {
          video.pause();
          audio.pause();
          mediaRecorder.stop();
          return;
        }

        requestAnimationFrame(renderFrame);
      };

      requestAnimationFrame(renderFrame);

    } catch (error) {
      console.error('Export error:', error);
      toast.error('Errore durante l\'esportazione: ' + (error as Error).message);
      setIsExporting(false);
    }
  }, [videoUrl, audioUrl, segmentStart, segmentEnd, quality, format]);

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border">
      <div className="flex items-center gap-2">
        <Film className="w-4 h-4" />
        <Label>Esporta Video con Nuovo Audio</Label>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Formato</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FORMAT_CONFIG).map(([key, config]) => {
                  const isSupported = supportedFormats.includes(key as ExportFormat);
                  return (
                    <SelectItem 
                      key={key} 
                      value={key}
                      disabled={!isSupported}
                    >
                      <div className="flex items-center gap-2">
                        <span>{config.label}</span>
                        {isSupported ? (
                          <CheckCircle className="w-3 h-3 text-green-500" />
                        ) : (
                          <span className="text-xs text-muted-foreground">(non supportato)</span>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Qualità</Label>
            <Select value={quality} onValueChange={(v) => setQuality(v as ExportQuality)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(QUALITY_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isExporting ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Esportazione in corso...</span>
            </div>
            <Progress value={exportProgress} className="w-full" />
            <p className="text-xs text-muted-foreground text-center">
              {Math.round(exportProgress)}%
            </p>
          </div>
        ) : (
          <Button 
            onClick={handleExport} 
            className="w-full"
            variant="default"
          >
            <Download className="w-4 h-4 mr-2" />
            Esporta Video (.{FORMAT_CONFIG[format].extension})
          </Button>
        )}

        <div className="flex items-start gap-2 p-2 bg-muted/50 rounded text-xs">
          <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-muted-foreground">
            {format === 'mp4' 
              ? "MP4 offre la massima compatibilità con dispositivi e player. Richiede browser recenti (Chrome 107+, Edge 107+)."
              : "WebM è supportato da tutti i browser moderni. Per massima compatibilità, considera MP4 se disponibile."}
          </p>
        </div>
      </div>

      {/* Hidden elements for reference */}
      <canvas ref={canvasRef} className="hidden" />
      <video ref={videoRef} className="hidden" />
      <audio ref={audioRef} className="hidden" />
    </div>
  );
}
