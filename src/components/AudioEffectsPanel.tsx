import React, { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  AudioLines, 
  Waves, 
  TrendingUp, 
  Volume2,
  RotateCcw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export interface AudioEffects {
  // Reverb
  reverbEnabled: boolean;
  reverbDecay: number; // 0-10 seconds
  reverbWet: number; // 0-100% mix
  
  // Pitch Shift
  pitchEnabled: boolean;
  pitchSemitones: number; // -12 to +12 semitones
  
  // Equalizer
  eqEnabled: boolean;
  eqLow: number; // -12 to +12 dB
  eqMid: number; // -12 to +12 dB
  eqHigh: number; // -12 to +12 dB
  
  // Compressor
  compressorEnabled: boolean;
  compressorThreshold: number; // -60 to 0 dB
  compressorRatio: number; // 1 to 20
}

export const defaultAudioEffects: AudioEffects = {
  reverbEnabled: false,
  reverbDecay: 2,
  reverbWet: 30,
  pitchEnabled: false,
  pitchSemitones: 0,
  eqEnabled: false,
  eqLow: 0,
  eqMid: 0,
  eqHigh: 0,
  compressorEnabled: false,
  compressorThreshold: -24,
  compressorRatio: 4,
};

interface AudioEffectsPanelProps {
  effects: AudioEffects;
  onChange: (effects: AudioEffects) => void;
  disabled?: boolean;
  trackName?: string;
}

export const AudioEffectsPanel = memo(function AudioEffectsPanel({
  effects,
  onChange,
  disabled = false,
  trackName
}: AudioEffectsPanelProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  
  const updateEffect = <K extends keyof AudioEffects>(key: K, value: AudioEffects[K]) => {
    onChange({ ...effects, [key]: value });
  };
  
  const resetEffects = () => {
    onChange(defaultAudioEffects);
  };
  
  const hasActiveEffects = effects.reverbEnabled || effects.pitchEnabled || effects.eqEnabled || effects.compressorEnabled;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className={`w-full justify-between ${hasActiveEffects ? 'border-primary text-primary' : ''}`}
          disabled={disabled}
        >
          <div className="flex items-center gap-2">
            <AudioLines className="h-4 w-4" />
            <span>Effetti Audio</span>
            {hasActiveEffects && (
              <span className="text-xs bg-primary/20 px-1.5 py-0.5 rounded">
                {[effects.reverbEnabled, effects.pitchEnabled, effects.eqEnabled, effects.compressorEnabled].filter(Boolean).length} attivi
              </span>
            )}
          </div>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="space-y-4 pt-4">
        {/* Reset Button */}
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={resetEffects} disabled={disabled}>
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset
          </Button>
        </div>
        
        {/* Reverb Section */}
        <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 font-medium">
              <Waves className="h-4 w-4 text-blue-500" />
              Riverbero
            </Label>
            <Switch
              checked={effects.reverbEnabled}
              onCheckedChange={(v) => updateEffect('reverbEnabled', v)}
              disabled={disabled}
            />
          </div>
          
          {effects.reverbEnabled && (
            <div className="space-y-3 pl-6">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Decay: {effects.reverbDecay.toFixed(1)}s
                </Label>
                <Slider
                  value={[effects.reverbDecay]}
                  min={0.1}
                  max={10}
                  step={0.1}
                  onValueChange={([v]) => updateEffect('reverbDecay', v)}
                  disabled={disabled}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Mix: {effects.reverbWet}%
                </Label>
                <Slider
                  value={[effects.reverbWet]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={([v]) => updateEffect('reverbWet', v)}
                  disabled={disabled}
                />
              </div>
            </div>
          )}
        </div>
        
        {/* Pitch Shift Section */}
        <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 font-medium">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              Pitch Shift
            </Label>
            <Switch
              checked={effects.pitchEnabled}
              onCheckedChange={(v) => updateEffect('pitchEnabled', v)}
              disabled={disabled}
            />
          </div>
          
          {effects.pitchEnabled && (
            <div className="space-y-3 pl-6">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Semitoni: {effects.pitchSemitones > 0 ? '+' : ''}{effects.pitchSemitones}
                </Label>
                <Slider
                  value={[effects.pitchSemitones]}
                  min={-12}
                  max={12}
                  step={1}
                  onValueChange={([v]) => updateEffect('pitchSemitones', v)}
                  disabled={disabled}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>-12 (basso)</span>
                  <span>0</span>
                  <span>+12 (alto)</span>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Equalizer Section */}
        <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 font-medium">
              <AudioLines className="h-4 w-4 text-green-500" />
              Equalizzatore
            </Label>
            <Switch
              checked={effects.eqEnabled}
              onCheckedChange={(v) => updateEffect('eqEnabled', v)}
              disabled={disabled}
            />
          </div>
          
          {effects.eqEnabled && (
            <div className="grid grid-cols-3 gap-4 pl-6">
              <div className="space-y-1 text-center">
                <Label className="text-xs text-muted-foreground">
                  Bassi: {effects.eqLow > 0 ? '+' : ''}{effects.eqLow}dB
                </Label>
                <div className="h-24 flex items-center justify-center">
                  <Slider
                    value={[effects.eqLow]}
                    min={-12}
                    max={12}
                    step={1}
                    orientation="vertical"
                    onValueChange={([v]) => updateEffect('eqLow', v)}
                    disabled={disabled}
                    className="h-full"
                  />
                </div>
              </div>
              <div className="space-y-1 text-center">
                <Label className="text-xs text-muted-foreground">
                  Medi: {effects.eqMid > 0 ? '+' : ''}{effects.eqMid}dB
                </Label>
                <div className="h-24 flex items-center justify-center">
                  <Slider
                    value={[effects.eqMid]}
                    min={-12}
                    max={12}
                    step={1}
                    orientation="vertical"
                    onValueChange={([v]) => updateEffect('eqMid', v)}
                    disabled={disabled}
                    className="h-full"
                  />
                </div>
              </div>
              <div className="space-y-1 text-center">
                <Label className="text-xs text-muted-foreground">
                  Alti: {effects.eqHigh > 0 ? '+' : ''}{effects.eqHigh}dB
                </Label>
                <div className="h-24 flex items-center justify-center">
                  <Slider
                    value={[effects.eqHigh]}
                    min={-12}
                    max={12}
                    step={1}
                    orientation="vertical"
                    onValueChange={([v]) => updateEffect('eqHigh', v)}
                    disabled={disabled}
                    className="h-full"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Compressor Section */}
        <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 font-medium">
              <Volume2 className="h-4 w-4 text-orange-500" />
              Compressore
            </Label>
            <Switch
              checked={effects.compressorEnabled}
              onCheckedChange={(v) => updateEffect('compressorEnabled', v)}
              disabled={disabled}
            />
          </div>
          
          {effects.compressorEnabled && (
            <div className="space-y-3 pl-6">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Threshold: {effects.compressorThreshold}dB
                </Label>
                <Slider
                  value={[effects.compressorThreshold]}
                  min={-60}
                  max={0}
                  step={1}
                  onValueChange={([v]) => updateEffect('compressorThreshold', v)}
                  disabled={disabled}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Ratio: {effects.compressorRatio}:1
                </Label>
                <Slider
                  value={[effects.compressorRatio]}
                  min={1}
                  max={20}
                  step={0.5}
                  onValueChange={([v]) => updateEffect('compressorRatio', v)}
                  disabled={disabled}
                />
              </div>
            </div>
          )}
        </div>
        
        {/* Info */}
        <p className="text-xs text-muted-foreground text-center">
          Gli effetti vengono applicati durante l'esportazione
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
});

export default AudioEffectsPanel;
