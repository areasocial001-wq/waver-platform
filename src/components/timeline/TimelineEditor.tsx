import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Play, Pause, SkipBack, SkipForward, Plus, Trash2, Volume2, VolumeX,
  Film, Music, Mic, Sparkles, ZoomIn, ZoomOut, Scissors, Copy,
  Lock, Unlock, Eye, EyeOff, GripVertical, MoreHorizontal, Download,
  Magnet, Import, Upload
} from 'lucide-react';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TimelineItem, TimelineTrack, formatTime } from './types';
import { DraggableClip } from './DraggableClip';

const TRACK_CONFIGS = {
  video: { label: 'Video', icon: <Film className="w-4 h-4" />, color: 'hsl(var(--primary))' },
  voiceover: { label: 'Voiceover', icon: <Mic className="w-4 h-4" />, color: 'hsl(var(--secondary))' },
  music: { label: 'Music', icon: <Music className="w-4 h-4" />, color: 'hsl(var(--accent))' },
  sfx: { label: 'SFX', icon: <Sparkles className="w-4 h-4" />, color: 'hsl(var(--destructive))' },
};

export interface TimelineEditorProps {
  initialItems?: {
    trackType: TimelineTrack['type'];
    items: TimelineItem[];
  }[];
}

export function TimelineEditor({ initialItems }: TimelineEditorProps) {
  const [tracks, setTracks] = useState<TimelineTrack[]>(() => {
    const defaults: TimelineTrack[] = [
      { id: 'video-1', type: 'video', label: 'Video 1', icon: TRACK_CONFIGS.video.icon, items: [], muted: false, locked: false, visible: true, volume: 100, color: TRACK_CONFIGS.video.color },
      { id: 'vo-1', type: 'voiceover', label: 'Voiceover', icon: TRACK_CONFIGS.voiceover.icon, items: [], muted: false, locked: false, visible: true, volume: 100, color: TRACK_CONFIGS.voiceover.color },
      { id: 'music-1', type: 'music', label: 'Music', icon: TRACK_CONFIGS.music.icon, items: [], muted: false, locked: false, visible: true, volume: 80, color: TRACK_CONFIGS.music.color },
      { id: 'sfx-1', type: 'sfx', label: 'SFX', icon: TRACK_CONFIGS.sfx.icon, items: [], muted: false, locked: false, visible: true, volume: 90, color: TRACK_CONFIGS.sfx.color },
    ];

    if (initialItems?.length) {
      initialItems.forEach(({ trackType, items }) => {
        const track = defaults.find(t => t.type === trackType);
        if (track) track.items = items;
      });
    }

    return defaults;
  });

  const [playhead, setPlayhead] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoom, setZoom] = useState(50);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [totalDuration] = useState(30);
  const timelineRef = useRef<HTMLDivElement>(null);
  const playIntervalRef = useRef<number | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [importTargetTrackId, setImportTargetTrackId] = useState<string | null>(null);
  const [dragOverTrackId, setDragOverTrackId] = useState<string | null>(null);

  const pixelsPerSecond = zoom;
  const snapInterval = snapEnabled ? (zoom >= 80 ? 0.5 : 1) : 0.1;

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

  useEffect(() => {
    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, []);

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

  const moveItem = useCallback((itemId: string, newStartTime: number) => {
    setTracks(prev => prev.map(track => ({
      ...track,
      items: track.items.map(item =>
        item.id === itemId ? { ...item, startTime: Math.max(0, newStartTime) } : item
      ),
    })));
  }, []);

  const resizeItem = useCallback((itemId: string, newStartTime: number, newDuration: number) => {
    setTracks(prev => prev.map(track => ({
      ...track,
      items: track.items.map(item =>
        item.id === itemId ? { ...item, startTime: Math.max(0, newStartTime), duration: newDuration } : item
      ),
    })));
  }, []);

  const duplicateItem = useCallback(() => {
    if (!selectedItem) return;
    setTracks(prev => prev.map(track => {
      const item = track.items.find(i => i.id === selectedItem);
      if (!item) return track;
      const clone: TimelineItem = {
        ...item,
        id: `item-${Date.now()}`,
        name: `${item.name} (copia)`,
        startTime: item.startTime + item.duration,
      };
      return { ...track, items: [...track.items, clone] };
    }));
    toast.success('Clip duplicata');
  }, [selectedItem]);

  const splitItem = useCallback(() => {
    if (!selectedItem) return;
    setTracks(prev => prev.map(track => {
      const idx = track.items.findIndex(i => i.id === selectedItem);
      if (idx === -1) return track;
      const item = track.items[idx];
      const splitPoint = playhead - item.startTime;
      if (splitPoint <= 0.5 || splitPoint >= item.duration - 0.5) {
        toast.error('Posiziona il playhead al centro della clip per tagliare');
        return track;
      }
      const left: TimelineItem = { ...item, duration: splitPoint };
      const right: TimelineItem = {
        ...item,
        id: `item-${Date.now()}`,
        name: `${item.name} (B)`,
        startTime: item.startTime + splitPoint,
        duration: item.duration - splitPoint,
      };
      const newItems = [...track.items];
      newItems.splice(idx, 1, left, right);
      return { ...track, items: newItems };
    }));
    toast.success('Clip tagliata');
  }, [selectedItem, playhead]);

  const toggleTrackMute = (trackId: string) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, muted: !t.muted } : t));
  };

  const toggleTrackLock = (trackId: string) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, locked: !t.locked } : t));
  };

  const toggleTrackVisible = (trackId: string) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, visible: !t.visible } : t));
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

  const handleImportAudio = useCallback((trackId: string) => {
    setImportTargetTrackId(trackId);
    audioInputRef.current?.click();
  }, []);

  const handleAudioFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !importTargetTrackId) return;

    processMultipleAudioFiles(files, importTargetTrackId);
    e.target.value = '';
    setImportTargetTrackId(null);
  }, [importTargetTrackId]);

  const processDroppedAudioFile = useCallback((file: File, trackId: string) => {
    const maxSizeMB = 50;
    if (file.size / (1024 * 1024) > maxSizeMB) {
      toast.error(`File troppo grande. Max: ${maxSizeMB}MB`);
      return;
    }
    const validExts = ['mp3', 'mpeg', 'wav', 'ogg', 'webm', 'aac', 'mp4'];
    if (!validExts.some(ext => file.type.includes(ext))) {
      toast.error('Formato non supportato. Usa MP3, WAV, OGG, WebM o AAC.');
      return;
    }
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audio.addEventListener('loadedmetadata', () => {
      setTracks(prev => prev.map(track => {
        if (track.id !== trackId) return track;
        const lastEnd = track.items.reduce((max, item) => Math.max(max, item.startTime + item.duration), 0);
        const newItem: TimelineItem = {
          id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: file.name.replace(/\.[^/.]+$/, ''),
          startTime: lastEnd,
          duration: audio.duration,
          url,
          color: track.color,
          volume: 100,
          sourceType: 'upload',
        };
        return { ...track, items: [...track.items, newItem] };
      }));
      toast.success(`"${file.name}" importato nella traccia`);
    });
    audio.addEventListener('error', () => {
      toast.error('Impossibile leggere il file audio');
      URL.revokeObjectURL(url);
    });
  }, []);

  const handleTrackDragOver = useCallback((e: React.DragEvent, trackId: string, trackType: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (trackType === 'video') return;
    e.dataTransfer.dropEffect = 'copy';
    setDragOverTrackId(trackId);
  }, []);

  const handleTrackDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTrackId(null);
  }, []);

  const handleTrackDrop = useCallback((e: React.DragEvent, trackId: string, trackType: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTrackId(null);
    if (trackType === 'video') {
      toast.error('Trascina i file audio su una traccia Voiceover, Music o SFX');
      return;
    }
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('audio/'));
    if (files.length === 0) {
      toast.error('Nessun file audio trovato. Trascina file MP3, WAV, OGG, etc.');
      return;
    }
    files.forEach(file => processDroppedAudioFile(file, trackId));
  }, [processDroppedAudioFile]);

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + timelineRef.current.scrollLeft;
    const time = x / pixelsPerSecond;
    setPlayhead(Math.max(0, Math.min(time, maxDuration)));
  };

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

  // Snap grid lines
  const renderSnapGrid = () => {
    if (!snapEnabled) return null;
    const lines = [];
    for (let t = 0; t <= maxDuration; t += snapInterval) {
      lines.push(
        <div
          key={`snap-${t}`}
          className="absolute top-0 bottom-0 w-px bg-primary/10"
          style={{ left: `${t * pixelsPerSecond}px` }}
        />
      );
    }
    return lines;
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full">
        {/* Hidden audio file input */}
        <input
          ref={audioInputRef}
          type="file"
          accept="audio/mp3,audio/mpeg,audio/wav,audio/ogg,audio/webm,audio/aac,audio/mp4"
          onChange={handleAudioFileSelected}
          className="hidden"
        />
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
            {/* Snap toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={snapEnabled ? 'default' : 'ghost'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setSnapEnabled(!snapEnabled)}
                >
                  <Magnet className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Snap alla griglia ({snapEnabled ? 'ON' : 'OFF'})</TooltipContent>
            </Tooltip>

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
                      {track.type !== 'video' && (
                        <DropdownMenuItem onClick={() => handleImportAudio(track.id)}>
                          <Upload className="w-3.5 h-3.5 mr-2" /> Importa audio
                        </DropdownMenuItem>
                      )}
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
                <div
                  key={track.id}
                  className={`h-16 relative border-b border-border transition-colors ${
                    dragOverTrackId === track.id ? 'bg-primary/10 ring-1 ring-inset ring-primary/40' : ''
                  }`}
                  onDragOver={(e) => handleTrackDragOver(e, track.id, track.type)}
                  onDragLeave={handleTrackDragLeave}
                  onDrop={(e) => handleTrackDrop(e, track.id, track.type)}
                >
                  {/* Grid lines */}
                  {Array.from({ length: Math.ceil(maxDuration) }).map((_, i) => (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 w-px bg-border/30"
                      style={{ left: `${i * pixelsPerSecond}px` }}
                    />
                  ))}

                  {/* Snap grid */}
                  {renderSnapGrid()}

                  {/* Items with drag/resize */}
                  {track.items.map(item => (
                    <DraggableClip
                      key={item.id}
                      item={item}
                      pixelsPerSecond={pixelsPerSecond}
                      isSelected={selectedItem === item.id}
                      isMuted={track.muted}
                      snapInterval={snapInterval}
                      onSelect={setSelectedItem}
                      onMove={track.locked ? () => {} : moveItem}
                      onResize={track.locked ? () => {} : resizeItem}
                    />
                  ))}

                  {/* Drop zone */}
                  {!track.locked && track.items.length === 0 && (
                    <div
                      className={`absolute inset-0 flex items-center justify-center gap-2 transition-opacity ${
                        dragOverTrackId === track.id ? 'opacity-100' : 'opacity-0 hover:opacity-100'
                      }`}
                    >
                      <span
                        className="text-xs text-muted-foreground flex items-center gap-1.5 bg-muted/80 px-3 py-1.5 rounded-full cursor-pointer hover:bg-muted transition-colors"
                        onClick={(e) => { e.stopPropagation(); addItem(track.id); }}
                      >
                        <Plus className="w-3 h-3" /> Aggiungi clip
                      </span>
                      {track.type !== 'video' && (
                        <span
                          className="text-xs text-muted-foreground flex items-center gap-1.5 bg-muted/80 px-3 py-1.5 rounded-full cursor-pointer hover:bg-muted transition-colors"
                          onClick={(e) => { e.stopPropagation(); handleImportAudio(track.id); }}
                        >
                          <Upload className="w-3 h-3" /> Importa audio
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
                <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={duplicateItem}>
                  <Copy className="w-3.5 h-3.5" /> Duplica
                </Button>
                <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={splitItem}>
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
