import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Mic, Wind, Sparkles, Music, Sliders, RotateCcw, Loader2, Info,
  Gauge, Save, Trash2, Plus,
} from "lucide-react";
import { toast } from "sonner";
import {
  AUDIO_MIX_PRESETS,
  DEFAULT_AUDIO_MIX,
  DEFAULT_HEADROOM,
  getAudioMix,
  loadAudioMixFromSupabase,
  setAudioMix,
  newPresetId,
  type AudioHeadroom,
  type AudioMixPreset,
  type CustomAudioPreset,
  type StoryModeAudioMix,
} from "@/lib/storyModeAudioMix";

/**
 * Global default Audio Mix used by every Story Mode render.
 * The render dialog lets the user override these locally without touching the
 * defaults stored here.
 */
export const AudioMixSettingsCard: React.FC = () => {
  const [mix, setMix] = useState<StoryModeAudioMix>(DEFAULT_AUDIO_MIX);
  const [loading, setLoading] = useState(true);
  const [newPresetName, setNewPresetName] = useState("");

  useEffect(() => {
    setMix(getAudioMix());
    (async () => {
      const remote = await loadAudioMixFromSupabase();
      setMix(remote);
      setLoading(false);
    })();
  }, []);

  const update = (patch: Partial<StoryModeAudioMix>, presetKey?: AudioMixPreset) => {
    const next: StoryModeAudioMix = {
      ...mix,
      ...patch,
      preset: presetKey ?? "custom",
    };
    setMix(next);
    setAudioMix(next);
  };

  const updateHeadroom = (patch: Partial<AudioHeadroom>) => {
    const next: StoryModeAudioMix = {
      ...mix,
      headroom: { ...mix.headroom, ...patch },
      preset: "custom",
    };
    setMix(next);
    setAudioMix(next);
  };

  const applyPreset = (key: keyof typeof AUDIO_MIX_PRESETS) => {
    const preset = AUDIO_MIX_PRESETS[key];
    update(preset, key);
    toast.success(`Preset "${key}" applicato — sincronizzato su tutti i tuoi dispositivi.`);
  };

  const applyCustomPreset = (preset: CustomAudioPreset) => {
    const next: StoryModeAudioMix = {
      ...mix,
      ...preset.values,
      preset: "custom",
    };
    setMix(next);
    setAudioMix(next);
    toast.success(`Preset "${preset.name}" applicato.`);
  };

  const saveCustomPreset = () => {
    const name = newPresetName.trim();
    if (!name) {
      toast.error("Dai un nome al preset prima di salvarlo.");
      return;
    }
    if (mix.customPresets.length >= 20) {
      toast.error("Limite di 20 preset personalizzati raggiunto. Eliminane qualcuno prima.");
      return;
    }
    const preset: CustomAudioPreset = {
      id: newPresetId(),
      name,
      createdAt: Date.now(),
      values: {
        narrationVolume: mix.narrationVolume,
        ambienceVolume: mix.ambienceVolume,
        sfxVolume: mix.sfxVolume,
        musicVolume: mix.musicVolume,
        autoMix: mix.autoMix,
        lufsTarget: mix.lufsTarget,
        headroom: { ...mix.headroom },
      },
    };
    const next: StoryModeAudioMix = {
      ...mix,
      customPresets: [...mix.customPresets, preset],
    };
    setMix(next);
    setAudioMix(next);
    setNewPresetName("");
    toast.success(`Preset "${name}" salvato.`);
  };

  const deleteCustomPreset = (id: string) => {
    const next: StoryModeAudioMix = {
      ...mix,
      customPresets: mix.customPresets.filter((p) => p.id !== id),
    };
    setMix(next);
    setAudioMix(next);
    toast.success("Preset eliminato.");
  };

  const reset = () => {
    setMix(DEFAULT_AUDIO_MIX);
    setAudioMix(DEFAULT_AUDIO_MIX);
    toast.success("Mix audio ripristinato ai valori di default.");
  };

  const resetHeadroom = () => {
    updateHeadroom({ ...DEFAULT_HEADROOM });
    toast.success("Headroom ripristinato.");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sliders className="h-5 w-5" />
          Mix Audio (default globale)
        </CardTitle>
        <CardDescription>
          Volumi di partenza per ogni nuovo render Story Mode. Il dialog di rendering può
          comunque sovrascriverli per il singolo progetto.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Sincronizzazione preferenze…
          </div>
        )}

        {/* Built-in presets */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Preset rapidi</Label>
          <div className="flex gap-2 flex-wrap">
            {(Object.keys(AUDIO_MIX_PRESETS) as Array<keyof typeof AUDIO_MIX_PRESETS>).map((k) => (
              <Button
                key={k}
                variant={mix.preset === k ? "default" : "outline"}
                size="sm"
                onClick={() => applyPreset(k)}
                disabled={loading}
                className="text-xs"
              >
                {k === "balanced" && "⚖️ Bilanciato"}
                {k === "voice-forward" && "🎙️ Voce in primo piano"}
                {k === "cinematic" && "🎬 Cinematico"}
                {k === "music-bed" && "🎵 Musica protagonista"}
              </Button>
            ))}
            <Button variant="ghost" size="sm" onClick={reset} disabled={loading} className="text-xs">
              <RotateCcw className="w-3 h-3 mr-1" /> Default
            </Button>
          </div>
          {mix.preset === "custom" && (
            <Badge variant="outline" className="text-[10px]">Custom — modificato manualmente</Badge>
          )}
        </div>

        {/* Custom presets */}
        <div className="space-y-2 p-3 rounded-lg border bg-muted/20">
          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Save className="w-3.5 h-3.5" /> Preset personalizzati ({mix.customPresets.length}/20)
          </Label>
          {mix.customPresets.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {mix.customPresets.map((p) => (
                <div key={p.id} className="flex items-center gap-1 rounded-md border bg-card px-1.5 py-0.5">
                  <button
                    type="button"
                    className="text-xs hover:text-primary"
                    onClick={() => applyCustomPreset(p)}
                    title={`V:${p.values.narrationVolume} A:${p.values.ambienceVolume} S:${p.values.sfxVolume} M:${p.values.musicVolume} • LUFS ${p.values.lufsTarget}`}
                  >
                    {p.name}
                  </button>
                  <button
                    type="button"
                    aria-label={`Elimina preset ${p.name}`}
                    onClick={() => deleteCustomPreset(p.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              placeholder="Nome preset (es. 'Doc voce-forte')"
              className="h-8 text-xs"
              maxLength={60}
            />
            <Button size="sm" variant="outline" onClick={saveCustomPreset} disabled={loading || !newPresetName.trim()}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Salva attuali
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Salva la combinazione corrente di volumi, headroom e LUFS come preset riutilizzabile.
          </p>
        </div>

        <SliderRow
          icon={<Mic className="w-4 h-4 text-primary" />}
          label="Voce (narrazione)"
          value={mix.narrationVolume}
          max={150}
          onChange={(v) => update({ narrationVolume: v })}
          hint="Volume della voce TTS — di norma il riferimento (100%)."
        />
        <SliderRow
          icon={<Wind className="w-4 h-4 text-blue-400" />}
          label="Ambience (vento, mare, pioggia)"
          value={mix.ambienceVolume}
          max={100}
          onChange={(v) => update({ ambienceVolume: v })}
          hint="Sfondo ambientale continuo. Tienilo basso (10–25%) per non coprire la voce."
        />
        <SliderRow
          icon={<Sparkles className="w-4 h-4 text-yellow-400" />}
          label="Effetti sonori (SFX puntuali)"
          value={mix.sfxVolume}
          max={100}
          onChange={(v) => update({ sfxVolume: v })}
          hint="Stinger e effetti scena per scena. 15–30% in genere."
        />
        <SliderRow
          icon={<Music className="w-4 h-4 text-green-400" />}
          label="Musica di sottofondo"
          value={mix.musicVolume}
          max={100}
          onChange={(v) => update({ musicVolume: v })}
          hint="Colonna sonora unificata. Sotto la voce, di norma 20–35%."
        />

        {/* Auto-mix */}
        <div className="flex items-start justify-between gap-4 p-3 rounded-lg border bg-card">
          <div className="space-y-1 flex-1">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              Auto-mix LUFS lato server
              <Badge variant="secondary" className="text-[9px]">beta</Badge>
            </Label>
            <p className="text-xs text-muted-foreground">
              Quando attivo, il server bilancia automaticamente i volumi per scena verso un
              target di loudness ({mix.lufsTarget} LUFS), abbassando musica e ambience sotto
              alla voce così che la narrazione resti sempre intelligibile.
            </p>
            <p className="text-[10px] text-muted-foreground/80 flex items-center gap-1">
              <Info className="w-3 h-3" />
              Il render manda i ratio calcolati al motore video; i tuoi slider qui sopra restano
              il punto di partenza.
            </p>
          </div>
          <Switch
            checked={mix.autoMix}
            disabled={loading}
            onCheckedChange={(v) => update({ autoMix: v })}
          />
        </div>

        {mix.autoMix && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Target loudness</Label>
              <span className="text-xs font-mono">{mix.lufsTarget} LUFS</span>
            </div>
            <Slider
              value={[mix.lufsTarget]}
              min={-23}
              max={-9}
              step={1}
              onValueChange={(v) => update({ lufsTarget: v[0] })}
              disabled={loading}
            />
            <p className="text-[10px] text-muted-foreground">
              -14 LUFS = standard streaming (YouTube/Spotify). Valori più bassi = più dinamica,
              valori più alti (es. -10) = più rumoroso e "compresso".
            </p>
          </div>
        )}

        {/* Headroom limits */}
        <div className="space-y-3 p-3 rounded-lg border bg-card">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Gauge className="w-4 h-4" /> Limiti di headroom (RMS dBFS)
            </Label>
            <Button variant="ghost" size="sm" onClick={resetHeadroom} disabled={loading} className="text-xs h-7">
              <RotateCcw className="w-3 h-3 mr-1" /> Reset
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Soglie per il <strong>test automatico post-render</strong>: se l'RMS misurato di un canale
            supera il limite, il report segnala una warning. Più negativo = più severo.
          </p>
          <HeadroomRow
            icon={<Mic className="w-3.5 h-3.5 text-primary" />}
            label="Voce max"
            value={mix.headroom.voiceMaxDb}
            onChange={(v) => updateHeadroom({ voiceMaxDb: v })}
          />
          <HeadroomRow
            icon={<Wind className="w-3.5 h-3.5 text-blue-400" />}
            label="Ambience max"
            value={mix.headroom.ambienceMaxDb}
            onChange={(v) => updateHeadroom({ ambienceMaxDb: v })}
          />
          <HeadroomRow
            icon={<Sparkles className="w-3.5 h-3.5 text-yellow-400" />}
            label="SFX max"
            value={mix.headroom.sfxMaxDb}
            onChange={(v) => updateHeadroom({ sfxMaxDb: v })}
          />
          <HeadroomRow
            icon={<Music className="w-3.5 h-3.5 text-green-400" />}
            label="Musica max"
            value={mix.headroom.musicMaxDb}
            onChange={(v) => updateHeadroom({ musicMaxDb: v })}
          />
        </div>
      </CardContent>
    </Card>
  );
};

const SliderRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
  hint?: string;
}> = ({ icon, label, value, max, onChange, hint }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <Label className="text-xs flex items-center gap-1.5">
        {icon} {label}
      </Label>
      <span className="text-xs font-mono tabular-nums">{value}%</span>
    </div>
    <Slider value={[value]} min={0} max={max} step={1} onValueChange={(v) => onChange(v[0])} />
    {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
  </div>
);

const HeadroomRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number;
  onChange: (v: number) => void;
}> = ({ icon, label, value, onChange }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between">
      <Label className="text-[11px] flex items-center gap-1.5">{icon} {label}</Label>
      <span className="text-[11px] font-mono tabular-nums">{value} dBFS</span>
    </div>
    <Slider value={[value]} min={-40} max={0} step={1} onValueChange={(v) => onChange(v[0])} />
  </div>
);
