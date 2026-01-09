import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Wand2, 
  ZoomIn, 
  Move, 
  Palette,
  RotateCcw,
  Sparkles,
  Sun,
  Contrast,
  Droplets
} from 'lucide-react';
import type { TimelineClip } from './TalkingAvatarTimeline';

export interface ClipEffect {
  // Zoom & Pan
  zoom: number; // 1 = 100%, range 0.5-2
  panX: number; // -100 to 100
  panY: number; // -100 to 100
  zoomAnimation: 'none' | 'zoom-in' | 'zoom-out' | 'ken-burns';
  
  // Color Filters
  filter: 'none' | 'vintage' | 'cinematic' | 'warm' | 'cool' | 'bw' | 'sepia' | 'dramatic';
  brightness: number; // 0-200, 100 = normal
  contrast: number; // 0-200, 100 = normal
  saturation: number; // 0-200, 100 = normal
  
  // Motion blur
  motionBlur: number; // 0-10
}

export const DEFAULT_EFFECT: ClipEffect = {
  zoom: 1,
  panX: 0,
  panY: 0,
  zoomAnimation: 'none',
  filter: 'none',
  brightness: 100,
  contrast: 100,
  saturation: 100,
  motionBlur: 0,
};

const FILTERS = [
  { id: 'none', name: 'Nessuno', css: '' },
  { id: 'vintage', name: 'Vintage', css: 'sepia(0.3) contrast(1.1) brightness(0.95)' },
  { id: 'cinematic', name: 'Cinematico', css: 'contrast(1.2) saturate(0.85) brightness(0.9)' },
  { id: 'warm', name: 'Caldo', css: 'sepia(0.2) saturate(1.3) brightness(1.05)' },
  { id: 'cool', name: 'Freddo', css: 'hue-rotate(10deg) saturate(0.9) brightness(1.05)' },
  { id: 'bw', name: 'Bianco/Nero', css: 'grayscale(1)' },
  { id: 'sepia', name: 'Seppia', css: 'sepia(0.8)' },
  { id: 'dramatic', name: 'Drammatico', css: 'contrast(1.4) brightness(0.85) saturate(1.2)' },
];

const ZOOM_ANIMATIONS = [
  { id: 'none', name: 'Nessuna' },
  { id: 'zoom-in', name: 'Zoom In' },
  { id: 'zoom-out', name: 'Zoom Out' },
  { id: 'ken-burns', name: 'Ken Burns' },
];

// Preset definitions for batch apply
export const EFFECT_PRESETS = [
  { 
    id: 'cinematic', 
    name: 'Cinematico', 
    icon: '🎬',
    effect: { filter: 'cinematic', contrast: 120, saturation: 90, zoomAnimation: 'ken-burns', zoom: 1.05 } as Partial<ClipEffect>
  },
  { 
    id: 'vintage', 
    name: 'Vintage', 
    icon: '📷',
    effect: { filter: 'vintage', brightness: 95, saturation: 85, contrast: 110 } as Partial<ClipEffect>
  },
  { 
    id: 'dramatic', 
    name: 'Drammatico', 
    icon: '🎭',
    effect: { filter: 'dramatic', contrast: 130, brightness: 90 } as Partial<ClipEffect>
  },
  { 
    id: 'warm', 
    name: 'Caldo', 
    icon: '☀️',
    effect: { filter: 'warm', brightness: 105, saturation: 120 } as Partial<ClipEffect>
  },
  { 
    id: 'cool', 
    name: 'Freddo', 
    icon: '❄️',
    effect: { filter: 'cool', saturation: 90, brightness: 105 } as Partial<ClipEffect>
  },
  { 
    id: 'bw', 
    name: 'Bianco/Nero', 
    icon: '⬛',
    effect: { filter: 'bw', contrast: 115 } as Partial<ClipEffect>
  },
  { 
    id: 'zoom-motion', 
    name: 'Zoom Dinamico', 
    icon: '🔍',
    effect: { zoomAnimation: 'zoom-in', zoom: 1.1 } as Partial<ClipEffect>
  },
  { 
    id: 'none', 
    name: 'Nessuno', 
    icon: '🚫',
    effect: { ...DEFAULT_EFFECT } as Partial<ClipEffect>
  },
];

interface ClipEffectsPanelProps {
  clip: TimelineClip | null;
  allClips?: TimelineClip[];
  effects: Record<string, ClipEffect>;
  onEffectsChange: (clipId: string, effect: ClipEffect) => void;
  onApplyToAll?: (effect: Partial<ClipEffect>) => void;
}

export function ClipEffectsPanel({ clip, allClips = [], effects, onEffectsChange, onApplyToAll }: ClipEffectsPanelProps) {
  const currentEffect = clip ? effects[clip.id] || DEFAULT_EFFECT : DEFAULT_EFFECT;
  
  const updateEffect = useCallback((partial: Partial<ClipEffect>) => {
    if (!clip) return;
    onEffectsChange(clip.id, { ...currentEffect, ...partial });
  }, [clip, currentEffect, onEffectsChange]);

  const resetEffects = useCallback(() => {
    if (!clip) return;
    onEffectsChange(clip.id, DEFAULT_EFFECT);
  }, [clip, onEffectsChange]);

  const handleApplyPresetToAll = useCallback((preset: typeof EFFECT_PRESETS[0]) => {
    if (onApplyToAll) {
      onApplyToAll(preset.effect);
    }
  }, [onApplyToAll]);

  // Generate CSS filter string
  const getFilterStyle = useCallback(() => {
    const filterPreset = FILTERS.find(f => f.id === currentEffect.filter);
    const baseFilter = filterPreset?.css || '';
    const adjustments = `brightness(${currentEffect.brightness / 100}) contrast(${currentEffect.contrast / 100}) saturate(${currentEffect.saturation / 100})`;
    return `${baseFilter} ${adjustments}`.trim();
  }, [currentEffect]);

  // Generate transform style
  const getTransformStyle = useCallback(() => {
    return `scale(${currentEffect.zoom}) translate(${currentEffect.panX}%, ${currentEffect.panY}%)`;
  }, [currentEffect]);

  if (!clip) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5" />
            Effetti Visivi
          </CardTitle>
          <CardDescription>
            Seleziona un clip dalla timeline per modificarne gli effetti
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>Nessun clip selezionato</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasEffects = JSON.stringify(currentEffect) !== JSON.stringify(DEFAULT_EFFECT);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="w-5 h-5" />
              Effetti Visivi
            </CardTitle>
            <CardDescription className="truncate max-w-[200px]">
              {clip.prompt.slice(0, 30)}...
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {hasEffects && (
              <Badge variant="secondary" className="text-xs">
                Modificato
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={resetEffects}>
              <RotateCcw className="w-4 h-4 mr-1" />
              Reset
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Preview */}
        <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
          <video
            src={clip.videoUrl}
            className="w-full h-full object-contain transition-all duration-300"
            style={{
              filter: getFilterStyle(),
              transform: getTransformStyle(),
            }}
            muted
            loop
            autoPlay
          />
          <div className="absolute bottom-2 right-2">
            <Badge variant="secondary" className="bg-background/80 text-xs">
              Anteprima
            </Badge>
          </div>
        </div>

        {/* Zoom & Pan */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <ZoomIn className="w-4 h-4 text-muted-foreground" />
            <h4 className="font-medium">Zoom & Pan</h4>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-xs">Zoom</Label>
                <span className="text-xs text-muted-foreground">{Math.round(currentEffect.zoom * 100)}%</span>
              </div>
              <Slider
                value={[currentEffect.zoom]}
                onValueChange={([v]) => updateEffect({ zoom: v })}
                min={0.5}
                max={2}
                step={0.05}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Animazione Zoom</Label>
              <Select 
                value={currentEffect.zoomAnimation}
                onValueChange={(v) => updateEffect({ zoomAnimation: v as ClipEffect['zoomAnimation'] })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ZOOM_ANIMATIONS.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs flex items-center gap-1">
                  <Move className="w-3 h-3" /> Pan X
                </Label>
                <span className="text-xs text-muted-foreground">{currentEffect.panX}%</span>
              </div>
              <Slider
                value={[currentEffect.panX]}
                onValueChange={([v]) => updateEffect({ panX: v })}
                min={-50}
                max={50}
                step={1}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs flex items-center gap-1">
                  <Move className="w-3 h-3" /> Pan Y
                </Label>
                <span className="text-xs text-muted-foreground">{currentEffect.panY}%</span>
              </div>
              <Slider
                value={[currentEffect.panY]}
                onValueChange={([v]) => updateEffect({ panY: v })}
                min={-50}
                max={50}
                step={1}
              />
            </div>
          </div>
        </div>

        {/* Color Filters */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-muted-foreground" />
            <h4 className="font-medium">Filtri Colore</h4>
          </div>
          
          <div className="grid grid-cols-4 gap-2">
            {FILTERS.map((filter) => (
              <Button
                key={filter.id}
                variant={currentEffect.filter === filter.id ? 'default' : 'outline'}
                size="sm"
                className="h-8 text-xs"
                onClick={() => updateEffect({ filter: filter.id as ClipEffect['filter'] })}
              >
                {filter.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Adjustments */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Sun className="w-4 h-4 text-muted-foreground" />
            <h4 className="font-medium">Regolazioni</h4>
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs flex items-center gap-1">
                  <Sun className="w-3 h-3" /> Luminosità
                </Label>
                <span className="text-xs text-muted-foreground">{currentEffect.brightness}%</span>
              </div>
              <Slider
                value={[currentEffect.brightness]}
                onValueChange={([v]) => updateEffect({ brightness: v })}
                min={50}
                max={150}
                step={5}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs flex items-center gap-1">
                  <Contrast className="w-3 h-3" /> Contrasto
                </Label>
                <span className="text-xs text-muted-foreground">{currentEffect.contrast}%</span>
              </div>
              <Slider
                value={[currentEffect.contrast]}
                onValueChange={([v]) => updateEffect({ contrast: v })}
                min={50}
                max={150}
                step={5}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs flex items-center gap-1">
                  <Droplets className="w-3 h-3" /> Saturazione
                </Label>
                <span className="text-xs text-muted-foreground">{currentEffect.saturation}%</span>
              </div>
              <Slider
                value={[currentEffect.saturation]}
                onValueChange={([v]) => updateEffect({ saturation: v })}
                min={0}
                max={200}
                step={5}
              />
            </div>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="pt-2 border-t">
          <Label className="text-xs text-muted-foreground mb-2 block">Preset Rapidi (Clip Corrente)</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => updateEffect({ 
                zoomAnimation: 'ken-burns', 
                zoom: 1.1 
              })}
            >
              Ken Burns
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => updateEffect({ 
                filter: 'cinematic', 
                contrast: 120, 
                saturation: 90 
              })}
            >
              Cinematico
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => updateEffect({ 
                filter: 'vintage', 
                brightness: 95, 
                saturation: 85 
              })}
            >
              Retrò
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => updateEffect({ 
                filter: 'dramatic', 
                contrast: 130 
              })}
            >
              Drammatico
            </Button>
          </div>
        </div>

        {/* Apply to All Clips */}
        {allClips.length > 1 && onApplyToAll && (
          <div className="pt-3 border-t space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Applica a Tutti i Clip ({allClips.length})</Label>
              <Badge variant="secondary" className="text-[10px]">Batch</Badge>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {EFFECT_PRESETS.map((preset) => (
                <Button
                  key={preset.id}
                  variant="outline"
                  size="sm"
                  className="h-auto py-2 flex flex-col items-center gap-1 text-xs hover:bg-primary/10"
                  onClick={() => handleApplyPresetToAll(preset)}
                  title={`Applica ${preset.name} a tutti i clip`}
                >
                  <span className="text-lg">{preset.icon}</span>
                  <span className="truncate w-full text-center">{preset.name}</span>
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ClipEffectsPanel;
