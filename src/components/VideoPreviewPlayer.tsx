import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack,
  Volume2,
  VolumeX,
  Maximize,
  RotateCcw,
  Music
} from 'lucide-react';
import type { TimelineClip } from './TalkingAvatarTimeline';

interface VideoPreviewPlayerProps {
  clips: TimelineClip[];
  backgroundMusicUrl?: string | null;
  backgroundMusicEmotion?: string | null;
  musicVolume?: number;
  onMusicVolumeChange?: (volume: number) => void;
}

export function VideoPreviewPlayer({
  clips,
  backgroundMusicUrl,
  backgroundMusicEmotion,
  musicVolume = 30,
  onMusicVolumeChange,
}: VideoPreviewPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [clipProgress, setClipProgress] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const musicRef = useRef<HTMLAudioElement>(null);

  // Calculate total duration
  useEffect(() => {
    const duration = clips.reduce((sum, clip) => sum + clip.duration, 0);
    setTotalDuration(duration);
  }, [clips]);

  // Sorted clips
  const sortedClips = [...clips].sort((a, b) => a.order - b.order);
  const currentClip = sortedClips[currentClipIndex];
  const validClips = sortedClips.filter(c => c.videoUrl);

  // Get current clip for playback
  const currentValidClip = validClips[currentClipIndex];

  // Calculate elapsed time
  const calculateElapsedTime = useCallback(() => {
    let elapsed = 0;
    for (let i = 0; i < currentClipIndex; i++) {
      elapsed += sortedClips[i]?.duration || 0;
    }
    elapsed += clipProgress * (currentClip?.duration || 0);
    return elapsed;
  }, [currentClipIndex, clipProgress, sortedClips, currentClip]);

  // Handle video time update
  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current || !currentClip) return;
    const progress = videoRef.current.currentTime / videoRef.current.duration;
    setClipProgress(progress);
    setCurrentTime(calculateElapsedTime());
  }, [calculateElapsedTime, currentClip]);

  // Handle video ended
  const handleVideoEnded = useCallback(() => {
    if (currentClipIndex < validClips.length - 1) {
      setCurrentClipIndex(prev => prev + 1);
    } else {
      // End of playlist
      setIsPlaying(false);
      setCurrentClipIndex(0);
      setClipProgress(0);
      if (musicRef.current) {
        musicRef.current.pause();
        musicRef.current.currentTime = 0;
      }
    }
  }, [currentClipIndex, validClips.length]);

  // Play/Pause toggle
  const togglePlayPause = useCallback(() => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
      musicRef.current?.pause();
    } else {
      videoRef.current.play().catch(console.error);
      if (backgroundMusicUrl && musicRef.current) {
        musicRef.current.play().catch(console.error);
      }
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, backgroundMusicUrl]);

  // Skip to next clip
  const skipNext = useCallback(() => {
    if (currentClipIndex < validClips.length - 1) {
      setCurrentClipIndex(prev => prev + 1);
      setClipProgress(0);
    }
  }, [currentClipIndex, validClips.length]);

  // Skip to previous clip
  const skipPrev = useCallback(() => {
    if (currentClipIndex > 0) {
      setCurrentClipIndex(prev => prev - 1);
      setClipProgress(0);
    } else if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  }, [currentClipIndex]);

  // Reset playback
  const resetPlayback = useCallback(() => {
    setIsPlaying(false);
    setCurrentClipIndex(0);
    setClipProgress(0);
    setCurrentTime(0);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    if (musicRef.current) {
      musicRef.current.pause();
      musicRef.current.currentTime = 0;
    }
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    setIsMuted(!isMuted);
    if (videoRef.current) videoRef.current.muted = !isMuted;
    if (musicRef.current) musicRef.current.muted = !isMuted;
  }, [isMuted]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen();
      }
    }
  }, []);

  // Update music volume
  useEffect(() => {
    if (musicRef.current) {
      musicRef.current.volume = musicVolume / 100;
    }
  }, [musicVolume]);

  // Auto-play when clip changes
  useEffect(() => {
    if (isPlaying && videoRef.current) {
      videoRef.current.play().catch(console.error);
    }
  }, [currentClipIndex, isPlaying]);

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Progress percentage
  const progressPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  if (validClips.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="w-5 h-5" />
            Anteprima Video
          </CardTitle>
          <CardDescription>
            Genera video e aggiungili alla timeline per vedere l'anteprima
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
            <p className="text-muted-foreground">Nessun video disponibile</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Play className="w-5 h-5" />
              Anteprima Video
            </CardTitle>
            <CardDescription>
              Scena {currentClipIndex + 1} di {validClips.length}
            </CardDescription>
          </div>
          {backgroundMusicUrl && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Music className="w-3 h-3" />
              {backgroundMusicEmotion}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Video Player */}
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden group">
          <video
            ref={videoRef}
            src={currentValidClip?.videoUrl}
            className="w-full h-full object-contain"
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleVideoEnded}
            muted={isMuted}
          />
          
          {/* Clip Expression Badge */}
          {currentValidClip?.expression && (
            <div className="absolute top-2 left-2">
              <Badge variant="secondary" className="bg-background/80">
                {currentValidClip.expression}
              </Badge>
            </div>
          )}

          {/* Play overlay on pause */}
          {!isPlaying && (
            <div 
              className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
              onClick={togglePlayPause}
            >
              <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center">
                <Play className="w-8 h-8 text-primary-foreground ml-1" />
              </div>
            </div>
          )}
        </div>

        {/* Background Music Audio */}
        {backgroundMusicUrl && (
          <audio 
            ref={musicRef} 
            src={backgroundMusicUrl} 
            loop 
            preload="auto"
          />
        )}

        {/* Progress Bar */}
        <div className="space-y-1">
          <Progress value={progressPercent} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(totalDuration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={resetPlayback}>
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={skipPrev} disabled={currentClipIndex === 0}>
              <SkipBack className="w-4 h-4" />
            </Button>
            <Button 
              variant="default" 
              size="icon" 
              className="w-10 h-10"
              onClick={togglePlayPause}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={skipNext} 
              disabled={currentClipIndex >= validClips.length - 1}
            >
              <SkipForward className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center gap-3">
            {/* Volume Control */}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={toggleMute}>
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>
            </div>

            {/* Music Volume (if available) */}
            {backgroundMusicUrl && onMusicVolumeChange && (
              <div className="flex items-center gap-2 px-2 py-1 bg-muted/50 rounded-lg">
                <Music className="w-3 h-3 text-muted-foreground" />
                <Slider
                  value={[musicVolume]}
                  onValueChange={([v]) => onMusicVolumeChange(v)}
                  min={0}
                  max={100}
                  step={5}
                  className="w-20"
                />
                <span className="text-xs w-6">{musicVolume}%</span>
              </div>
            )}

            <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
              <Maximize className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Clip Thumbnails */}
        <div className="flex gap-1 overflow-x-auto pb-2">
          {validClips.map((clip, index) => (
            <button
              key={clip.id}
              onClick={() => {
                setCurrentClipIndex(index);
                setClipProgress(0);
              }}
              className={`flex-shrink-0 w-16 h-10 rounded overflow-hidden border-2 transition-all ${
                index === currentClipIndex 
                  ? 'border-primary ring-2 ring-primary/30' 
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <video 
                src={clip.videoUrl} 
                className="w-full h-full object-cover"
                muted
              />
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default VideoPreviewPlayer;
