import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Maximize2, 
  Minimize2, 
  Play, 
  Pause, 
  RotateCcw,
  Grid2X2,
  LayoutList,
  Download,
  Check,
  X,
  Clock,
  Loader2
} from 'lucide-react';

interface VideoResult {
  provider: string;
  providerName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
  generationId?: string;
}

interface VideoComparisonPanelProps {
  results: VideoResult[];
  onClose?: () => void;
}

export const VideoComparisonPanel = ({ results, onClose }: VideoComparisonPanelProps) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [expandedVideo, setExpandedVideo] = useState<string | null>(null);
  const [playingVideos, setPlayingVideos] = useState<Set<string>>(new Set());

  const completedResults = results.filter(r => r.status === 'completed' && r.videoUrl);
  const hasMultipleVideos = completedResults.length > 1;

  const togglePlay = (provider: string) => {
    setPlayingVideos(prev => {
      const next = new Set(prev);
      if (next.has(provider)) {
        next.delete(provider);
      } else {
        next.add(provider);
      }
      return next;
    });
  };

  const playAll = () => {
    const allProviders = completedResults.map(r => r.provider);
    setPlayingVideos(new Set(allProviders));
    
    // Trigger play on all video elements
    allProviders.forEach(provider => {
      const video = document.getElementById(`comparison-video-${provider}`) as HTMLVideoElement;
      if (video) {
        video.currentTime = 0;
        video.play();
      }
    });
  };

  const pauseAll = () => {
    setPlayingVideos(new Set());
    
    completedResults.forEach(result => {
      const video = document.getElementById(`comparison-video-${result.provider}`) as HTMLVideoElement;
      if (video) {
        video.pause();
      }
    });
  };

  const resetAll = () => {
    completedResults.forEach(result => {
      const video = document.getElementById(`comparison-video-${result.provider}`) as HTMLVideoElement;
      if (video) {
        video.currentTime = 0;
        video.pause();
      }
    });
    setPlayingVideos(new Set());
  };

  const downloadVideo = async (url: string, providerName: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `video-${providerName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const getStatusIcon = (status: VideoResult['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'completed':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <X className="h-4 w-4 text-destructive" />;
    }
  };

  const getStatusBadge = (status: VideoResult['status']) => {
    const variants: Record<VideoResult['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'secondary',
      processing: 'outline',
      completed: 'default',
      failed: 'destructive',
    };
    
    const labels: Record<VideoResult['status'], string> = {
      pending: 'In attesa',
      processing: 'Elaborazione',
      completed: 'Completato',
      failed: 'Fallito',
    };

    return (
      <Badge variant={variants[status]} className="text-xs">
        {getStatusIcon(status)}
        <span className="ml-1">{labels[status]}</span>
      </Badge>
    );
  };

  if (results.length === 0) {
    return null;
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">Confronto Video</h3>
        
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex border rounded-md overflow-hidden">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              className="rounded-none"
              onClick={() => setViewMode('grid')}
            >
              <Grid2X2 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              className="rounded-none"
              onClick={() => setViewMode('list')}
            >
              <LayoutList className="h-4 w-4" />
            </Button>
          </div>

          {/* Playback Controls */}
          {hasMultipleVideos && (
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={playAll}>
                <Play className="h-4 w-4 mr-1" />
                Tutti
              </Button>
              <Button variant="outline" size="sm" onClick={pauseAll}>
                <Pause className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={resetAll}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      <ScrollArea className="max-h-[600px]">
        {viewMode === 'grid' ? (
          <div className={`grid gap-4 ${
            completedResults.length === 1 ? 'grid-cols-1' :
            completedResults.length === 2 ? 'grid-cols-2' :
            'grid-cols-2 lg:grid-cols-3'
          }`}>
            {results.map((result) => (
              <Card 
                key={result.provider} 
                className={`p-3 ${expandedVideo === result.provider ? 'col-span-full' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{result.providerName}</span>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(result.status)}
                    {result.videoUrl && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setExpandedVideo(
                            expandedVideo === result.provider ? null : result.provider
                          )}
                        >
                          {expandedVideo === result.provider ? (
                            <Minimize2 className="h-4 w-4" />
                          ) : (
                            <Maximize2 className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => downloadVideo(result.videoUrl!, result.providerName)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {result.status === 'completed' && result.videoUrl ? (
                  <div className={`aspect-video bg-black rounded overflow-hidden ${
                    expandedVideo === result.provider ? 'max-w-3xl mx-auto' : ''
                  }`}>
                    <video
                      id={`comparison-video-${result.provider}`}
                      src={result.videoUrl}
                      controls
                      className="w-full h-full object-contain"
                      onPlay={() => setPlayingVideos(prev => new Set(prev).add(result.provider))}
                      onPause={() => {
                        setPlayingVideos(prev => {
                          const next = new Set(prev);
                          next.delete(result.provider);
                          return next;
                        });
                      }}
                    />
                  </div>
                ) : result.status === 'processing' ? (
                  <div className="aspect-video bg-muted rounded flex items-center justify-center">
                    <div className="text-center">
                      <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Generazione in corso...</p>
                    </div>
                  </div>
                ) : result.status === 'failed' ? (
                  <div className="aspect-video bg-destructive/10 rounded flex items-center justify-center">
                    <div className="text-center p-4">
                      <X className="h-8 w-8 text-destructive mx-auto mb-2" />
                      <p className="text-sm text-destructive">{result.error || 'Generazione fallita'}</p>
                    </div>
                  </div>
                ) : (
                  <div className="aspect-video bg-muted rounded flex items-center justify-center">
                    <Clock className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {results.map((result) => (
              <Card key={result.provider} className="p-4">
                <div className="flex gap-4">
                  {result.status === 'completed' && result.videoUrl ? (
                    <div className="w-64 flex-shrink-0">
                      <video
                        id={`comparison-video-list-${result.provider}`}
                        src={result.videoUrl}
                        controls
                        className="w-full rounded"
                      />
                    </div>
                  ) : (
                    <div className="w-64 flex-shrink-0 aspect-video bg-muted rounded flex items-center justify-center">
                      {result.status === 'processing' ? (
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      ) : result.status === 'failed' ? (
                        <X className="h-6 w-6 text-destructive" />
                      ) : (
                        <Clock className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                  )}
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">{result.providerName}</h4>
                      {getStatusBadge(result.status)}
                    </div>
                    
                    {result.error && (
                      <p className="text-sm text-destructive mb-2">{result.error}</p>
                    )}
                    
                    {result.videoUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadVideo(result.videoUrl!, result.providerName)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Scarica
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>
    </Card>
  );
};