import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Upload, 
  AudioLines, 
  Play, 
  Pause, 
  Trash2, 
  Volume2, 
  Clock,
  FileAudio,
  Link,
  Mic,
  Music
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExternalAudioUploaderProps {
  audioUrl: string | null;
  onAudioChange: (url: string | null) => void;
  onAudioDuration?: (duration: number) => void;
  disabled?: boolean;
  className?: string;
  maxFileSizeMB?: number;
  acceptedFormats?: string[];
}

export function ExternalAudioUploader({
  audioUrl,
  onAudioChange,
  onAudioDuration,
  disabled = false,
  className,
  maxFileSizeMB = 50,
  acceptedFormats = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm'],
}: ExternalAudioUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(100);
  const [fileName, setFileName] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Handle file upload
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Check file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxFileSizeMB) {
      setError(`File troppo grande. Max: ${maxFileSizeMB}MB`);
      return;
    }

    // Check file type
    if (!acceptedFormats.some(format => file.type.includes(format.split('/')[1]))) {
      setError('Formato non supportato. Usa MP3, WAV, OGG o WebM.');
      return;
    }

    const url = URL.createObjectURL(file);
    setFileName(file.name);
    onAudioChange(url);
    
    e.target.value = '';
  }, [maxFileSizeMB, acceptedFormats, onAudioChange]);

  // Handle URL input
  const handleUrlSubmit = useCallback(() => {
    if (!urlInput.trim()) return;
    
    setError(null);
    
    // Basic URL validation
    try {
      new URL(urlInput);
      setFileName('Audio URL');
      onAudioChange(urlInput);
      setShowUrlInput(false);
      setUrlInput('');
    } catch {
      setError('URL non valido');
    }
  }, [urlInput, onAudioChange]);

  // Handle audio metadata loaded
  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      const dur = audioRef.current.duration;
      setDuration(dur);
      onAudioDuration?.(dur);
    }
  }, [onAudioDuration]);

  // Handle time update
  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, []);

  // Toggle play
  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  // Handle volume change
  const handleVolumeChange = useCallback((value: number[]) => {
    const vol = value[0];
    setVolume(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol / 100;
    }
  }, []);

  // Handle seek
  const handleSeek = useCallback((value: number[]) => {
    if (audioRef.current && duration) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  }, [duration]);

  // Clear audio
  const handleClear = useCallback(() => {
    if (audioUrl && audioUrl.startsWith('blob:')) {
      URL.revokeObjectURL(audioUrl);
    }
    onAudioChange(null);
    setFileName(null);
    setDuration(null);
    setCurrentTime(0);
    setIsPlaying(false);
    setError(null);
  }, [audioUrl, onAudioChange]);

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioUrl && audioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, []);

  return (
    <Card className={cn('border-dashed', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <AudioLines className="w-4 h-4" />
          Audio Esterno per Lip Sync
        </CardTitle>
        <CardDescription className="text-xs">
          Carica una traccia audio per sincronizzare le labbra dell'avatar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Hidden file input */}
        <input
          ref={inputRef}
          type="file"
          accept={acceptedFormats.join(',')}
          onChange={handleFileUpload}
          className="hidden"
          disabled={disabled}
        />

        {/* Hidden audio element */}
        {audioUrl && (
          <audio
            ref={audioRef}
            src={audioUrl}
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
          />
        )}

        {!audioUrl ? (
          <>
            {/* Upload Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => inputRef.current?.click()}
                disabled={disabled}
              >
                <Upload className="w-3 h-3 mr-1" />
                Carica File
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setShowUrlInput(!showUrlInput)}
                disabled={disabled}
              >
                <Link className="w-3 h-3 mr-1" />
                URL
              </Button>
            </div>

            {/* URL Input */}
            {showUrlInput && (
              <div className="flex gap-2">
                <Input
                  placeholder="https://example.com/audio.mp3"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="text-xs"
                  onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
                />
                <Button size="sm" onClick={handleUrlSubmit}>
                  OK
                </Button>
              </div>
            )}

            {/* Supported formats info */}
            <div className="text-[10px] text-muted-foreground text-center">
              Formati: MP3, WAV, OGG, WebM • Max: {maxFileSizeMB}MB
            </div>
          </>
        ) : (
          <>
            {/* Audio Info */}
            <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
              <FileAudio className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{fileName}</p>
                {duration && (
                  <p className="text-[10px] text-muted-foreground">
                    Durata: {formatTime(duration)}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="w-6 h-6 shrink-0"
                onClick={handleClear}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>

            {/* Playback Controls */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="w-8 h-8"
                  onClick={togglePlay}
                >
                  {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                </Button>
                
                <div className="flex-1">
                  <Slider
                    value={[currentTime]}
                    onValueChange={handleSeek}
                    max={duration || 100}
                    step={0.1}
                    className="cursor-pointer"
                  />
                </div>
                
                <span className="text-[10px] text-muted-foreground w-16 text-right">
                  {formatTime(currentTime)} / {duration ? formatTime(duration) : '0:00'}
                </span>
              </div>

              {/* Volume */}
              <div className="flex items-center gap-2">
                <Volume2 className="w-3 h-3 text-muted-foreground" />
                <Slider
                  value={[volume]}
                  onValueChange={handleVolumeChange}
                  max={100}
                  step={1}
                  className="flex-1"
                />
                <span className="text-[10px] text-muted-foreground w-8">
                  {volume}%
                </span>
              </div>
            </div>

            {/* Status Badge */}
            <Badge variant="secondary" className="w-full justify-center text-xs">
              <Music className="w-3 h-3 mr-1" />
              Audio pronto per lip sync
            </Badge>
          </>
        )}

        {/* Error Message */}
        {error && (
          <p className="text-xs text-destructive text-center">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default ExternalAudioUploader;
