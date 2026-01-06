import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Download, Play, Pause, Volume2, Clock, Layers, Plus, Trash2, GripVertical, Loader2 } from 'lucide-react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

interface AudioTrack {
  id: string;
  url: string;
  name: string;
  startTime: number;
  volume: number;
  duration?: number;
  fadeIn: number; // seconds
  fadeOut: number; // seconds
  color: string;
}

interface VideoAudioCombinerProps {
  videoUrl: string;
  videoName?: string;
  existingAudioUrl?: string;
  dialogueText?: string;
  onCombined?: (combinedUrl: string) => void;
}

type ExportFormat = 'webm' | 'mp4';

const TRACK_COLORS = [
  'hsl(var(--primary))',
  'hsl(142, 76%, 36%)',
  'hsl(38, 92%, 50%)',
  'hsl(280, 87%, 65%)',
  'hsl(199, 89%, 48%)',
  'hsl(0, 84%, 60%)',
];

export const VideoAudioCombiner: React.FC<VideoAudioCombinerProps> = ({
  videoUrl,
  videoName = 'video',
  existingAudioUrl,
  dialogueText,
  onCombined
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('mp4');
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [ffmpegLoading, setFfmpegLoading] = useState(false);
  
  // Drag state for timeline
  const [draggingTrack, setDraggingTrack] = useState<string | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartTime, setDragStartTime] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const ffmpegRef = useRef<FFmpeg | null>(null);

  // Load FFmpeg on demand
  const loadFFmpeg = useCallback(async () => {
    if (ffmpegRef.current || ffmpegLoading) return;
    
    setFfmpegLoading(true);
    try {
      const ffmpeg = new FFmpeg();
      
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
      
      ffmpeg.on('progress', ({ progress: p }) => {
        setProgress(Math.round(p * 100));
      });
      
      ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpeg]', message);
      });
      
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      
      ffmpegRef.current = ffmpeg;
      setFfmpegLoaded(true);
      toast.success('FFmpeg caricato con successo');
    } catch (error) {
      console.error('Error loading FFmpeg:', error);
      toast.error('Errore nel caricamento di FFmpeg');
    } finally {
      setFfmpegLoading(false);
    }
  }, [ffmpegLoading]);

  // Initialize with existing audio if available
  useEffect(() => {
    if (existingAudioUrl && isOpen) {
      const existingTrack: AudioTrack = {
        id: 'existing-voiceover',
        url: existingAudioUrl,
        name: 'Voiceover',
        startTime: 0,
        volume: 1,
        fadeIn: 0,
        fadeOut: 0,
        color: TRACK_COLORS[0]
      };
      setAudioTracks(prev => {
        if (prev.find(t => t.id === 'existing-voiceover')) return prev;
        return [existingTrack, ...prev];
      });
    }
  }, [existingAudioUrl, isOpen]);

  // Update audio elements when tracks change
  useEffect(() => {
    audioTracks.forEach(track => {
      if (!audioRefs.current.has(track.id)) {
        const audio = new Audio(track.url);
        audio.volume = track.volume;
        audio.addEventListener('loadedmetadata', () => {
          setAudioTracks(prev => prev.map(t => 
            t.id === track.id ? { ...t, duration: audio.duration } : t
          ));
        });
        audioRefs.current.set(track.id, audio);
      } else {
        const audio = audioRefs.current.get(track.id);
        if (audio) audio.volume = track.volume;
      }
    });

    // Clean up removed tracks
    audioRefs.current.forEach((audio, id) => {
      if (!audioTracks.find(t => t.id === id)) {
        audio.pause();
        audioRefs.current.delete(id);
      }
    });
  }, [audioTracks]);

  const handleVideoLoad = () => {
    if (videoRef.current) {
      setVideoDuration(videoRef.current.duration);
    }
  };

  // Apply fade effects during playback
  const applyFadeEffects = (track: AudioTrack, audio: HTMLAudioElement, videoTime: number) => {
    const audioLocalTime = videoTime - track.startTime;
    const trackDuration = track.duration || 0;
    
    let volumeMultiplier = 1;
    
    // Fade in
    if (track.fadeIn > 0 && audioLocalTime < track.fadeIn) {
      volumeMultiplier = audioLocalTime / track.fadeIn;
    }
    
    // Fade out
    const fadeOutStart = trackDuration - track.fadeOut;
    if (track.fadeOut > 0 && audioLocalTime > fadeOutStart) {
      volumeMultiplier = (trackDuration - audioLocalTime) / track.fadeOut;
    }
    
    audio.volume = Math.max(0, Math.min(1, track.volume * volumeMultiplier));
  };

  const syncAudioWithVideo = () => {
    if (!videoRef.current) return;
    
    const videoTime = videoRef.current.currentTime;
    setCurrentTime(videoTime);

    audioTracks.forEach(track => {
      const audio = audioRefs.current.get(track.id);
      if (!audio) return;

      const audioStartTime = track.startTime;
      const audioEndTime = audioStartTime + (track.duration || 0);

      if (videoTime >= audioStartTime && videoTime < audioEndTime) {
        const audioTime = videoTime - audioStartTime;
        if (Math.abs(audio.currentTime - audioTime) > 0.3) {
          audio.currentTime = audioTime;
        }
        
        // Apply fade effects
        applyFadeEffects(track, audio, videoTime);
        
        if (audio.paused && isPlaying) {
          audio.play().catch(() => {});
        }
      } else {
        if (!audio.paused) {
          audio.pause();
        }
      }
    });

    if (isPlaying) {
      animationRef.current = requestAnimationFrame(syncAudioWithVideo);
    }
  };

  const togglePlayback = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      audioRefs.current.forEach(audio => audio.pause());
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    } else {
      videoRef.current.play();
      animationRef.current = requestAnimationFrame(syncAudioWithVideo);
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (value: number[]) => {
    const time = value[0];
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
      
      audioTracks.forEach(track => {
        const audio = audioRefs.current.get(track.id);
        if (!audio) return;
        
        const audioTime = time - track.startTime;
        if (audioTime >= 0 && audioTime < (track.duration || 0)) {
          audio.currentTime = audioTime;
        }
      });
    }
  };

  const addAudioTrack = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const url = URL.createObjectURL(file);
        const colorIndex = audioTracks.length % TRACK_COLORS.length;
        const newTrack: AudioTrack = {
          id: `track-${Date.now()}`,
          url,
          name: file.name,
          startTime: 0,
          volume: 1,
          fadeIn: 0,
          fadeOut: 0,
          color: TRACK_COLORS[colorIndex]
        };
        setAudioTracks(prev => [...prev, newTrack]);
      }
    };
    input.click();
  };

  const updateTrack = (trackId: string, updates: Partial<AudioTrack>) => {
    setAudioTracks(prev => prev.map(t => 
      t.id === trackId ? { ...t, ...updates } : t
    ));
  };

  const removeTrack = (trackId: string) => {
    const audio = audioRefs.current.get(trackId);
    if (audio) {
      audio.pause();
      URL.revokeObjectURL(audio.src);
      audioRefs.current.delete(trackId);
    }
    setAudioTracks(prev => prev.filter(t => t.id !== trackId));
  };

  // Timeline drag handlers
  const handleTimelineDragStart = (e: React.MouseEvent, trackId: string) => {
    const track = audioTracks.find(t => t.id === trackId);
    if (!track || !timelineRef.current) return;
    
    e.preventDefault();
    setDraggingTrack(trackId);
    setDragStartX(e.clientX);
    setDragStartTime(track.startTime);
  };

  const handleTimelineDragMove = useCallback((e: MouseEvent) => {
    if (!draggingTrack || !timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const deltaX = e.clientX - dragStartX;
    const deltaSec = (deltaX / rect.width) * videoDuration;
    
    const newStartTime = Math.max(0, Math.min(
      videoDuration - (audioTracks.find(t => t.id === draggingTrack)?.duration || 0),
      dragStartTime + deltaSec
    ));
    
    updateTrack(draggingTrack, { startTime: newStartTime });
  }, [draggingTrack, dragStartX, dragStartTime, videoDuration, audioTracks]);

  const handleTimelineDragEnd = useCallback(() => {
    setDraggingTrack(null);
  }, []);

  useEffect(() => {
    if (draggingTrack) {
      window.addEventListener('mousemove', handleTimelineDragMove);
      window.addEventListener('mouseup', handleTimelineDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleTimelineDragMove);
        window.removeEventListener('mouseup', handleTimelineDragEnd);
      };
    }
  }, [draggingTrack, handleTimelineDragMove, handleTimelineDragEnd]);

  // Combine using FFmpeg for MP4 export
  const combineWithFFmpeg = async () => {
    if (!ffmpegRef.current) {
      await loadFFmpeg();
      if (!ffmpegRef.current) return;
    }

    const ffmpeg = ffmpegRef.current;
    setProgress(0);
    setProgressMessage('Preparazione file...');

    try {
      // Fetch and write video file
      const videoData = await fetchFile(videoUrl);
      await ffmpeg.writeFile('input.mp4', videoData);
      setProgress(10);
      setProgressMessage('Video caricato...');

      // Process each audio track
      const audioInputs: string[] = [];
      for (let i = 0; i < audioTracks.length; i++) {
        const track = audioTracks[i];
        setProgressMessage(`Caricamento audio ${i + 1}/${audioTracks.length}...`);
        
        const audioData = await fetchFile(track.url);
        const audioFileName = `audio${i}.mp3`;
        await ffmpeg.writeFile(audioFileName, audioData);
        audioInputs.push(audioFileName);
      }
      
      setProgress(30);

      // Build complex filter for audio mixing with fades
      let filterComplex = '';
      let audioMixInputs = '';
      
      for (let i = 0; i < audioTracks.length; i++) {
        const track = audioTracks[i];
        const inputIdx = i + 1; // 0 is video
        
        // Apply delay, volume, and fades
        let audioFilter = `[${inputIdx}:a]`;
        
        // Delay to start at the right time
        if (track.startTime > 0) {
          audioFilter += `adelay=${Math.round(track.startTime * 1000)}|${Math.round(track.startTime * 1000)},`;
        }
        
        // Volume adjustment
        audioFilter += `volume=${track.volume}`;
        
        // Fade in
        if (track.fadeIn > 0) {
          audioFilter += `,afade=t=in:st=0:d=${track.fadeIn}`;
        }
        
        // Fade out
        if (track.fadeOut > 0 && track.duration) {
          const fadeOutStart = track.duration - track.fadeOut;
          audioFilter += `,afade=t=out:st=${fadeOutStart}:d=${track.fadeOut}`;
        }
        
        audioFilter += `[a${i}];`;
        filterComplex += audioFilter;
        audioMixInputs += `[a${i}]`;
      }
      
      // Mix all audio streams
      if (audioTracks.length > 0) {
        filterComplex += `${audioMixInputs}amix=inputs=${audioTracks.length}:duration=longest:dropout_transition=0[aout]`;
      }

      setProgress(40);
      setProgressMessage('Encoding video...');

      // Build FFmpeg command
      const inputArgs: string[] = ['-i', 'input.mp4'];
      for (const audioFile of audioInputs) {
        inputArgs.push('-i', audioFile);
      }

      const outputArgs: string[] = [];
      
      if (audioTracks.length > 0) {
        outputArgs.push(
          '-filter_complex', filterComplex,
          '-map', '0:v',
          '-map', '[aout]'
        );
      } else {
        outputArgs.push('-c', 'copy');
      }

      if (exportFormat === 'mp4') {
        outputArgs.push(
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '23',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-movflags', '+faststart'
        );
      } else {
        outputArgs.push(
          '-c:v', 'libvpx-vp9',
          '-crf', '30',
          '-b:v', '0',
          '-c:a', 'libopus'
        );
      }

      const outputFile = `output.${exportFormat}`;
      outputArgs.push(outputFile);

      await ffmpeg.exec([...inputArgs, ...outputArgs]);

      setProgress(90);
      setProgressMessage('Finalizzazione...');

      // Read output file
      const data = await ffmpeg.readFile(outputFile);
      const uint8Array = data instanceof Uint8Array ? data : new TextEncoder().encode(data as string);
      const arrayBuffer = new ArrayBuffer(uint8Array.byteLength);
      new Uint8Array(arrayBuffer).set(uint8Array);
      const blob = new Blob([arrayBuffer], { type: exportFormat === 'mp4' ? 'video/mp4' : 'video/webm' });
      const url = URL.createObjectURL(blob);

      // Download
      const a = document.createElement('a');
      a.href = url;
      a.download = `${videoName}_combined.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Cleanup FFmpeg files
      await ffmpeg.deleteFile('input.mp4');
      for (const audioFile of audioInputs) {
        await ffmpeg.deleteFile(audioFile);
      }
      await ffmpeg.deleteFile(outputFile);

      setProgress(100);
      toast.success(`Video esportato in ${exportFormat.toUpperCase()}!`);
      
      if (onCombined) {
        onCombined(url);
      }

      setTimeout(() => URL.revokeObjectURL(url), 60000);

    } catch (error) {
      console.error('FFmpeg error:', error);
      toast.error('Errore durante l\'esportazione: ' + (error as Error).message);
    }
  };

  // Combine using WebCodecs for WebM (fallback)
  const combineWithWebCodecs = async () => {
    if (!videoRef.current || !canvasRef.current) {
      toast.error('Elementi video non pronti');
      return;
    }

    setProgress(0);
    setProgressMessage('Preparazione...');

    try {
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();

      // Load and process audio tracks with fades
      const audioBuffers: { buffer: AudioBuffer; track: AudioTrack }[] = [];
      
      for (const track of audioTracks) {
        try {
          const response = await fetch(track.url);
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          audioBuffers.push({ buffer: audioBuffer, track });
        } catch (err) {
          console.warn(`Failed to load audio track ${track.name}:`, err);
        }
      }

      // Create offline context for rendering with fades
      const offlineContext = new OfflineAudioContext(
        2,
        Math.ceil(videoDuration * audioContext.sampleRate),
        audioContext.sampleRate
      );

      // Schedule all audio buffers with fade effects
      audioBuffers.forEach(({ buffer, track }) => {
        const source = offlineContext.createBufferSource();
        source.buffer = buffer;
        
        const gainNode = offlineContext.createGain();
        const startTime = track.startTime;
        const duration = track.duration || buffer.duration;
        
        // Set initial gain
        gainNode.gain.setValueAtTime(0, startTime);
        
        // Fade in
        if (track.fadeIn > 0) {
          gainNode.gain.linearRampToValueAtTime(track.volume, startTime + track.fadeIn);
        } else {
          gainNode.gain.setValueAtTime(track.volume, startTime);
        }
        
        // Hold volume
        const fadeOutStart = startTime + duration - track.fadeOut;
        gainNode.gain.setValueAtTime(track.volume, fadeOutStart);
        
        // Fade out
        if (track.fadeOut > 0) {
          gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
        }
        
        source.connect(gainNode);
        gainNode.connect(offlineContext.destination);
        source.start(startTime);
      });

      setProgress(20);
      setProgressMessage('Rendering audio...');

      const renderedBuffer = await offlineContext.startRendering();
      
      setProgress(40);
      setProgressMessage('Preparazione video...');

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) throw new Error('Canvas context not available');

      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;

      const videoStream = canvas.captureStream(30);
      
      const audioSource = audioContext.createBufferSource();
      audioSource.buffer = renderedBuffer;
      audioSource.connect(destination);
      
      const combinedStream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...destination.stream.getAudioTracks()
      ]);

      const mimeType = 'video/webm;codecs=vp9,opus';
      const mediaRecorder = new MediaRecorder(combinedStream, { 
        mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : 'video/webm',
        videoBitsPerSecond: 5000000
      });

      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${videoName}_combined.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setProgress(100);
        toast.success('Video e audio combinati con successo!');
        
        if (onCombined) onCombined(url);
        
        audioContext.close();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      };

      mediaRecorder.start();
      audioSource.start();
      video.currentTime = 0;
      await video.play();

      setProgress(60);
      setProgressMessage('Recording...');

      const captureFrame = () => {
        if (video.ended || video.paused) {
          mediaRecorder.stop();
          audioSource.stop();
          return;
        }
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const progressValue = 60 + (video.currentTime / videoDuration) * 40;
        setProgress(Math.min(progressValue, 99));
        
        requestAnimationFrame(captureFrame);
      };

      captureFrame();

    } catch (error) {
      console.error('Error combining video and audio:', error);
      toast.error('Errore durante la combinazione: ' + (error as Error).message);
    }
  };

  const handleExport = async () => {
    setIsProcessing(true);
    setProgress(0);
    
    try {
      if (exportFormat === 'mp4') {
        await combineWithFFmpeg();
      } else {
        await combineWithWebCodecs();
      }
    } finally {
      setIsProcessing(false);
      setProgressMessage('');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
  };

  // Generate timeline markers
  const timelineMarkers = [];
  const markerInterval = videoDuration > 60 ? 10 : videoDuration > 30 ? 5 : 2;
  for (let i = 0; i <= videoDuration; i += markerInterval) {
    timelineMarkers.push(i);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Layers className="h-4 w-4" />
          Combina Audio
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Editor Video e Audio
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Video Preview */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="w-full h-full object-contain"
                  onLoadedMetadata={handleVideoLoad}
                  onEnded={() => setIsPlaying(false)}
                  onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
                  crossOrigin="anonymous"
                />
                <canvas ref={canvasRef} className="hidden" />
              </div>
              
              {/* Playback Controls */}
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={togglePlayback}
                  disabled={isProcessing}
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <span className="text-sm font-mono text-muted-foreground min-w-[100px]">
                  {formatTime(currentTime)} / {formatTime(videoDuration)}
                </span>
                <Slider
                  value={[currentTime]}
                  max={videoDuration}
                  step={0.1}
                  onValueChange={handleSeek}
                  disabled={isProcessing}
                  className="flex-1"
                />
              </div>
            </CardContent>
          </Card>

          {/* Visual Timeline */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Timeline</CardTitle>
                <Button variant="outline" size="sm" onClick={addAudioTrack} disabled={isProcessing}>
                  <Plus className="h-4 w-4 mr-2" />
                  Aggiungi Audio
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* Time markers */}
              <div className="relative h-6 border-b border-border">
                {timelineMarkers.map((time) => (
                  <div
                    key={time}
                    className="absolute top-0 h-full flex flex-col items-center"
                    style={{ left: `${(time / videoDuration) * 100}%` }}
                  >
                    <div className="w-px h-2 bg-border" />
                    <span className="text-[10px] text-muted-foreground">{formatTime(time)}</span>
                  </div>
                ))}
                {/* Playhead */}
                <div
                  className="absolute top-0 w-0.5 h-full bg-primary z-10"
                  style={{ left: `${(currentTime / videoDuration) * 100}%` }}
                />
              </div>

              {/* Audio tracks timeline */}
              <div ref={timelineRef} className="space-y-1 min-h-[80px]">
                {audioTracks.length === 0 ? (
                  <div className="flex items-center justify-center h-20 text-muted-foreground text-sm border-2 border-dashed border-border rounded-lg">
                    <Volume2 className="h-5 w-5 mr-2 opacity-50" />
                    Trascina qui le tracce audio
                  </div>
                ) : (
                  audioTracks.map((track, index) => (
                    <div key={track.id} className="relative h-12 bg-muted/30 rounded">
                      {/* Track block */}
                      <div
                        className={`absolute h-full rounded cursor-grab active:cursor-grabbing transition-opacity ${
                          draggingTrack === track.id ? 'opacity-70' : ''
                        }`}
                        style={{
                          left: `${(track.startTime / videoDuration) * 100}%`,
                          width: `${((track.duration || 1) / videoDuration) * 100}%`,
                          backgroundColor: track.color,
                          minWidth: '20px'
                        }}
                        onMouseDown={(e) => handleTimelineDragStart(e, track.id)}
                      >
                        {/* Fade in indicator */}
                        {track.fadeIn > 0 && (
                          <div
                            className="absolute left-0 top-0 h-full bg-gradient-to-r from-black/50 to-transparent pointer-events-none"
                            style={{ width: `${(track.fadeIn / (track.duration || 1)) * 100}%` }}
                          />
                        )}
                        
                        {/* Fade out indicator */}
                        {track.fadeOut > 0 && (
                          <div
                            className="absolute right-0 top-0 h-full bg-gradient-to-l from-black/50 to-transparent pointer-events-none"
                            style={{ width: `${(track.fadeOut / (track.duration || 1)) * 100}%` }}
                          />
                        )}
                        
                        <div className="flex items-center gap-1 h-full px-2 overflow-hidden">
                          <GripVertical className="h-3 w-3 shrink-0 opacity-60" />
                          <span className="text-xs font-medium truncate text-white drop-shadow">
                            {track.name}
                          </span>
                        </div>
                      </div>
                      
                      {/* Playhead on track */}
                      <div
                        className="absolute top-0 w-0.5 h-full bg-primary/50 pointer-events-none"
                        style={{ left: `${(currentTime / videoDuration) * 100}%` }}
                      />
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Track Settings */}
          {audioTracks.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Impostazioni Tracce</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {audioTracks.map((track, index) => (
                  <div key={track.id} className="p-3 bg-muted/30 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: track.color }}
                        />
                        <span className="font-medium text-sm truncate max-w-[200px]">
                          {track.name}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeTrack(track.id)}
                        disabled={isProcessing}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {/* Start Time */}
                      <div className="space-y-1">
                        <Label className="text-xs flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Inizio: {track.startTime.toFixed(1)}s
                        </Label>
                        <Slider
                          value={[track.startTime]}
                          max={videoDuration}
                          step={0.1}
                          onValueChange={(v) => updateTrack(track.id, { startTime: v[0] })}
                          disabled={isProcessing}
                        />
                      </div>
                      
                      {/* Volume */}
                      <div className="space-y-1">
                        <Label className="text-xs flex items-center gap-1">
                          <Volume2 className="h-3 w-3" />
                          Volume: {Math.round(track.volume * 100)}%
                        </Label>
                        <Slider
                          value={[track.volume]}
                          max={1}
                          step={0.05}
                          onValueChange={(v) => updateTrack(track.id, { volume: v[0] })}
                          disabled={isProcessing}
                        />
                      </div>
                      
                      {/* Fade In */}
                      <div className="space-y-1">
                        <Label className="text-xs">Fade In: {track.fadeIn.toFixed(1)}s</Label>
                        <Slider
                          value={[track.fadeIn]}
                          max={Math.min(5, (track.duration || 5) / 2)}
                          step={0.1}
                          onValueChange={(v) => updateTrack(track.id, { fadeIn: v[0] })}
                          disabled={isProcessing}
                        />
                      </div>
                      
                      {/* Fade Out */}
                      <div className="space-y-1">
                        <Label className="text-xs">Fade Out: {track.fadeOut.toFixed(1)}s</Label>
                        <Slider
                          value={[track.fadeOut]}
                          max={Math.min(5, (track.duration || 5) / 2)}
                          step={0.1}
                          onValueChange={(v) => updateTrack(track.id, { fadeOut: v[0] })}
                          disabled={isProcessing}
                        />
                      </div>
                    </div>
                    
                    {track.duration && (
                      <div className="text-xs text-muted-foreground">
                        Durata: {formatTime(track.duration)} • 
                        Fine: {formatTime(track.startTime + track.duration)}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Export Settings */}
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Formato</Label>
                    <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as ExportFormat)}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mp4">MP4 (H.264)</SelectItem>
                        <SelectItem value="webm">WebM (VP9)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {exportFormat === 'mp4' && !ffmpegLoaded && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={loadFFmpeg}
                      disabled={ffmpegLoading}
                    >
                      {ffmpegLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Caricamento FFmpeg...
                        </>
                      ) : (
                        'Carica FFmpeg'
                      )}
                    </Button>
                  )}
                  
                  {exportFormat === 'mp4' && ffmpegLoaded && (
                    <span className="text-xs text-green-500">✓ FFmpeg pronto</span>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isProcessing}>
                    Annulla
                  </Button>
                  <Button 
                    onClick={handleExport} 
                    disabled={isProcessing || audioTracks.length === 0 || (exportFormat === 'mp4' && !ffmpegLoaded && !ffmpegLoading)}
                    className="gap-2"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Elaborazione...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        Esporta {exportFormat.toUpperCase()}
                      </>
                    )}
                  </Button>
                </div>
              </div>
              
              {isProcessing && (
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{progressMessage || 'Elaborazione in corso...'}</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VideoAudioCombiner;
