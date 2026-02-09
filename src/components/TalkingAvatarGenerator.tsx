import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { TalkingAvatarTimeline, TimelineClip } from './TalkingAvatarTimeline';
import { TalkingAvatarBatch, BatchScene } from './TalkingAvatarBatch';
import { StoryTemplates } from './StoryTemplates';
import { QuickFaceswap } from './QuickFaceswap';
import { UserTemplates } from './UserTemplates';
import { VideoPreviewPlayer } from './VideoPreviewPlayer';
import { ClipEffectsPanel, ClipEffect, DEFAULT_EFFECT, EFFECT_PRESETS } from './ClipEffectsPanel';
import { TransitionSelector, TRANSITION_TYPES } from './TransitionSelector';
import { GenerationStatusIndicator, GenerationStep } from './GenerationStatusIndicator';
import { LivePreviewPanel } from './LivePreviewPanel';
import { ExternalAudioUploader } from './ExternalAudioUploader';
import { useTalkingAvatarProjects, EMOTION_MUSIC_PROMPTS, detectDominantEmotion } from '@/hooks/useTalkingAvatarProjects';
import { useVoiceOptions, DEFAULT_VOICE_OPTIONS } from '@/hooks/useVoiceOptions';
import { 
  User, 
  Upload, 
  Video, 
  ImagePlus, 
  Sparkles, 
  Volume2,
  Download,
  RefreshCw,
  Trash2,
  Wand2,
  Film,
  AudioLines,
  ListOrdered,
  Clock,
  Plus,
  Save,
  FolderOpen,
  Music,
  Loader2,
  Mic
} from 'lucide-react';

interface ReferenceImage {
  id: string;
  url: string;
  name: string;
  isActive: boolean;
}

interface GeneratedVideo {
  id: string;
  url: string;
  prompt: string;
  thumbnail?: string;
  expression?: string;
  createdAt: Date;
}

// Expression presets
const EXPRESSION_PRESETS = [
  { id: 'happy', name: 'Felice', emoji: '😊', promptSuffix: 'with a warm happy smile, joyful expression' },
  { id: 'sad', name: 'Triste', emoji: '😢', promptSuffix: 'with a sad melancholic expression' },
  { id: 'surprised', name: 'Sorpreso', emoji: '😲', promptSuffix: 'with a surprised expression, wide eyes' },
  { id: 'angry', name: 'Arrabbiato', emoji: '😠', promptSuffix: 'with an angry expression, furrowed brows' },
  { id: 'neutral', name: 'Neutro', emoji: '😐', promptSuffix: 'with a calm neutral expression' },
  { id: 'thinking', name: 'Pensieroso', emoji: '🤔', promptSuffix: 'with a thoughtful expression' },
  { id: 'excited', name: 'Eccitato', emoji: '🤩', promptSuffix: 'with an excited enthusiastic expression' },
  { id: 'confident', name: 'Sicuro', emoji: '😎', promptSuffix: 'with a confident expression' },
];

export function TalkingAvatarGenerator() {
  // Voice options hook
  const { voiceOptions, hasClonedVoices } = useVoiceOptions();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'single' | 'batch' | 'timeline'>('single');
  
  // Project management
  const { 
    projects, 
    isLoading: isLoadingProjects, 
    currentProjectId, 
    saveProject, 
    loadProject, 
    deleteProject 
  } = useTalkingAvatarProjects();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  
  // Background music state
  const [backgroundMusicUrl, setBackgroundMusicUrl] = useState<string | null>(null);
  const [backgroundMusicEmotion, setBackgroundMusicEmotion] = useState<string | null>(null);
  const [isGeneratingMusic, setIsGeneratingMusic] = useState(false);
  const [musicDuration, setMusicDuration] = useState(30);
  
  // Batch scenes for project saving
  const [batchScenes, setBatchScenes] = useState<BatchScene[]>([]);
  
  // State for reference images (character consistency)
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [activeReferenceId, setActiveReferenceId] = useState<string | null>(null);
  
  // State for prompt and generation
  const [scenePrompt, setScenePrompt] = useState('');
  const [dialogueText, setDialogueText] = useState('');
  const [audioDescription, setAudioDescription] = useState('');
  const [selectedExpression, setSelectedExpression] = useState('neutral');
  
  // Audio state
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [useTTS, setUseTTS] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState(DEFAULT_VOICE_OPTIONS[0].id);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  
  // External audio for lip sync
  const [externalAudioUrl, setExternalAudioUrl] = useState<string | null>(null);
  const [useLipSync, setUseLipSync] = useState(false);
  const [externalAudioDuration, setExternalAudioDuration] = useState<number | null>(null);
  
  // Generation settings
  const [sampleSteps, setSampleSteps] = useState(20);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentEventId, setCurrentEventId] = useState<string | null>(null);
  const [generationStep, setGenerationStep] = useState<GenerationStep>('idle');
  const [generationError, setGenerationError] = useState<string | null>(null);
  
  // Generated videos
  const [generatedVideos, setGeneratedVideos] = useState<GeneratedVideo[]>([]);
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);
  
  // Timeline clips
  const [timelineClips, setTimelineClips] = useState<TimelineClip[]>([]);
  
  // Selected clip for effects
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [clipEffects, setClipEffects] = useState<Record<string, ClipEffect>>({});
  
  // Music volume for preview
  const [musicVolume, setMusicVolume] = useState(30);
  
  // Transition state
  const [selectedTransition, setSelectedTransition] = useState('fade');
  const [transitionDuration, setTransitionDuration] = useState(0.5);
  
  // Refs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Get active reference image URL
  const activeReferenceUrl = referenceImages.find(img => img.id === activeReferenceId)?.url || null;

  // Build the full prompt in Ovi format with expression
  const buildFullPrompt = useCallback(() => {
    let prompt = scenePrompt;
    
    // Add expression
    const expression = EXPRESSION_PRESETS.find(e => e.id === selectedExpression);
    if (expression && expression.promptSuffix) {
      prompt += `, ${expression.promptSuffix}`;
    }
    
    if (dialogueText) {
      prompt += `, <S>${dialogueText}<E>`;
    }
    
    if (audioDescription) {
      prompt += ` <AUDCAP>${audioDescription}<ENDAUDCAP>`;
    }
    
    return prompt;
  }, [scenePrompt, dialogueText, audioDescription, selectedExpression]);

  // Handle image upload for reference
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const newImage: ReferenceImage = {
          id: crypto.randomUUID(),
          url: event.target?.result as string,
          name: file.name,
          isActive: referenceImages.length === 0,
        };
        setReferenceImages((prev) => [...prev, newImage]);
        if (referenceImages.length === 0) {
          setActiveReferenceId(newImage.id);
        }
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  }, [referenceImages.length]);

  // Handle audio file upload
  const handleAudioUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAudioUrl(URL.createObjectURL(file));
    setGeneratedAudioUrl(null);
    e.target.value = '';
  }, []);

  // Generate TTS audio using ElevenLabs
  const generateTTSAudio = useCallback(async () => {
    if (!dialogueText.trim()) {
      toast.error('Inserisci un testo per il dialogo');
      return null;
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            text: dialogueText,
            voiceId: selectedVoice,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Errore generazione audio TTS');
      }

      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);
      setGeneratedAudioUrl(url);
      toast.success('Audio TTS generato!');
      return url;
    } catch (error: any) {
      console.error('TTS error:', error);
      toast.error(error.message || 'Errore generazione TTS');
      return null;
    }
  }, [dialogueText, selectedVoice]);

  // Poll for generation status
  useEffect(() => {
    if (!currentEventId || !isGenerating) return;

    const pollInterval = setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('talking-avatar', {
          body: {
            action: 'status',
            eventId: currentEventId,
          },
        });

        if (error) {
          console.error('Status poll error:', error);
          return;
        }

        if (data.status === 'COMPLETED' && data.videoUrl) {
          clearInterval(pollInterval);
          setIsGenerating(false);
          setProgress(100);
          setCurrentEventId(null);
          
          const newVideo: GeneratedVideo = {
            id: crypto.randomUUID(),
            url: data.videoUrl,
            prompt: buildFullPrompt(),
            expression: selectedExpression,
            createdAt: new Date(),
          };
          
          setGeneratedVideos((prev) => [newVideo, ...prev]);
          setPreviewVideo(data.videoUrl);
          toast.success('Video talking avatar generato!');
        } else if (data.status === 'FAILED') {
          clearInterval(pollInterval);
          setIsGenerating(false);
          setProgress(0);
          setCurrentEventId(null);
          toast.error(data.error || 'Generazione fallita');
        } else {
          setProgress((prev) => Math.min(prev + 5, 90));
        }
      } catch (err) {
        console.error('Poll error:', err);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [currentEventId, isGenerating, buildFullPrompt, selectedExpression]);

  // Generate talking avatar video
  const handleGenerate = useCallback(async () => {
    const activeImage = referenceImages.find((img) => img.id === activeReferenceId);
    if (!activeImage) {
      toast.error('Seleziona un\'immagine di riferimento');
      return;
    }

    if (!scenePrompt.trim()) {
      toast.error('Inserisci una descrizione della scena');
      return;
    }

    setIsGenerating(true);
    setProgress(10);
    setGenerationStep('preparing');
    setGenerationError(null);

    try {
      // Step 1: Prepare audio if needed
      let finalAudioUrl = audioUrl;
      if (useTTS && dialogueText.trim() && !generatedAudioUrl) {
        setGenerationStep('generating_audio');
        setProgress(20);
        finalAudioUrl = await generateTTSAudio();
      } else if (generatedAudioUrl) {
        finalAudioUrl = generatedAudioUrl;
      }

      // Step 2: Upload image
      setGenerationStep('uploading_image');
      setProgress(30);

      // Step 3: Build prompt and send request
      const fullPrompt = buildFullPrompt();
      console.log('Generating with prompt:', fullPrompt);

      // Prepare request body with optional external audio
      const requestBody: Record<string, unknown> = {
        action: 'generate',
        prompt: fullPrompt,
        imageUrl: activeImage.url,
        audioUrl: finalAudioUrl,
        sampleSteps,
      };

      // Add external audio for lip sync if enabled
      if (useLipSync && externalAudioUrl) {
        setGenerationStep('uploading_audio');
        setProgress(35);
        requestBody.externalAudioUrl = externalAudioUrl;
        requestBody.useLipSync = true;
      }

      setGenerationStep('processing');
      setProgress(40);

      const { data, error } = await supabase.functions.invoke('talking-avatar', {
        body: requestBody,
      });

      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);

      if (data.eventId) {
        setCurrentEventId(data.eventId);
        setProgress(50);
        setGenerationStep('rendering');
        toast.info('Generazione in corso... Attendere.');
      } else if (data.videoUrl) {
        const newVideo: GeneratedVideo = {
          id: crypto.randomUUID(),
          url: data.videoUrl,
          prompt: fullPrompt,
          expression: selectedExpression,
          createdAt: new Date(),
        };
        
        setGeneratedVideos((prev) => [newVideo, ...prev]);
        setPreviewVideo(data.videoUrl);
        setIsGenerating(false);
        setProgress(100);
        setGenerationStep('completed');
        toast.success('Video generato!');
      }
    } catch (error: any) {
      console.error('Generation error:', error);
      toast.error(error.message || 'Errore durante la generazione');
      setIsGenerating(false);
      setProgress(0);
      setGenerationStep('failed');
      setGenerationError(error.message || 'Errore sconosciuto');
    }
  }, [
    referenceImages,
    activeReferenceId,
    scenePrompt,
    audioUrl,
    useTTS,
    dialogueText,
    generatedAudioUrl,
    generateTTSAudio,
    buildFullPrompt,
    sampleSteps,
    selectedExpression,
    useLipSync,
    externalAudioUrl,
  ]);

  // Set active reference image
  const setActiveReference = useCallback((id: string) => {
    setActiveReferenceId(id);
    setReferenceImages((prev) =>
      prev.map((img) => ({
        ...img,
        isActive: img.id === id,
      }))
    );
  }, []);

  // Remove reference image
  const removeReferenceImage = useCallback((id: string) => {
    setReferenceImages((prev) => {
      const filtered = prev.filter((img) => img.id !== id);
      if (activeReferenceId === id && filtered.length > 0) {
        setActiveReferenceId(filtered[0].id);
        filtered[0].isActive = true;
      }
      return filtered;
    });
  }, [activeReferenceId]);

  // Add video to timeline
  const addToTimeline = useCallback((video: GeneratedVideo) => {
    const newClip: TimelineClip = {
      id: video.id,
      videoUrl: video.url,
      prompt: video.prompt,
      duration: 5, // Default 5 seconds
      expression: video.expression,
      order: timelineClips.length,
    };
    setTimelineClips((prev) => [...prev, newClip]);
    toast.success('Video aggiunto alla timeline!');
  }, [timelineClips.length]);

  // Handle batch scene generated
  const handleBatchSceneGenerated = useCallback((scene: BatchScene) => {
    if (scene.videoUrl) {
      const newClip: TimelineClip = {
        id: scene.id,
        videoUrl: scene.videoUrl,
        prompt: scene.scenePrompt,
        duration: 5,
        expression: scene.expression,
        order: timelineClips.length,
      };
      setTimelineClips((prev) => [...prev, newClip]);
    }
  }, [timelineClips.length]);

  // Handle all batch scenes completed
  const handleBatchCompleted = useCallback((scenes: BatchScene[]) => {
    setBatchScenes(scenes);
    // Auto-switch to timeline tab
    setActiveTab('timeline');
  }, []);

  // Timeline clip management
  const handleRemoveClip = useCallback((id: string) => {
    setTimelineClips((prev) => {
      const filtered = prev.filter(c => c.id !== id);
      return filtered.map((c, i) => ({ ...c, order: i }));
    });
  }, []);

  const handleReorderClips = useCallback((fromIndex: number, toIndex: number) => {
    setTimelineClips((prev) => {
      const newClips = [...prev];
      const [movedClip] = newClips.splice(fromIndex, 1);
      newClips.splice(toIndex, 0, movedClip);
      return newClips.map((c, i) => ({ ...c, order: i }));
    });
  }, []);

  // Download video
  const handleDownload = useCallback((url: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `talking-avatar-${Date.now()}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  // Handle clip effects change
  const handleClipEffectChange = useCallback((clipId: string, effect: ClipEffect) => {
    setClipEffects(prev => ({ ...prev, [clipId]: effect }));
  }, []);

  // Handle clip selection from timeline
  const handleClipSelect = useCallback((clipId: string | null) => {
    setSelectedClipId(clipId);
  }, []);

  // Get selected clip
  const selectedClip = selectedClipId ? timelineClips.find(c => c.id === selectedClipId) || null : null;

  // Save project
  const handleSaveProject = useCallback(async () => {
    if (!projectName.trim()) {
      toast.error('Inserisci un nome per il progetto');
      return;
    }

    const id = await saveProject(
      projectName,
      projectDescription,
      batchScenes,
      timelineClips,
      referenceImages,
      backgroundMusicUrl || undefined,
      backgroundMusicEmotion || undefined,
      { selectedVoice, sampleSteps },
      currentProjectId || undefined
    );

    if (id) {
      setShowSaveDialog(false);
    }
  }, [projectName, projectDescription, batchScenes, timelineClips, referenceImages, backgroundMusicUrl, backgroundMusicEmotion, selectedVoice, sampleSteps, saveProject, currentProjectId]);

  // Load project
  const handleLoadProject = useCallback(async (projectId: string) => {
    const project = await loadProject(projectId);
    if (project) {
      setProjectName(project.name);
      setProjectDescription(project.description || '');
      setBatchScenes(project.scenes);
      setTimelineClips(project.timeline_clips);
      setReferenceImages(project.reference_images.map(img => ({ ...img, isActive: false })));
      if (project.reference_images.length > 0) {
        setActiveReferenceId(project.reference_images[0].id);
      }
      setBackgroundMusicUrl(project.background_music_url || null);
      setBackgroundMusicEmotion(project.background_music_emotion || null);
      if (project.settings.selectedVoice) {
        setSelectedVoice(project.settings.selectedVoice as string);
      }
      if (project.settings.sampleSteps) {
        setSampleSteps(project.settings.sampleSteps as number);
      }
      setShowLoadDialog(false);
    }
  }, [loadProject]);

  // Generate background music based on scene emotions
  const generateBackgroundMusic = useCallback(async (customEmotion?: string) => {
    const emotion = customEmotion || detectDominantEmotion(batchScenes) || detectDominantEmotion(
      timelineClips.map(c => ({ expression: c.expression || 'neutral' } as BatchScene))
    );
    
    const musicPrompt = EMOTION_MUSIC_PROMPTS[emotion] || EMOTION_MUSIC_PROMPTS.neutral;
    
    setIsGeneratingMusic(true);
    setBackgroundMusicEmotion(emotion);
    
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
            prompt: musicPrompt,
            category: 'music',
            duration: musicDuration,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Errore generazione musica');
      }

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      // Convert base64 to audio URL
      const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
      setBackgroundMusicUrl(audioUrl);
      toast.success(`Musica di sottofondo generata (${emotion})!`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Errore sconosciuto';
      console.error('Music generation error:', error);
      toast.error(`Errore generazione musica: ${message}`);
    } finally {
      setIsGeneratingMusic(false);
    }
  }, [batchScenes, timelineClips, musicDuration]);

  // Handle story template selection
  const handleTemplateSelect = useCallback((scenes: BatchScene[], suggestedEmotion: string) => {
    setBatchScenes(scenes);
    // Convert to timeline clips
    const clips: TimelineClip[] = scenes.map((scene, index) => ({
      id: scene.id,
      videoUrl: '', // Will be filled when generated
      prompt: scene.scenePrompt,
      duration: 5,
      expression: scene.expression,
      order: index,
    }));
    // Don't add empty clips to timeline yet - user needs to generate first
    
    // Auto-generate music for the template's suggested emotion
    if (suggestedEmotion) {
      generateBackgroundMusic(suggestedEmotion);
    }
    
    // Switch to batch tab
    setActiveTab('batch');
    toast.success('Template applicato! Genera le scene nel tab Batch.');
  }, [generateBackgroundMusic]);

  // Apply preset effect to all clips
  const handleApplyEffectToAll = useCallback((effectPartial: Partial<ClipEffect>) => {
    if (timelineClips.length === 0) {
      toast.error('Nessun clip nella timeline');
      return;
    }
    
    const newEffects = { ...clipEffects };
    timelineClips.forEach(clip => {
      const currentEffect = newEffects[clip.id] || DEFAULT_EFFECT;
      newEffects[clip.id] = { ...currentEffect, ...effectPartial };
    });
    setClipEffects(newEffects);
    toast.success(`Effetto applicato a ${timelineClips.length} clip!`);
  }, [timelineClips, clipEffects]);

  return (
    <div className="space-y-6">
      {/* Project Management Bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Save Dialog */}
            <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Save className="w-4 h-4 mr-2" />
                  Salva Progetto
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Salva Progetto</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Nome Progetto</Label>
                    <Input 
                      value={projectName} 
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="La mia storia..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Descrizione (opzionale)</Label>
                    <Textarea 
                      value={projectDescription} 
                      onChange={(e) => setProjectDescription(e.target.value)}
                      placeholder="Descrivi il progetto..."
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                    Annulla
                  </Button>
                  <Button onClick={handleSaveProject}>
                    <Save className="w-4 h-4 mr-2" />
                    {currentProjectId ? 'Aggiorna' : 'Salva'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Load Dialog */}
            <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <FolderOpen className="w-4 h-4 mr-2" />
                  Carica Progetto
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>I Tuoi Progetti</DialogTitle>
                </DialogHeader>
                <ScrollArea className="h-[400px]">
                  {isLoadingProjects ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  ) : projects.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Nessun progetto salvato
                    </div>
                  ) : (
                    <div className="space-y-2 pr-4">
                      {projects.map((project) => (
                        <div
                          key={project.id}
                          className="p-3 rounded-lg border hover:border-primary transition-colors cursor-pointer"
                          onClick={() => handleLoadProject(project.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">{project.name}</h4>
                              {project.description && (
                                <p className="text-sm text-muted-foreground truncate max-w-[300px]">
                                  {project.description}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary" className="text-xs">
                                  {project.scenes.length} scene
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  {project.timeline_clips.length} clip
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(project.updated_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteProject(project.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </DialogContent>
            </Dialog>

            {currentProjectId && (
              <Badge variant="outline" className="text-xs">
                Progetto: {projectName}
              </Badge>
            )}

            {/* Story Templates */}
            <StoryTemplates onSelectTemplate={handleTemplateSelect} />
            
            {/* User Templates */}
            <UserTemplates 
              currentScenes={batchScenes}
              onSelectTemplate={handleTemplateSelect}
            />

            {/* Quick Faceswap */}
            <QuickFaceswap />

            {/* Background Music Section */}
            <div className="flex items-center gap-2">
              <Select value={String(musicDuration)} onValueChange={(v) => setMusicDuration(Number(v))}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 sec</SelectItem>
                  <SelectItem value="20">20 sec</SelectItem>
                  <SelectItem value="30">30 sec</SelectItem>
                </SelectContent>
              </Select>
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => generateBackgroundMusic()}
                disabled={isGeneratingMusic}
              >
                {isGeneratingMusic ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Music className="w-4 h-4 mr-2" />
                )}
                Genera Musica AI
              </Button>
            </div>

            {backgroundMusicUrl && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  🎵 {backgroundMusicEmotion}
                </Badge>
                <audio src={backgroundMusicUrl} controls className="h-8 w-40" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-6 h-6"
                  onClick={() => {
                    setBackgroundMusicUrl(null);
                    setBackgroundMusicEmotion(null);
                  }}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="single" className="flex items-center gap-2">
            <Wand2 className="w-4 h-4" />
            Singolo
          </TabsTrigger>
          <TabsTrigger value="batch" className="flex items-center gap-2">
            <ListOrdered className="w-4 h-4" />
            Batch
          </TabsTrigger>
          <TabsTrigger value="timeline" className="flex items-center gap-2">
            <Film className="w-4 h-4" />
            Timeline ({timelineClips.length})
          </TabsTrigger>
        </TabsList>

        {/* Single Generation Tab */}
        <TabsContent value="single">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Panel - Reference Images */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Character Reference
                </CardTitle>
                <CardDescription>
                  Carica immagini per mantenere la consistenza del personaggio
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
                
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => imageInputRef.current?.click()}
                >
                  <ImagePlus className="w-4 h-4 mr-2" />
                  Aggiungi Immagine
                </Button>

                <ScrollArea className="h-[300px]">
                  <div className="grid grid-cols-2 gap-2">
                    {referenceImages.map((img) => (
                      <div
                        key={img.id}
                        className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                          img.id === activeReferenceId
                            ? 'border-primary ring-2 ring-primary/30'
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => setActiveReference(img.id)}
                      >
                        <img
                          src={img.url}
                          alt={img.name}
                          className="w-full aspect-square object-cover"
                        />
                        {img.id === activeReferenceId && (
                          <Badge className="absolute top-1 left-1 text-xs">
                            Attivo
                          </Badge>
                        )}
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeReferenceImage(img.id);
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {referenceImages.length > 0 && (
                  <div className="text-xs text-muted-foreground text-center">
                    {referenceImages.length} immagine/i
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Center Panel - Prompt & Settings */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wand2 className="w-5 h-5" />
                  Generazione Video
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Tabs defaultValue="prompt" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="prompt">Prompt</TabsTrigger>
                    <TabsTrigger value="audio">Audio</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="prompt" className="space-y-4">
                    <div className="space-y-2">
                      <Label>Descrizione Scena</Label>
                      <Textarea
                        placeholder="Es: A woman looking at the camera..."
                        value={scenePrompt}
                        onChange={(e) => setScenePrompt(e.target.value)}
                        rows={3}
                      />
                    </div>
                    
                    {/* Expression Presets */}
                    <div className="space-y-2">
                      <Label>Espressione Facciale</Label>
                      <div className="flex flex-wrap gap-1">
                        {EXPRESSION_PRESETS.map(preset => (
                          <Button
                            key={preset.id}
                            variant={selectedExpression === preset.id ? 'default' : 'outline'}
                            size="sm"
                            className="h-8"
                            onClick={() => setSelectedExpression(preset.id)}
                          >
                            {preset.emoji} {preset.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Dialogo (opzionale)</Label>
                      <Textarea
                        placeholder="Es: Hello! Welcome..."
                        value={dialogueText}
                        onChange={(e) => setDialogueText(e.target.value)}
                        rows={2}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Atmosfera Audio</Label>
                      <Textarea
                        placeholder="Es: cheerful voice..."
                        value={audioDescription}
                        onChange={(e) => setAudioDescription(e.target.value)}
                        rows={2}
                      />
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="audio" className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Usa Text-to-Speech</Label>
                      <Switch checked={useTTS} onCheckedChange={setUseTTS} />
                    </div>
                    
                    {useTTS ? (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            Voce
                            {hasClonedVoices && (
                              <span className="text-xs text-primary flex items-center gap-1">
                                <Mic className="w-3 h-3" />
                                Clonate disponibili
                              </span>
                            )}
                          </Label>
                          <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {hasClonedVoices && (
                                <>
                                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                    <Mic className="w-3 h-3" />
                                    Voci Clonate
                                  </div>
                                  {voiceOptions.filter(v => v.isCloned).map((voice) => (
                                    <SelectItem key={voice.id} value={voice.id}>
                                      <span className="text-primary">{voice.name}</span>
                                    </SelectItem>
                                  ))}
                                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">
                                    Predefinite
                                  </div>
                                </>
                              )}
                              {voiceOptions.filter(v => !v.isCloned).map((voice) => (
                                <SelectItem key={voice.id} value={voice.id}>
                                  {voice.name} - {voice.description}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={generateTTSAudio}
                          disabled={!dialogueText.trim() || isGenerating}
                        >
                          <Volume2 className="w-4 h-4 mr-2" />
                          Genera Audio TTS
                        </Button>
                        
                        {generatedAudioUrl && (
                          <audio src={generatedAudioUrl} controls className="w-full" />
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <input
                          ref={audioInputRef}
                          type="file"
                          accept="audio/*"
                          onChange={handleAudioUpload}
                          className="hidden"
                        />
                        
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => audioInputRef.current?.click()}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Carica File Audio
                        </Button>
                        
                        {audioUrl && <audio src={audioUrl} controls className="w-full" />}
                      </div>
                    )}
                    
                    {/* External Audio for Lip Sync */}
                    <div className="pt-3 border-t space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2">
                          <AudioLines className="w-4 h-4" />
                          Lip Sync con Audio Esterno
                        </Label>
                        <Switch checked={useLipSync} onCheckedChange={setUseLipSync} />
                      </div>
                      
                      {useLipSync && (
                        <ExternalAudioUploader
                          audioUrl={externalAudioUrl}
                          onAudioChange={setExternalAudioUrl}
                          onAudioDuration={setExternalAudioDuration}
                          disabled={isGenerating}
                        />
                      )}
                      
                      {useLipSync && externalAudioDuration && (
                        <Badge variant="outline" className="w-full justify-center text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          Audio: {Math.floor(externalAudioDuration / 60)}:{Math.floor(externalAudioDuration % 60).toString().padStart(2, '0')}
                        </Badge>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Settings */}
                <div className="space-y-4 pt-4 border-t">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label>Sample Steps</Label>
                      <span className="text-sm text-muted-foreground">{sampleSteps}</span>
                    </div>
                    <Slider
                      value={[sampleSteps]}
                      onValueChange={([v]) => setSampleSteps(v)}
                      min={10}
                      max={50}
                      step={5}
                    />
                  </div>
                </div>

                {/* Generation Status Indicator */}
                <GenerationStatusIndicator
                  step={generationStep}
                  progress={progress}
                  errorMessage={generationError || undefined}
                  estimatedTime={120}
                />

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleGenerate}
                  disabled={isGenerating || !activeReferenceId || !scenePrompt.trim()}
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Generazione...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Genera Video
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Right Panel - Preview */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Film className="w-5 h-5" />
                  Anteprima
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="aspect-video bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                  {previewVideo ? (
                    <video src={previewVideo} controls className="w-full h-full object-contain" />
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <Video className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Nessun video</p>
                    </div>
                  )}
                </div>

                {previewVideo && (
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => handleDownload(previewVideo)}>
                      <Download className="w-4 h-4 mr-2" />
                      Scarica
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={() => {
                      const video = generatedVideos.find(v => v.url === previewVideo);
                      if (video) addToTimeline(video);
                    }}>
                      <Plus className="w-4 h-4 mr-2" />
                      Timeline
                    </Button>
                  </div>
                )}

                {/* Video History */}
                {generatedVideos.length > 0 && (
                  <div className="space-y-2">
                    <Label>Video Generati</Label>
                    <ScrollArea className="h-[150px]">
                      <div className="space-y-2">
                        {generatedVideos.map((video) => (
                          <div
                            key={video.id}
                            className={`p-2 rounded-lg border cursor-pointer transition-all ${
                              previewVideo === video.url ? 'border-primary bg-primary/5' : 'border-border'
                            }`}
                            onClick={() => setPreviewVideo(video.url)}
                          >
                            <div className="flex items-center gap-2">
                              <Video className="w-4 h-4 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm truncate">{video.prompt.slice(0, 30)}...</p>
                                <div className="flex items-center gap-1">
                                  {video.expression && (
                                    <Badge variant="secondary" className="text-xs">
                                      {EXPRESSION_PRESETS.find(e => e.id === video.expression)?.emoji}
                                    </Badge>
                                  )}
                                  <span className="text-xs text-muted-foreground">
                                    {video.createdAt.toLocaleTimeString()}
                                  </span>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-6 h-6"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addToTimeline(video);
                                }}
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {/* Prompt Preview */}
                {(scenePrompt || dialogueText) && (
                  <div className="space-y-2 pt-4 border-t">
                    <Label className="flex items-center gap-1">
                      <AudioLines className="w-3 h-3" />
                      Prompt
                    </Label>
                    <div className="p-3 bg-muted rounded-lg text-xs font-mono break-all max-h-24 overflow-auto">
                      {buildFullPrompt()}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Batch Generation Tab */}
        <TabsContent value="batch">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Reference Images */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Character Reference
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
                
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => imageInputRef.current?.click()}
                >
                  <ImagePlus className="w-4 h-4 mr-2" />
                  Aggiungi Immagine
                </Button>

                <ScrollArea className="h-[200px]">
                  <div className="grid grid-cols-2 gap-2">
                    {referenceImages.map((img) => (
                      <div
                        key={img.id}
                        className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 ${
                          img.id === activeReferenceId ? 'border-primary' : 'border-border'
                        }`}
                        onClick={() => setActiveReference(img.id)}
                      >
                        <img src={img.url} alt={img.name} className="w-full aspect-square object-cover" />
                        {img.id === activeReferenceId && (
                          <Badge className="absolute top-1 left-1 text-xs">Attivo</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {/* Voice Selection */}
                <div className="space-y-2 pt-4 border-t">
                  <Label className="flex items-center gap-2">
                    Voce TTS
                    {hasClonedVoices && (
                      <Mic className="w-3 h-3 text-primary" />
                    )}
                  </Label>
                  <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {hasClonedVoices && (
                        <>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                            <Mic className="w-3 h-3" />
                            Voci Clonate
                          </div>
                          {voiceOptions.filter(v => v.isCloned).map((voice) => (
                            <SelectItem key={voice.id} value={voice.id}>
                              <span className="text-primary">{voice.name}</span>
                            </SelectItem>
                          ))}
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">
                            Predefinite
                          </div>
                        </>
                      )}
                      {voiceOptions.filter(v => !v.isCloned).map((voice) => (
                        <SelectItem key={voice.id} value={voice.id}>
                          {voice.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Sample Steps: {sampleSteps}</Label>
                  <Slider
                    value={[sampleSteps]}
                    onValueChange={([v]) => setSampleSteps(v)}
                    min={10}
                    max={50}
                    step={5}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Batch Queue */}
            <div className="lg:col-span-2">
              <TalkingAvatarBatch
                referenceImageUrl={activeReferenceUrl}
                selectedVoice={selectedVoice}
                sampleSteps={sampleSteps}
                initialScenes={batchScenes}
                onSceneGenerated={handleBatchSceneGenerated}
                onAllCompleted={handleBatchCompleted}
                onScenesChange={setBatchScenes}
              />
            </div>
          </div>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Panel - Video Preview & Effects */}
            <div className="lg:col-span-1 space-y-6">
              <VideoPreviewPlayer
                clips={timelineClips}
                backgroundMusicUrl={backgroundMusicUrl}
                backgroundMusicEmotion={backgroundMusicEmotion}
                musicVolume={musicVolume}
                onMusicVolumeChange={setMusicVolume}
                clipEffects={clipEffects}
                transition={selectedTransition}
                transitionDuration={transitionDuration}
              />
              
              {/* Transition Selector */}
              <TransitionSelector
                selectedTransition={selectedTransition}
                onTransitionChange={setSelectedTransition}
                transitionDuration={transitionDuration}
                onDurationChange={setTransitionDuration}
              />
              
              {/* Clip Effects Panel */}
              <ClipEffectsPanel
                clip={selectedClip}
                allClips={timelineClips}
                effects={clipEffects}
                onEffectsChange={handleClipEffectChange}
                onApplyToAll={handleApplyEffectToAll}
              />
            </div>
            
            {/* Timeline Editor */}
            <div className="lg:col-span-2">
              <TalkingAvatarTimeline
                clips={timelineClips}
                onClipsChange={setTimelineClips}
                onRemoveClip={handleRemoveClip}
                onReorderClips={handleReorderClips}
                backgroundMusicUrl={backgroundMusicUrl}
                backgroundMusicEmotion={backgroundMusicEmotion}
                onClipSelect={handleClipSelect}
                selectedClipId={selectedClipId}
                clipEffects={clipEffects}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default TalkingAvatarGenerator;
