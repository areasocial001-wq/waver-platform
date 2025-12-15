import { useCallback, useMemo } from 'react';
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
import { ImageIcon, Video, Wand2, Play, Sparkles } from 'lucide-react';
import { ImageTransform } from './SortablePanel';

interface StoryboardPanel {
  id: string;
  imageUrl: string | null;
  caption: string;
  note?: string;
  transform?: ImageTransform;
}

interface WorkflowViewProps {
  panels: StoryboardPanel[];
  onOptimizePrompt: (panelId: string, imageUrl: string) => void;
  onGenerateVideo: (panelId: string, imageUrl: string, prompt?: string) => void;
  onGenerateMultiModel: (panelId: string, imageUrl: string) => void;
  isOptimizing?: string | null;
}

// Custom node for storyboard panels
const ImageNode = ({ data }: NodeProps) => {
  const nodeData = data as {
    imageUrl?: string;
    caption?: string;
    transform?: ImageTransform;
    index: number;
    isOptimizing?: boolean;
    onOptimize?: () => void;
    onMultiModel?: () => void;
  };
  
  const transform = nodeData.transform;
  const transformStyle = transform ? {
    transform: `rotate(${transform.rotation || 0}deg) scaleX(${transform.flipH ? -1 : 1}) scaleY(${transform.flipV ? -1 : 1})`,
  } : {};

  return (
    <Card className="w-48 bg-card border-2 border-primary/20 overflow-hidden">
      <Handle type="target" position={Position.Left} className="!bg-primary" />
      <div className="p-2">
        <div className="aspect-video bg-muted rounded overflow-hidden mb-2">
          {nodeData.imageUrl ? (
            <img
              src={nodeData.imageUrl}
              alt={nodeData.caption || 'Panel'}
              className="w-full h-full object-cover"
              style={transformStyle}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
        </div>
        <p className="text-xs font-medium truncate">{nodeData.caption || `Pannello ${nodeData.index + 1}`}</p>
        <div className="flex gap-1 mt-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-6 text-xs"
            onClick={() => nodeData.onOptimize?.()}
            disabled={!nodeData.imageUrl || nodeData.isOptimizing}
          >
            <Wand2 className="h-3 w-3 mr-1" />
            AI
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-6 text-xs"
            onClick={() => nodeData.onMultiModel?.()}
            disabled={!nodeData.imageUrl}
          >
            <Sparkles className="h-3 w-3 mr-1" />
            Multi
          </Button>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-primary" />
    </Card>
  );
};

// Custom node for video generation
const VideoNode = ({ data }: NodeProps) => {
  const nodeData = data as { label: string; provider: string };
  return (
    <Card className="w-40 bg-card border-2 border-accent/20 overflow-hidden">
      <Handle type="target" position={Position.Left} className="!bg-accent" />
      <div className="p-3 flex flex-col items-center">
        <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center mb-2">
          <Video className="h-6 w-6 text-accent" />
        </div>
        <Badge variant="secondary" className="text-xs">
          {nodeData.label}
        </Badge>
        <p className="text-xs text-muted-foreground mt-1">{nodeData.provider}</p>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-accent" />
    </Card>
  );
};

// Custom node for transitions
const TransitionNode = ({ data }: NodeProps) => {
  const nodeData = data as { duration: number };
  return (
    <Card className="w-32 bg-gradient-to-r from-primary/10 to-accent/10 border-dashed border-2">
      <Handle type="target" position={Position.Left} className="!bg-primary" />
      <div className="p-2 text-center">
        <Play className="h-4 w-4 mx-auto text-primary mb-1" />
        <p className="text-xs font-medium">Transizione</p>
        <p className="text-xs text-muted-foreground">{nodeData.duration}s</p>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-accent" />
    </Card>
  );
};

const nodeTypes = {
  imageNode: ImageNode,
  videoNode: VideoNode,
  transitionNode: TransitionNode,
};

export const WorkflowView = ({
  panels,
  onOptimizePrompt,
  onGenerateVideo,
  onGenerateMultiModel,
  isOptimizing,
}: WorkflowViewProps) => {
  const panelsWithImages = panels.filter(p => p.imageUrl);

  const initialNodes: Node[] = useMemo(() => {
    const nodes: Node[] = [];
    let xPos = 50;
    const yBase = 100;
    const spacing = 250;

    panelsWithImages.forEach((panel, index) => {
      // Image node
      nodes.push({
        id: panel.id,
        type: 'imageNode',
        position: { x: xPos, y: yBase },
        data: {
          ...panel,
          index,
          isOptimizing: isOptimizing === panel.id,
          onOptimize: () => panel.imageUrl && onOptimizePrompt(panel.id, panel.imageUrl),
          onMultiModel: () => panel.imageUrl && onGenerateMultiModel(panel.id, panel.imageUrl),
        },
      });

      // Add transition node between panels
      if (index < panelsWithImages.length - 1) {
        nodes.push({
          id: `transition-${panel.id}`,
          type: 'transitionNode',
          position: { x: xPos + 180, y: yBase + 150 },
          data: { duration: 5 },
        });
      }

      // Add video output nodes for each provider
      const providers = ['Veo', 'Kling', 'MiniMax'];
      providers.forEach((provider, pIndex) => {
        nodes.push({
          id: `video-${panel.id}-${provider}`,
          type: 'videoNode',
          position: { x: xPos + 60, y: yBase + 200 + pIndex * 80 },
          data: { label: `Video ${index + 1}`, provider },
        });
      });

      xPos += spacing;
    });

    return nodes;
  }, [panelsWithImages, isOptimizing, onOptimizePrompt, onGenerateMultiModel]);

  const initialEdges: Edge[] = useMemo(() => {
    const edges: Edge[] = [];

    panelsWithImages.forEach((panel, index) => {
      // Edge to video outputs
      const providers = ['Veo', 'Kling', 'MiniMax'];
      providers.forEach((provider) => {
        edges.push({
          id: `edge-${panel.id}-${provider}`,
          source: panel.id,
          target: `video-${panel.id}-${provider}`,
          animated: true,
          style: { stroke: 'hsl(var(--primary))' },
        });
      });

      // Edge to transition
      if (index < panelsWithImages.length - 1) {
        edges.push({
          id: `edge-trans-${panel.id}`,
          source: panel.id,
          target: `transition-${panel.id}`,
          style: { stroke: 'hsl(var(--accent))' },
        });

        // Edge from transition to next panel
        edges.push({
          id: `edge-trans-next-${panel.id}`,
          source: `transition-${panel.id}`,
          target: panelsWithImages[index + 1].id,
          style: { stroke: 'hsl(var(--accent))' },
        });
      }
    });

    return edges;
  }, [panelsWithImages]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  if (panelsWithImages.length === 0) {
    return (
      <div className="h-[500px] flex items-center justify-center bg-muted/30 rounded-lg border-2 border-dashed">
        <div className="text-center">
          <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Aggiungi immagini ai pannelli per visualizzare il workflow</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[600px] bg-background rounded-lg border overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
        <MiniMap 
          nodeColor={(node) => {
            switch (node.type) {
              case 'imageNode':
                return 'hsl(var(--primary))';
              case 'videoNode':
                return 'hsl(var(--accent))';
              default:
                return 'hsl(var(--muted))';
            }
          }}
        />
      </ReactFlow>
    </div>
  );
};
