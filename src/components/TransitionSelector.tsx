import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { 
  ArrowRight, 
  Check, 
  Eye, 
  Blend,
  MoveHorizontal,
  ZoomIn,
  Sparkles
} from 'lucide-react';

export interface TransitionType {
  id: string;
  name: string;
  duration: number;
  icon: React.ReactNode;
  description: string;
}

export const TRANSITION_TYPES: TransitionType[] = [
  { id: 'none', name: 'Nessuna', duration: 0, icon: <ArrowRight className="w-4 h-4" />, description: 'Taglio netto tra clip' },
  { id: 'fade', name: 'Dissolvenza', duration: 0.5, icon: <Blend className="w-4 h-4" />, description: 'Sfuma gradualmente al clip successivo' },
  { id: 'crossfade', name: 'Cross-fade', duration: 1, icon: <Blend className="w-4 h-4" />, description: 'Dissolve incrociata più lunga' },
  { id: 'slide-left', name: 'Scorri Sx', duration: 0.5, icon: <MoveHorizontal className="w-4 h-4" />, description: 'Il nuovo clip entra da destra' },
  { id: 'slide-right', name: 'Scorri Dx', duration: 0.5, icon: <MoveHorizontal className="w-4 h-4 rotate-180" />, description: 'Il nuovo clip entra da sinistra' },
  { id: 'zoom', name: 'Zoom', duration: 0.8, icon: <ZoomIn className="w-4 h-4" />, description: 'Zoom in durante transizione' },
];

interface TransitionSelectorProps {
  selectedTransition: string;
  onTransitionChange: (transitionId: string) => void;
  transitionDuration?: number;
  onDurationChange?: (duration: number) => void;
}

export function TransitionSelector({
  selectedTransition,
  onTransitionChange,
  transitionDuration,
  onDurationChange,
}: TransitionSelectorProps) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const currentTransition = TRANSITION_TYPES.find(t => t.id === selectedTransition) || TRANSITION_TYPES[0];

  // Animate preview
  useEffect(() => {
    if (previewId && previewRef.current) {
      const el = previewRef.current;
      el.classList.remove('animate-preview');
      void el.offsetWidth; // Force reflow
      el.classList.add('animate-preview');
      
      const timer = setTimeout(() => {
        setPreviewId(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [previewId]);

  const getPreviewAnimation = (id: string) => {
    switch (id) {
      case 'fade':
      case 'crossfade':
        return 'opacity-0';
      case 'slide-left':
        return 'translate-x-full';
      case 'slide-right':
        return '-translate-x-full';
      case 'zoom':
        return 'scale-0';
      default:
        return '';
    }
  };

  const getPreviewTransition = (id: string) => {
    const duration = TRANSITION_TYPES.find(t => t.id === id)?.duration || 0.5;
    return `all ${duration}s ease-in-out`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="w-4 h-4" />
          Transizioni
        </CardTitle>
        <CardDescription>
          Seleziona l'effetto di transizione tra i clip
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Preview Area */}
        <div className="relative h-24 bg-muted rounded-lg overflow-hidden flex items-center justify-center gap-2">
          {/* Clip A */}
          <div className="w-16 h-16 bg-primary/30 rounded flex items-center justify-center text-xs font-medium">
            Clip A
          </div>
          
          {/* Transition Preview */}
          <div 
            ref={previewRef}
            className="relative w-8 h-16 flex items-center justify-center"
          >
            {previewId ? (
              <div 
                className={`absolute inset-0 flex items-center justify-center transition-all ${
                  previewId === 'none' ? '' : getPreviewAnimation(previewId)
                }`}
                style={{ 
                  transition: getPreviewTransition(previewId),
                  animation: previewId !== 'none' ? `preview-${previewId} ${TRANSITION_TYPES.find(t => t.id === previewId)?.duration || 0.5}s ease-in-out` : 'none'
                }}
              >
                <div className="w-4 h-4 rounded-full bg-primary animate-pulse" />
              </div>
            ) : (
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                {currentTransition.icon}
              </div>
            )}
          </div>
          
          {/* Clip B */}
          <div className="w-16 h-16 bg-secondary/50 rounded flex items-center justify-center text-xs font-medium">
            Clip B
          </div>
          
          {/* Current Transition Label */}
          <Badge variant="secondary" className="absolute bottom-2 right-2 text-[10px]">
            {currentTransition.name}
          </Badge>
        </div>

        {/* Transition Grid */}
        <div className="grid grid-cols-3 gap-2">
          {TRANSITION_TYPES.map((transition) => (
            <Button
              key={transition.id}
              variant={selectedTransition === transition.id ? 'default' : 'outline'}
              size="sm"
              className="h-auto py-2 px-2 flex flex-col items-center gap-1 relative"
              onClick={() => onTransitionChange(transition.id)}
              onMouseEnter={() => setPreviewId(transition.id)}
              onMouseLeave={() => setPreviewId(null)}
            >
              <div className="flex items-center gap-1">
                {transition.icon}
                <span className="text-xs">{transition.name}</span>
              </div>
              {transition.duration > 0 && (
                <span className="text-[10px] opacity-60">{transition.duration}s</span>
              )}
              {selectedTransition === transition.id && (
                <Check className="w-3 h-3 absolute top-1 right-1" />
              )}
            </Button>
          ))}
        </div>

        {/* Duration Slider (for non-none transitions) */}
        {selectedTransition !== 'none' && onDurationChange && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Durata Transizione</Label>
              <span className="text-xs text-muted-foreground">
                {transitionDuration?.toFixed(1) || currentTransition.duration}s
              </span>
            </div>
            <Slider
              value={[transitionDuration || currentTransition.duration]}
              onValueChange={([v]) => onDurationChange(v)}
              min={0.1}
              max={2}
              step={0.1}
            />
          </div>
        )}

        {/* Current Selection Info */}
        <div className="flex items-start gap-2 p-2 bg-muted/50 rounded text-xs">
          <Eye className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
          <div>
            <p className="font-medium">{currentTransition.name}</p>
            <p className="text-muted-foreground">{currentTransition.description}</p>
          </div>
        </div>
      </CardContent>

      {/* CSS for preview animations */}
      <style>{`
        @keyframes preview-fade {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes preview-crossfade {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes preview-slide-left {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(100%); }
        }
        @keyframes preview-slide-right {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(-100%); }
        }
        @keyframes preview-zoom {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(0); }
        }
      `}</style>
    </Card>
  );
}

export default TransitionSelector;
