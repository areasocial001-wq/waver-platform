import React from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Radio, Timer, Volume1 } from "lucide-react";

export interface AudioEffectsSettings {
  // Global Dry/Wet mix: 0 = 100% dry (no effects), 100 = 100% wet (only effects)
  dryWetMix: number;

  // Reverb
  reverbEnabled: boolean;
  reverbMix: number; // 0-100 (wet/dry)
  reverbDecay: number; // 0.1-10 seconds
  
  // Echo/Delay
  echoEnabled: boolean;
  echoDelay: number; // 0-1 seconds
  echoFeedback: number; // 0-90%
  echoMix: number; // 0-100
  
  // Compressor
  compressorEnabled: boolean;
  compressorThreshold: number; // -60 to 0 dB
  compressorRatio: number; // 1-20
  compressorAttack: number; // 0-1 seconds
  compressorRelease: number; // 0-1 seconds
}

export const DEFAULT_EFFECTS_SETTINGS: AudioEffectsSettings = {
  dryWetMix: 50,
  reverbEnabled: false,
  reverbMix: 30,
  reverbDecay: 2,
  echoEnabled: false,
  echoDelay: 0.3,
  echoFeedback: 40,
  echoMix: 25,
  compressorEnabled: false,
  compressorThreshold: -24,
  compressorRatio: 4,
  compressorAttack: 0.003,
  compressorRelease: 0.25,
};

// Effect presets
interface EffectPreset {
  name: string;
  description: string;
  settings: Partial<AudioEffectsSettings>;
}

const EFFECT_PRESETS: Record<string, EffectPreset> = {
  none: {
    name: 'Nessuno',
    description: 'Nessun effetto attivo',
    settings: DEFAULT_EFFECTS_SETTINGS,
  },
  studio: {
    name: 'Studio',
    description: 'Riverbero leggero da studio',
    settings: {
      dryWetMix: 30,
      reverbEnabled: true,
      reverbMix: 15,
      reverbDecay: 1.5,
      compressorEnabled: true,
      compressorThreshold: -20,
      compressorRatio: 3,
    },
  },
  podcast: {
    name: 'Podcast',
    description: 'Voce chiara con compressione',
    settings: {
      dryWetMix: 15,
      reverbEnabled: false,
      compressorEnabled: true,
      compressorThreshold: -18,
      compressorRatio: 4,
      compressorAttack: 0.005,
      compressorRelease: 0.2,
    },
  },
  concert: {
    name: 'Concerto',
    description: 'Riverbero ampio da sala',
    settings: {
      dryWetMix: 60,
      reverbEnabled: true,
      reverbMix: 50,
      reverbDecay: 4,
      echoEnabled: false,
    },
  },
  ambient: {
    name: 'Ambient',
    description: 'Atmosfera con eco e riverbero',
    settings: {
      dryWetMix: 70,
      reverbEnabled: true,
      reverbMix: 40,
      reverbDecay: 6,
      echoEnabled: true,
      echoDelay: 0.5,
      echoFeedback: 30,
      echoMix: 20,
    },
  },
  voiceover: {
    name: 'Voiceover',
    description: 'Ottimizzato per narrazioni',
    settings: {
      dryWetMix: 20,
      reverbEnabled: true,
      reverbMix: 10,
      reverbDecay: 1,
      compressorEnabled: true,
      compressorThreshold: -24,
      compressorRatio: 6,
    },
  },
};

interface AudioEffectsProps {
  settings: AudioEffectsSettings;
  onSettingsChange: (settings: AudioEffectsSettings) => void;
}

export function AudioEffects({ settings, onSettingsChange }: AudioEffectsProps) {
  const handleChange = <K extends keyof AudioEffectsSettings>(key: K, value: AudioEffectsSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const handlePresetChange = (presetKey: string) => {
    const preset = EFFECT_PRESETS[presetKey];
    if (preset) {
      onSettingsChange({ ...DEFAULT_EFFECTS_SETTINGS, ...preset.settings });
    }
  };

  const hasAnyEffect = settings.reverbEnabled || settings.echoEnabled || settings.compressorEnabled;

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          Effetti Audio
        </Label>
      </div>

      {/* Global Dry/Wet Mix */}
      {hasAnyEffect && (
        <div className="space-y-2 p-3 bg-accent/10 rounded-md border border-accent/20">
          <div className="flex justify-between text-xs">
            <span className="font-medium flex items-center gap-1">
              <Volume1 className="w-3 h-3" />
              Dry / Wet Mix
            </span>
            <span className="tabular-nums">{settings.dryWetMix}%</span>
          </div>
          <Slider
            value={[settings.dryWetMix]}
            min={0}
            max={100}
            step={1}
            onValueChange={(v) => handleChange('dryWetMix', v[0])}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>100% Pulito</span>
            <span>100% Effetti</span>
          </div>
        </div>
      )}

      {/* Preset Selector */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Preset Effetti</Label>
        <Select onValueChange={handlePresetChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Seleziona preset effetti" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(EFFECT_PRESETS).map(([key, preset]) => (
              <SelectItem key={key} value={key}>
                <div className="flex flex-col">
                  <span className="font-medium">{preset.name}</span>
                  <span className="text-xs text-muted-foreground">{preset.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Reverb Section */}
      <div className="space-y-3 p-3 bg-background/50 rounded-md">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-sm">
            <Radio className="w-3 h-3" />
            Riverbero
          </Label>
          <Switch
            checked={settings.reverbEnabled}
            onCheckedChange={(checked) => handleChange('reverbEnabled', checked)}
          />
        </div>
        
        {settings.reverbEnabled && (
          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Mix (wet/dry)</span>
                <span>{settings.reverbMix}%</span>
              </div>
              <Slider
                value={[settings.reverbMix]}
                min={0}
                max={100}
                step={1}
                onValueChange={(v) => handleChange('reverbMix', v[0])}
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Decay</span>
                <span>{settings.reverbDecay.toFixed(1)}s</span>
              </div>
              <Slider
                value={[settings.reverbDecay]}
                min={0.1}
                max={10}
                step={0.1}
                onValueChange={(v) => handleChange('reverbDecay', v[0])}
              />
            </div>
          </div>
        )}
      </div>

      {/* Echo Section */}
      <div className="space-y-3 p-3 bg-background/50 rounded-md">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-sm">
            <Timer className="w-3 h-3" />
            Echo / Delay
          </Label>
          <Switch
            checked={settings.echoEnabled}
            onCheckedChange={(checked) => handleChange('echoEnabled', checked)}
          />
        </div>
        
        {settings.echoEnabled && (
          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Delay</span>
                <span>{(settings.echoDelay * 1000).toFixed(0)}ms</span>
              </div>
              <Slider
                value={[settings.echoDelay]}
                min={0.05}
                max={1}
                step={0.01}
                onValueChange={(v) => handleChange('echoDelay', v[0])}
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Feedback</span>
                <span>{settings.echoFeedback}%</span>
              </div>
              <Slider
                value={[settings.echoFeedback]}
                min={0}
                max={90}
                step={1}
                onValueChange={(v) => handleChange('echoFeedback', v[0])}
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Mix</span>
                <span>{settings.echoMix}%</span>
              </div>
              <Slider
                value={[settings.echoMix]}
                min={0}
                max={100}
                step={1}
                onValueChange={(v) => handleChange('echoMix', v[0])}
              />
            </div>
          </div>
        )}
      </div>

      {/* Compressor Section */}
      <div className="space-y-3 p-3 bg-background/50 rounded-md">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-sm">
            <Volume1 className="w-3 h-3" />
            Compressore
          </Label>
          <Switch
            checked={settings.compressorEnabled}
            onCheckedChange={(checked) => handleChange('compressorEnabled', checked)}
          />
        </div>
        
        {settings.compressorEnabled && (
          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Threshold</span>
                <span>{settings.compressorThreshold}dB</span>
              </div>
              <Slider
                value={[settings.compressorThreshold]}
                min={-60}
                max={0}
                step={1}
                onValueChange={(v) => handleChange('compressorThreshold', v[0])}
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Ratio</span>
                <span>{settings.compressorRatio}:1</span>
              </div>
              <Slider
                value={[settings.compressorRatio]}
                min={1}
                max={20}
                step={0.5}
                onValueChange={(v) => handleChange('compressorRatio', v[0])}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Attack</span>
                  <span>{(settings.compressorAttack * 1000).toFixed(0)}ms</span>
                </div>
                <Slider
                  value={[settings.compressorAttack]}
                  min={0}
                  max={1}
                  step={0.001}
                  onValueChange={(v) => handleChange('compressorAttack', v[0])}
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Release</span>
                  <span>{(settings.compressorRelease * 1000).toFixed(0)}ms</span>
                </div>
                <Slider
                  value={[settings.compressorRelease]}
                  min={0.01}
                  max={1}
                  step={0.01}
                  onValueChange={(v) => handleChange('compressorRelease', v[0])}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Riverbero aggiunge spazialità, eco crea ripetizioni, compressore uniforma i volumi.
      </p>
    </div>
  );
}
