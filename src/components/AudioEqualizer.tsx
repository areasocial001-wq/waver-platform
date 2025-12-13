import React, { useEffect, useRef, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RotateCcw, Music2 } from "lucide-react";

export interface EqualizerSettings {
  bass: number;      // 60-250 Hz
  lowMid: number;    // 250-500 Hz
  mid: number;       // 500-2000 Hz
  highMid: number;   // 2000-4000 Hz
  treble: number;    // 4000-16000 Hz
}

interface AudioEqualizerProps {
  audioElement: HTMLAudioElement | null;
  settings: EqualizerSettings;
  onSettingsChange: (settings: EqualizerSettings) => void;
  onAudioContextReady?: (context: AudioContext, source: MediaElementAudioSourceNode) => void;
}

const DEFAULT_SETTINGS: EqualizerSettings = {
  bass: 0,
  lowMid: 0,
  mid: 0,
  highMid: 0,
  treble: 0,
};

// Preset configurations for different use cases
interface PresetConfig {
  name: string;
  description: string;
  settings: EqualizerSettings;
}

const PRESETS: Record<string, PresetConfig> = {
  flat: {
    name: 'Flat',
    description: 'Nessuna modifica',
    settings: { bass: 0, lowMid: 0, mid: 0, highMid: 0, treble: 0 },
  },
  voice: {
    name: 'Voce',
    description: 'Ottimizzato per dialoghi e narrazioni',
    settings: { bass: -2, lowMid: 0, mid: 4, highMid: 3, treble: 1 },
  },
  podcast: {
    name: 'Podcast',
    description: 'Chiarezza vocale con bassi caldi',
    settings: { bass: 2, lowMid: -1, mid: 3, highMid: 4, treble: 2 },
  },
  music: {
    name: 'Musica',
    description: 'Bilanciato per sottofondo musicale',
    settings: { bass: 4, lowMid: 2, mid: 0, highMid: 2, treble: 3 },
  },
  cinema: {
    name: 'Cinema',
    description: 'Drammatico con bassi profondi',
    settings: { bass: 6, lowMid: 3, mid: -1, highMid: 2, treble: 4 },
  },
  bright: {
    name: 'Brillante',
    description: 'Alti enfatizzati per chiarezza',
    settings: { bass: -1, lowMid: 0, mid: 2, highMid: 4, treble: 6 },
  },
  warm: {
    name: 'Caldo',
    description: 'Bassi ricchi e morbidi',
    settings: { bass: 5, lowMid: 3, mid: 0, highMid: -1, treble: -2 },
  },
  presence: {
    name: 'Presenza',
    description: 'Voce in primo piano',
    settings: { bass: -3, lowMid: 1, mid: 5, highMid: 6, treble: 2 },
  },
};

const BAND_CONFIG = [
  { key: 'bass' as const, label: 'Bassi', frequency: 60, color: 'bg-red-500' },
  { key: 'lowMid' as const, label: 'Bassi-Medi', frequency: 250, color: 'bg-orange-500' },
  { key: 'mid' as const, label: 'Medi', frequency: 1000, color: 'bg-yellow-500' },
  { key: 'highMid' as const, label: 'Medi-Alti', frequency: 4000, color: 'bg-green-500' },
  { key: 'treble' as const, label: 'Alti', frequency: 12000, color: 'bg-blue-500' },
];

export function AudioEqualizer({ 
  audioElement, 
  settings, 
  onSettingsChange,
  onAudioContextReady 
}: AudioEqualizerProps) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const isInitializedRef = useRef(false);

  // Initialize audio context and filters
  const initializeAudioContext = useCallback(() => {
    if (!audioElement || isInitializedRef.current) return;

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      // Create source from audio element
      const source = audioContext.createMediaElementSource(audioElement);
      sourceNodeRef.current = source;

      // Create filters for each frequency band
      const filters: BiquadFilterNode[] = BAND_CONFIG.map((band, index) => {
        const filter = audioContext.createBiquadFilter();
        
        if (index === 0) {
          filter.type = 'lowshelf';
        } else if (index === BAND_CONFIG.length - 1) {
          filter.type = 'highshelf';
        } else {
          filter.type = 'peaking';
        }
        
        filter.frequency.value = band.frequency;
        filter.gain.value = settings[band.key];
        filter.Q.value = 1;
        
        return filter;
      });

      // Connect filters in chain: source -> filter1 -> filter2 -> ... -> destination
      source.connect(filters[0]);
      for (let i = 0; i < filters.length - 1; i++) {
        filters[i].connect(filters[i + 1]);
      }
      filters[filters.length - 1].connect(audioContext.destination);

      filtersRef.current = filters;
      isInitializedRef.current = true;

      if (onAudioContextReady) {
        onAudioContextReady(audioContext, source);
      }
    } catch (error) {
      console.error('Error initializing audio context:', error);
    }
  }, [audioElement, onAudioContextReady, settings]);

  // Initialize on first interaction (required for audio context)
  useEffect(() => {
    if (!audioElement) return;

    const handlePlay = () => {
      if (!isInitializedRef.current) {
        initializeAudioContext();
      }
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
    };

    audioElement.addEventListener('play', handlePlay);

    return () => {
      audioElement.removeEventListener('play', handlePlay);
    };
  }, [audioElement, initializeAudioContext]);

  // Update filter gains when settings change
  useEffect(() => {
    if (!filtersRef.current.length) return;

    BAND_CONFIG.forEach((band, index) => {
      if (filtersRef.current[index]) {
        filtersRef.current[index].gain.value = settings[band.key];
      }
    });
  }, [settings]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      isInitializedRef.current = false;
    };
  }, []);

  const handleBandChange = (key: keyof EqualizerSettings, value: number) => {
    onSettingsChange({
      ...settings,
      [key]: value,
    });
  };

  const handleReset = () => {
    onSettingsChange(DEFAULT_SETTINGS);
  };

  const handlePresetChange = (presetKey: string) => {
    const preset = PRESETS[presetKey];
    if (preset) {
      onSettingsChange(preset.settings);
    }
  };

  // Determine current preset (if any matches)
  const getCurrentPreset = (): string => {
    for (const [key, preset] of Object.entries(PRESETS)) {
      const matches = Object.keys(preset.settings).every(
        (k) => preset.settings[k as keyof EqualizerSettings] === settings[k as keyof EqualizerSettings]
      );
      if (matches) return key;
    }
    return 'custom';
  };

  const currentPreset = getCurrentPreset();

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Music2 className="w-4 h-4" />
          Equalizzatore Audio
        </Label>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="h-7 text-xs"
        >
          <RotateCcw className="w-3 h-3 mr-1" />
          Reset
        </Button>
      </div>

      {/* Preset Selector */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Preset</Label>
        <Select value={currentPreset} onValueChange={handlePresetChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Seleziona preset" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PRESETS).map(([key, preset]) => (
              <SelectItem key={key} value={key}>
                <div className="flex flex-col">
                  <span className="font-medium">{preset.name}</span>
                  <span className="text-xs text-muted-foreground">{preset.description}</span>
                </div>
              </SelectItem>
            ))}
            {currentPreset === 'custom' && (
              <SelectItem value="custom" disabled>
                <span className="text-muted-foreground">Personalizzato</span>
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {BAND_CONFIG.map((band) => (
          <div key={band.key} className="flex flex-col items-center space-y-2">
            <div className="h-24 flex items-center">
              <Slider
                orientation="vertical"
                value={[settings[band.key]]}
                min={-12}
                max={12}
                step={1}
                onValueChange={(values) => handleBandChange(band.key, values[0])}
                className="h-full"
              />
            </div>
            <div className="text-center">
              <div className={`w-2 h-2 rounded-full mx-auto mb-1 ${band.color}`} />
              <span className="text-xs font-medium block">{settings[band.key] > 0 ? '+' : ''}{settings[band.key]}</span>
              <span className="text-[10px] text-muted-foreground block">{band.label}</span>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Regola le frequenze audio da -12dB a +12dB. Premi play per attivare l'equalizzatore.
      </p>
    </div>
  );
}

export { DEFAULT_SETTINGS as DEFAULT_EQUALIZER_SETTINGS };
