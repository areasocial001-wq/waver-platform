import React from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Volume2, VolumeX, Blend } from "lucide-react";

export interface AudioMixerSettings {
  originalEnabled: boolean;
  originalVolume: number; // 0-100
  generatedVolume: number; // 0-100
}

export const DEFAULT_MIXER_SETTINGS: AudioMixerSettings = {
  originalEnabled: false,
  originalVolume: 30,
  generatedVolume: 100,
};

interface AudioMixerProps {
  settings: AudioMixerSettings;
  onSettingsChange: (settings: AudioMixerSettings) => void;
  hasOriginalAudio: boolean;
}

export function AudioMixer({ settings, onSettingsChange, hasOriginalAudio }: AudioMixerProps) {
  const handleChange = <K extends keyof AudioMixerSettings>(key: K, value: AudioMixerSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border">
      <div className="flex items-center gap-2">
        <Blend className="w-4 h-4" />
        <Label>Mixer Audio</Label>
      </div>

      {/* Generated Audio Volume */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm flex items-center gap-2">
            <Volume2 className="w-3 h-3 text-primary" />
            Audio Generato (TTS)
          </Label>
          <span className="text-xs font-medium">{settings.generatedVolume}%</span>
        </div>
        <Slider
          value={[settings.generatedVolume]}
          min={0}
          max={100}
          step={1}
          onValueChange={(v) => handleChange('generatedVolume', v[0])}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Original Audio Section */}
      <div className="space-y-3 p-3 bg-background/50 rounded-md">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-sm">
            {settings.originalEnabled ? (
              <Volume2 className="w-3 h-3 text-orange-500" />
            ) : (
              <VolumeX className="w-3 h-3 text-muted-foreground" />
            )}
            Audio Originale Video
          </Label>
          <Switch
            checked={settings.originalEnabled}
            onCheckedChange={(checked) => handleChange('originalEnabled', checked)}
            disabled={!hasOriginalAudio}
          />
        </div>

        {!hasOriginalAudio && (
          <p className="text-xs text-muted-foreground">
            Carica un video per abilitare il mix con l'audio originale.
          </p>
        )}

        {settings.originalEnabled && hasOriginalAudio && (
          <div className="space-y-2 pt-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Volume originale</span>
              <span>{settings.originalVolume}%</span>
            </div>
            <Slider
              value={[settings.originalVolume]}
              min={0}
              max={100}
              step={1}
              onValueChange={(v) => handleChange('originalVolume', v[0])}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>
        )}
      </div>

      {/* Mix Info */}
      {settings.originalEnabled && hasOriginalAudio && (
        <div className="p-2 bg-muted/50 rounded text-xs space-y-1">
          <p className="text-muted-foreground">Mix finale:</p>
          <div className="flex gap-2">
            <div 
              className="h-2 bg-primary rounded-full transition-all"
              style={{ width: `${settings.generatedVolume * 0.5}%` }}
              title="Audio generato"
            />
            <div 
              className="h-2 bg-orange-500 rounded-full transition-all"
              style={{ width: `${settings.originalVolume * 0.5}%` }}
              title="Audio originale"
            />
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>TTS: {settings.generatedVolume}%</span>
            <span>Originale: {settings.originalVolume}%</span>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Regola i volumi per mixare l'audio generato con quello originale del video.
      </p>
    </div>
  );
}
