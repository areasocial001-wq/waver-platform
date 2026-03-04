import React, { useState, useEffect, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Radio, Timer, Volume1, Save, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  cinematic: {
    name: 'Cinematico',
    description: 'Scene drammatiche con riverbero lungo ed eco sottile',
    settings: {
      dryWetMix: 45,
      reverbEnabled: true,
      reverbMix: 55,
      reverbDecay: 7,
      echoEnabled: true,
      echoDelay: 0.4,
      echoFeedback: 20,
      echoMix: 15,
      compressorEnabled: true,
      compressorThreshold: -22,
      compressorRatio: 3,
    },
  },
  documentary: {
    name: 'Documentario',
    description: 'Voce naturale con compressione moderata',
    settings: {
      dryWetMix: 25,
      reverbEnabled: true,
      reverbMix: 12,
      reverbDecay: 1.8,
      echoEnabled: false,
      compressorEnabled: true,
      compressorThreshold: -20,
      compressorRatio: 3.5,
      compressorAttack: 0.008,
      compressorRelease: 0.3,
    },
  },
};

interface UserPreset {
  id: string;
  name: string;
  settings: AudioEffectsSettings;
}

interface AudioEffectsProps {
  settings: AudioEffectsSettings;
  onSettingsChange: (settings: AudioEffectsSettings) => void;
}

export function AudioEffects({ settings, onSettingsChange }: AudioEffectsProps) {
  const [userPresets, setUserPresets] = useState<UserPreset[]>([]);
  const [newPresetName, setNewPresetName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const loadUserPresets = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await (supabase
        .from('audio_effect_presets') as any)
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setUserPresets((data || []).map(p => ({
        id: p.id,
        name: p.name,
        settings: p.settings as unknown as AudioEffectsSettings,
      })));
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadUserPresets(); }, [loadUserPresets]);

  const handleChange = <K extends keyof AudioEffectsSettings>(key: K, value: AudioEffectsSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const handlePresetChange = (presetKey: string) => {
    // Check built-in presets first
    const preset = EFFECT_PRESETS[presetKey];
    if (preset) {
      onSettingsChange({ ...DEFAULT_EFFECTS_SETTINGS, ...preset.settings });
      return;
    }
    // Check user presets
    const userPreset = userPresets.find(p => p.id === presetKey);
    if (userPreset) {
      onSettingsChange({ ...DEFAULT_EFFECTS_SETTINGS, ...userPreset.settings });
    }
  };

  const handleSavePreset = async () => {
    if (!newPresetName.trim()) {
      toast.error("Inserisci un nome per il preset");
      return;
    }
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Devi essere autenticato"); return; }
      const { error } = await (supabase.from('audio_effect_presets') as any).insert({
        user_id: user.id,
        name: newPresetName.trim(),
        settings: settings as unknown as Record<string, unknown>,
      });
      if (error) throw error;
      toast.success(`Preset "${newPresetName.trim()}" salvato!`);
      setNewPresetName("");
      setShowSaveInput(false);
      await loadUserPresets();
    } catch (e) {
      toast.error("Errore nel salvataggio: " + (e as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePreset = async (presetId: string, presetName: string) => {
    try {
      const { error } = await (supabase.from('audio_effect_presets') as any).delete().eq('id', presetId);
      if (error) throw error;
      toast.success(`Preset "${presetName}" eliminato`);
      await loadUserPresets();
    } catch (e) {
      toast.error("Errore: " + (e as Error).message);
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
            {userPresets.length > 0 && (
              <>
                {userPresets.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">⭐ {preset.name}</span>
                      <span className="text-xs text-muted-foreground">Preset personalizzato</span>
                    </div>
                  </SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Save / Manage Custom Presets */}
      <div className="space-y-2">
        {!showSaveInput ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setShowSaveInput(true)}
          >
            <Save className="w-3 h-3 mr-1" />
            Salva impostazioni come preset
          </Button>
        ) : (
          <div className="flex gap-2">
            <Input
              placeholder="Nome preset..."
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
              className="h-8 text-xs"
            />
            <Button size="sm" onClick={handleSavePreset} disabled={isSaving} className="h-8 shrink-0">
              {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowSaveInput(false)} className="h-8 shrink-0">
              ✕
            </Button>
          </div>
        )}

        {/* User presets list with delete */}
        {userPresets.length > 0 && (
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">I tuoi preset</Label>
            {userPresets.map((preset) => (
              <div key={preset.id} className="flex items-center justify-between p-1.5 rounded bg-background/50 text-xs">
                <span className="truncate">⭐ {preset.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                  onClick={() => handleDeletePreset(preset.id, preset.name)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
        {isLoading && (
          <div className="flex items-center justify-center py-1">
            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
          </div>
        )}
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
