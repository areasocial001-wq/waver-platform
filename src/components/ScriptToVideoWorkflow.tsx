import { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  ImageIcon, Video, Wand2, Play, Sparkles, Camera, Users, Film,
  ChevronRight, Loader2, Settings2, RotateCcw, History, ArrowRight
} from 'lucide-react';
import { ImageTransform } from './SortablePanel';
import { StoryboardCharacter } from '@/hooks/useStoryboardCharacters';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PromptVersion {
  prompt: string;
  camera: string;
  timestamp: number;
}

interface StoryboardPanel {
  id: string;
  imageUrl: string | null;
  caption: string;
  note?: string;
  transform?: ImageTransform;
  characterIds?: string[];
}

interface ScriptToVideoWorkflowProps {
  panels: StoryboardPanel[];
  characters: StoryboardCharacter[];
  storyboardId: string | null;
  onGenerateVideo: (config: PipelineConfig) => void;
  isGenerating?: boolean;
}

export interface PipelineConfig {
  scenes: SceneConfig[];
  globalSettings: {
    provider: string;
    duration: number;
    transitionStyle: string;
    transitionSpeed: string;
  };
}

interface SceneConfig {
  panelId: string;
  imageUrl: string;
  prompt: string;
  cameraMovement: string;
  characterRefs: string[];
}

// ─── Scene Node ───
const SceneNode = ({ data }: NodeProps) => {
  const d = data as {
    imageUrl?: string;
    caption?: string;
    index: number;
    characterCount: number;
    hasPrompt: boolean;
  };

  return (
    <Card className="w-56 bg-card/95 backdrop-blur border-primary/30 shadow-lg">
      <Handle type="target" position={Position.Left} className="!bg-primary !w-3 !h-3" />
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-[10px]">Scena {d.index + 1}</Badge>
          {d.characterCount > 0 && (
            <Badge className="text-[10px] gap-1 bg-accent/20 text-accent-foreground">
              <Users className="h-2.5 w-2.5" />
              {d.characterCount}
            </Badge>
          )}
        </div>
        <div className="aspect-video bg-muted rounded overflow-hidden">
          {d.imageUrl ? (
            <img src={d.imageUrl} alt={d.caption || 'Scene'} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground line-clamp-2">{d.caption || 'Nessuna didascalia'}</p>
        {d.hasPrompt && (
          <Badge variant="secondary" className="text-[10px] gap-1">
            <Wand2 className="h-2.5 w-2.5" /> Prompt OK
          </Badge>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-primary !w-3 !h-3" />
    </Card>
  );
};

// ─── Camera Node ───
const CameraNode = ({ data }: NodeProps) => {
  const d = data as { movement: string; sceneIndex: number };
  return (
    <Card className="w-44 bg-card/95 backdrop-blur border-accent/30 shadow-md">
      <Handle type="target" position={Position.Left} className="!bg-accent !w-3 !h-3" />
      <div className="p-3 text-center space-y-1.5">
        <Camera className="h-5 w-5 mx-auto text-accent" />
        <p className="text-[11px] font-medium">Camera</p>
        <Badge variant="outline" className="text-[10px]">
          {d.movement === 'none' ? 'Statica' : d.movement}
        </Badge>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-accent !w-3 !h-3" />
    </Card>
  );
};

// ─── Character Ref Node ───
const CharacterRefNode = ({ data }: NodeProps) => {
  const d = data as { characters: { name: string; color: string; refCount: number }[] };
  return (
    <Card className="w-48 bg-card/95 backdrop-blur border-violet-500/30 shadow-md">
      <Handle type="target" position={Position.Left} className="!bg-violet-500 !w-3 !h-3" />
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-1.5">
          <Users className="h-4 w-4 text-violet-500" />
          <span className="text-[11px] font-medium">Character Lock</span>
        </div>
        {d.characters.map((c, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
            <span className="text-[10px] truncate">{c.name}</span>
            <Badge variant="secondary" className="text-[9px] ml-auto">{c.refCount} ref</Badge>
          </div>
        ))}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-violet-500 !w-3 !h-3" />
    </Card>
  );
};

// ─── Transition Node ───
const TransitionNode = ({ data }: NodeProps) => {
  const d = data as { style: string; duration: number };
  return (
    <Card className="w-36 bg-gradient-to-br from-primary/10 to-accent/10 border-dashed border-2 border-primary/20">
      <Handle type="target" position={Position.Left} className="!bg-primary !w-3 !h-3" />
      <div className="p-2.5 text-center space-y-1">
        <Play className="h-4 w-4 mx-auto text-primary" />
        <p className="text-[10px] font-medium">Transizione</p>
        <Badge variant="outline" className="text-[9px]">{d.style} • {d.duration}s</Badge>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-primary !w-3 !h-3" />
    </Card>
  );
};

// ─── Video Output Node ───
const VideoOutputNode = ({ data }: NodeProps) => {
  const d = data as { provider: string; sceneCount: number };
  return (
    <Card className="w-52 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30 shadow-lg">
      <Handle type="target" position={Position.Left} className="!bg-green-500 !w-3 !h-3" />
      <div className="p-4 text-center space-y-2">
        <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
          <Film className="h-6 w-6 text-green-500" />
        </div>
        <p className="text-sm font-semibold">Video Finale</p>
        <Badge className="text-[10px] bg-green-500/20 text-green-700 dark:text-green-300">
          {d.sceneCount} scene • {d.provider}
        </Badge>
      </div>
    </Card>
  );
};

const nodeTypes = {
  scene: SceneNode,
  camera: CameraNode,
  characterRef: CharacterRefNode,
  transition: TransitionNode,
  videoOutput: VideoOutputNode,
};

const CAMERA_OPTIONS = [
  { value: 'none', label: 'Statica' },
  { value: 'dolly_in', label: 'Dolly In' },
  { value: 'dolly_out', label: 'Dolly Out' },
  { value: 'tracking', label: 'Tracking' },
  { value: 'pan_left', label: 'Pan Left' },
  { value: 'pan_right', label: 'Pan Right' },
  { value: 'crane_up', label: 'Crane Up' },
  { value: 'orbit', label: 'Orbit' },
  { value: 'aerial', label: 'Aerial' },
];

export const ScriptToVideoWorkflow = ({
  panels,
  characters,
  storyboardId,
  onGenerateVideo,
  isGenerating,
}: ScriptToVideoWorkflowProps) => {
  const panelsWithImages = panels.filter(p => p.imageUrl);

  const [scenePrompts, setScenePrompts] = useState<Record<string, string>>({});
  const [sceneCameras, setSceneCameras] = useState<Record<string, string>>({});
  const [globalProvider, setGlobalProvider] = useState('auto');
  const [globalDuration, setGlobalDuration] = useState(6);
  const [transitionStyle, setTransitionStyle] = useState('smooth');
  const [transitionSpeed, setTransitionSpeed] = useState('normal');
  const [selectedScene, setSelectedScene] = useState<string | null>(null);
  const [aiGenerating, setAiGenerating] = useState<Record<string, boolean>>({});
  const [aiGeneratingAll, setAiGeneratingAll] = useState(false);

  const [promptHistory, setPromptHistory] = useState<Record<string, PromptVersion[]>>({});
  const [showComparison, setShowComparison] = useState<string | null>(null);

  const generatePromptForScene = useCallback(async (panel: StoryboardPanel) => {
    if (!panel.imageUrl) return;
    // Save current prompt as history before overwriting
    const currentPrompt = scenePrompts[panel.id] || panel.caption || '';
    const currentCamera = sceneCameras[panel.id] || 'none';
    if (currentPrompt.trim()) {
      setPromptHistory(prev => ({
        ...prev,
        [panel.id]: [...(prev[panel.id] || []), { prompt: currentPrompt, camera: currentCamera, timestamp: Date.now() }],
      }));
    }
    setAiGenerating(prev => ({ ...prev, [panel.id]: true }));
    try {
      // Compress image for API
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = panel.imageUrl!;
      });
      const canvas = document.createElement('canvas');
      const maxW = 800;
      const scale = Math.min(1, maxW / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const compressedUrl = canvas.toDataURL('image/jpeg', 0.7);

      const { data, error } = await supabase.functions.invoke('optimize-video-prompt', {
        body: {
          imageUrl: compressedUrl,
          caption: panel.caption || undefined,
        },
      });
      if (error) throw error;
      if (data?.mainPrompt) {
        setScenePrompts(prev => ({ ...prev, [panel.id]: data.mainPrompt }));
        if (data.cameraMovement) {
          const camMap: Record<string, string> = {
            'slow dolly in': 'dolly_in', 'dolly in': 'dolly_in',
            'dolly out': 'dolly_out', 'tracking shot': 'tracking', 'tracking': 'tracking',
            'pan left': 'pan_left', 'pan right': 'pan_right',
            'crane up': 'crane_up', 'orbit': 'orbit', 'aerial': 'aerial',
          };
          const mapped = camMap[data.cameraMovement.toLowerCase()] || 'none';
          setSceneCameras(prev => ({ ...prev, [panel.id]: mapped }));
        }
      }
    } catch (err) {
      console.error('AI prompt generation error:', err);
      toast.error(`Errore generazione prompt per scena`);
    } finally {
      setAiGenerating(prev => ({ ...prev, [panel.id]: false }));
    }
  }, []);

  const generateAllPrompts = useCallback(async () => {
    setAiGeneratingAll(true);
    toast.info(`Generazione AI prompt per ${panelsWithImages.length} scene...`);
    for (const panel of panelsWithImages) {
      await generatePromptForScene(panel);
    }
    setAiGeneratingAll(false);
    toast.success('Prompt AI generati per tutte le scene!');
  }, [panelsWithImages, generatePromptForScene]);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const xStart = 50;
    const yBase = 60;
    const sceneSpacingY = 220;
    const colOffsets = { scene: 0, camera: 280, charRef: 480, transition: 700 };

    panelsWithImages.forEach((panel, idx) => {
      const y = yBase + idx * sceneSpacingY;
      const panelChars = characters.filter(c => (panel.characterIds || []).includes(c.id));

      // Scene node
      nodes.push({
        id: `scene-${panel.id}`,
        type: 'scene',
        position: { x: xStart + colOffsets.scene, y },
        data: {
          imageUrl: panel.imageUrl,
          caption: panel.caption,
          index: idx,
          characterCount: panelChars.length,
          hasPrompt: !!(scenePrompts[panel.id] || panel.caption),
        },
      });

      // Camera node
      nodes.push({
        id: `camera-${panel.id}`,
        type: 'camera',
        position: { x: xStart + colOffsets.camera, y: y + 20 },
        data: {
          movement: sceneCameras[panel.id] || 'none',
          sceneIndex: idx,
        },
      });

      edges.push({
        id: `e-scene-camera-${panel.id}`,
        source: `scene-${panel.id}`,
        target: `camera-${panel.id}`,
        animated: true,
        style: { stroke: 'hsl(var(--accent))' },
      });

      // Character ref node (if has characters)
      if (panelChars.length > 0) {
        nodes.push({
          id: `chars-${panel.id}`,
          type: 'characterRef',
          position: { x: xStart + colOffsets.charRef, y: y + 10 },
          data: {
            characters: panelChars.map(c => ({
              name: c.name,
              color: c.color,
              refCount: c.reference_images.length,
            })),
          },
        });

        edges.push({
          id: `e-camera-chars-${panel.id}`,
          source: `camera-${panel.id}`,
          target: `chars-${panel.id}`,
          animated: true,
          style: { stroke: 'hsl(210 80% 60%)' },
        });
      }

      // Transition node between scenes
      if (idx < panelsWithImages.length - 1) {
        const lastNodeId = panelChars.length > 0 ? `chars-${panel.id}` : `camera-${panel.id}`;
        nodes.push({
          id: `trans-${panel.id}`,
          type: 'transition',
          position: { x: xStart + colOffsets.transition, y: y + 30 },
          data: { style: transitionStyle, duration: globalDuration },
        });

        edges.push({
          id: `e-to-trans-${panel.id}`,
          source: lastNodeId,
          target: `trans-${panel.id}`,
          style: { stroke: 'hsl(var(--primary) / 0.5)' },
        });

        // Connect transition to next scene
        const nextPanel = panelsWithImages[idx + 1];
        edges.push({
          id: `e-trans-next-${panel.id}`,
          source: `trans-${panel.id}`,
          target: `scene-${nextPanel.id}`,
          style: { stroke: 'hsl(var(--primary) / 0.5)', strokeDasharray: '5 5' },
        });
      }
    });

    // Video output node
    if (panelsWithImages.length > 0) {
      const lastPanel = panelsWithImages[panelsWithImages.length - 1];
      const lastPanelChars = characters.filter(c => (lastPanel.characterIds || []).includes(c.id));
      const lastNodeId = lastPanelChars.length > 0 ? `chars-${lastPanel.id}` : `camera-${lastPanel.id}`;
      
      nodes.push({
        id: 'video-output',
        type: 'videoOutput',
        position: {
          x: xStart + 900,
          y: yBase + ((panelsWithImages.length - 1) * sceneSpacingY) / 2,
        },
        data: {
          provider: globalProvider === 'auto' ? 'Auto' : globalProvider,
          sceneCount: panelsWithImages.length,
        },
      });

      edges.push({
        id: 'e-to-output',
        source: lastNodeId,
        target: 'video-output',
        animated: true,
        style: { stroke: 'hsl(142 70% 45%)', strokeWidth: 2 },
      });
    }

    return { nodes, edges };
  }, [panelsWithImages, characters, scenePrompts, sceneCameras, globalProvider, globalDuration, transitionStyle]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const handleNodeClick = useCallback((_: any, node: Node) => {
    if (node.id.startsWith('scene-')) {
      const panelId = node.id.replace('scene-', '');
      setSelectedScene(panelId);
    }
  }, []);

  const handleLaunchPipeline = () => {
    if (panelsWithImages.length < 2) {
      toast.error('Servono almeno 2 pannelli con immagini');
      return;
    }

    const scenes: SceneConfig[] = panelsWithImages.map(panel => {
      const panelChars = characters.filter(c => (panel.characterIds || []).includes(c.id));
      return {
        panelId: panel.id,
        imageUrl: panel.imageUrl!,
        prompt: scenePrompts[panel.id] || panel.caption || '',
        cameraMovement: sceneCameras[panel.id] || 'none',
        characterRefs: panelChars.flatMap(c => c.reference_images).slice(0, 5),
      };
    });

    onGenerateVideo({
      scenes,
      globalSettings: {
        provider: globalProvider,
        duration: globalDuration,
        transitionStyle,
        transitionSpeed,
      },
    });
  };

  const selectedPanel = panelsWithImages.find(p => p.id === selectedScene);

  if (panelsWithImages.length === 0) {
    return (
      <div className="h-[500px] flex items-center justify-center bg-muted/30 rounded-lg border-2 border-dashed">
        <div className="text-center space-y-2">
          <Film className="h-12 w-12 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Aggiungi immagini ai pannelli per attivare la pipeline</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Global settings bar */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Provider</label>
            <Select value={globalProvider} onValueChange={setGlobalProvider}>
              <SelectTrigger className="w-48 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">🤖 Auto</SelectItem>
                <SelectItem value="google-veo">🌟 Google Veo 3.1</SelectItem>
                <SelectItem value="aiml-kling">🎬 Kling v1.6 Pro</SelectItem>
                <SelectItem value="piapi-kling-2.6">🎥 Kling 2.6</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Durata</label>
            <Select value={globalDuration.toString()} onValueChange={v => setGlobalDuration(+v)}>
              <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="4">4s</SelectItem>
                <SelectItem value="6">6s</SelectItem>
                <SelectItem value="8">8s</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Transizione</label>
            <Select value={transitionStyle} onValueChange={setTransitionStyle}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="smooth">🌊 Smooth</SelectItem>
                <SelectItem value="fade">🌫️ Fade</SelectItem>
                <SelectItem value="dissolve">✨ Dissolve</SelectItem>
                <SelectItem value="morph">🦋 Morph</SelectItem>
                <SelectItem value="zoom">🔍 Zoom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Velocità</label>
            <Select value={transitionSpeed} onValueChange={setTransitionSpeed}>
              <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fast">⚡ Veloce</SelectItem>
                <SelectItem value="normal">➡️ Normale</SelectItem>
                <SelectItem value="slow">🐌 Lento</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            onClick={generateAllPrompts}
            disabled={aiGeneratingAll || isGenerating}
            className="gap-2"
          >
            {aiGeneratingAll ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generazione AI...</>
            ) : (
              <><Sparkles className="h-4 w-4" /> Auto-genera prompt AI</>
            )}
          </Button>
          <Button
            onClick={handleLaunchPipeline}
            disabled={isGenerating || panelsWithImages.length < 2}
            className="ml-auto bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 gap-2"
          >
            {isGenerating ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generazione...</>
            ) : (
              <><Film className="h-4 w-4" /> Lancia Pipeline ({panelsWithImages.length} scene)</>
            )}
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* ReactFlow canvas */}
        <div className="lg:col-span-3 h-[550px] bg-background rounded-lg border overflow-hidden">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background />
            <Controls />
            <MiniMap
              nodeColor={(node) => {
                if (node.type === 'scene') return 'hsl(var(--primary))';
                if (node.type === 'camera') return 'hsl(var(--accent))';
                if (node.type === 'characterRef') return '#8b5cf6';
                if (node.type === 'videoOutput') return '#22c55e';
                return 'hsl(var(--muted))';
              }}
            />
          </ReactFlow>
        </div>

        {/* Scene inspector panel */}
        <Card className="lg:col-span-1 p-4 space-y-4 max-h-[550px] overflow-y-auto">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Configurazione Scena</h3>
          </div>

          {selectedPanel ? (
            <div className="space-y-4">
              <div className="aspect-video rounded overflow-hidden bg-muted">
                <img src={selectedPanel.imageUrl!} alt="" className="w-full h-full object-cover" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Prompt scena</label>
                <Textarea
                  value={scenePrompts[selectedPanel.id] || selectedPanel.caption || ''}
                  onChange={(e) => setScenePrompts(prev => ({ ...prev, [selectedPanel.id]: e.target.value }))}
                  placeholder="Descrivi l'azione della scena..."
                  rows={3}
                  className="text-xs"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generatePromptForScene(selectedPanel)}
                  disabled={aiGenerating[selectedPanel.id]}
                  className="w-full gap-1.5 text-xs h-7"
                >
                  {aiGenerating[selectedPanel.id] ? (
                    <><Loader2 className="h-3 w-3 animate-spin" /> Analisi AI...</>
                  ) : (
                    <><Sparkles className="h-3 w-3" /> Genera prompt con AI</>
                  )}
                </Button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Camera movement</label>
                <Select
                  value={sceneCameras[selectedPanel.id] || 'none'}
                  onValueChange={(v) => setSceneCameras(prev => ({ ...prev, [selectedPanel.id]: v }))}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CAMERA_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Assigned characters */}
              {(() => {
                const panelChars = characters.filter(c => (selectedPanel.characterIds || []).includes(c.id));
                if (panelChars.length === 0) return null;
                return (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Personaggi assegnati</label>
                    <div className="space-y-1">
                      {panelChars.map(c => (
                        <div key={c.id} className="flex items-center gap-2 text-xs">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                          <span>{c.name}</span>
                          <Badge variant="secondary" className="text-[9px] ml-auto">{c.reference_images.length} ref</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <ChevronRight className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-xs text-muted-foreground">
                Clicca su una scena nel workflow per configurarla
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
