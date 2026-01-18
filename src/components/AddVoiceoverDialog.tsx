import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Volume2, Play, Download, Loader2, Settings2, ChevronDown, ChevronUp, Copy, Save, Trash2, Headphones } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface AddVoiceoverDialogProps {
  videoId: string;
  dialogueText?: string | null;
  onVoiceoverAdded?: (audioUrl: string) => void;
}

interface VoiceSettings {
  voiceId: string;
  speed: number;
  stability: number;
  similarityBoost: number;
  style: number;
}

interface VoicePreset {
  id: string;
  name: string;
  settings: VoiceSettings;
}

const VOICE_OPTIONS = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah (Femminile, Naturale)", lang: "it", description: "Voce femminile naturale, ottima per italiano" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George (Maschile, Profondo)", lang: "en", description: "Voce maschile profonda e autorevole" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel (Maschile, Narratore)", lang: "en", description: "Perfetta per narrazioni e documentari" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily (Femminile, Dolce)", lang: "en", description: "Voce dolce e rassicurante" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam (Maschile, Giovane)", lang: "en", description: "Voce giovane e dinamica" },
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda (Femminile, Elegante)", lang: "en", description: "Voce elegante e sofisticata" },
  { id: "9BWtsMINqrJLrRacOk9x", name: "Aria (Femminile, Espressiva)", lang: "en", description: "Voce espressiva e coinvolgente" },
  { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger (Maschile, Caldo)", lang: "en", description: "Voce calda e avvolgente" },
];

const PRESETS_STORAGE_KEY = "voice-presets";

const getStoredPresets = (): VoicePreset[] => {
  try {
    const stored = localStorage.getItem(PRESETS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const savePresetsToStorage = (presets: VoicePreset[]) => {
  localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
};

export const AddVoiceoverDialog = ({ videoId, dialogueText, onVoiceoverAdded }: AddVoiceoverDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState(dialogueText || "");
  const [voiceId, setVoiceId] = useState(VOICE_OPTIONS[0].id);
  const [speed, setSpeed] = useState([1.0]);
  const [stability, setStability] = useState([0.5]);
  const [similarityBoost, setSimilarityBoost] = useState([0.75]);
  const [style, setStyle] = useState([0.5]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewGenerating, setIsPreviewGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Preset management
  const [presets, setPresets] = useState<VoicePreset[]>([]);
  const [newPresetName, setNewPresetName] = useState("");
  const [showPresetInput, setShowPresetInput] = useState(false);
  
  // Original settings from video
  const [originalSettings, setOriginalSettings] = useState<VoiceSettings | null>(null);
  const [hasOriginalSettings, setHasOriginalSettings] = useState(false);

  // Load presets and original settings when dialog opens
  useEffect(() => {
    if (isOpen) {
      setPresets(getStoredPresets());
      loadOriginalSettings();
    }
  }, [isOpen, videoId]);

  const loadOriginalSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("video_generations")
        .select("voice_settings, dialogue_text")
        .eq("id", videoId)
        .single();

      if (error) throw error;

      if (data?.voice_settings && typeof data.voice_settings === 'object' && !Array.isArray(data.voice_settings)) {
        const vs = data.voice_settings as Record<string, unknown>;
        const settings: VoiceSettings = {
          voiceId: typeof vs.voiceId === 'string' ? vs.voiceId : VOICE_OPTIONS[0].id,
          speed: typeof vs.speed === 'number' ? vs.speed : 1.0,
          stability: typeof vs.stability === 'number' ? vs.stability : 0.5,
          similarityBoost: typeof vs.similarityBoost === 'number' ? vs.similarityBoost : 0.75,
          style: typeof vs.style === 'number' ? vs.style : 0.5,
        };
        setOriginalSettings(settings);
        setHasOriginalSettings(true);
      } else {
        setHasOriginalSettings(false);
      }
      
      if (data?.dialogue_text && !dialogueText) {
        setText(data.dialogue_text);
      }
    } catch (error) {
      console.error("Error loading original settings:", error);
    }
  };

  const applySettings = (settings: VoiceSettings) => {
    setVoiceId(settings.voiceId);
    setSpeed([settings.speed]);
    setStability([settings.stability]);
    setSimilarityBoost([settings.similarityBoost]);
    setStyle([settings.style]);
    setShowAdvanced(true);
  };

  const copyOriginalSettings = () => {
    if (originalSettings) {
      applySettings(originalSettings);
      toast.success("Impostazioni originali applicate!");
    }
  };

  const getCurrentSettings = (): VoiceSettings => ({
    voiceId,
    speed: speed[0],
    stability: stability[0],
    similarityBoost: similarityBoost[0],
    style: style[0],
  });

  const savePreset = () => {
    if (!newPresetName.trim()) {
      toast.error("Inserisci un nome per il preset");
      return;
    }

    const newPreset: VoicePreset = {
      id: Date.now().toString(),
      name: newPresetName.trim(),
      settings: getCurrentSettings(),
    };

    const updatedPresets = [...presets, newPreset];
    setPresets(updatedPresets);
    savePresetsToStorage(updatedPresets);
    setNewPresetName("");
    setShowPresetInput(false);
    toast.success(`Preset "${newPreset.name}" salvato!`);
  };

  const deletePreset = (presetId: string) => {
    const updatedPresets = presets.filter(p => p.id !== presetId);
    setPresets(updatedPresets);
    savePresetsToStorage(updatedPresets);
    toast.success("Preset eliminato");
  };

  const applyPreset = (preset: VoicePreset) => {
    applySettings(preset.settings);
    toast.success(`Preset "${preset.name}" applicato!`);
  };

  const generateAudio = async (isPreview: boolean = false) => {
    const textToGenerate = isPreview ? text.substring(0, 200) : text;
    
    if (!textToGenerate.trim()) {
      toast.error("Inserisci il testo per il voiceover");
      return;
    }

    if (isPreview) {
      setIsPreviewGenerating(true);
      setPreviewAudioUrl(null);
    } else {
      setIsGenerating(true);
      setAudioUrl(null);
    }

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Devi effettuare l'accesso");
        return;
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/elevenlabs-tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseKey,
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ 
          text: textToGenerate, 
          voiceId, 
          speed: speed[0],
          stability: stability[0],
          similarityBoost: similarityBoost[0],
          style: style[0],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Errore nella generazione audio");
      }

      const data = await response.json();
      
      if (data.audioContent) {
        const url = `data:audio/mpeg;base64,${data.audioContent}`;
        if (isPreview) {
          setPreviewAudioUrl(url);
          // Auto-play preview
          const audio = new Audio(url);
          audio.play();
          toast.success("Anteprima generata!");
        } else {
          setAudioUrl(url);
          toast.success("Audio generato con successo!");
        }
      }
    } catch (error) {
      console.error("Error generating voiceover:", error);
      toast.error(error instanceof Error ? error.message : "Errore nella generazione");
    } finally {
      if (isPreview) {
        setIsPreviewGenerating(false);
      } else {
        setIsGenerating(false);
      }
    }
  };

  const handleGenerate = () => generateAudio(false);
  const handlePreview = () => generateAudio(true);

  const handlePlay = () => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.onended = () => setIsPlaying(false);
      audio.play();
      setIsPlaying(true);
    }
  };

  const handleSave = async () => {
    if (!audioUrl) return;

    try {
      const currentSettings = getCurrentSettings();
      const { error } = await supabase
        .from("video_generations")
        .update({ 
          audio_url: audioUrl,
          dialogue_text: text,
          voice_settings: {
            voiceId: currentSettings.voiceId,
            speed: currentSettings.speed,
            stability: currentSettings.stability,
            similarityBoost: currentSettings.similarityBoost,
            style: currentSettings.style,
          },
        })
        .eq("id", videoId);

      if (error) throw error;

      toast.success("Voiceover salvato!");
      onVoiceoverAdded?.(audioUrl);
      setIsOpen(false);
    } catch (error) {
      console.error("Error saving voiceover:", error);
      toast.error("Errore nel salvataggio");
    }
  };

  const handleDownload = () => {
    if (audioUrl) {
      const link = document.createElement("a");
      link.href = audioUrl;
      link.download = `voiceover-${videoId}.mp3`;
      link.click();
    }
  };

  const getVoiceName = (id: string) => {
    return VOICE_OPTIONS.find(v => v.id === id)?.name || id;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Volume2 className="h-4 w-4" />
          Aggiungi Voiceover
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Genera Voiceover con ElevenLabs</DialogTitle>
          <DialogDescription>
            Aggiungi un audio parlato al tuo video usando la sintesi vocale AI
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Original Settings Button */}
          {hasOriginalSettings && originalSettings && (
            <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium">Impostazioni Originali Disponibili</p>
                  <p className="text-xs text-muted-foreground">
                    Voce: {getVoiceName(originalSettings.voiceId)} • 
                    Velocità: {originalSettings.speed.toFixed(1)}x
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={copyOriginalSettings} className="gap-2">
                  <Copy className="h-4 w-4" />
                  Usa Originali
                </Button>
              </div>
            </div>
          )}

          {/* Preset Selector */}
          {presets.length > 0 && (
            <div className="space-y-2">
              <Label>Preset Salvati</Label>
              <div className="flex flex-wrap gap-2">
                {presets.map((preset) => (
                  <div key={preset.id} className="flex items-center gap-1 bg-muted rounded-md">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => applyPreset(preset)}
                      className="h-8"
                    >
                      {preset.name}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deletePreset(preset.id)}
                      className="h-8 px-2 hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="voiceover-text">Testo da pronunciare</Label>
            <Textarea
              id="voiceover-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Inserisci il testo che vuoi far pronunciare..."
              rows={4}
              maxLength={5000}
            />
            <p className="text-xs text-muted-foreground text-right">
              {text.length}/5000 caratteri
            </p>
          </div>

          <div className="space-y-2">
            <Label>Voce</Label>
            <Select value={voiceId} onValueChange={setVoiceId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VOICE_OPTIONS.map((voice) => (
                  <SelectItem key={voice.id} value={voice.id}>
                    <div className="flex flex-col">
                      <span>{voice.name}</span>
                      <span className="text-xs text-muted-foreground">{voice.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Velocità: {speed[0].toFixed(1)}x</Label>
            <Slider
              value={speed}
              onValueChange={setSpeed}
              min={0.7}
              max={1.2}
              step={0.1}
              className="w-full"
            />
          </div>

          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full gap-2">
                <Settings2 className="h-4 w-4" />
                Impostazioni Avanzate
                {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Stabilità: {(stability[0] * 100).toFixed(0)}%</Label>
                  <span className="text-xs text-muted-foreground">
                    {stability[0] < 0.3 ? "Più espressivo" : stability[0] > 0.7 ? "Più stabile" : "Bilanciato"}
                  </span>
                </div>
                <Slider
                  value={stability}
                  onValueChange={setStability}
                  min={0}
                  max={1}
                  step={0.05}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Valori bassi = più variazione emotiva, alti = più costante
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Somiglianza: {(similarityBoost[0] * 100).toFixed(0)}%</Label>
                  <span className="text-xs text-muted-foreground">
                    {similarityBoost[0] < 0.5 ? "Più naturale" : similarityBoost[0] > 0.8 ? "Più fedele" : "Bilanciato"}
                  </span>
                </div>
                <Slider
                  value={similarityBoost}
                  onValueChange={setSimilarityBoost}
                  min={0}
                  max={1}
                  step={0.05}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Quanto la voce deve aderire al timbro originale
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Stile/Espressività: {(style[0] * 100).toFixed(0)}%</Label>
                  <span className="text-xs text-muted-foreground">
                    {style[0] < 0.3 ? "Neutro" : style[0] > 0.7 ? "Molto espressivo" : "Moderato"}
                  </span>
                </div>
                <Slider
                  value={style}
                  onValueChange={setStyle}
                  min={0}
                  max={1}
                  step={0.05}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Quanto enfatizzare lo stile espressivo della voce
                </p>
              </div>

              {/* Save Preset */}
              <div className="pt-2 border-t">
                {showPresetInput ? (
                  <div className="flex gap-2">
                    <Input
                      value={newPresetName}
                      onChange={(e) => setNewPresetName(e.target.value)}
                      placeholder="Nome preset..."
                      className="flex-1"
                      onKeyDown={(e) => e.key === 'Enter' && savePreset()}
                    />
                    <Button size="sm" onClick={savePreset}>
                      <Save className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowPresetInput(false)}>
                      Annulla
                    </Button>
                  </div>
                ) : (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setShowPresetInput(true)}
                    className="w-full gap-2"
                  >
                    <Save className="h-4 w-4" />
                    Salva come Preset
                  </Button>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={handlePreview} 
              disabled={isPreviewGenerating || isGenerating || !text.trim()}
              className="flex-1"
            >
              {isPreviewGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Anteprima...
                </>
              ) : (
                <>
                  <Headphones className="h-4 w-4 mr-2" />
                  Anteprima (primi 200 car.)
                </>
              )}
            </Button>
            <Button 
              onClick={handleGenerate} 
              disabled={isGenerating || isPreviewGenerating || !text.trim()}
              className="flex-1"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generazione...
                </>
              ) : (
                <>
                  <Volume2 className="h-4 w-4 mr-2" />
                  Genera Completo
                </>
              )}
            </Button>
          </div>

          {audioUrl && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handlePlay}
                disabled={isPlaying}
              >
                <Play className="h-4 w-4" />
              </Button>
              <span className="flex-1 text-sm text-muted-foreground">
                Audio pronto
              </span>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4" />
              </Button>
              <Button size="sm" onClick={handleSave}>
                Salva
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};