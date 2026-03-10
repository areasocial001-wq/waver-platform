import React, { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Film, Download, AlertCircle, CheckCircle, AlertTriangle, Music } from "lucide-react";
import { toast } from "sonner";
import { AudioMixerSettings } from "./AudioMixer";
import { AudioEffectsSettings } from "./AudioEffects";
import { createFixedFpsLoop, type FixedFpsLoop } from "@/lib/videoExport/fixedFpsLoop";

interface VideoExporterProps {
  videoUrl: string;
  audioUrl: string;
  segmentStart: number;
  segmentEnd: number;
  equalizerEnabled?: boolean;
  mixerSettings?: AudioMixerSettings;
  effectsSettings?: AudioEffectsSettings;
}

type ExportQuality = 'low' | 'medium' | 'high';
type ExportFormat = 'webm' | 'mp4';
type ExportMode = 'video' | 'audio-only';
type ExportFps = '24' | '30' | '60';

const QUALITY_CONFIG: Record<ExportQuality, { bitrate: number; label: string }> = {
  low: { bitrate: 2_500_000, label: 'Bassa (2.5 Mbps)' },
  medium: { bitrate: 5_000_000, label: 'Media (5 Mbps)' },
  high: { bitrate: 10_000_000, label: 'Alta (10 Mbps)' },
};

const FORMAT_CONFIG: Record<ExportFormat, { 
  mimeType: string; 
  extension: string; 
  label: string;
  fallbackMimeType?: string;
}> = {
  webm: { 
    // VP8 is significantly faster to encode than VP9 in many browsers,
    // helping maintain real-time capture FPS.
    mimeType: 'video/webm;codecs=vp8,opus', 
    extension: 'webm', 
    label: 'WebM (VP8)',
    fallbackMimeType: 'video/webm;codecs=vp9,opus',
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

// Detect Chromium-based browsers (Chrome, Edge, Brave, Opera, etc.)
const isChromiumBrowser = (): boolean => {
  const ua = navigator.userAgent;
  // Chromium-based browsers have "Chrome" in UA but not "Firefox" or "Safari" alone
  return /Chrome|Chromium|Brave|Edg|OPR/i.test(ua) && !/Firefox/i.test(ua);
};

export function VideoExporter({ 
  videoUrl, 
  audioUrl, 
  segmentStart, 
  segmentEnd,
  mixerSettings,
  effectsSettings,
}: VideoExporterProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [quality, setQuality] = useState<ExportQuality>('medium');
  const [format, setFormat] = useState<ExportFormat>('webm');
  const [fps, setFps] = useState<ExportFps>('24');
  const [exportMode, setExportMode] = useState<ExportMode>('video');
  const [supportedFormats, setSupportedFormats] = useState<ExportFormat[]>([]);
  const [isChromium, setIsChromium] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Check supported formats and browser type on mount
  useEffect(() => {
    const formats: ExportFormat[] = [];
    // WebM first as it's recommended for stable FPS
    if (isFormatSupported('webm')) formats.push('webm');
    if (isFormatSupported('mp4')) formats.push('mp4');
    setSupportedFormats(formats);
    setIsChromium(isChromiumBrowser());
    
    // Default to WebM for best FPS stability
    if (formats.includes('webm')) {
      setFormat('webm');
    } else if (formats.length > 0) {
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

  const handleAudioOnlyExport = useCallback(async () => {
    if (!audioUrl) {
      toast.error("Audio necessario per l'esportazione");
      return;
    }

    setIsExporting(true);
    setExportProgress(0);

    let audioContext: AudioContext | null = null;

    try {
      const audio = document.createElement('audio');
      audio.src = audioUrl;
      audio.crossOrigin = 'anonymous';
      audio.preload = 'auto';

      await new Promise<void>((resolve, reject) => {
        audio.oncanplaythrough = () => resolve();
        audio.onerror = () => reject(new Error('Errore caricamento audio'));
        audio.load();
      });

      audioContext = new AudioContext({ latencyHint: 'playback' });
      const audioSource = audioContext.createMediaElementSource(audio);
      const generatedGain = audioContext.createGain();
      generatedGain.gain.value = (mixerSettings?.generatedVolume ?? 100) / 100;

      let lastNode: AudioNode = audioSource;

      if (effectsSettings?.compressorEnabled) {
        const compressor = audioContext.createDynamicsCompressor();
        compressor.threshold.value = effectsSettings.compressorThreshold;
        compressor.ratio.value = effectsSettings.compressorRatio;
        compressor.attack.value = effectsSettings.compressorAttack;
        compressor.release.value = effectsSettings.compressorRelease;
        lastNode.connect(compressor);
        lastNode = compressor;
      }

      const hasEffects = effectsSettings?.echoEnabled || effectsSettings?.reverbEnabled;
      const dryWet = (effectsSettings?.dryWetMix ?? 50) / 100;

      if (hasEffects) {
        const dryGain = audioContext.createGain();
        dryGain.gain.value = 1 - dryWet;
        lastNode.connect(dryGain);
        dryGain.connect(generatedGain);

        const wetGain = audioContext.createGain();
        wetGain.gain.value = dryWet;

        if (effectsSettings?.echoEnabled) {
          const delay = audioContext.createDelay(1);
          delay.delayTime.value = effectsSettings.echoDelay;
          const feedbackGain = audioContext.createGain();
          feedbackGain.gain.value = effectsSettings.echoFeedback / 100;
          const echoMixGain = audioContext.createGain();
          echoMixGain.gain.value = effectsSettings.echoMix / 100;
          lastNode.connect(delay);
          delay.connect(feedbackGain);
          feedbackGain.connect(delay);
          delay.connect(echoMixGain);
          echoMixGain.connect(wetGain);
        }

        if (effectsSettings?.reverbEnabled) {
          const reverbGain = audioContext.createGain();
          reverbGain.gain.value = effectsSettings.reverbMix / 100;
          lastNode.connect(reverbGain);
          reverbGain.connect(wetGain);
        }

        wetGain.connect(generatedGain);
      } else {
        lastNode.connect(generatedGain);
      }

      const audioDestination = audioContext.createMediaStreamDestination();
      generatedGain.connect(audioDestination);

      const silent = audioContext.createConstantSource();
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;
      silent.connect(silentGain);
      silentGain.connect(audioDestination);
      silent.start();

      const mediaRecorder = new MediaRecorder(audioDestination.stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const segmentDuration = segmentEnd - segmentStart;
      let recordingComplete = false;

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `audio_processato_${Date.now()}.webm`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setIsExporting(false);
        setExportProgress(100);
        toast.success('Audio esportato con successo!');
        try { await audioContext?.close(); } catch { /* ignore */ }
      };

      mediaRecorder.start(500);
      audio.currentTime = 0;
      await audio.play();

      const startTime = performance.now();
      const checkProgress = () => {
        if (recordingComplete) return;
        const elapsed = (performance.now() - startTime) / 1000;
        const progress = Math.min((elapsed / segmentDuration) * 100, 99);
        setExportProgress(progress);

        if (elapsed >= segmentDuration) {
          recordingComplete = true;
          audio.pause();
          const gracePeriodMs = hasEffects ? 1000 : 200;
          setTimeout(() => {
            try { if (mediaRecorder.state !== 'inactive') mediaRecorder.stop(); } catch { /* ignore */ }
          }, gracePeriodMs);
          return;
        }
        requestAnimationFrame(checkProgress);
      };
      requestAnimationFrame(checkProgress);

    } catch (error) {
      console.error('Audio export error:', error);
      toast.error("Errore durante l'esportazione audio: " + (error as Error).message);
      setIsExporting(false);
      try { await audioContext?.close(); } catch { /* ignore */ }
    }
  }, [audioUrl, segmentStart, segmentEnd, mixerSettings, effectsSettings]);

  const handleExport = useCallback(async () => {
    if (exportMode === 'audio-only') {
      return handleAudioOnlyExport();
    }

    if (!videoUrl || !audioUrl) {
      toast.error("Video e audio sono necessari per l'esportazione");
      return;
    }

    if (segmentEnd <= segmentStart) {
      toast.error("Intervallo segmento non valido");
      return;
    }

    setIsExporting(true);
    setExportProgress(0);

    let audioContext: AudioContext | null = null;
    let loop: FixedFpsLoop | null = null;
    let combinedStream: MediaStream | null = null;
    let videoStream: MediaStream | null = null;
    let cleanupRan = false;

    const cleanup = async () => {
      if (cleanupRan) return;
      cleanupRan = true;
      try { loop?.stop(); } catch { /* ignore */ }
      try { combinedStream?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
      try { videoStream?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
      try { await audioContext?.close(); } catch { /* ignore */ }
    };

    try {
      const video = document.createElement('video');
      video.src = videoUrl;
      video.muted = true;
      video.crossOrigin = 'anonymous';
      video.playsInline = true;
      video.preload = 'auto';
      video.playbackRate = 1;

      const audio = document.createElement('audio');
      audio.src = audioUrl;
      audio.crossOrigin = 'anonymous';
      audio.preload = 'auto';

      await Promise.all([
        new Promise<void>((resolve, reject) => {
          video.oncanplaythrough = () => resolve();
          video.onerror = () => reject(new Error('Errore caricamento video'));
          video.load();
        }),
        new Promise<void>((resolve, reject) => {
          audio.oncanplaythrough = () => resolve();
          audio.onerror = () => reject(new Error('Errore caricamento audio'));
          audio.load();
        }),
      ]);

      let cw = video.videoWidth;
      let ch = video.videoHeight;
      const MAX_DIM = 1080;
      if (cw > MAX_DIM || ch > MAX_DIM) {
        const scale = MAX_DIM / Math.max(cw, ch);
        cw = Math.round(cw * scale);
        ch = Math.round(ch * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d', { alpha: false });

      if (!ctx) {
        throw new Error('Impossibile creare contesto canvas');
      }

      audioContext = new AudioContext({ latencyHint: 'playback' });
      const audioSource = audioContext.createMediaElementSource(audio);
      const generatedGain = audioContext.createGain();
      generatedGain.gain.value = (mixerSettings?.generatedVolume ?? 100) / 100;

      let lastNode: AudioNode = audioSource;

      if (effectsSettings?.compressorEnabled) {
        const compressor = audioContext.createDynamicsCompressor();
        compressor.threshold.value = effectsSettings.compressorThreshold;
        compressor.ratio.value = effectsSettings.compressorRatio;
        compressor.attack.value = effectsSettings.compressorAttack;
        compressor.release.value = effectsSettings.compressorRelease;
        lastNode.connect(compressor);
        lastNode = compressor;
      }

      const hasEffects = effectsSettings?.echoEnabled || effectsSettings?.reverbEnabled;
      const dryWet = (effectsSettings?.dryWetMix ?? 50) / 100;

      if (hasEffects) {
        const dryGain = audioContext.createGain();
        dryGain.gain.value = 1 - dryWet;
        lastNode.connect(dryGain);
        dryGain.connect(generatedGain);

        const wetGain = audioContext.createGain();
        wetGain.gain.value = dryWet;

        if (effectsSettings?.echoEnabled) {
          const delay = audioContext.createDelay(1);
          delay.delayTime.value = effectsSettings.echoDelay;
          const feedbackGain = audioContext.createGain();
          feedbackGain.gain.value = effectsSettings.echoFeedback / 100;
          const echoMixGain = audioContext.createGain();
          echoMixGain.gain.value = effectsSettings.echoMix / 100;
          lastNode.connect(delay);
          delay.connect(feedbackGain);
          feedbackGain.connect(delay);
          delay.connect(echoMixGain);
          echoMixGain.connect(wetGain);
        }

        if (effectsSettings?.reverbEnabled) {
          const reverbGain = audioContext.createGain();
          reverbGain.gain.value = effectsSettings.reverbMix / 100;
          lastNode.connect(reverbGain);
          reverbGain.connect(wetGain);
        }

        wetGain.connect(generatedGain);
      } else {
        lastNode.connect(generatedGain);
      }

      const audioDestination = audioContext.createMediaStreamDestination();
      generatedGain.connect(audioDestination);

      const silent = audioContext.createConstantSource();
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;
      silent.connect(silentGain);
      silentGain.connect(audioDestination);
      silent.start();

      if (mixerSettings?.originalEnabled && mixerSettings.originalVolume > 0) {
        const originalSource = audioContext.createMediaElementSource(video);
        const originalGain = audioContext.createGain();
        originalGain.gain.value = mixerSettings.originalVolume / 100;
        originalSource.connect(originalGain);
        originalGain.connect(audioDestination);
      }

      const targetFps = parseInt(fps);
      videoStream = canvas.captureStream(targetFps);

      combinedStream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...audioDestination.stream.getAudioTracks(),
      ]);

      const mimeType = getMimeType(format);
      const actualFormat = mimeType.includes('mp4') ? 'mp4' : 'webm';
      const extension = FORMAT_CONFIG[actualFormat].extension;

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: QUALITY_CONFIG[quality].bitrate,
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const segmentDuration = segmentEnd - segmentStart;
      let recordingComplete = false;
      let lastUiUpdateMs = 0;
      const UI_UPDATE_INTERVAL_MS = 250;

      const stopOnce = () => {
        if (recordingComplete) return;
        recordingComplete = true;
        try { loop?.stop(); } catch { /* ignore */ }
        try { video.pause(); } catch { /* ignore */ }
        try { audio.pause(); } catch { /* ignore */ }
        setTimeout(() => {
          try {
            if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
          } catch { /* ignore */ }
        }, 100);
      };

      mediaRecorder.onstop = () => {
        const blobType = actualFormat === 'mp4' ? 'video/mp4' : 'video/webm';
        const blob = new Blob(chunks, { type: blobType });
        const url = URL.createObjectURL(blob);

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
        void cleanup();
      };

      video.currentTime = segmentStart;
      audio.currentTime = 0;

      await new Promise<void>((resolve) => {
        const checkReady = () => {
          if (video.readyState >= 4) {
            resolve();
          } else {
            video.oncanplaythrough = () => resolve();
          }
        };
        video.onseeked = checkReady;
      });

      mediaRecorder.start(500);

      if (mixerSettings?.originalEnabled && mixerSettings.originalVolume > 0) {
        video.muted = false;
      }
      await Promise.all([video.play(), audio.play()]);

      loop = createFixedFpsLoop({
        fps: targetFps,
        durationMs: segmentDuration * 1000,
        onFrame: ({ progress01 }) => {
          if (recordingComplete) return;
          ctx.drawImage(video, 0, 0, cw, ch);

          const now = performance.now();
          if (now - lastUiUpdateMs >= UI_UPDATE_INTERVAL_MS || progress01 >= 0.99) {
            lastUiUpdateMs = now;
            setExportProgress(Math.min(progress01 * 100, 99));
          }
        },
        onDone: () => {
          ctx.drawImage(video, 0, 0, cw, ch);
          const gracePeriodMs = hasEffects ? 1000 : 200;
          setTimeout(() => stopOnce(), gracePeriodMs);
        },
      });

      video.onended = () => {
        ctx.drawImage(video, 0, 0, cw, ch);
      };

      ctx.drawImage(video, 0, 0, cw, ch);
      loop.start();

    } catch (error) {
      console.error('Export error:', error);
      toast.error('Errore durante l\'esportazione: ' + (error as Error).message);
      setIsExporting(false);
      void cleanup();
    }
  }, [videoUrl, audioUrl, segmentStart, segmentEnd, quality, format, fps, exportMode, mixerSettings, effectsSettings, handleAudioOnlyExport]);

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border">
      <div className="flex items-center gap-2">
        {exportMode === 'audio-only' ? <Music className="w-4 h-4" /> : <Film className="w-4 h-4" />}
        <Label>Esporta {exportMode === 'audio-only' ? 'Audio Processato' : 'Video con Nuovo Audio'}</Label>
      </div>

      <div className="space-y-3">
        {/* Export mode toggle */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Modalità esportazione</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={exportMode === 'video' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setExportMode('video')}
              className="w-full"
            >
              <Film className="w-3.5 h-3.5 mr-1.5" />
              Video + Audio
            </Button>
            <Button
              variant={exportMode === 'audio-only' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setExportMode('audio-only')}
              className="w-full"
            >
              <Music className="w-3.5 h-3.5 mr-1.5" />
              Solo Audio
            </Button>
          </div>
        </div>

        {/* Video-specific settings */}
        {exportMode === 'video' && (
          <>
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
                      const isRecommended = key === 'webm';
                      return (
                        <SelectItem 
                          key={key} 
                          value={key}
                          disabled={!isSupported}
                        >
                          <div className="flex items-center gap-2">
                            <span>{config.label}</span>
                            {isRecommended && (
                              <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                                Consigliato
                              </span>
                            )}
                            {isSupported ? (
                              <CheckCircle className="w-3 h-3 text-primary" />
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

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Framerate</Label>
              <Select value={fps} onValueChange={(v) => setFps(v as ExportFps)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24">24 fps (Cinema)</SelectItem>
                  <SelectItem value="30">30 fps (Standard)</SelectItem>
                  <SelectItem value="60">60 fps (Fluido)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {/* Audio-only info */}
        {exportMode === 'audio-only' && (
          <div className="flex items-start gap-2 p-2 bg-muted/50 rounded text-xs">
            <Music className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-muted-foreground">
              Esporta solo l'audio processato con tutti gli effetti applicati (EQ, riverbero, eco, compressore) in formato WebM/Opus.
            </p>
          </div>
        )}

        {isExporting ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Esportazione {exportMode === 'audio-only' ? 'audio' : 'video'} in corso...</span>
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
            {exportMode === 'audio-only' 
              ? 'Esporta Audio (.webm)' 
              : `Esporta Video (.${FORMAT_CONFIG[format].extension})`}
          </Button>
        )}

        {/* Warning for MP4 on Chromium browsers */}
        {exportMode === 'video' && format === 'mp4' && isChromium && (
          <div className="flex items-start gap-2 p-2 bg-destructive/10 border border-destructive/30 rounded text-xs">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-destructive">
              <strong>Attenzione:</strong> L'encoding MP4 (H.264) su browser Chromium (Chrome, Brave, Edge) può causare cali di FPS. 
              Per un framerate stabile a 24fps, consigliamo <strong>WebM (VP8)</strong>.
            </p>
          </div>
        )}
        
        {exportMode === 'video' && (
          <div className="flex items-start gap-2 p-2 bg-muted/50 rounded text-xs">
            <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-muted-foreground">
              {format === 'mp4' 
                ? "MP4 offre la massima compatibilità con dispositivi e player. Richiede browser recenti (Chrome 107+, Edge 107+)."
                : "WebM (VP8) garantisce FPS stabili durante l'export. Per massima compatibilità con tutti i dispositivi, considera MP4."}
            </p>
          </div>
        )}
      </div>

      {/* Hidden elements for reference */}
      <canvas ref={canvasRef} className="hidden" />
      <video ref={videoRef} className="hidden" />
      <audio ref={audioRef} className="hidden" />
    </div>
  );
}
