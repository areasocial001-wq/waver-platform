import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Download, Play, Pause, Volume2, Clock, Layers, Plus, Trash2, Move } from 'lucide-react';

interface AudioTrack {
  id: string;
  url: string;
  name: string;
  startTime: number; // in seconds
  volume: number; // 0-1
  duration?: number;
}

interface VideoAudioCombinerProps {
  videoUrl: string;
  videoName?: string;
  existingAudioUrl?: string;
  dialogueText?: string;
  onCombined?: (combinedUrl: string) => void;
}

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
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  // Initialize with existing audio if available
  useEffect(() => {
    if (existingAudioUrl && isOpen) {
      const existingTrack: AudioTrack = {
        id: 'existing-voiceover',
        url: existingAudioUrl,
        name: 'Voiceover',
        startTime: 0,
        volume: 1
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
      
      // Sync all audio tracks
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
        const newTrack: AudioTrack = {
          id: `track-${Date.now()}`,
          url,
          name: file.name,
          startTime: 0,
          volume: 1
        };
        setAudioTracks(prev => [...prev, newTrack]);
      }
    };
    input.click();
  };

  const updateTrackStartTime = (trackId: string, startTime: number) => {
    setAudioTracks(prev => prev.map(t => 
      t.id === trackId ? { ...t, startTime: Math.max(0, Math.min(startTime, videoDuration)) } : t
    ));
  };

  const updateTrackVolume = (trackId: string, volume: number) => {
    setAudioTracks(prev => prev.map(t => 
      t.id === trackId ? { ...t, volume } : t
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

  const combineVideoAndAudio = async () => {
    if (!videoRef.current || !canvasRef.current) {
      toast.error('Elementi video non pronti');
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      // Create audio context for mixing
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();

      // Load and connect all audio tracks
      const audioBuffers: { buffer: AudioBuffer; startTime: number; volume: number }[] = [];
      
      for (const track of audioTracks) {
        try {
          const response = await fetch(track.url);
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          audioBuffers.push({
            buffer: audioBuffer,
            startTime: track.startTime,
            volume: track.volume
          });
        } catch (err) {
          console.warn(`Failed to load audio track ${track.name}:`, err);
        }
      }

      // Create offline context for rendering
      const offlineContext = new OfflineAudioContext(
        2,
        Math.ceil(videoDuration * audioContext.sampleRate),
        audioContext.sampleRate
      );

      // Schedule all audio buffers
      audioBuffers.forEach(({ buffer, startTime, volume }) => {
        const source = offlineContext.createBufferSource();
        source.buffer = buffer;
        
        const gainNode = offlineContext.createGain();
        gainNode.gain.value = volume;
        
        source.connect(gainNode);
        gainNode.connect(offlineContext.destination);
        
        source.start(startTime);
      });

      setProgress(20);

      // Render mixed audio
      const renderedBuffer = await offlineContext.startRendering();
      
      setProgress(40);

      // Convert to WAV
      const wavBlob = audioBufferToWav(renderedBuffer);
      
      setProgress(60);

      // Create video capture
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) throw new Error('Canvas context not available');

      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;

      // Create MediaRecorder with video and audio
      const videoStream = canvas.captureStream(30);
      
      // Add audio to the stream
      const audioSource = audioContext.createBufferSource();
      audioSource.buffer = renderedBuffer;
      audioSource.connect(destination);
      
      const combinedStream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...destination.stream.getAudioTracks()
      ]);

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') 
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm';

      const mediaRecorder = new MediaRecorder(combinedStream, { 
        mimeType,
        videoBitsPerSecond: 5000000
      });

      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        // Download the file
        const a = document.createElement('a');
        a.href = url;
        a.download = `${videoName}_combined.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setIsProcessing(false);
        setProgress(100);
        
        toast.success('Video e audio combinati con successo!');
        
        if (onCombined) {
          onCombined(url);
        }
        
        // Cleanup
        audioContext.close();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      };

      // Start recording
      mediaRecorder.start();
      audioSource.start();
      video.currentTime = 0;
      await video.play();

      setProgress(70);

      // Capture frames
      const captureFrame = () => {
        if (video.ended || video.paused) {
          mediaRecorder.stop();
          audioSource.stop();
          return;
        }
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const progressValue = 70 + (video.currentTime / videoDuration) * 30;
        setProgress(Math.min(progressValue, 99));
        
        requestAnimationFrame(captureFrame);
      };

      captureFrame();

    } catch (error) {
      console.error('Error combining video and audio:', error);
      toast.error('Errore durante la combinazione: ' + (error as Error).message);
      setIsProcessing(false);
    }
  };

  // Helper function to convert AudioBuffer to WAV
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
    
    // RIFF header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(view, 8, 'WAVE');
    
    // fmt chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    
    // data chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);
    
    // Interleave channels
    const channels = [];
    for (let i = 0; i < numChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }
    
    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const sample = Math.max(-1, Math.min(1, channels[ch][i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  };

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Layers className="h-4 w-4" />
          Combina Audio
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Combina Video e Audio
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Video Preview */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Anteprima</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
              <div className="space-y-2">
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={togglePlayback}
                    disabled={isProcessing}
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {formatTime(currentTime)} / {formatTime(videoDuration)}
                  </span>
                </div>
                
                <Slider
                  value={[currentTime]}
                  max={videoDuration}
                  step={0.1}
                  onValueChange={handleSeek}
                  disabled={isProcessing}
                />
              </div>
            </CardContent>
          </Card>

          {/* Audio Tracks */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Tracce Audio</CardTitle>
                <Button variant="outline" size="sm" onClick={addAudioTrack} disabled={isProcessing}>
                  <Plus className="h-4 w-4 mr-2" />
                  Aggiungi Audio
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {audioTracks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Volume2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nessuna traccia audio</p>
                  <p className="text-sm">Aggiungi tracce audio per combinarle con il video</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {audioTracks.map((track, index) => (
                    <div
                      key={track.id}
                      className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Move className="h-4 w-4" />
                        <span className="text-sm font-medium">#{index + 1}</span>
                      </div>
                      
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm truncate max-w-[200px]">
                            {track.name}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeTrack(track.id)}
                            disabled={isProcessing}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Inizio (sec): {track.startTime.toFixed(1)}
                            </Label>
                            <Slider
                              value={[track.startTime]}
                              max={videoDuration}
                              step={0.1}
                              onValueChange={(v) => updateTrackStartTime(track.id, v[0])}
                              disabled={isProcessing}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label className="text-xs flex items-center gap-1">
                              <Volume2 className="h-3 w-3" />
                              Volume: {Math.round(track.volume * 100)}%
                            </Label>
                            <Slider
                              value={[track.volume]}
                              max={1}
                              step={0.05}
                              onValueChange={(v) => updateTrackVolume(track.id, v[0])}
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
                        
                        {/* Timeline visualization */}
                        <div className="h-4 bg-muted rounded relative overflow-hidden">
                          <div
                            className="absolute h-full bg-primary/30 rounded"
                            style={{
                              left: `${(track.startTime / videoDuration) * 100}%`,
                              width: `${((track.duration || 0) / videoDuration) * 100}%`
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Processing Progress */}
          {isProcessing && (
            <Card>
              <CardContent className="py-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Elaborazione in corso...</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isProcessing}>
              Annulla
            </Button>
            <Button 
              onClick={combineVideoAndAudio} 
              disabled={isProcessing || audioTracks.length === 0}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              {isProcessing ? 'Elaborazione...' : 'Combina e Scarica'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VideoAudioCombiner;
