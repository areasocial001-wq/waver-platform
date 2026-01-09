import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack,
  Download,
  Trash2,
  GripVertical,
  Film,
  Merge,
  Clock,
  ChevronLeft,
  ChevronRight,
  Plus,
  Music,
  Volume2
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export interface TimelineClip {
  id: string;
  videoUrl: string;
  prompt: string;
  duration: number; // in seconds
  thumbnail?: string;
  expression?: string;
  order: number;
}

interface TransitionType {
  id: string;
  name: string;
  duration: number;
}

const TRANSITIONS: TransitionType[] = [
  { id: 'none', name: 'Nessuna', duration: 0 },
  { id: 'fade', name: 'Dissolvenza', duration: 0.5 },
  { id: 'crossfade', name: 'Cross-fade', duration: 1 },
  { id: 'slide-left', name: 'Scorrimento Sinistra', duration: 0.5 },
  { id: 'slide-right', name: 'Scorrimento Destra', duration: 0.5 },
  { id: 'zoom', name: 'Zoom', duration: 0.8 },
];

interface TalkingAvatarTimelineProps {
  clips: TimelineClip[];
  onClipsChange: (clips: TimelineClip[]) => void;
  onRemoveClip: (id: string) => void;
  onReorderClips: (fromIndex: number, toIndex: number) => void;
  backgroundMusicUrl?: string | null;
  backgroundMusicEmotion?: string | null;
}

export function TalkingAvatarTimeline({
  clips,
  onClipsChange,
  onRemoveClip,
  onReorderClips,
  backgroundMusicUrl,
  backgroundMusicEmotion,
}: TalkingAvatarTimelineProps) {
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedTransition, setSelectedTransition] = useState<string>('fade');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayIndex, setCurrentPlayIndex] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [draggedClipId, setDraggedClipId] = useState<string | null>(null);
  const [musicVolume, setMusicVolume] = useState(30); // Background music volume (0-100)

  // Calculate total timeline duration
  const totalDuration = useMemo(() => {
    const clipsDuration = clips.reduce((sum, clip) => sum + clip.duration, 0);
    const transitionsDuration = Math.max(0, clips.length - 1) * 
      (TRANSITIONS.find(t => t.id === selectedTransition)?.duration || 0);
    return clipsDuration + transitionsDuration;
  }, [clips, selectedTransition]);

  // Format time display
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Handle drag start
  const handleDragStart = useCallback((e: React.DragEvent, clipId: string) => {
    setDraggedClipId(clipId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  // Handle drag over
  const handleDragOver = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle drop
  const handleDrop = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (!draggedClipId) return;
    
    const sourceIndex = clips.findIndex(c => c.id === draggedClipId);
    if (sourceIndex !== -1 && sourceIndex !== targetIndex) {
      onReorderClips(sourceIndex, targetIndex);
    }
    setDraggedClipId(null);
  }, [draggedClipId, clips, onReorderClips]);

  // Playback controls
  const handlePlay = useCallback(() => {
    if (clips.length === 0) return;
    setIsPlaying(true);
  }, [clips.length]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handleNext = useCallback(() => {
    setCurrentPlayIndex((prev) => Math.min(prev + 1, clips.length - 1));
  }, [clips.length]);

  const handlePrev = useCallback(() => {
    setCurrentPlayIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  // Export final video with background music
  const handleExport = useCallback(async () => {
    if (clips.length === 0) {
      toast.error('Aggiungi almeno un clip alla timeline');
      return;
    }

    setIsExporting(true);
    setExportProgress(10);

    try {
      // Prepare video URLs for concatenation
      const videoUrls = clips
        .sort((a, b) => a.order - b.order)
        .map(clip => clip.videoUrl);
      
      // Prepare clip durations
      const clipDurations = clips
        .sort((a, b) => a.order - b.order)
        .map(clip => clip.duration);

      setExportProgress(30);

      // Build request with optional background music
      const requestBody: Record<string, unknown> = {
        videoUrls,
        clipDurations,
        transition: selectedTransition === 'slide-left' ? 'wipe' : 
                   selectedTransition === 'slide-right' ? 'wipe' : 
                   selectedTransition === 'zoom' ? 'fade' : selectedTransition,
        transitionDuration: TRANSITIONS.find(t => t.id === selectedTransition)?.duration || 0.5,
      };

      // Add background music if available
      if (backgroundMusicUrl) {
        requestBody.audioUrl = backgroundMusicUrl;
        requestBody.audioVolume = musicVolume;
        toast.info(`Esportando con musica di sottofondo (${backgroundMusicEmotion || 'custom'})...`);
      }

      const { data, error } = await supabase.functions.invoke('video-concat', {
        body: requestBody,
      });

      if (error) throw new Error(error.message);

      setExportProgress(80);

      if (data.videoUrl) {
        // Download the final video
        const a = document.createElement('a');
        a.href = data.videoUrl;
        a.download = `talking-avatar-story-${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        toast.success('Video esportato con successo!');
      } else if (data.taskId) {
        toast.info('Esportazione in corso... Riceverai una notifica quando sarà pronto.');
      }

      setExportProgress(100);
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(error.message || 'Errore durante l\'esportazione');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  }, [clips, selectedTransition, backgroundMusicUrl, backgroundMusicEmotion, musicVolume]);

  // Move clip left/right
  const moveClip = useCallback((clipId: string, direction: 'left' | 'right') => {
    const index = clips.findIndex(c => c.id === clipId);
    if (index === -1) return;
    
    const newIndex = direction === 'left' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= clips.length) return;
    
    onReorderClips(index, newIndex);
  }, [clips, onReorderClips]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Film className="w-5 h-5" />
          Timeline Editor
        </CardTitle>
        <CardDescription>
          Trascina e rilascia i clip per riordinarli. Durata totale: {formatTime(totalDuration)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Transport Controls */}
        <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handlePrev} disabled={currentPlayIndex === 0}>
              <SkipBack className="w-4 h-4" />
            </Button>
            
            {isPlaying ? (
              <Button variant="ghost" size="icon" onClick={handlePause}>
                <Pause className="w-4 h-4" />
              </Button>
            ) : (
              <Button variant="ghost" size="icon" onClick={handlePlay} disabled={clips.length === 0}>
                <Play className="w-4 h-4" />
              </Button>
            )}
            
            <Button variant="ghost" size="icon" onClick={handleNext} disabled={currentPlayIndex >= clips.length - 1}>
              <SkipForward className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-mono">
              {formatTime(clips.slice(0, currentPlayIndex + 1).reduce((sum, c) => sum + c.duration, 0))} / {formatTime(totalDuration)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Background Music Controls */}
            {backgroundMusicUrl && (
              <div className="flex items-center gap-2 px-2 py-1 bg-primary/10 rounded-lg">
                <Music className="w-4 h-4 text-primary" />
                <span className="text-xs text-primary">{backgroundMusicEmotion}</span>
                <div className="flex items-center gap-1 w-20">
                  <Volume2 className="w-3 h-3" />
                  <Slider
                    value={[musicVolume]}
                    onValueChange={([v]) => setMusicVolume(v)}
                    min={0}
                    max={100}
                    step={5}
                    className="w-16"
                  />
                  <span className="text-xs w-6">{musicVolume}%</span>
                </div>
              </div>
            )}
            
            <select
              value={selectedTransition}
              onChange={(e) => setSelectedTransition(e.target.value)}
              className="text-sm bg-background border rounded px-2 py-1"
            >
              {TRANSITIONS.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            
            <Button 
              onClick={handleExport} 
              disabled={isExporting || clips.length === 0}
              size="sm"
            >
              {isExporting ? (
                <>Esportando...</>
              ) : (
                <>
                  <Merge className="w-4 h-4 mr-1" />
                  {backgroundMusicUrl ? 'Esporta con Musica' : 'Esporta'}
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Export Progress */}
        {isExporting && (
          <Progress value={exportProgress} className="w-full" />
        )}

        {/* Timeline Track */}
        <div className="relative">
          <ScrollArea className="w-full">
            <div className="flex items-stretch gap-1 min-h-[120px] p-2 bg-muted/30 rounded-lg">
              {clips.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <Plus className="w-5 h-5 mr-2" />
                  Genera video e aggiungili alla timeline
                </div>
              ) : (
                clips
                  .sort((a, b) => a.order - b.order)
                  .map((clip, index) => (
                    <React.Fragment key={clip.id}>
                      {/* Clip */}
                      <div
                        draggable
                        onDragStart={(e) => handleDragStart(e, clip.id)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDrop={(e) => handleDrop(e, index)}
                        className={`relative flex-shrink-0 w-32 rounded-lg overflow-hidden border-2 transition-all cursor-move ${
                          selectedClipId === clip.id
                            ? 'border-primary ring-2 ring-primary/30'
                            : currentPlayIndex === index
                            ? 'border-green-500'
                            : 'border-border hover:border-primary/50'
                        } ${draggedClipId === clip.id ? 'opacity-50' : ''}`}
                        onClick={() => setSelectedClipId(clip.id)}
                      >
                        {/* Grip Handle */}
                        <div className="absolute top-1 left-1 p-1 bg-background/80 rounded">
                          <GripVertical className="w-3 h-3 text-muted-foreground" />
                        </div>
                        
                        {/* Video Preview */}
                        <video
                          src={clip.videoUrl}
                          className="w-full h-20 object-cover"
                          muted
                        />
                        
                        {/* Clip Info */}
                        <div className="p-1.5 bg-background/90">
                          <div className="flex items-center justify-between text-xs">
                            <span className="truncate flex-1">{clip.prompt.slice(0, 15)}...</span>
                            <span className="text-muted-foreground">{formatTime(clip.duration)}</span>
                          </div>
                          
                          {clip.expression && (
                            <Badge variant="secondary" className="text-[10px] mt-1">
                              {clip.expression}
                            </Badge>
                          )}
                        </div>
                        
                        {/* Controls */}
                        <div className="absolute bottom-8 right-1 flex gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-5 h-5 bg-background/80"
                            onClick={(e) => {
                              e.stopPropagation();
                              moveClip(clip.id, 'left');
                            }}
                            disabled={index === 0}
                          >
                            <ChevronLeft className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-5 h-5 bg-background/80"
                            onClick={(e) => {
                              e.stopPropagation();
                              moveClip(clip.id, 'right');
                            }}
                            disabled={index === clips.length - 1}
                          >
                            <ChevronRight className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            className="w-5 h-5"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveClip(clip.id);
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Transition Indicator */}
                      {index < clips.length - 1 && selectedTransition !== 'none' && (
                        <div className="flex items-center justify-center w-6 flex-shrink-0">
                          <div className="w-4 h-4 rounded-full bg-primary/30 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-primary" />
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Timeline Ruler */}
        <div className="relative h-6 bg-muted/30 rounded overflow-hidden">
          {clips.length > 0 && (
            <div className="absolute inset-0 flex">
              {clips.map((clip, index) => {
                const widthPercent = (clip.duration / totalDuration) * 100;
                return (
                  <div
                    key={clip.id}
                    className={`h-full border-r border-border flex items-center justify-center text-[10px] text-muted-foreground ${
                      currentPlayIndex === index ? 'bg-primary/20' : ''
                    }`}
                    style={{ width: `${widthPercent}%` }}
                  >
                    Scena {index + 1}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Clip Count */}
        <div className="text-xs text-muted-foreground text-center">
          {clips.length} clip{clips.length !== 1 ? 's' : ''} · Transizione: {TRANSITIONS.find(t => t.id === selectedTransition)?.name}
        </div>
      </CardContent>
    </Card>
  );
}

export default TalkingAvatarTimeline;
