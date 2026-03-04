import React, { useEffect, useRef, useCallback, useState } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RotateCcw, Music2, Activity } from "lucide-react";

export interface EqualizerSettings {
  bass: number;
  lowMid: number;
  mid: number;
  highMid: number;
  treble: number;
}

interface AudioEqualizerProps {
  audioElement: HTMLAudioElement | null;
  settings: EqualizerSettings;
  onSettingsChange: (settings: EqualizerSettings) => void;
  onAudioContextReady?: (context: AudioContext, source: MediaElementAudioSourceNode) => void;
}

const DEFAULT_SETTINGS: EqualizerSettings = {
  bass: 0, lowMid: 0, mid: 0, highMid: 0, treble: 0,
};

interface PresetConfig {
  name: string;
  description: string;
  settings: EqualizerSettings;
}

const PRESETS: Record<string, PresetConfig> = {
  flat: { name: 'Flat', description: 'Nessuna modifica', settings: { bass: 0, lowMid: 0, mid: 0, highMid: 0, treble: 0 } },
  voice: { name: 'Voce', description: 'Ottimizzato per dialoghi e narrazioni', settings: { bass: -4, lowMid: -1, mid: 8, highMid: 6, treble: 2 } },
  podcast: { name: 'Podcast', description: 'Chiarezza vocale con bassi caldi', settings: { bass: 4, lowMid: -2, mid: 6, highMid: 7, treble: 3 } },
  music: { name: 'Musica', description: 'Bilanciato per sottofondo musicale', settings: { bass: 7, lowMid: 3, mid: 0, highMid: 3, treble: 6 } },
  cinema: { name: 'Cinema', description: 'Drammatico con bassi profondi', settings: { bass: 10, lowMid: 5, mid: -2, highMid: 3, treble: 7 } },
  bright: { name: 'Brillante', description: 'Alti enfatizzati per chiarezza', settings: { bass: -3, lowMid: 0, mid: 3, highMid: 7, treble: 10 } },
  warm: { name: 'Caldo', description: 'Bassi ricchi e morbidi', settings: { bass: 9, lowMid: 5, mid: 0, highMid: -2, treble: -4 } },
  presence: { name: 'Presenza', description: 'Voce in primo piano', settings: { bass: -6, lowMid: 2, mid: 9, highMid: 10, treble: 3 } },
};

const BAND_CONFIG = [
  { key: 'bass' as const, label: 'Bassi', frequency: 80, q: 0.7, color: 'bg-red-500', barColor: '#ef4444', glowColor: 'rgba(239,68,68,0.4)' },
  { key: 'lowMid' as const, label: 'Bassi-Medi', frequency: 300, q: 0.8, color: 'bg-orange-500', barColor: '#f97316', glowColor: 'rgba(249,115,22,0.4)' },
  { key: 'mid' as const, label: 'Medi', frequency: 1000, q: 0.7, color: 'bg-yellow-500', barColor: '#eab308', glowColor: 'rgba(234,179,8,0.4)' },
  { key: 'highMid' as const, label: 'Medi-Alti', frequency: 3500, q: 0.8, color: 'bg-green-500', barColor: '#22c55e', glowColor: 'rgba(34,197,94,0.4)' },
  { key: 'treble' as const, label: 'Alti', frequency: 10000, q: 0.7, color: 'bg-blue-500', barColor: '#3b82f6', glowColor: 'rgba(59,130,246,0.4)' },
];

// Frequency bin ranges for each band (mapped to FFT bins at 44100 sample rate, 256 fftSize)
const getBinRange = (freq: number, sampleRate: number, fftSize: number): [number, number] => {
  const binHz = sampleRate / fftSize;
  const centerBin = Math.round(freq / binHz);
  const spread = Math.max(2, Math.round(centerBin * 0.4));
  return [Math.max(0, centerBin - spread), Math.min(fftSize / 2 - 1, centerBin + spread)];
};

/** Small canvas component that draws animated level bars */
function BandLevelMeter({ levels, isActive }: { levels: number[]; isActive: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const smoothLevels = useRef<number[]>(new Array(BAND_CONFIG.length).fill(0));
  const peakLevels = useRef<number[]>(new Array(BAND_CONFIG.length).fill(0));
  const peakDecay = useRef<number[]>(new Array(BAND_CONFIG.length).fill(0));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const barCount = BAND_CONFIG.length;
      const gap = 4;
      const barW = (w - gap * (barCount - 1)) / barCount;

      for (let i = 0; i < barCount; i++) {
        const target = isActive ? levels[i] ?? 0 : 0;
        // Smooth towards target
        smoothLevels.current[i] += (target - smoothLevels.current[i]) * 0.18;
        const level = Math.max(0, Math.min(1, smoothLevels.current[i]));

        // Peak hold with decay
        if (level > peakLevels.current[i]) {
          peakLevels.current[i] = level;
          peakDecay.current[i] = 0;
        } else {
          peakDecay.current[i] += 1;
          if (peakDecay.current[i] > 15) {
            peakLevels.current[i] *= 0.96;
          }
        }

        const x = i * (barW + gap);
        const barH = level * h;
        const peakY = h - peakLevels.current[i] * h;
        const config = BAND_CONFIG[i];

        // Glow
        if (level > 0.05) {
          ctx.shadowBlur = 8;
          ctx.shadowColor = config.glowColor;
        }

        // Bar gradient
        const grad = ctx.createLinearGradient(x, h, x, h - barH);
        grad.addColorStop(0, config.barColor);
        grad.addColorStop(1, config.barColor + '88');
        ctx.fillStyle = grad;

        // Draw segmented bar
        const segH = 3;
        const segGap = 1;
        const segments = Math.floor(barH / (segH + segGap));
        for (let s = 0; s < segments; s++) {
          const sy = h - s * (segH + segGap) - segH;
          ctx.fillRect(x, sy, barW, segH);
        }

        ctx.shadowBlur = 0;

        // Peak indicator
        if (peakLevels.current[i] > 0.05) {
          ctx.fillStyle = config.barColor;
          ctx.fillRect(x, peakY, barW, 2);
        }
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [levels, isActive]);

  return (
    <canvas
      ref={canvasRef}
      width={160}
      height={48}
      className="w-full h-12 rounded bg-background/50 border border-border/50"
    />
  );
}

export function AudioEqualizer({
  audioElement,
  settings,
  onSettingsChange,
  onAudioContextReady,
}: AudioEqualizerProps) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const isInitializedRef = useRef(false);
  const rafRef = useRef<number>(0);

  const [bandLevels, setBandLevels] = useState<number[]>(new Array(BAND_CONFIG.length).fill(0));
  const [isPlaying, setIsPlaying] = useState(false);
  const [showMeter, setShowMeter] = useState(true);

  // Initialize audio context and filters
  const initializeAudioContext = useCallback(() => {
    if (!audioElement || isInitializedRef.current) return;

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaElementSource(audioElement);
      sourceNodeRef.current = source;

      const filters: BiquadFilterNode[] = BAND_CONFIG.map((band, index) => {
        const filter = audioContext.createBiquadFilter();
        if (index === 0) filter.type = 'lowshelf';
        else if (index === BAND_CONFIG.length - 1) filter.type = 'highshelf';
        else filter.type = 'peaking';
        filter.frequency.value = band.frequency;
        filter.gain.value = settings[band.key];
        filter.Q.value = band.q;
        return filter;
      });

      // Chain: source → filters → analyser → destination
      source.connect(filters[0]);
      for (let i = 0; i < filters.length - 1; i++) {
        filters[i].connect(filters[i + 1]);
      }

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.75;
      filters[filters.length - 1].connect(analyser);
      analyser.connect(audioContext.destination);

      filtersRef.current = filters;
      analyserRef.current = analyser;
      isInitializedRef.current = true;

      // Start level monitoring
      startLevelMonitoring(analyser, audioContext.sampleRate);

      if (onAudioContextReady) {
        onAudioContextReady(audioContext, source);
      }
    } catch (error) {
      console.error('Error initializing audio context:', error);
    }
  }, [audioElement, onAudioContextReady, settings]);

  const startLevelMonitoring = useCallback((analyser: AnalyserNode, sampleRate: number) => {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const fftSize = analyser.fftSize;

    const binRanges = BAND_CONFIG.map(b => getBinRange(b.frequency, sampleRate, fftSize));

    const tick = () => {
      analyser.getByteFrequencyData(dataArray);

      const levels = binRanges.map(([lo, hi]) => {
        let sum = 0;
        let count = 0;
        for (let i = lo; i <= hi; i++) {
          sum += dataArray[i];
          count++;
        }
        return count > 0 ? (sum / count) / 255 : 0;
      });

      setBandLevels(levels);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // Track play/pause state
  useEffect(() => {
    if (!audioElement) return;

    const onPlay = () => {
      setIsPlaying(true);
      if (!isInitializedRef.current) initializeAudioContext();
      if (audioContextRef.current?.state === 'suspended') audioContextRef.current.resume();
    };
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    audioElement.addEventListener('play', onPlay);
    audioElement.addEventListener('pause', onPause);
    audioElement.addEventListener('ended', onEnded);

    return () => {
      audioElement.removeEventListener('play', onPlay);
      audioElement.removeEventListener('pause', onPause);
      audioElement.removeEventListener('ended', onEnded);
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

  // Cleanup
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      isInitializedRef.current = false;
    };
  }, []);

  const handleBandChange = (key: keyof EqualizerSettings, value: number) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const handleReset = () => onSettingsChange(DEFAULT_SETTINGS);

  const handlePresetChange = (presetKey: string) => {
    const preset = PRESETS[presetKey];
    if (preset) onSettingsChange(preset.settings);
  };

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
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMeter(!showMeter)}
            className={`h-7 text-xs ${showMeter ? 'text-primary' : 'text-muted-foreground'}`}
            title={showMeter ? 'Nascondi livelli' : 'Mostra livelli'}
          >
            <Activity className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleReset} className="h-7 text-xs">
            <RotateCcw className="w-3 h-3 mr-1" />
            Reset
          </Button>
        </div>
      </div>

      {/* Real-time level meter */}
      {showMeter && (
        <div className="animate-fade-in">
          <BandLevelMeter levels={bandLevels} isActive={isPlaying} />
          <div className="flex justify-between px-1 mt-1">
            {BAND_CONFIG.map((band) => (
              <span key={band.key} className="text-[8px] text-muted-foreground">{band.frequency >= 1000 ? `${band.frequency / 1000}k` : band.frequency}</span>
            ))}
          </div>
          {!isPlaying && (
            <p className="text-[10px] text-muted-foreground text-center mt-1 animate-pulse">
              ▶ Premi play per attivare il visualizzatore
            </p>
          )}
        </div>
      )}

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
