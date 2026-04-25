import React, { useState, useRef, useEffect, useCallback } from 'react';
import { getStoredAudioProvider } from "@/lib/audioProviderRouter";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Download, Play, Pause, Volume2, Clock, Layers, Plus, Trash2, GripVertical, Loader2, Save, FolderOpen, Scissors, Wand2, Sparkles, Music, Undo2, Redo2, Zap, Wind, MousePointer, Bomb, Bell, Footprints, AudioLines } from 'lucide-react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { TrackWaveform } from './TrackWaveform';
import { AudioEffectsPanel, AudioEffects, defaultAudioEffects } from './AudioEffectsPanel';

interface AudioTrack {
  id: string;
  url: string;
  name: string;
  startTime: number;
  volume: number;
  duration?: number;
  originalDuration?: number; // Original full duration
  trimStart: number; // Trim from start (seconds)
  trimEnd: number; // Trim from end (seconds)
  fadeIn: number;
  fadeOut: number;
  color: string;
  effects: AudioEffects;
}

interface SavedProject {
  id: string;
  name: string;
  videoUrl: string;
  videoName: string;
  tracks: Omit<AudioTrack, 'url'>[]; // URLs are blob URLs so we can't persist them
  createdAt: string;
  updatedAt: string;
}

interface VideoAudioCombinerProps {
  videoUrl: string;
  videoName?: string;
  existingAudioUrl?: string;
  dialogueText?: string;
  onCombined?: (combinedUrl: string) => void;
}

type ExportFormat = 'webm' | 'mp4';
type DragType = 'move' | 'trim-start' | 'trim-end';

// Undo/Redo history types
interface HistoryState {
  tracks: AudioTrack[];
}

// SFX Preset type
interface SfxPreset {
  id: string;
  name: string;
  icon: React.ReactNode;
  prompt: string;
  category: 'sfx' | 'music' | 'ambient';
  duration: number;
}

const TRACK_COLORS = [
  'hsl(var(--primary))',
  'hsl(142, 76%, 36%)',
  'hsl(38, 92%, 50%)',
  'hsl(280, 87%, 65%)',
  'hsl(199, 89%, 48%)',
  'hsl(0, 84%, 60%)',
];

const PROJECTS_STORAGE_KEY = 'video-audio-combiner-projects';

// Maximum history size
const MAX_HISTORY_SIZE = 50;

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
  
  // Project management
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [projectName, setProjectName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  
  // ElevenLabs SFX generation
  const [showSfxDialog, setShowSfxDialog] = useState(false);
  const [sfxPrompt, setSfxPrompt] = useState('');
  const [sfxCategory, setSfxCategory] = useState<'sfx' | 'music' | 'ambient'>('sfx');
  const [sfxDuration, setSfxDuration] = useState(5);
  const [isGeneratingSfx, setIsGeneratingSfx] = useState(false);
  const [generatingPresetId, setGeneratingPresetId] = useState<string | null>(null);
  
  // Undo/Redo state
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedo = useRef(false);
  
  // Drag state for timeline
  const [draggingTrack, setDraggingTrack] = useState<string | null>(null);
  const [dragType, setDragType] = useState<DragType>('move');
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartValue, setDragStartValue] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const ffmpegRef = useRef<FFmpeg | null>(null);

  // SFX Presets
  const sfxPresets: SfxPreset[] = [
    { id: 'explosion', name: 'Esplosione', icon: <Bomb className="h-4 w-4" />, prompt: 'cinematic explosion with deep bass rumble', category: 'sfx', duration: 3 },
    { id: 'whoosh', name: 'Whoosh', icon: <Wind className="h-4 w-4" />, prompt: 'fast swoosh whoosh sound effect', category: 'sfx', duration: 2 },
    { id: 'click', name: 'Click', icon: <MousePointer className="h-4 w-4" />, prompt: 'clean UI button click sound', category: 'sfx', duration: 1 },
    { id: 'notification', name: 'Notifica', icon: <Bell className="h-4 w-4" />, prompt: 'pleasant notification chime sound', category: 'sfx', duration: 2 },
    { id: 'footsteps', name: 'Passi', icon: <Footprints className="h-4 w-4" />, prompt: 'walking footsteps on concrete floor', category: 'sfx', duration: 5 },
    { id: 'impact', name: 'Impatto', icon: <Zap className="h-4 w-4" />, prompt: 'heavy impact hit punch sound', category: 'sfx', duration: 2 },
  ];

  // Track history for undo/redo
  const pushToHistory = useCallback((tracks: AudioTrack[]) => {
    if (isUndoRedo.current) {
      isUndoRedo.current = false;
      return;
    }
    
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push({ tracks: JSON.parse(JSON.stringify(tracks)) });
      
      // Limit history size
      if (newHistory.length > MAX_HISTORY_SIZE) {
        newHistory.shift();
        return newHistory;
      }
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, MAX_HISTORY_SIZE - 1));
  }, [historyIndex]);

  // Undo function
  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    
    isUndoRedo.current = true;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    setAudioTracks(JSON.parse(JSON.stringify(history[newIndex].tracks)));
  }, [historyIndex, history]);

  // Redo function
  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    
    isUndoRedo.current = true;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    setAudioTracks(JSON.parse(JSON.stringify(history[newIndex].tracks)));
  }, [historyIndex, history]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // Load saved projects from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PROJECTS_STORAGE_KEY);
      if (saved) {
        setSavedProjects(JSON.parse(saved));
      }
    } catch (e) {
      console.warn('Failed to load saved projects:', e);
    }
  }, []);

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
        trimStart: 0,
        trimEnd: 0,
        fadeIn: 0,
        fadeOut: 0,
        color: TRACK_COLORS[0],
        effects: defaultAudioEffects
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
            t.id === track.id ? { 
              ...t, 
              duration: audio.duration,
              originalDuration: audio.duration
            } : t
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

  // Calculate effective duration after trim
  const getEffectiveDuration = (track: AudioTrack) => {
    const original = track.originalDuration || track.duration || 0;
    return Math.max(0.1, original - track.trimStart - track.trimEnd);
  };

  const handleVideoLoad = () => {
    if (videoRef.current) {
      setVideoDuration(videoRef.current.duration);
    }
  };

  // Apply fade effects during playback
  const applyFadeEffects = (track: AudioTrack, audio: HTMLAudioElement, videoTime: number) => {
    const effectiveDuration = getEffectiveDuration(track);
    const audioLocalTime = videoTime - track.startTime;
    
    let volumeMultiplier = 1;
    
    // Fade in
    if (track.fadeIn > 0 && audioLocalTime < track.fadeIn) {
      volumeMultiplier = audioLocalTime / track.fadeIn;
    }
    
    // Fade out
    const fadeOutStart = effectiveDuration - track.fadeOut;
    if (track.fadeOut > 0 && audioLocalTime > fadeOutStart) {
      volumeMultiplier = (effectiveDuration - audioLocalTime) / track.fadeOut;
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

      const effectiveDuration = getEffectiveDuration(track);
      const audioStartTime = track.startTime;
      const audioEndTime = audioStartTime + effectiveDuration;

      if (videoTime >= audioStartTime && videoTime < audioEndTime) {
        // Calculate audio time accounting for trim
        const audioTime = (videoTime - audioStartTime) + track.trimStart;
        if (Math.abs(audio.currentTime - audioTime) > 0.3) {
          audio.currentTime = audioTime;
        }
        
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
        
        const effectiveDuration = getEffectiveDuration(track);
        const audioTime = (time - track.startTime) + track.trimStart;
        if (audioTime >= track.trimStart && audioTime < (track.originalDuration || 0) - track.trimEnd) {
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
          trimStart: 0,
          trimEnd: 0,
          fadeIn: 0,
          fadeOut: 0,
          color: TRACK_COLORS[colorIndex],
          effects: defaultAudioEffects
        };
        setAudioTracks(prev => {
          const newTracks = [...prev, newTrack];
          pushToHistory(newTracks);
          return newTracks;
        });
      }
    };
    input.click();
  };

  // Add audio from URL (for ElevenLabs generated audio)
  const addAudioFromUrl = (url: string, name: string, duration: number) => {
    const colorIndex = audioTracks.length % TRACK_COLORS.length;
    const newTrack: AudioTrack = {
      id: `track-${Date.now()}`,
      url,
      name,
      startTime: 0,
      volume: 1,
      duration,
      originalDuration: duration,
      trimStart: 0,
      trimEnd: 0,
      fadeIn: 0,
      fadeOut: 0,
      color: TRACK_COLORS[colorIndex],
      effects: defaultAudioEffects
    };
    setAudioTracks(prev => {
      const newTracks = [...prev, newTrack];
      pushToHistory(newTracks);
      return newTracks;
    });
  };

  // Generate SFX from preset (one click)
  const generateFromPreset = async (preset: SfxPreset) => {
    setGeneratingPresetId(preset.id);
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-music`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            prompt: preset.prompt,
            category: preset.category,
            duration: preset.duration,
            provider: getStoredAudioProvider(preset.category === "music" ? "music_generation" : "sound_effects"),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore nella generazione');
      }

      const data = await response.json();
      const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
      
      addAudioFromUrl(audioUrl, preset.name, data.duration || preset.duration);
      toast.success(`${preset.name} aggiunto alla timeline!`);
    } catch (error) {
      console.error('Error generating preset SFX:', error);
      toast.error(error instanceof Error ? error.message : 'Errore nella generazione');
    } finally {
      setGeneratingPresetId(null);
    }
  };

  // Generate sound effects with ElevenLabs
  const generateSfx = async () => {
    if (!sfxPrompt.trim()) {
      toast.error('Inserisci una descrizione per l\'effetto sonoro');
      return;
    }

    setIsGeneratingSfx(true);
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-music`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            prompt: sfxPrompt,
            category: sfxCategory,
            duration: sfxDuration,
            provider: getStoredAudioProvider(sfxCategory === "music" ? "music_generation" : "sound_effects"),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore nella generazione');
      }

      const data = await response.json();
      
      // Create audio URL from base64
      const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
      
      // Get category label for name
      const categoryLabels = {
        sfx: 'SFX',
        music: 'Musica',
        ambient: 'Ambiente'
      };
      
      addAudioFromUrl(
        audioUrl, 
        `${categoryLabels[sfxCategory]}: ${sfxPrompt.substring(0, 25)}${sfxPrompt.length > 25 ? '...' : ''}`,
        data.duration || sfxDuration
      );
      
      toast.success('Effetto sonoro generato e aggiunto alla timeline!');
      setShowSfxDialog(false);
      setSfxPrompt('');
    } catch (error) {
      console.error('Error generating SFX:', error);
      toast.error(error instanceof Error ? error.message : 'Errore nella generazione dell\'effetto sonoro');
    } finally {
      setIsGeneratingSfx(false);
    }
  };

  const updateTrack = (trackId: string, updates: Partial<AudioTrack>) => {
    setAudioTracks(prev => {
      const newTracks = prev.map(t => 
        t.id === trackId ? { ...t, ...updates } : t
      );
      pushToHistory(newTracks);
      return newTracks;
    });
  };

  const removeTrack = (trackId: string) => {
    const audio = audioRefs.current.get(trackId);
    if (audio) {
      audio.pause();
      URL.revokeObjectURL(audio.src);
      audioRefs.current.delete(trackId);
    }
    setAudioTracks(prev => {
      const newTracks = prev.filter(t => t.id !== trackId);
      pushToHistory(newTracks);
      return newTracks;
    });
  };

  // Timeline drag handlers for move and trim
  const handleTimelineDragStart = (e: React.MouseEvent, trackId: string, type: DragType) => {
    const track = audioTracks.find(t => t.id === trackId);
    if (!track || !timelineRef.current) return;
    
    e.preventDefault();
    e.stopPropagation();
    setDraggingTrack(trackId);
    setDragType(type);
    setDragStartX(e.clientX);
    
    if (type === 'move') {
      setDragStartValue(track.startTime);
    } else if (type === 'trim-start') {
      setDragStartValue(track.trimStart);
    } else if (type === 'trim-end') {
      setDragStartValue(track.trimEnd);
    }
  };

  const handleTimelineDragMove = useCallback((e: MouseEvent) => {
    if (!draggingTrack || !timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const deltaX = e.clientX - dragStartX;
    const deltaSec = (deltaX / rect.width) * videoDuration;
    const track = audioTracks.find(t => t.id === draggingTrack);
    if (!track) return;
    
    if (dragType === 'move') {
      const effectiveDuration = getEffectiveDuration(track);
      const newStartTime = Math.max(0, Math.min(
        videoDuration - effectiveDuration,
        dragStartValue + deltaSec
      ));
      updateTrack(draggingTrack, { startTime: newStartTime });
    } else if (dragType === 'trim-start') {
      const originalDuration = track.originalDuration || track.duration || 0;
      const maxTrim = originalDuration - track.trimEnd - 0.5; // Min 0.5s duration
      const newTrimStart = Math.max(0, Math.min(maxTrim, dragStartValue + deltaSec));
      updateTrack(draggingTrack, { trimStart: newTrimStart });
    } else if (dragType === 'trim-end') {
      const originalDuration = track.originalDuration || track.duration || 0;
      const maxTrim = originalDuration - track.trimStart - 0.5;
      const newTrimEnd = Math.max(0, Math.min(maxTrim, dragStartValue - deltaSec));
      updateTrack(draggingTrack, { trimEnd: newTrimEnd });
    }
  }, [draggingTrack, dragType, dragStartX, dragStartValue, videoDuration, audioTracks]);

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

  // Project save/load functions
  const saveProject = () => {
    if (!projectName.trim()) {
      toast.error('Inserisci un nome per il progetto');
      return;
    }

    const project: SavedProject = {
      id: `project-${Date.now()}`,
      name: projectName,
      videoUrl,
      videoName,
      tracks: audioTracks.map(({ url, ...rest }) => rest),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const updatedProjects = [...savedProjects, project];
    setSavedProjects(updatedProjects);
    
    try {
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(updatedProjects));
      toast.success(`Progetto "${projectName}" salvato!`);
      setShowSaveDialog(false);
      setProjectName('');
    } catch (e) {
      toast.error('Errore nel salvataggio del progetto');
    }
  };

  const loadProject = (project: SavedProject) => {
    // Can only load track metadata, URLs need to be re-added
    toast.info('Progetto caricato. Le tracce audio devono essere ricaricate.');
    setShowLoadDialog(false);
  };

  const deleteProject = (projectId: string) => {
    const updatedProjects = savedProjects.filter(p => p.id !== projectId);
    setSavedProjects(updatedProjects);
    try {
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(updatedProjects));
      toast.success('Progetto eliminato');
    } catch (e) {
      toast.error('Errore nell\'eliminazione del progetto');
    }
  };

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
      const videoData = await fetchFile(videoUrl);
      await ffmpeg.writeFile('input.mp4', videoData);
      setProgress(10);
      setProgressMessage('Video caricato...');

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

      // Build complex filter for audio mixing with trim, fades, and effects
      let filterComplex = '';
      let audioMixInputs = '';
      
      for (let i = 0; i < audioTracks.length; i++) {
        const track = audioTracks[i];
        const inputIdx = i + 1;
        const effectiveDuration = getEffectiveDuration(track);
        
        let audioFilter = `[${inputIdx}:a]`;
        
        // Apply trim first
        if (track.trimStart > 0 || track.trimEnd > 0) {
          const endTime = (track.originalDuration || track.duration || 0) - track.trimEnd;
          audioFilter += `atrim=start=${track.trimStart}:end=${endTime},asetpts=PTS-STARTPTS,`;
        }
        
        // Delay to start at the right time
        if (track.startTime > 0) {
          audioFilter += `adelay=${Math.round(track.startTime * 1000)}|${Math.round(track.startTime * 1000)},`;
        }
        
        // Volume adjustment
        audioFilter += `volume=${track.volume}`;
        
        // Apply audio effects
        const fx = track.effects;
        
        // Pitch shift using asetrate and atempo
        if (fx.pitchEnabled && fx.pitchSemitones !== 0) {
          const pitchRatio = Math.pow(2, fx.pitchSemitones / 12);
          audioFilter += `,asetrate=44100*${pitchRatio},atempo=${1/pitchRatio}`;
        }
        
        // Equalizer (3-band)
        if (fx.eqEnabled && (fx.eqLow !== 0 || fx.eqMid !== 0 || fx.eqHigh !== 0)) {
          const lowGain = fx.eqLow;
          const midGain = fx.eqMid;
          const highGain = fx.eqHigh;
          audioFilter += `,equalizer=f=100:t=h:width=200:g=${lowGain}`;
          audioFilter += `,equalizer=f=1000:t=h:width=1000:g=${midGain}`;
          audioFilter += `,equalizer=f=8000:t=h:width=4000:g=${highGain}`;
        }
        
        // Compressor
        if (fx.compressorEnabled) {
          audioFilter += `,acompressor=threshold=${fx.compressorThreshold}dB:ratio=${fx.compressorRatio}:attack=5:release=50`;
        }
        
        // Reverb using aecho (simulated reverb)
        if (fx.reverbEnabled) {
          const decay = Math.min(0.9, fx.reverbWet / 100);
          const delay = Math.min(500, fx.reverbDecay * 50);
          audioFilter += `,aecho=0.8:${decay}:${delay}:${decay * 0.8}`;
        }
        
        // Fade in
        if (track.fadeIn > 0) {
          audioFilter += `,afade=t=in:st=0:d=${track.fadeIn}`;
        }
        
        // Fade out
        if (track.fadeOut > 0) {
          const fadeOutStart = effectiveDuration - track.fadeOut;
          audioFilter += `,afade=t=out:st=${fadeOutStart}:d=${track.fadeOut}`;
        }
        
        audioFilter += `[a${i}];`;
        filterComplex += audioFilter;
        audioMixInputs += `[a${i}]`;
      }
      
      if (audioTracks.length > 0) {
        filterComplex += `${audioMixInputs}amix=inputs=${audioTracks.length}:duration=longest:dropout_transition=0[aout]`;
      }

      setProgress(40);
      setProgressMessage('Encoding video...');

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

      const data = await ffmpeg.readFile(outputFile);
      const uint8Array = data instanceof Uint8Array ? data : new TextEncoder().encode(data as string);
      const arrayBuffer = new ArrayBuffer(uint8Array.byteLength);
      new Uint8Array(arrayBuffer).set(uint8Array);
      const blob = new Blob([arrayBuffer], { type: exportFormat === 'mp4' ? 'video/mp4' : 'video/webm' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `${videoName}_combined.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

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

      const offlineContext = new OfflineAudioContext(
        2,
        Math.ceil(videoDuration * audioContext.sampleRate),
        audioContext.sampleRate
      );

      // Schedule all audio buffers with trim and fade effects
      audioBuffers.forEach(({ buffer, track }) => {
        const source = offlineContext.createBufferSource();
        source.buffer = buffer;
        
        const gainNode = offlineContext.createGain();
        const startTime = track.startTime;
        const effectiveDuration = getEffectiveDuration(track);
        
        // Set initial gain for fade
        gainNode.gain.setValueAtTime(0, startTime);
        
        if (track.fadeIn > 0) {
          gainNode.gain.linearRampToValueAtTime(track.volume, startTime + track.fadeIn);
        } else {
          gainNode.gain.setValueAtTime(track.volume, startTime);
        }
        
        const fadeOutStart = startTime + effectiveDuration - track.fadeOut;
        gainNode.gain.setValueAtTime(track.volume, fadeOutStart);
        
        if (track.fadeOut > 0) {
          gainNode.gain.linearRampToValueAtTime(0, startTime + effectiveDuration);
        }
        
        source.connect(gainNode);
        gainNode.connect(offlineContext.destination);
        
        // Start with offset for trim
        source.start(startTime, track.trimStart, effectiveDuration);
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
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Editor Video e Audio
            </div>
            <div className="flex items-center gap-2">
              {/* Undo/Redo buttons */}
              <Button 
                variant="outline" 
                size="icon" 
                onClick={undo} 
                disabled={historyIndex <= 0 || isProcessing}
                title="Annulla (Ctrl+Z)"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={redo} 
                disabled={historyIndex >= history.length - 1 || isProcessing}
                title="Ripristina (Ctrl+Y)"
              >
                <Redo2 className="h-4 w-4" />
              </Button>
              <div className="w-px h-6 bg-border mx-1" />
              <Button variant="outline" size="sm" onClick={() => setShowSaveDialog(true)}>
                <Save className="h-4 w-4 mr-1" />
                Salva
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowLoadDialog(true)}>
                <FolderOpen className="h-4 w-4 mr-1" />
                Carica
              </Button>
            </div>
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
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  Timeline
                  <span className="text-xs text-muted-foreground font-normal">
                    (Trascina i bordi per tagliare)
                  </span>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Dialog open={showSfxDialog} onOpenChange={setShowSfxDialog}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={isProcessing}
                        className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 hover:from-purple-500/20 hover:to-pink-500/20 border-purple-500/30"
                      >
                        <Wand2 className="h-4 w-4 mr-2 text-purple-500" />
                        Genera AI
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <Sparkles className="h-5 w-5 text-purple-500" />
                          Genera Audio AI
                        </DialogTitle>
                        <DialogDescription>
                          Descrivi l'effetto sonoro, la musica o l'ambiente che vuoi generare
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Categoria</Label>
                          <Select value={sfxCategory} onValueChange={(v) => setSfxCategory(v as 'sfx' | 'music' | 'ambient')}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sfx">
                                <div className="flex items-center gap-2">
                                  <Sparkles className="h-4 w-4" />
                                  Effetto Sonoro
                                </div>
                              </SelectItem>
                              <SelectItem value="music">
                                <div className="flex items-center gap-2">
                                  <Music className="h-4 w-4" />
                                  Musica di Sottofondo
                                </div>
                              </SelectItem>
                              <SelectItem value="ambient">
                                <div className="flex items-center gap-2">
                                  <Volume2 className="h-4 w-4" />
                                  Suono Ambientale
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Descrizione</Label>
                          <Textarea
                            value={sfxPrompt}
                            onChange={(e) => setSfxPrompt(e.target.value)}
                            placeholder={
                              sfxCategory === 'sfx' 
                                ? "Es: esplosione cinematografica, whoosh veloce, click di bottone, porta che si chiude..."
                                : sfxCategory === 'music'
                                ? "Es: musica epica orchestrale, lo-fi hip hop rilassante, chitarra acustica..."
                                : "Es: foresta con uccelli e vento, pioggia su finestra, traffico cittadino..."
                            }
                            rows={3}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Durata: {sfxDuration} secondi</Label>
                          <Slider
                            value={[sfxDuration]}
                            onValueChange={([v]) => setSfxDuration(v)}
                            min={1}
                            max={sfxCategory === 'sfx' ? 22 : 30}
                            step={1}
                          />
                          <p className="text-xs text-muted-foreground">
                            {sfxCategory === 'sfx' ? 'Max 22 secondi per effetti sonori' : 'Max 30 secondi per musica/ambiente'}
                          </p>
                        </div>
                      </div>

                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowSfxDialog(false)}>
                          Annulla
                        </Button>
                        <Button 
                          onClick={generateSfx} 
                          disabled={isGeneratingSfx || !sfxPrompt.trim()}
                          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                        >
                          {isGeneratingSfx ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              Generazione...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4 mr-1" />
                              Genera
                            </>
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  
                  <Button variant="outline" size="sm" onClick={addAudioTrack} disabled={isProcessing}>
                    <Plus className="h-4 w-4 mr-2" />
                    Aggiungi File
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* Quick SFX Presets */}
              <div className="flex items-center gap-2 pb-2 border-b border-border overflow-x-auto">
                <span className="text-xs text-muted-foreground shrink-0">Preset:</span>
                {sfxPresets.map((preset) => (
                  <Button
                    key={preset.id}
                    variant="outline"
                    size="sm"
                    onClick={() => generateFromPreset(preset)}
                    disabled={isProcessing || generatingPresetId !== null}
                    className="shrink-0 gap-1 text-xs h-7"
                  >
                    {generatingPresetId === preset.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      preset.icon
                    )}
                    {preset.name}
                  </Button>
                ))}
              </div>
              
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
                    Aggiungi tracce audio per iniziare
                  </div>
                ) : (
                  audioTracks.map((track) => {
                    const effectiveDuration = getEffectiveDuration(track);
                    const hasEffects = track.effects.reverbEnabled || track.effects.pitchEnabled || 
                                       track.effects.eqEnabled || track.effects.compressorEnabled;
                    return (
                      <div key={track.id} className="relative h-16 bg-muted/30 rounded">
                        {/* Track block */}
                        <div
                          className={`absolute h-full rounded transition-opacity overflow-hidden ${
                            draggingTrack === track.id ? 'opacity-70' : ''
                          }`}
                          style={{
                            left: `${(track.startTime / videoDuration) * 100}%`,
                            width: `${(effectiveDuration / videoDuration) * 100}%`,
                            backgroundColor: track.color,
                            minWidth: '60px'
                          }}
                        >
                          {/* Waveform visualization */}
                          <div className="absolute inset-0 pointer-events-none">
                            <TrackWaveform
                              audioUrl={track.url}
                              color={track.color}
                              trimStart={track.trimStart}
                              trimEnd={track.trimEnd}
                              isPlaying={isPlaying}
                              currentTime={currentTime}
                              startTime={track.startTime}
                              height={64}
                            />
                          </div>
                          
                          {/* Left trim handle */}
                          <div
                            className="absolute left-0 top-0 w-3 h-full cursor-ew-resize bg-black/30 hover:bg-black/50 flex items-center justify-center rounded-l group z-10"
                            onMouseDown={(e) => handleTimelineDragStart(e, track.id, 'trim-start')}
                          >
                            <Scissors className="h-3 w-3 text-white/70 group-hover:text-white rotate-90" />
                          </div>
                          
                          {/* Center drag area */}
                          <div
                            className="absolute left-3 right-3 top-0 h-full cursor-grab active:cursor-grabbing flex items-center gap-1 px-2 overflow-hidden z-10"
                            onMouseDown={(e) => handleTimelineDragStart(e, track.id, 'move')}
                          >
                            <GripVertical className="h-3 w-3 shrink-0 opacity-60 text-white drop-shadow" />
                            <span className="text-xs font-medium truncate text-white drop-shadow">
                              {track.name}
                            </span>
                            {hasEffects && (
                              <AudioLines className="h-3 w-3 shrink-0 text-white/80" />
                            )}
                          </div>
                          
                          {/* Right trim handle */}
                          <div
                            className="absolute right-0 top-0 w-3 h-full cursor-ew-resize bg-black/30 hover:bg-black/50 flex items-center justify-center rounded-r group z-10"
                            onMouseDown={(e) => handleTimelineDragStart(e, track.id, 'trim-end')}
                          >
                            <Scissors className="h-3 w-3 text-white/70 group-hover:text-white rotate-90" />
                          </div>
                          
                          {/* Fade indicators */}
                          {track.fadeIn > 0 && (
                            <div
                              className="absolute left-3 top-0 h-full bg-gradient-to-r from-black/40 to-transparent pointer-events-none z-5"
                              style={{ width: `${(track.fadeIn / effectiveDuration) * 100}%` }}
                            />
                          )}
                          {track.fadeOut > 0 && (
                            <div
                              className="absolute right-3 top-0 h-full bg-gradient-to-l from-black/40 to-transparent pointer-events-none z-5"
                              style={{ width: `${(track.fadeOut / effectiveDuration) * 100}%` }}
                            />
                          )}
                          
                          {/* Trim info */}
                          {(track.trimStart > 0 || track.trimEnd > 0) && (
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[9px] text-white/80 bg-black/40 px-1 rounded z-10">
                              {track.trimStart > 0 && `↦${track.trimStart.toFixed(1)}s`}
                              {track.trimStart > 0 && track.trimEnd > 0 && ' '}
                              {track.trimEnd > 0 && `${track.trimEnd.toFixed(1)}s↤`}
                            </div>
                          )}
                        </div>
                        
                        {/* Playhead on track */}
                        <div
                          className="absolute top-0 w-0.5 h-full bg-primary/50 pointer-events-none"
                          style={{ left: `${(currentTime / videoDuration) * 100}%` }}
                        />
                      </div>
                    );
                  })
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
                {audioTracks.map((track) => {
                  const effectiveDuration = getEffectiveDuration(track);
                  const originalDuration = track.originalDuration || track.duration || 0;
                  
                  return (
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
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
                        
                        {/* Trim Start */}
                        <div className="space-y-1">
                          <Label className="text-xs flex items-center gap-1">
                            <Scissors className="h-3 w-3" />
                            Taglia inizio: {track.trimStart.toFixed(1)}s
                          </Label>
                          <Slider
                            value={[track.trimStart]}
                            max={originalDuration - track.trimEnd - 0.5}
                            step={0.1}
                            onValueChange={(v) => updateTrack(track.id, { trimStart: v[0] })}
                            disabled={isProcessing}
                          />
                        </div>
                        
                        {/* Trim End */}
                        <div className="space-y-1">
                          <Label className="text-xs flex items-center gap-1">
                            <Scissors className="h-3 w-3" />
                            Taglia fine: {track.trimEnd.toFixed(1)}s
                          </Label>
                          <Slider
                            value={[track.trimEnd]}
                            max={originalDuration - track.trimStart - 0.5}
                            step={0.1}
                            onValueChange={(v) => updateTrack(track.id, { trimEnd: v[0] })}
                            disabled={isProcessing}
                          />
                        </div>
                        
                        {/* Fade In */}
                        <div className="space-y-1">
                          <Label className="text-xs">Fade In: {track.fadeIn.toFixed(1)}s</Label>
                          <Slider
                            value={[track.fadeIn]}
                            max={Math.min(5, effectiveDuration / 2)}
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
                            max={Math.min(5, effectiveDuration / 2)}
                            step={0.1}
                            onValueChange={(v) => updateTrack(track.id, { fadeOut: v[0] })}
                            disabled={isProcessing}
                          />
                        </div>
                      </div>
                      
                      {/* Audio Effects Panel */}
                      <AudioEffectsPanel
                        effects={track.effects}
                        onChange={(effects) => updateTrack(track.id, { effects })}
                        disabled={isProcessing}
                        trackName={track.name}
                        audioUrl={track.url}
                      />
                      
                      <div className="text-xs text-muted-foreground">
                        Originale: {formatTime(originalDuration)} • 
                        Effettiva: {formatTime(effectiveDuration)} • 
                        Fine: {formatTime(track.startTime + effectiveDuration)}
                      </div>
                    </div>
                  );
                })}
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

        {/* Save Project Dialog */}
        {showSaveDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowSaveDialog(false)}>
            <div className="bg-background p-6 rounded-lg shadow-xl max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-4">Salva Progetto</h3>
              <Input
                placeholder="Nome del progetto"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="mb-4"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowSaveDialog(false)}>Annulla</Button>
                <Button onClick={saveProject}>Salva</Button>
              </div>
            </div>
          </div>
        )}

        {/* Load Project Dialog */}
        {showLoadDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowLoadDialog(false)}>
            <div className="bg-background p-6 rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-4">Progetti Salvati</h3>
              {savedProjects.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nessun progetto salvato</p>
              ) : (
                <div className="space-y-2">
                  {savedProjects.map(project => (
                    <div key={project.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{project.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(project.updatedAt).toLocaleDateString('it-IT')}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => loadProject(project)}>
                          Carica
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteProject(project.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-end mt-4">
                <Button variant="outline" onClick={() => setShowLoadDialog(false)}>Chiudi</Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default VideoAudioCombiner;
