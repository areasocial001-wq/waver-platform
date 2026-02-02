import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Film, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX,
  Download,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  RotateCcw,
  Maximize2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface GeneratedVideo {
  id: string;
  url: string;
  prompt: string;
  thumbnail?: string;
  expression?: string;
  createdAt: Date;
}

interface LivePreviewPanelProps {
  previewVideo: string | null;
  referenceImage: string | null;
  generatedVideos: GeneratedVideo[];
  isGenerating: boolean;
  onVideoSelect: (url: string) => void;
  onAddToTimeline: (video: GeneratedVideo) => void;
  onDownload: (url: string) => void;
  onDeleteVideo?: (id: string) => void;
  expressionPresets?: { id: string; emoji: string }[];
  className?: string;
}

export function LivePreviewPanel({
  previewVideo,
  referenceImage,
  generatedVideos,
  isGenerating,
  onVideoSelect,
  onAddToTimeline,
  onDownload,
  onDeleteVideo,
  expressionPresets = [],
  className,
}: LivePreviewPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [showReference, setShowReference] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Auto-play when new video is loaded
  useEffect(() => {
    if (previewVideo && videoRef.current) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [previewVideo]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (value: number[]) => {
    if (!videoRef.current) return;
    const vol = value[0];
    setVolume(vol);
    videoRef.current.volume = vol / 100;
    setIsMuted(vol === 0);
  };

  const handleRestart = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    videoRef.current.play();
    setIsPlaying(true);
  };

  const toggleFullscreen = () => {
    if (!videoRef.current) return;
    if (!isFullscreen) {
      videoRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  const getExpressionEmoji = (expressionId?: string) => {
    const preset = expressionPresets.find(e => e.id === expressionId);
    return preset?.emoji || '😐';
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4" />
            Live Preview
          </div>
          {isGenerating && (
            <Badge variant="secondary" className="animate-pulse">
              Generazione in corso...
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Main Preview Area */}
        <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
          {previewVideo ? (
            <>
              <video
                ref={videoRef}
                src={previewVideo}
                className="w-full h-full object-contain"
                loop
                playsInline
                muted={isMuted}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
              
              {/* Reference Image Overlay */}
              {showReference && referenceImage && (
                <div className="absolute top-2 left-2 w-16 h-16 rounded-lg overflow-hidden border-2 border-white/50 shadow-lg">
                  <img 
                    src={referenceImage} 
                    alt="Reference" 
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              
              {/* Video Controls Overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 text-white hover:bg-white/20"
                    onClick={togglePlay}
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 text-white hover:bg-white/20"
                    onClick={handleRestart}
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 text-white hover:bg-white/20"
                    onClick={toggleMute}
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </Button>
                  
                  <Slider
                    value={[volume]}
                    onValueChange={handleVolumeChange}
                    max={100}
                    step={1}
                    className="w-20"
                  />
                  
                  <div className="flex-1" />
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 text-white hover:bg-white/20"
                    onClick={() => setShowReference(!showReference)}
                    title={showReference ? 'Nascondi riferimento' : 'Mostra riferimento'}
                  >
                    {showReference ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 text-white hover:bg-white/20"
                    onClick={toggleFullscreen}
                  >
                    <Maximize2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
              <Film className="w-12 h-12 mb-2 opacity-30" />
              <p className="text-sm">Nessun video generato</p>
              <p className="text-xs mt-1">Genera un video per vedere l'anteprima</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {previewVideo && (
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={() => onDownload(previewVideo)}
            >
              <Download className="w-3 h-3 mr-1" />
              Scarica
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={() => {
                const video = generatedVideos.find(v => v.url === previewVideo);
                if (video) onAddToTimeline(video);
              }}
            >
              <Plus className="w-3 h-3 mr-1" />
              Timeline
            </Button>
          </div>
        )}

        {/* Video History */}
        {generatedVideos.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs flex items-center justify-between">
              <span>Video Generati ({generatedVideos.length})</span>
            </Label>
            <ScrollArea className="h-[120px]">
              <div className="space-y-1.5">
                {generatedVideos.map((video) => (
                  <div
                    key={video.id}
                    className={cn(
                      'group p-2 rounded-md border cursor-pointer transition-all flex items-center gap-2',
                      previewVideo === video.url 
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/30' 
                        : 'border-border hover:border-primary/50'
                    )}
                    onClick={() => onVideoSelect(video.url)}
                  >
                    {/* Thumbnail or Expression */}
                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                      {video.thumbnail ? (
                        <img src={video.thumbnail} alt="" className="w-full h-full object-cover rounded" />
                      ) : (
                        <span className="text-sm">{getExpressionEmoji(video.expression)}</span>
                      )}
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate">{video.prompt.slice(0, 25)}...</p>
                      <p className="text-[10px] text-muted-foreground">
                        {video.createdAt.toLocaleTimeString()}
                      </p>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-6 h-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddToTimeline(video);
                        }}
                        title="Aggiungi alla timeline"
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                      {onDeleteVideo && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-6 h-6 text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteVideo(video.id);
                          }}
                          title="Elimina"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default LivePreviewPanel;
