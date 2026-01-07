import React, { memo, useCallback, useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { 
  AudioLines, 
  Waves, 
  TrendingUp, 
  Volume2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Play,
  Square,
  Mic,
  Music,
  Sparkles,
  Loader2
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';

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

// Effects Presets
interface EffectsPreset {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  effects: AudioEffects;
}

export const effectsPresets: EffectsPreset[] = [
  {
    id: 'voice-enhance',
    name: 'Voice Enhancement',
    icon: <Mic className="h-4 w-4" />,
    description: 'Ottimizza la voce con chiarezza e presenza',
    effects: {
      reverbEnabled: false,
      reverbDecay: 1,
      reverbWet: 15,
      pitchEnabled: false,
      pitchSemitones: 0,
      eqEnabled: true,
      eqLow: -3,
      eqMid: 2,
      eqHigh: 4,
      compressorEnabled: true,
      compressorThreshold: -20,
      compressorRatio: 4,
    }
  },
  {
    id: 'bass-boost',
    name: 'Bass Boost',
    icon: <Music className="h-4 w-4" />,
    description: 'Potenzia i bassi per più impatto',
    effects: {
      reverbEnabled: false,
      reverbDecay: 2,
      reverbWet: 30,
      pitchEnabled: false,
      pitchSemitones: 0,
      eqEnabled: true,
      eqLow: 8,
      eqMid: 0,
      eqHigh: -2,
      compressorEnabled: true,
      compressorThreshold: -15,
      compressorRatio: 3,
    }
  },
  {
    id: 'reverb-room',
    name: 'Reverb Room',
    icon: <Waves className="h-4 w-4" />,
    description: 'Aggiunge spazialità con riverbero ambiente',
    effects: {
      reverbEnabled: true,
      reverbDecay: 3,
      reverbWet: 40,
      pitchEnabled: false,
      pitchSemitones: 0,
      eqEnabled: true,
      eqLow: 0,
      eqMid: 1,
      eqHigh: 2,
      compressorEnabled: false,
      compressorThreshold: -24,
      compressorRatio: 4,
    }
  },
  {
    id: 'radio-voice',
    name: 'Radio Voice',
    icon: <AudioLines className="h-4 w-4" />,
    description: 'Effetto radio/telefono vintage',
    effects: {
      reverbEnabled: false,
      reverbDecay: 0.5,
      reverbWet: 10,
      pitchEnabled: false,
      pitchSemitones: 0,
      eqEnabled: true,
      eqLow: -12,
      eqMid: 6,
      eqHigh: -8,
      compressorEnabled: true,
      compressorThreshold: -10,
      compressorRatio: 8,
    }
  },
  {
    id: 'cinematic',
    name: 'Cinematic',
    icon: <Sparkles className="h-4 w-4" />,
    description: 'Audio cinematografico professionale',
    effects: {
      reverbEnabled: true,
      reverbDecay: 4,
      reverbWet: 25,
      pitchEnabled: false,
      pitchSemitones: 0,
      eqEnabled: true,
      eqLow: 2,
      eqMid: 0,
      eqHigh: 3,
      compressorEnabled: true,
      compressorThreshold: -18,
      compressorRatio: 3,
    }
  },
];

interface AudioEffectsPanelProps {
  effects: AudioEffects;
  onChange: (effects: AudioEffects) => void;
  disabled?: boolean;
  trackName?: string;
  audioUrl?: string;
}

// Create a convolver impulse response for reverb
const createImpulseResponse = (audioContext: AudioContext, duration: number, decay: number): AudioBuffer => {
  const sampleRate = audioContext.sampleRate;
  const length = sampleRate * duration;
  const impulse = audioContext.createBuffer(2, length, sampleRate);
  
  for (let channel = 0; channel < 2; channel++) {
    const channelData = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  
  return impulse;
};

export const AudioEffectsPanel = memo(function AudioEffectsPanel({
  effects,
  onChange,
  disabled = false,
  trackName,
  audioUrl
}: AudioEffectsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  
  // Web Audio API refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const eqLowRef = useRef<BiquadFilterNode | null>(null);
  const eqMidRef = useRef<BiquadFilterNode | null>(null);
  const eqHighRef = useRef<BiquadFilterNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const convolverRef = useRef<ConvolverNode | null>(null);
  const dryGainRef = useRef<GainNode | null>(null);
  const wetGainRef = useRef<GainNode | null>(null);
  
  const updateEffect = <K extends keyof AudioEffects>(key: K, value: AudioEffects[K]) => {
    onChange({ ...effects, [key]: value });
  };
  
  const resetEffects = () => {
    onChange(defaultAudioEffects);
  };
  
  const applyPreset = (preset: EffectsPreset) => {
    onChange(preset.effects);
    toast.success(`Preset "${preset.name}" applicato`);
  };
  
  const hasActiveEffects = effects.reverbEnabled || effects.pitchEnabled || effects.eqEnabled || effects.compressorEnabled;

  // Load audio buffer for preview
  const loadAudioBuffer = useCallback(async () => {
    if (!audioUrl) return null;
    
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      audioBufferRef.current = audioBuffer;
      return audioBuffer;
    } catch (error) {
      console.error('Error loading audio:', error);
      return null;
    }
  }, [audioUrl]);

  // Setup and apply effects chain
  const setupEffectsChain = useCallback(() => {
    const ctx = audioContextRef.current;
    if (!ctx) return null;
    
    // Create nodes
    const gainNode = ctx.createGain();
    gainNode.gain.value = 1;
    gainNodeRef.current = gainNode;
    
    // EQ nodes (3-band)
    const eqLow = ctx.createBiquadFilter();
    eqLow.type = 'lowshelf';
    eqLow.frequency.value = 320;
    eqLow.gain.value = effects.eqEnabled ? effects.eqLow : 0;
    eqLowRef.current = eqLow;
    
    const eqMid = ctx.createBiquadFilter();
    eqMid.type = 'peaking';
    eqMid.frequency.value = 1000;
    eqMid.Q.value = 0.5;
    eqMid.gain.value = effects.eqEnabled ? effects.eqMid : 0;
    eqMidRef.current = eqMid;
    
    const eqHigh = ctx.createBiquadFilter();
    eqHigh.type = 'highshelf';
    eqHigh.frequency.value = 3200;
    eqHigh.gain.value = effects.eqEnabled ? effects.eqHigh : 0;
    eqHighRef.current = eqHigh;
    
    // Compressor
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = effects.compressorEnabled ? effects.compressorThreshold : 0;
    compressor.ratio.value = effects.compressorEnabled ? effects.compressorRatio : 1;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;
    compressorRef.current = compressor;
    
    // Reverb (convolver)
    const convolver = ctx.createConvolver();
    const impulseResponse = createImpulseResponse(ctx, effects.reverbDecay, 2);
    convolver.buffer = impulseResponse;
    convolverRef.current = convolver;
    
    // Dry/Wet mix for reverb
    const dryGain = ctx.createGain();
    const wetGain = ctx.createGain();
    const wetAmount = effects.reverbEnabled ? effects.reverbWet / 100 : 0;
    dryGain.gain.value = 1 - wetAmount * 0.5;
    wetGain.gain.value = wetAmount;
    dryGainRef.current = dryGain;
    wetGainRef.current = wetGain;
    
    // Connect chain
    gainNode.connect(eqLow);
    eqLow.connect(eqMid);
    eqMid.connect(eqHigh);
    eqHigh.connect(compressor);
    
    // Split for reverb
    compressor.connect(dryGain);
    compressor.connect(convolver);
    convolver.connect(wetGain);
    
    dryGain.connect(ctx.destination);
    wetGain.connect(ctx.destination);
    
    return gainNode;
  }, [effects]);

  // Update effects in real-time
  useEffect(() => {
    if (!isPreviewing) return;
    
    // Update EQ
    if (eqLowRef.current) {
      eqLowRef.current.gain.value = effects.eqEnabled ? effects.eqLow : 0;
    }
    if (eqMidRef.current) {
      eqMidRef.current.gain.value = effects.eqEnabled ? effects.eqMid : 0;
    }
    if (eqHighRef.current) {
      eqHighRef.current.gain.value = effects.eqEnabled ? effects.eqHigh : 0;
    }
    
    // Update compressor
    if (compressorRef.current) {
      compressorRef.current.threshold.value = effects.compressorEnabled ? effects.compressorThreshold : 0;
      compressorRef.current.ratio.value = effects.compressorEnabled ? effects.compressorRatio : 1;
    }
    
    // Update reverb mix
    if (dryGainRef.current && wetGainRef.current) {
      const wetAmount = effects.reverbEnabled ? effects.reverbWet / 100 : 0;
      dryGainRef.current.gain.value = 1 - wetAmount * 0.5;
      wetGainRef.current.gain.value = wetAmount;
    }
  }, [effects, isPreviewing]);

  // Start preview
  const startPreview = async () => {
    if (!audioUrl) {
      toast.error('Nessuna traccia audio disponibile per la preview');
      return;
    }
    
    setIsLoadingPreview(true);
    
    try {
      // Stop any existing preview
      stopPreview();
      
      // Load buffer if needed
      if (!audioBufferRef.current) {
        await loadAudioBuffer();
      }
      
      if (!audioBufferRef.current || !audioContextRef.current) {
        throw new Error('Failed to load audio');
      }
      
      const ctx = audioContextRef.current;
      
      // Resume context if suspended
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      
      // Setup effects chain
      const inputNode = setupEffectsChain();
      if (!inputNode) throw new Error('Failed to setup effects');
      
      // Create source
      const source = ctx.createBufferSource();
      source.buffer = audioBufferRef.current;
      
      // Apply pitch shift using playbackRate (simple method)
      if (effects.pitchEnabled && effects.pitchSemitones !== 0) {
        source.playbackRate.value = Math.pow(2, effects.pitchSemitones / 12);
      }
      
      source.connect(inputNode);
      source.loop = true;
      source.start(0);
      sourceNodeRef.current = source;
      
      setIsPreviewing(true);
      toast.success('Preview avviata - Modifica gli effetti per sentire le modifiche in tempo reale');
    } catch (error) {
      console.error('Preview error:', error);
      toast.error('Errore nell\'avvio della preview');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Stop preview
  const stopPreview = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch (e) {
        // Ignore errors from already stopped sources
      }
      sourceNodeRef.current = null;
    }
    setIsPreviewing(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPreview();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [stopPreview]);

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
        {/* Presets */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Preset Rapidi</Label>
          <div className="flex flex-wrap gap-2">
            {effectsPresets.map((preset) => (
              <Button
                key={preset.id}
                variant="outline"
                size="sm"
                onClick={() => applyPreset(preset)}
                disabled={disabled}
                className="gap-1 text-xs h-7"
                title={preset.description}
              >
                {preset.icon}
                {preset.name}
              </Button>
            ))}
          </div>
        </div>
        
        {/* Preview Controls */}
        {audioUrl && (
          <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-lg">
            <Button
              variant={isPreviewing ? "destructive" : "default"}
              size="sm"
              onClick={isPreviewing ? stopPreview : startPreview}
              disabled={disabled || isLoadingPreview}
              className="gap-1"
            >
              {isLoadingPreview ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isPreviewing ? (
                <Square className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {isPreviewing ? 'Stop Preview' : 'Preview Effetti'}
            </Button>
            {isPreviewing && (
              <span className="text-xs text-muted-foreground animate-pulse">
                🔊 Preview attiva - modifica gli effetti per sentirli in tempo reale
              </span>
            )}
          </div>
        )}
        
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
              {isPreviewing && effects.pitchSemitones !== 0 && (
                <p className="text-[10px] text-amber-500">
                  ⚠️ Per sentire le modifiche al pitch, riavvia la preview
                </p>
              )}
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
          {isPreviewing 
            ? '🎧 Preview in tempo reale attiva' 
            : 'Gli effetti vengono applicati durante l\'esportazione'}
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
});

export default AudioEffectsPanel;
