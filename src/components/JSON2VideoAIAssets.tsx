import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ImagePlus, Mic, Plus, Trash2, Sparkles, Wand2
} from "lucide-react";
import { toast } from "sonner";

export interface AIImage {
  id: string;
  model: 'freepik-classic' | 'flux-pro';
  prompt: string;
  aspectRatio: 'horizontal' | 'vertical' | 'squared';
  duration: number;
  resize: 'cover' | 'fit' | 'contain';
  zoom: number;
  pan: string;
}

export interface AIVoice {
  id: string;
  model: 'azure' | 'elevenlabs';
  text: string;
  voice: string;
  volume: number;
}

interface JSON2VideoAIAssetsProps {
  aiImages: AIImage[];
  aiVoices: AIVoice[];
  onImagesChange: (images: AIImage[]) => void;
  onVoicesChange: (voices: AIVoice[]) => void;
}

const IMAGE_MODELS = [
  { value: 'freepik-classic', label: 'Freepik Classic', description: 'Gratuito, veloce' },
  { value: 'flux-pro', label: 'Flux Pro', description: 'Alta qualità' },
];

const VOICE_MODELS = [
  { value: 'azure', label: 'Microsoft Azure', description: 'Gratuito, 400+ voci' },
];

const AZURE_VOICES = [
  { value: 'it-IT-ElsaNeural', label: 'Elsa (IT)' },
  { value: 'it-IT-IsabellaNeural', label: 'Isabella (IT)' },
  { value: 'it-IT-DiegoNeural', label: 'Diego (IT)' },
  { value: 'en-US-JennyNeural', label: 'Jenny (EN)' },
  { value: 'en-US-GuyNeural', label: 'Guy (EN)' },
  { value: 'en-GB-SoniaNeural', label: 'Sonia (UK)' },
];

const ELEVENLABS_VOICES = [
  { value: 'Rachel', label: 'Rachel' },
  { value: 'Drew', label: 'Drew' },
  { value: 'Clyde', label: 'Clyde' },
  { value: 'Paul', label: 'Paul' },
  { value: 'Domi', label: 'Domi' },
  { value: 'Dave', label: 'Dave' },
  { value: 'Fin', label: 'Fin' },
  { value: 'Sarah', label: 'Sarah' },
  { value: 'Antoni', label: 'Antoni' },
  { value: 'Thomas', label: 'Thomas' },
];

const defaultAIImage = (): AIImage => ({
  id: crypto.randomUUID(),
  model: 'freepik-classic',
  prompt: '',
  aspectRatio: 'horizontal',
  duration: 5,
  resize: 'cover',
  zoom: 0,
  pan: 'none',
});

const defaultAIVoice = (): AIVoice => ({
  id: crypto.randomUUID(),
  model: 'azure',
  text: '',
  voice: 'it-IT-ElsaNeural',
  volume: 1,
});

export default function JSON2VideoAIAssets({
  aiImages,
  aiVoices,
  onImagesChange,
  onVoicesChange,
}: JSON2VideoAIAssetsProps) {
  const [activeTab, setActiveTab] = useState("images");

  const addImage = () => {
    onImagesChange([...aiImages, defaultAIImage()]);
    toast.success("Scena AI aggiunta");
  };

  const updateImage = (id: string, updates: Partial<AIImage>) => {
    onImagesChange(aiImages.map(img => img.id === id ? { ...img, ...updates } : img));
  };

  const removeImage = (id: string) => {
    onImagesChange(aiImages.filter(img => img.id !== id));
  };

  const addVoice = () => {
    onVoicesChange([...aiVoices, defaultAIVoice()]);
    toast.success("Voiceover AI aggiunto");
  };

  const updateVoice = (id: string, updates: Partial<AIVoice>) => {
    onVoicesChange(aiVoices.map(v => v.id === id ? { ...v, ...updates } : v));
  };

  const removeVoice = (id: string) => {
    onVoicesChange(aiVoices.filter(v => v.id !== id));
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Asset AI Generati
        </CardTitle>
        <CardDescription>
          Genera immagini e voci AI direttamente nel video
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="images" className="gap-2">
              <ImagePlus className="h-4 w-4" />
              Immagini ({aiImages.length})
            </TabsTrigger>
            <TabsTrigger value="voices" className="gap-2">
              <Mic className="h-4 w-4" />
              Voci ({aiVoices.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="images" className="space-y-4 mt-4">
            {aiImages.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <ImagePlus className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nessuna immagine AI</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={addImage}>
                  <Plus className="mr-2 h-4 w-4" />
                  Aggiungi Scena AI
                </Button>
              </div>
            ) : (
              <>
                {aiImages.map((img, index) => (
                  <div key={img.id} className="p-4 rounded-lg border space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">Scena AI #{index + 1}</Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => removeImage(img.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label>Prompt Immagine</Label>
                      <Textarea
                        value={img.prompt}
                        onChange={(e) => updateImage(img.id, { prompt: e.target.value })}
                        placeholder="Descrivi l'immagine da generare..."
                        rows={2}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label>Modello AI</Label>
                        <Select 
                          value={img.model} 
                          onValueChange={(v: 'freepik-classic' | 'flux-pro') => updateImage(img.id, { model: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {IMAGE_MODELS.map(m => (
                              <SelectItem key={m.value} value={m.value}>
                                <div className="flex flex-col">
                                  <span>{m.label}</span>
                                  <span className="text-xs text-muted-foreground">{m.description}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Aspect Ratio</Label>
                        <Select 
                          value={img.aspectRatio} 
                          onValueChange={(v: 'horizontal' | 'vertical' | 'squared') => updateImage(img.id, { aspectRatio: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="horizontal">Orizzontale (16:9)</SelectItem>
                            <SelectItem value="vertical">Verticale (9:16)</SelectItem>
                            <SelectItem value="squared">Quadrato (1:1)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Durata: {img.duration}s</Label>
                        <Slider
                          value={[img.duration]}
                          min={2}
                          max={15}
                          step={1}
                          onValueChange={([v]) => updateImage(img.id, { duration: v })}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <Button variant="outline" onClick={addImage} className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Aggiungi Altra Scena AI
                </Button>
              </>
            )}
          </TabsContent>

          <TabsContent value="voices" className="space-y-4 mt-4">
            {aiVoices.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Mic className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nessun voiceover AI</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={addVoice}>
                  <Plus className="mr-2 h-4 w-4" />
                  Aggiungi Voiceover
                </Button>
              </div>
            ) : (
              <>
                {aiVoices.map((voice, index) => (
                  <div key={voice.id} className="p-4 rounded-lg border space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">Voiceover #{index + 1}</Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => removeVoice(voice.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label>Testo da Narrare</Label>
                      <Textarea
                        value={voice.text}
                        onChange={(e) => updateVoice(voice.id, { text: e.target.value })}
                        placeholder="Inserisci il testo per la narrazione..."
                        rows={3}
                      />
                      <p className="text-xs text-muted-foreground">
                        {voice.text.length} caratteri
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label>Provider</Label>
                        <Select 
                          value={voice.model} 
                          onValueChange={(v: 'azure' | 'elevenlabs') => {
                            updateVoice(voice.id, { 
                              model: v,
                              voice: v === 'azure' ? 'it-IT-ElsaNeural' : 'Rachel'
                            });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {VOICE_MODELS.map(m => (
                              <SelectItem key={m.value} value={m.value}>
                                <div className="flex flex-col">
                                  <span>{m.label}</span>
                                  <span className="text-xs text-muted-foreground">{m.description}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Voce</Label>
                        <Select 
                          value={voice.voice} 
                          onValueChange={(v) => updateVoice(voice.id, { voice: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(voice.model === 'azure' ? AZURE_VOICES : ELEVENLABS_VOICES).map(v => (
                              <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Volume: {(voice.volume * 100).toFixed(0)}%</Label>
                        <Slider
                          value={[voice.volume]}
                          min={0}
                          max={2}
                          step={0.1}
                          onValueChange={([v]) => updateVoice(voice.id, { volume: v })}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <Button variant="outline" onClick={addVoice} className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Aggiungi Altro Voiceover
                </Button>
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
