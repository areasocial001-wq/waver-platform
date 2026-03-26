import React, { useState, useRef, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Play, Pause, SkipBack, SkipForward, Plus, Trash2, Volume2, VolumeX,
  Film, Music, Mic, Sparkles, ZoomIn, ZoomOut, Scissors, Copy,
  Lock, Unlock, Eye, EyeOff, GripVertical, MoreHorizontal, Download
} from 'lucide-react';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Types
export interface TimelineItem {
  id: string;
  name: string;
  startTime: number; // seconds
  duration: number;
  url?: string;
  color: string;
  volume?: number;
  thumbnail?: string;
}

export interface TimelineTrack {
  id: string;
  type: 'video' | 'voiceover' | 'music' | 'sfx';
  label: string;
  icon: React.ReactNode;
  items: TimelineItem[];
  muted: boolean;
  locked: boolean;
  visible: boolean;
  volume: number;
  color: string;
}

const TRACK_CONFIGS = {
  video: { label: 'Video', icon: <Film className="w-4 h-4" />, color: 'hsl(var(--primary))' },
  voiceover: { label: 'Voiceover', icon: <Mic className="w-4 h-4" />, color: 'hsl(var(--secondary))' },
  music: { label: 'Music', icon: <Music className="w-4 h-4" />, color: 'hsl(var(--accent))' },
  sfx: { label: 'SFX', icon: <Sparkles className="w-4 h-4" />, color: 'hsl(var(--destructive))' },
};

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const frames = Math.floor((seconds % 1) * 30);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
};

export function TimelineEditor() {
  const [tracks, setTracks] = useState<TimelineTrack[]>([
    { id: 'video-1', type: 'video', label: 'Video 1', icon: TRACK_CONFIGS.video.icon, items: [], muted: false, locked: false, visible: true, volume: 100, color: TRACK_CONFIGS.video.color },
    { id: 'vo-1', type: 'voiceover', label: 'Voiceover', icon: TRACK_CONFIGS.voiceover.icon, items: [], muted: false, locked: false, visible: true, volume: 100, color: TRACK_CONFIGS.voiceover.color },
    { id: 'music-1', type: 'music', label: 'Music', icon: TRACK_CONFIGS.music.icon, items: [], muted: false, locked: false, visible: true, volume: 80, color: TRACK_CONFIGS.music.color },
    { id: 'sfx-1', type: 'sfx', label: 'SFX', icon: TRACK_CONFIGS.sfx.icon, items: [], muted: false, locked: false, visible: true, volume: 90, color: TRACK_CONFIGS.sfx.color },
  ]);

  const [playhead, setPlayhead] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoom, setZoom] = useState(50); // pixels per second
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [totalDuration, setTotalDuration] = useState(30);
  const timelineRef = useRef<HTMLDivElement>(null);
  const playIntervalRef = useRef<number | null>(null);

  const pixelsPerSecond = zoom;

  const maxDuration = useMemo(() => {
    let max = 30;
    tracks.forEach(track => {
      track.items.forEach(item => {
        const end = item.startTime + item.duration;
        if (end > max) max = end;
      });
    });
    return Math.max(max + 5, totalDuration);
  }, [tracks, totalDuration]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      playIntervalRef.current = window.setInterval(() => {
        setPlayhead(prev => {
          if (prev >= maxDuration) {
            if (playIntervalRef.current) clearInterval(playIntervalRef.current);
            setIsPlaying(false);
            return 0;
          }
          return prev + 1 / 30;
        });
      }, 1000 / 30);
    }
  }, [isPlaying, maxDuration]);

  const addItem = (trackId: string) => {
    setTracks(prev => prev.map(track => {
      if (track.id !== trackId || track.locked) return track;
      const lastEnd = track.items.reduce((max, item) => Math.max(max, item.startTime + item.duration), 0);
      const newItem: TimelineItem = {
        id: `item-${Date.now()}`,
        name: `${track.label} Clip ${track.items.length + 1}`,
        startTime: lastEnd,
        duration: track.type === 'sfx' ? 2 : track.type === 'music' ? 10 : 5,
        color: track.color,
        volume: 100,
      };
      return { ...track, items: [...track.items, newItem] };
    }));
  };

  const removeItem = (trackId: string, itemId: string) => {
    setTracks(prev => prev.map(track => {
      if (track.id !== trackId) return track;
      return { ...track, items: track.items.filter(i => i.id !== itemId) };
    }));
    if (selectedItem === itemId) setSelectedItem(null);
  };

  const toggleTrackMute = (trackId: string) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, muted: !t.muted } : t));
  };

  const toggleTrackLock = (trackId: string) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, locked: !t.locked } : t));
  };

  const toggleTrackVisible = (trackId: string) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, visible: !t.visible } : t));
  };

  const setTrackVolume = (trackId: string, volume: number) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, volume } : t));
  };

  const addTrack = (type: TimelineTrack['type']) => {
    const config = TRACK_CONFIGS[type];
    const count = tracks.filter(t => t.type === type).length + 1;
    const newTrack: TimelineTrack = {
      id: `${type}-${Date.now()}`,
      type,
      label: `${config.label} ${count}`,
      icon: config.icon,
      items: [],
      muted: false,
      locked: false,
      visible: true,
      volume: 100,
      color: config.color,
    };
    setTracks(prev => [...prev, newTrack]);
  };

  const removeTrack = (trackId: string) => {
    if (tracks.length <= 1) return;
    setTracks(prev => prev.filter(t => t.id !== trackId));
  };

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + timelineRef.current.scrollLeft;
    const time = x / pixelsPerSecond;
    setPlayhead(Math.max(0, Math.min(time, maxDuration)));
  };

  // Render time ruler markers
  const renderTimeRuler = () => {
    const markers = [];
    const step = zoom >= 80 ? 1 : zoom >= 40 ? 2 : 5;
    for (let t = 0; t <= maxDuration; t += step) {
      markers.push(
        <div
          key={t}
          className="absolute top-0 flex flex-col items-center"
          style={{ left: `${t * pixelsPerSecond}px` }}
        >
          <div className="h-3 w-px bg-muted-foreground/40" />
          <span className="text-[9px] text-muted-foreground mt-0.5 select-none">
            {formatTime(t)}
          </span>
        </div>
      );
    }
    return markers;
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full">
        {/* Transport Controls */}
        <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPlayhead(0)}>
                  <SkipBack className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Vai all'inizio</TooltipContent>
            </Tooltip>

            <Button variant="default" size="icon" className="h-9 w-9" onClick={togglePlay}>
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPlayhead(maxDuration)}>
                  <SkipForward className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Vai alla fine</TooltipContent>
            </Tooltip>

            <div className="ml-3 px-3 py-1 rounded bg-muted font-mono text-sm text-foreground tabular-nums">
              {formatTime(playhead)}
            </div>
            <span className="text-xs text-muted-foreground">/ {formatTime(maxDuration)}</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <ZoomOut className="w-3.5 h-3.5 text-muted-foreground" />
              <Slider
                value={[zoom]}
                onValueChange={([v]) => setZoom(v)}
                min={20}
                max={150}
                step={5}
                className="w-24"
              />
              <ZoomIn className="w-3.5 h-3.5 text-muted-foreground" />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  Aggiungi Traccia
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => addTrack('video')}>
                  <Film className="w-4 h-4 mr-2" /> Traccia Video
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => addTrack('voiceover')}>
                  <Mic className="w-4 h-4 mr-2" /> Traccia Voiceover
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => addTrack('music')}>
                  <Music className="w-4 h-4 mr-2" /> Traccia Musica
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => addTrack('sfx')}>
                  <Sparkles className="w-4 h-4 mr-2" /> Traccia SFX
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => toast.info('Export in arrivo...')}>
              <Download className="w-3.5 h-3.5" />
              Esporta
            </Button>
          </div>
        </div>

        {/* Timeline Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Track Headers */}
          <div className="w-56 flex-shrink-0 border-r border-border bg-card/50">
            {/* Ruler spacer */}
            <div className="h-8 border-b border-border" />

            {tracks.map(track => (
              <div
                key={track.id}
                className="h-16 flex items-center gap-1.5 px-2 border-b border-border hover:bg-muted/30 transition-colors group"
              >
                <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 cursor-grab" />

                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: track.color }} />

                <span className="text-xs font-medium truncate flex-1 text-foreground">{track.label}</span>

                <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleTrackMute(track.id)}>
                        {track.muted ? <VolumeX className="w-3 h-3 text-destructive" /> : <Volume2 className="w-3 h-3" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{track.muted ? 'Attiva audio' : 'Muta'}</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleTrackLock(track.id)}>
                        {track.locked ? <Lock className="w-3 h-3 text-accent" /> : <Unlock className="w-3 h-3" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{track.locked ? 'Sblocca' : 'Blocca'}</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleTrackVisible(track.id)}>
                        {track.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 text-muted-foreground" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{track.visible ? 'Nascondi' : 'Mostra'}</TooltipContent>
                  </Tooltip>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <MoreHorizontal className="w-3 h-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => addItem(track.id)}>
                        <Plus className="w-3.5 h-3.5 mr-2" /> Aggiungi clip
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => removeTrack(track.id)} className="text-destructive">
                        <Trash2 className="w-3.5 h-3.5 mr-2" /> Rimuovi traccia
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>

          {/* Timeline Content */}
          <ScrollArea className="flex-1">
            <div
              ref={timelineRef}
              className="relative cursor-crosshair"
              style={{ width: `${maxDuration * pixelsPerSecond + 100}px` }}
              onClick={handleTimelineClick}
            >
              {/* Time Ruler */}
              <div className="h-8 relative border-b border-border bg-muted/30">
                {renderTimeRuler()}
              </div>

              {/* Tracks */}
              {tracks.map(track => (
                <div key={track.id} className="h-16 relative border-b border-border">
                  {/* Grid lines */}
                  {Array.from({ length: Math.ceil(maxDuration) }).map((_, i) => (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 w-px bg-border/30"
                      style={{ left: `${i * pixelsPerSecond}px` }}
                    />
                  ))}

                  {/* Items */}
                  {track.items.map(item => (
                    <div
                      key={item.id}
                      className={`absolute top-1.5 bottom-1.5 rounded-md border cursor-pointer transition-all
                        ${selectedItem === item.id ? 'ring-2 ring-primary shadow-lg z-10' : 'hover:brightness-110'}
                        ${track.muted ? 'opacity-40' : ''}`}
                      style={{
                        left: `${item.startTime * pixelsPerSecond}px`,
                        width: `${Math.max(item.duration * pixelsPerSecond, 24)}px`,
                        backgroundColor: `${item.color}33`,
                        borderColor: item.color,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedItem(item.id);
                      }}
                    >
                      <div className="flex items-center h-full px-1.5 overflow-hidden">
                        <span className="text-[10px] font-medium truncate text-foreground">
                          {item.name}
                        </span>
                      </div>

                      {/* Resize handles */}
                      <div className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 rounded-l" />
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 rounded-r" />
                    </div>
                  ))}

                  {/* Drop zone indicator */}
                  {!track.locked && (
                    <div
                      className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); addItem(track.id); }}
                    >
                      {track.items.length === 0 && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5 bg-muted/80 px-3 py-1.5 rounded-full">
                          <Plus className="w-3 h-3" /> Clicca per aggiungere
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Playhead */}
              <div
                className="absolute top-0 bottom-0 w-px bg-destructive z-20 pointer-events-none"
                style={{ left: `${playhead * pixelsPerSecond}px` }}
              >
                <div className="absolute -top-0.5 -left-1.5 w-3 h-3 bg-destructive rounded-full" />
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* Properties Panel */}
        {selectedItem && (
          <div className="border-t border-border bg-card px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Proprietà Clip</span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => {
                  tracks.forEach(t => {
                    const item = t.items.find(i => i.id === selectedItem);
                    if (item) removeItem(t.id, item.id);
                  });
                }}>
                  <Trash2 className="w-3.5 h-3.5" /> Elimina
                </Button>
                <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => toast.info('Clip duplicata')}>
                  <Copy className="w-3.5 h-3.5" /> Duplica
                </Button>
                <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => toast.info('Clip tagliata')}>
                  <Scissors className="w-3.5 h-3.5" /> Taglia
                </Button>
              </div>
            </div>
            {(() => {
              for (const track of tracks) {
                const item = track.items.find(i => i.id === selectedItem);
                if (item) {
                  return (
                    <div className="grid grid-cols-4 gap-4 mt-2">
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Nome</span>
                        <p className="text-sm text-foreground">{item.name}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Inizio</span>
                        <p className="text-sm font-mono text-foreground">{formatTime(item.startTime)}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Durata</span>
                        <p className="text-sm font-mono text-foreground">{formatTime(item.duration)}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Volume</span>
                        <Slider value={[item.volume || 100]} min={0} max={100} className="mt-1" />
                      </div>
                    </div>
                  );
                }
              }
              return null;
            })()}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
