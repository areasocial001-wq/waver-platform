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
import type { ClipEffect } from './ClipEffectsPanel';

// Transition types
type TransitionTypeValue = 'none' | 'fade' | 'slide-left' | 'slide-right' | 'zoom' | 'crossfade' | string;

interface VideoPreviewPlayerProps {
  clips: TimelineClip[];
  backgroundMusicUrl?: string | null;
  backgroundMusicEmotion?: string | null;
  musicVolume?: number;
  onMusicVolumeChange?: (volume: number) => void;
  clipEffects?: Record<string, ClipEffect>;
  transition?: TransitionTypeValue;
  transitionDuration?: number;
}

export function VideoPreviewPlayer({
  clips,
  backgroundMusicUrl,
  backgroundMusicEmotion,
  musicVolume = 30,
  onMusicVolumeChange,
  clipEffects = {},
  transition = 'fade',
  transitionDuration = 0.5,
}: VideoPreviewPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [clipProgress, setClipProgress] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionProgress, setTransitionProgress] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const nextVideoRef = useRef<HTMLVideoElement>(null);
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

  // Handle video ended with transition
  const handleVideoEnded = useCallback(() => {
    if (currentClipIndex < validClips.length - 1) {
      // Start transition animation
      if (transition !== 'none') {
        setIsTransitioning(true);
        setTransitionProgress(0);
        
        // Animate transition
        const duration = transitionDuration * 1000;
        const startTime = Date.now();
        const animateTransition = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          setTransitionProgress(progress);
          
          if (progress < 1) {
            requestAnimationFrame(animateTransition);
          } else {
            setIsTransitioning(false);
            setCurrentClipIndex(prev => prev + 1);
          }
        };
        requestAnimationFrame(animateTransition);
      } else {
        setCurrentClipIndex(prev => prev + 1);
      }
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
  }, [currentClipIndex, validClips.length, transition, transitionDuration]);

  // Get CSS styles for current clip effects
  const getClipEffectStyles = useCallback((clipId: string): React.CSSProperties => {
    const effect = clipEffects[clipId];
    if (!effect) return {};
    
    const filters: string[] = [];
    
    // Apply filter preset
    const filterPresets: Record<string, string> = {
      none: '',
      vintage: 'sepia(0.3) contrast(1.1) brightness(0.95)',
      cinematic: 'contrast(1.2) saturate(0.85) brightness(0.9)',
      warm: 'sepia(0.2) saturate(1.3) brightness(1.05)',
      cool: 'hue-rotate(10deg) saturate(0.9) brightness(1.05)',
      bw: 'grayscale(1)',
      sepia: 'sepia(0.8)',
      dramatic: 'contrast(1.4) brightness(0.85) saturate(1.2)',
    };
    
    if (effect.filter && effect.filter !== 'none') {
      filters.push(filterPresets[effect.filter] || '');
    }
    
    // Apply adjustments
    filters.push(`brightness(${effect.brightness / 100})`);
    filters.push(`contrast(${effect.contrast / 100})`);
    filters.push(`saturate(${effect.saturation / 100})`);
    
    return {
      filter: filters.join(' '),
      transform: `scale(${effect.zoom}) translate(${effect.panX}%, ${effect.panY}%)`,
      transition: 'filter 0.3s, transform 0.3s',
    };
  }, [clipEffects]);

  // Get transition styles
  const getTransitionStyles = useCallback((): { current: React.CSSProperties; next: React.CSSProperties } => {
    const base = { transition: `all ${transitionDuration}s ease-in-out` };
    
    if (!isTransitioning) {
      return { current: { ...base, opacity: 1 }, next: { ...base, opacity: 0 } };
    }
    
    switch (transition) {
      case 'fade':
      case 'crossfade':
        return {
          current: { ...base, opacity: 1 - transitionProgress },
          next: { ...base, opacity: transitionProgress },
        };
      case 'slide-left':
        return {
          current: { ...base, transform: `translateX(${-transitionProgress * 100}%)` },
          next: { ...base, transform: `translateX(${(1 - transitionProgress) * 100}%)` },
        };
      case 'slide-right':
        return {
          current: { ...base, transform: `translateX(${transitionProgress * 100}%)` },
          next: { ...base, transform: `translateX(${-(1 - transitionProgress) * 100}%)` },
        };
      case 'zoom':
        return {
          current: { ...base, transform: `scale(${1 + transitionProgress})`, opacity: 1 - transitionProgress },
          next: { ...base, transform: `scale(${2 - transitionProgress})`, opacity: transitionProgress },
        };
      default:
        return { current: base, next: base };
    }
  }, [isTransitioning, transition, transitionProgress, transitionDuration]);

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
        {/* Video Player with Transitions */}
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden group">
          {/* Current Video */}
          <video
            ref={videoRef}
            src={currentValidClip?.videoUrl}
            className="absolute inset-0 w-full h-full object-contain"
            style={{
              ...getClipEffectStyles(currentValidClip?.id || ''),
              ...getTransitionStyles().current,
            }}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleVideoEnded}
            muted={isMuted}
          />
          
          {/* Next Video (for transitions) */}
          {isTransitioning && validClips[currentClipIndex + 1] && (
            <video
              ref={nextVideoRef}
              src={validClips[currentClipIndex + 1]?.videoUrl}
              className="absolute inset-0 w-full h-full object-contain"
              style={{
                ...getClipEffectStyles(validClips[currentClipIndex + 1]?.id || ''),
                ...getTransitionStyles().next,
              }}
              muted={isMuted}
              autoPlay
            />
          )}
          
          {/* Transition Indicator */}
          {isTransitioning && (
            <div className="absolute bottom-2 left-2">
              <Badge variant="secondary" className="bg-primary/80 text-primary-foreground text-xs">
                Transizione...
              </Badge>
            </div>
          )}
          
          {/* Clip Expression Badge */}
          {currentValidClip?.expression && (
            <div className="absolute top-2 left-2">
              <Badge variant="secondary" className="bg-background/80">
                {currentValidClip.expression}
              </Badge>
            </div>
          )}
          
          {/* Effect Indicator */}
          {currentValidClip && clipEffects[currentValidClip.id] && (
            <div className="absolute top-2 right-2">
              <Badge variant="outline" className="bg-background/80 text-xs">
                Effetti
              </Badge>
            </div>
          )}

          {/* Play overlay on pause */}
          {!isPlaying && !isTransitioning && (
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
