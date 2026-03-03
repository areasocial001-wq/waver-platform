import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Plus, 
  Trash2, 
  Play, 
  Pause,
  ChevronUp,
  ChevronDown,
  Sparkles,
  ListOrdered,
  Film
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export interface BatchScene {
  id: string;
  order: number;
  scenePrompt: string;
  dialogueText: string;
  expression: string;
  audioDescription: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
  progress: number;
}

interface TalkingAvatarBatchProps {
  referenceImageUrl: string | null;
  selectedVoice: string;
  sampleSteps: number;
  initialScenes?: BatchScene[];
  onSceneGenerated: (scene: BatchScene) => void;
  onAllCompleted: (scenes: BatchScene[]) => void;
  onScenesChange?: (scenes: BatchScene[]) => void;
}

// Expression presets with keywords for auto-detection
const EXPRESSION_PRESETS = [
  { 
    id: 'happy', 
    name: 'Felice', 
    emoji: '😊',
    keywords: ['felice', 'happy', 'gioia', 'joy', 'contento', 'glad', 'sorriso', 'smile', 'fantastico', 'great', 'wonderful', 'meraviglioso'],
    promptSuffix: 'with a warm happy smile, joyful expression, bright eyes'
  },
  { 
    id: 'sad', 
    name: 'Triste', 
    emoji: '😢',
    keywords: ['triste', 'sad', 'piangere', 'cry', 'dolore', 'pain', 'sconsolato', 'upset', 'dispiaciuto', 'sorry', 'purtroppo', 'unfortunately'],
    promptSuffix: 'with a sad melancholic expression, slightly downturned mouth, sorrowful eyes'
  },
  { 
    id: 'surprised', 
    name: 'Sorpreso', 
    emoji: '😲',
    keywords: ['sorpreso', 'surprised', 'incredibile', 'incredible', 'wow', 'shocka', 'shock', 'non ci credo', 'unbelievable', 'davvero', 'really'],
    promptSuffix: 'with a surprised expression, raised eyebrows, wide eyes, slightly open mouth'
  },
  { 
    id: 'angry', 
    name: 'Arrabbiato', 
    emoji: '😠',
    keywords: ['arrabbiato', 'angry', 'furioso', 'furious', 'rabbia', 'rage', 'incazzato', 'mad', 'basta', 'enough', 'stufo'],
    promptSuffix: 'with an angry expression, furrowed brows, intense stern look'
  },
  { 
    id: 'neutral', 
    name: 'Neutro', 
    emoji: '😐',
    keywords: [],
    promptSuffix: 'with a calm neutral expression, professional demeanor'
  },
  { 
    id: 'thinking', 
    name: 'Pensieroso', 
    emoji: '🤔',
    keywords: ['penso', 'think', 'forse', 'maybe', 'hmm', 'potrebbe', 'could', 'non so', 'dunno', 'considera'],
    promptSuffix: 'with a thoughtful expression, slightly tilted head, contemplative look'
  },
  { 
    id: 'excited', 
    name: 'Eccitato', 
    emoji: '🤩',
    keywords: ['eccitato', 'excited', 'entusiasta', 'enthusiastic', 'fantastico', 'amazing', 'incredibile', 'incredible', 'wooo'],
    promptSuffix: 'with an excited enthusiastic expression, bright animated face, energetic demeanor'
  },
  { 
    id: 'confident', 
    name: 'Sicuro', 
    emoji: '😎',
    keywords: ['sicuro', 'confident', 'certo', 'certain', 'ovviamente', 'obviously', 'naturalmente', 'naturally', 'assolutamente'],
    promptSuffix: 'with a confident expression, assured demeanor, self-assured look'
  },
];

export function TalkingAvatarBatch({
  referenceImageUrl,
  selectedVoice,
  sampleSteps,
  initialScenes,
  onSceneGenerated,
  onAllCompleted,
  onScenesChange,
}: TalkingAvatarBatchProps) {
  const [scenes, setScenes] = useState<BatchScene[]>(initialScenes || []);
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);
  const [currentGeneratingIndex, setCurrentGeneratingIndex] = useState(-1);

  // Sync with initial scenes from parent (template selection)
  React.useEffect(() => {
    if (initialScenes && initialScenes.length > 0) {
      setScenes(initialScenes);
    }
  }, [initialScenes]);

  // Notify parent of scene changes
  React.useEffect(() => {
    onScenesChange?.(scenes);
  }, [scenes, onScenesChange]);

  // Auto-detect expression from dialogue text
  const detectExpression = useCallback((dialogueText: string): string => {
    const lowerText = dialogueText.toLowerCase();
    
    for (const preset of EXPRESSION_PRESETS) {
      if (preset.keywords.some(keyword => lowerText.includes(keyword.toLowerCase()))) {
        return preset.id;
      }
    }
    
    return 'neutral';
  }, []);

  // Add new scene
  const addScene = useCallback(() => {
    const newScene: BatchScene = {
      id: crypto.randomUUID(),
      order: scenes.length,
      scenePrompt: '',
      dialogueText: '',
      expression: 'neutral',
      audioDescription: '',
      status: 'pending',
      progress: 0,
    };
    setScenes(prev => [...prev, newScene]);
  }, [scenes.length]);

  // Update scene
  const updateScene = useCallback((id: string, updates: Partial<BatchScene>) => {
    setScenes(prev => prev.map(scene => {
      if (scene.id !== id) return scene;
      
      const updated = { ...scene, ...updates };
      
      // Auto-detect expression if dialogue changed
      if (updates.dialogueText !== undefined) {
        updated.expression = detectExpression(updates.dialogueText);
      }
      
      return updated;
    }));
  }, [detectExpression]);

  // Remove scene
  const removeScene = useCallback((id: string) => {
    setScenes(prev => {
      const filtered = prev.filter(s => s.id !== id);
      return filtered.map((s, i) => ({ ...s, order: i }));
    });
  }, []);

  // Move scene up/down
  const moveScene = useCallback((id: string, direction: 'up' | 'down') => {
    setScenes(prev => {
      const index = prev.findIndex(s => s.id === id);
      if (index === -1) return prev;
      
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      
      const newScenes = [...prev];
      [newScenes[index], newScenes[newIndex]] = [newScenes[newIndex], newScenes[index]];
      return newScenes.map((s, i) => ({ ...s, order: i }));
    });
  }, []);

  // Build prompt with expression
  const buildScenePrompt = useCallback((scene: BatchScene): string => {
    const preset = EXPRESSION_PRESETS.find(p => p.id === scene.expression);
    let prompt = scene.scenePrompt;
    
    if (preset && preset.promptSuffix) {
      prompt += `, ${preset.promptSuffix}`;
    }
    
    if (scene.dialogueText) {
      prompt += `, <S>${scene.dialogueText}<E>`;
    }
    
    if (scene.audioDescription) {
      prompt += ` <AUDCAP>${scene.audioDescription}<ENDAUDCAP>`;
    }
    
    return prompt;
  }, []);

  // Generate single scene
  const generateScene = useCallback(async (scene: BatchScene): Promise<BatchScene> => {
    if (!referenceImageUrl) {
      throw new Error('Immagine di riferimento mancante');
    }

    const fullPrompt = buildScenePrompt(scene);
    
    // First generate TTS audio if there's dialogue
    let audioUrl: string | null = null;
    if (scene.dialogueText.trim()) {
      try {
        const ttsResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              text: scene.dialogueText,
              voiceId: selectedVoice,
              languageCode: 'it',
            }),
          }
        );

        if (ttsResponse.ok) {
          const audioBlob = await ttsResponse.blob();
          audioUrl = URL.createObjectURL(audioBlob);
        }
      } catch (e) {
        console.warn('TTS generation failed, continuing without audio:', e);
      }
    }

    // Generate the video
    const { data, error } = await supabase.functions.invoke('talking-avatar', {
      body: {
        action: 'generate',
        prompt: fullPrompt,
        imageUrl: referenceImageUrl,
        audioUrl,
        sampleSteps,
      },
    });

    if (error) throw new Error(error.message);
    if (data.error) throw new Error(data.error);

    // Poll for completion if async
    if (data.eventId) {
      let attempts = 0;
      const maxAttempts = 60;
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        attempts++;
        
        const { data: statusData } = await supabase.functions.invoke('talking-avatar', {
          body: {
            action: 'status',
            eventId: data.eventId,
          },
        });

        if (statusData?.status === 'COMPLETED' && statusData.videoUrl) {
          return {
            ...scene,
            status: 'completed',
            videoUrl: statusData.videoUrl,
            progress: 100,
          };
        }
        
        if (statusData?.status === 'FAILED') {
          throw new Error(statusData.error || 'Generazione fallita');
        }
      }
      
      throw new Error('Timeout durante la generazione');
    }

    if (data.videoUrl) {
      return {
        ...scene,
        status: 'completed',
        videoUrl: data.videoUrl,
        progress: 100,
      };
    }

    throw new Error('Risposta non valida dal server');
  }, [referenceImageUrl, selectedVoice, sampleSteps, buildScenePrompt]);

  // Generate all scenes in batch
  const generateBatch = useCallback(async () => {
    const pendingScenes = scenes.filter(s => s.status === 'pending');
    if (pendingScenes.length === 0) {
      toast.error('Nessuna scena da generare');
      return;
    }

    if (!referenceImageUrl) {
      toast.error('Carica un\'immagine di riferimento');
      return;
    }

    setIsGeneratingBatch(true);
    const completedScenes: BatchScene[] = [];

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      if (scene.status !== 'pending') {
        if (scene.status === 'completed') {
          completedScenes.push(scene);
        }
        continue;
      }

      setCurrentGeneratingIndex(i);
      
      // Update status to generating
      setScenes(prev => prev.map(s => 
        s.id === scene.id ? { ...s, status: 'generating' as const, progress: 10 } : s
      ));

      try {
        const updatedScene = await generateScene(scene);
        
        setScenes(prev => prev.map(s => 
          s.id === scene.id ? updatedScene : s
        ));
        
        completedScenes.push(updatedScene);
        onSceneGenerated(updatedScene);
        
        toast.success(`Scena ${i + 1} completata!`);
      } catch (error: any) {
        console.error(`Scene ${i + 1} generation error:`, error);
        
        setScenes(prev => prev.map(s => 
          s.id === scene.id ? { ...s, status: 'failed' as const, error: error.message, progress: 0 } : s
        ));
        
        toast.error(`Errore scena ${i + 1}: ${error.message}`);
      }
    }

    setIsGeneratingBatch(false);
    setCurrentGeneratingIndex(-1);

    if (completedScenes.length > 0) {
      onAllCompleted(completedScenes);
      toast.success(`Batch completato! ${completedScenes.length}/${scenes.length} scene generate.`);
    }
  }, [scenes, referenceImageUrl, generateScene, onSceneGenerated, onAllCompleted]);

  // Calculate overall progress
  const overallProgress = useMemo(() => {
    if (scenes.length === 0) return 0;
    const completed = scenes.filter(s => s.status === 'completed').length;
    return Math.round((completed / scenes.length) * 100);
  }, [scenes]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListOrdered className="w-5 h-5" />
          Batch Generation
        </CardTitle>
        <CardDescription>
          Crea più scene in sequenza per costruire una storia completa
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Scene Button */}
        <Button variant="outline" className="w-full" onClick={addScene}>
          <Plus className="w-4 h-4 mr-2" />
          Aggiungi Scena
        </Button>

        {/* Scenes List */}
        <ScrollArea className="h-[400px]">
          <div className="space-y-3">
            {scenes.map((scene, index) => (
              <div
                key={scene.id}
                className={`p-3 rounded-lg border transition-all ${
                  scene.status === 'generating' 
                    ? 'border-primary bg-primary/5' 
                    : scene.status === 'completed'
                    ? 'border-green-500 bg-green-500/5'
                    : scene.status === 'failed'
                    ? 'border-destructive bg-destructive/5'
                    : 'border-border'
                }`}
              >
                {/* Scene Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Scena {index + 1}</Badge>
                    
                    {/* Expression Badge */}
                    <Badge variant="secondary" className="text-sm">
                      {EXPRESSION_PRESETS.find(p => p.id === scene.expression)?.emoji}{' '}
                      {EXPRESSION_PRESETS.find(p => p.id === scene.expression)?.name}
                    </Badge>
                    
                    {scene.status === 'completed' && (
                      <Badge className="bg-green-500">✓ Completato</Badge>
                    )}
                    {scene.status === 'failed' && (
                      <Badge variant="destructive">✗ Fallito</Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7"
                      onClick={() => moveScene(scene.id, 'up')}
                      disabled={index === 0 || isGeneratingBatch}
                    >
                      <ChevronUp className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7"
                      onClick={() => moveScene(scene.id, 'down')}
                      disabled={index === scenes.length - 1 || isGeneratingBatch}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7 text-destructive"
                      onClick={() => removeScene(scene.id)}
                      disabled={isGeneratingBatch}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Scene Content */}
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs">Descrizione Scena</Label>
                    <Textarea
                      placeholder="Descrivi la scena..."
                      value={scene.scenePrompt}
                      onChange={(e) => updateScene(scene.id, { scenePrompt: e.target.value })}
                      rows={2}
                      className="text-sm"
                      disabled={isGeneratingBatch || scene.status === 'completed'}
                    />
                  </div>
                  
                  <div>
                    <Label className="text-xs">Dialogo (auto-rileva espressione)</Label>
                    <Textarea
                      placeholder="Cosa dice il personaggio..."
                      value={scene.dialogueText}
                      onChange={(e) => updateScene(scene.id, { dialogueText: e.target.value })}
                      rows={2}
                      className="text-sm"
                      disabled={isGeneratingBatch || scene.status === 'completed'}
                    />
                  </div>

                  {/* Manual Expression Override */}
                  <div className="flex flex-wrap gap-1">
                    {EXPRESSION_PRESETS.map(preset => (
                      <Button
                        key={preset.id}
                        variant={scene.expression === preset.id ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => updateScene(scene.id, { expression: preset.id })}
                        disabled={isGeneratingBatch || scene.status === 'completed'}
                      >
                        {preset.emoji} {preset.name}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Progress */}
                {scene.status === 'generating' && (
                  <Progress value={scene.progress} className="mt-2" />
                )}

                {/* Error */}
                {scene.error && (
                  <p className="text-xs text-destructive mt-2">{scene.error}</p>
                )}

                {/* Video Preview */}
                {scene.videoUrl && (
                  <div className="mt-2">
                    <video
                      src={scene.videoUrl}
                      controls
                      className="w-full h-24 rounded object-cover"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Overall Progress */}
        {scenes.length > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progresso totale</span>
              <span>{scenes.filter(s => s.status === 'completed').length}/{scenes.length}</span>
            </div>
            <Progress value={overallProgress} />
          </div>
        )}

        {/* Generate All Button */}
        <Button
          className="w-full"
          size="lg"
          onClick={generateBatch}
          disabled={isGeneratingBatch || scenes.length === 0 || !referenceImageUrl}
        >
          {isGeneratingBatch ? (
            <>
              <Sparkles className="w-4 h-4 mr-2 animate-pulse" />
              Generando Scena {currentGeneratingIndex + 1}/{scenes.length}...
            </>
          ) : (
            <>
              <Film className="w-4 h-4 mr-2" />
              Genera Tutte le Scene ({scenes.filter(s => s.status === 'pending').length})
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export default TalkingAvatarBatch;
