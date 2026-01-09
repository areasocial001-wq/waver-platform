import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  User, 
  Upload, 
  Mic, 
  Play, 
  Pause, 
  Video, 
  ImagePlus, 
  Sparkles, 
  Volume2,
  Download,
  RefreshCw,
  Trash2,
  Plus,
  Settings2,
  Wand2,
  Film,
  AudioLines
} from 'lucide-react';

interface ReferenceImage {
  id: string;
  url: string;
  name: string;
  isActive: boolean;
}

interface GeneratedVideo {
  id: string;
  url: string;
  prompt: string;
  thumbnail?: string;
  createdAt: Date;
}

// Voice options for TTS
const VOICE_OPTIONS = [
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', description: 'Femminile, calda' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', description: 'Maschile, profonda' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', description: 'Femminile, giovane' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', description: 'Maschile, energico' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', description: 'Maschile, narratore' },
];

export function TalkingAvatarGenerator() {
  // State for reference images (character consistency)
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [activeReferenceId, setActiveReferenceId] = useState<string | null>(null);
  
  // State for prompt and generation
  const [scenePrompt, setScenePrompt] = useState('');
  const [dialogueText, setDialogueText] = useState('');
  const [audioDescription, setAudioDescription] = useState('');
  
  // Audio state
  const [useAudioInput, setUseAudioInput] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [useTTS, setUseTTS] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState(VOICE_OPTIONS[0].id);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  
  // Generation settings
  const [sampleSteps, setSampleSteps] = useState(20);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentEventId, setCurrentEventId] = useState<string | null>(null);
  
  // Generated videos
  const [generatedVideos, setGeneratedVideos] = useState<GeneratedVideo[]>([]);
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);
  
  // Refs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Build the full prompt in Ovi format
  const buildFullPrompt = useCallback(() => {
    let prompt = scenePrompt;
    
    if (dialogueText) {
      prompt += `, <S>${dialogueText}<E>`;
    }
    
    if (audioDescription) {
      prompt += ` <AUDCAP>${audioDescription}<ENDAUDCAP>`;
    }
    
    return prompt;
  }, [scenePrompt, dialogueText, audioDescription]);

  // Handle image upload for reference
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const newImage: ReferenceImage = {
          id: crypto.randomUUID(),
          url: event.target?.result as string,
          name: file.name,
          isActive: referenceImages.length === 0,
        };
        setReferenceImages((prev) => [...prev, newImage]);
        if (referenceImages.length === 0) {
          setActiveReferenceId(newImage.id);
        }
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  }, [referenceImages.length]);

  // Handle audio file upload
  const handleAudioUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAudioFile(file);
    setAudioUrl(URL.createObjectURL(file));
    setGeneratedAudioUrl(null);
    e.target.value = '';
  }, []);

  // Generate TTS audio using ElevenLabs
  const generateTTSAudio = useCallback(async () => {
    if (!dialogueText.trim()) {
      toast.error('Inserisci un testo per il dialogo');
      return null;
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            text: dialogueText,
            voiceId: selectedVoice,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Errore generazione audio TTS');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      setGeneratedAudioUrl(audioUrl);
      toast.success('Audio TTS generato!');
      return audioUrl;
    } catch (error: any) {
      console.error('TTS error:', error);
      toast.error(error.message || 'Errore generazione TTS');
      return null;
    }
  }, [dialogueText, selectedVoice]);

  // Poll for generation status
  useEffect(() => {
    if (!currentEventId || !isGenerating) return;

    const pollInterval = setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('talking-avatar', {
          body: {
            action: 'status',
            eventId: currentEventId,
          },
        });

        if (error) {
          console.error('Status poll error:', error);
          return;
        }

        if (data.status === 'COMPLETED' && data.videoUrl) {
          clearInterval(pollInterval);
          setIsGenerating(false);
          setProgress(100);
          setCurrentEventId(null);
          
          const newVideo: GeneratedVideo = {
            id: crypto.randomUUID(),
            url: data.videoUrl,
            prompt: buildFullPrompt(),
            createdAt: new Date(),
          };
          
          setGeneratedVideos((prev) => [newVideo, ...prev]);
          setPreviewVideo(data.videoUrl);
          toast.success('Video talking avatar generato!');
        } else if (data.status === 'FAILED') {
          clearInterval(pollInterval);
          setIsGenerating(false);
          setProgress(0);
          setCurrentEventId(null);
          toast.error(data.error || 'Generazione fallita');
        } else {
          // Still processing
          setProgress((prev) => Math.min(prev + 5, 90));
        }
      } catch (err) {
        console.error('Poll error:', err);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [currentEventId, isGenerating, buildFullPrompt]);

  // Generate talking avatar video
  const handleGenerate = useCallback(async () => {
    const activeImage = referenceImages.find((img) => img.id === activeReferenceId);
    if (!activeImage) {
      toast.error('Seleziona un\'immagine di riferimento');
      return;
    }

    if (!scenePrompt.trim()) {
      toast.error('Inserisci una descrizione della scena');
      return;
    }

    setIsGenerating(true);
    setProgress(10);

    try {
      // First generate TTS if needed
      let finalAudioUrl = audioUrl;
      if (useTTS && dialogueText.trim() && !generatedAudioUrl) {
        finalAudioUrl = await generateTTSAudio();
      } else if (generatedAudioUrl) {
        finalAudioUrl = generatedAudioUrl;
      }

      setProgress(30);

      const fullPrompt = buildFullPrompt();
      console.log('Generating with prompt:', fullPrompt);

      const { data, error } = await supabase.functions.invoke('talking-avatar', {
        body: {
          action: 'generate',
          prompt: fullPrompt,
          imageUrl: activeImage.url,
          audioUrl: finalAudioUrl,
          sampleSteps,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.eventId) {
        setCurrentEventId(data.eventId);
        setProgress(50);
        toast.info('Generazione in corso... Attendere.');
      } else if (data.videoUrl) {
        // Direct result
        const newVideo: GeneratedVideo = {
          id: crypto.randomUUID(),
          url: data.videoUrl,
          prompt: fullPrompt,
          createdAt: new Date(),
        };
        
        setGeneratedVideos((prev) => [newVideo, ...prev]);
        setPreviewVideo(data.videoUrl);
        setIsGenerating(false);
        setProgress(100);
        toast.success('Video generato!');
      }
    } catch (error: any) {
      console.error('Generation error:', error);
      toast.error(error.message || 'Errore durante la generazione');
      setIsGenerating(false);
      setProgress(0);
    }
  }, [
    referenceImages,
    activeReferenceId,
    scenePrompt,
    audioUrl,
    useTTS,
    dialogueText,
    generatedAudioUrl,
    generateTTSAudio,
    buildFullPrompt,
    sampleSteps,
  ]);

  // Set active reference image
  const setActiveReference = useCallback((id: string) => {
    setActiveReferenceId(id);
    setReferenceImages((prev) =>
      prev.map((img) => ({
        ...img,
        isActive: img.id === id,
      }))
    );
  }, []);

  // Remove reference image
  const removeReferenceImage = useCallback((id: string) => {
    setReferenceImages((prev) => {
      const filtered = prev.filter((img) => img.id !== id);
      if (activeReferenceId === id && filtered.length > 0) {
        setActiveReferenceId(filtered[0].id);
        filtered[0].isActive = true;
      }
      return filtered;
    });
  }, [activeReferenceId]);

  // Download video
  const handleDownload = useCallback((url: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `talking-avatar-${Date.now()}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
      {/* Left Panel - Reference Images & Character Consistency */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Character Reference
          </CardTitle>
          <CardDescription>
            Carica immagini per mantenere la consistenza del personaggio
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageUpload}
            className="hidden"
          />
          
          <Button
            variant="outline"
            className="w-full"
            onClick={() => imageInputRef.current?.click()}
          >
            <ImagePlus className="w-4 h-4 mr-2" />
            Aggiungi Immagine
          </Button>

          <ScrollArea className="h-[300px]">
            <div className="grid grid-cols-2 gap-2">
              {referenceImages.map((img) => (
                <div
                  key={img.id}
                  className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                    img.id === activeReferenceId
                      ? 'border-primary ring-2 ring-primary/30'
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setActiveReference(img.id)}
                >
                  <img
                    src={img.url}
                    alt={img.name}
                    className="w-full aspect-square object-cover"
                  />
                  {img.id === activeReferenceId && (
                    <Badge className="absolute top-1 left-1 text-xs">
                      Attivo
                    </Badge>
                  )}
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeReferenceImage(img.id);
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>

          {referenceImages.length > 0 && (
            <div className="text-xs text-muted-foreground text-center">
              {referenceImages.length} immagine/i · Clicca per selezionare quella attiva
            </div>
          )}
        </CardContent>
      </Card>

      {/* Center Panel - Prompt & Settings */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5" />
            Generazione Video
          </CardTitle>
          <CardDescription>
            Descrivi la scena e il dialogo per il tuo avatar parlante
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs defaultValue="prompt" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="prompt">Prompt</TabsTrigger>
              <TabsTrigger value="audio">Audio</TabsTrigger>
            </TabsList>
            
            <TabsContent value="prompt" className="space-y-4">
              <div className="space-y-2">
                <Label>Descrizione Scena</Label>
                <Textarea
                  placeholder="Es: A woman with dark hair looking at the camera in a modern office..."
                  value={scenePrompt}
                  onChange={(e) => setScenePrompt(e.target.value)}
                  rows={3}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Dialogo (opzionale)</Label>
                <Textarea
                  placeholder="Es: Hello! Welcome to my channel..."
                  value={dialogueText}
                  onChange={(e) => setDialogueText(e.target.value)}
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">
                  Il testo verrà aggiunto come {"<S>dialogo<E>"} nel prompt
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>Atmosfera Audio (opzionale)</Label>
                <Textarea
                  placeholder="Es: cheerful female voice, warm background music..."
                  value={audioDescription}
                  onChange={(e) => setAudioDescription(e.target.value)}
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">
                  Verrà aggiunto come {"<AUDCAP>descrizione<ENDAUDCAP>"}
                </p>
              </div>
            </TabsContent>
            
            <TabsContent value="audio" className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Usa Text-to-Speech</Label>
                <Switch checked={useTTS} onCheckedChange={setUseTTS} />
              </div>
              
              {useTTS ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Voce</Label>
                    <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VOICE_OPTIONS.map((voice) => (
                          <SelectItem key={voice.id} value={voice.id}>
                            {voice.name} - {voice.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={generateTTSAudio}
                    disabled={!dialogueText.trim() || isGenerating}
                  >
                    <Volume2 className="w-4 h-4 mr-2" />
                    Genera Audio TTS
                  </Button>
                  
                  {generatedAudioUrl && (
                    <audio
                      ref={audioRef}
                      src={generatedAudioUrl}
                      controls
                      className="w-full"
                    />
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <input
                    ref={audioInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={handleAudioUpload}
                    className="hidden"
                  />
                  
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => audioInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Carica File Audio
                  </Button>
                  
                  {audioUrl && (
                    <div className="space-y-2">
                      <audio src={audioUrl} controls className="w-full" />
                      <p className="text-xs text-muted-foreground">
                        {audioFile?.name}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Generation Settings */}
          <div className="space-y-4 pt-4 border-t">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Sample Steps</Label>
                <span className="text-sm text-muted-foreground">{sampleSteps}</span>
              </div>
              <Slider
                value={[sampleSteps]}
                onValueChange={([v]) => setSampleSteps(v)}
                min={10}
                max={50}
                step={5}
              />
              <p className="text-xs text-muted-foreground">
                Più step = qualità migliore ma tempi più lunghi
              </p>
            </div>
          </div>

          {/* Progress */}
          {isGenerating && (
            <div className="space-y-2">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-center text-muted-foreground">
                Generazione in corso... {progress}%
              </p>
            </div>
          )}

          {/* Generate Button */}
          <Button
            className="w-full"
            size="lg"
            onClick={handleGenerate}
            disabled={
              isGenerating ||
              !activeReferenceId ||
              !scenePrompt.trim()
            }
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Generazione...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Genera Talking Avatar
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Right Panel - Preview & Results */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Film className="w-5 h-5" />
            Anteprima Video
          </CardTitle>
          <CardDescription>
            Video generati con il tuo avatar parlante
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Video Preview */}
          <div className="aspect-video bg-muted rounded-lg overflow-hidden flex items-center justify-center">
            {previewVideo ? (
              <video
                ref={videoRef}
                src={previewVideo}
                controls
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-center text-muted-foreground">
                <Video className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Nessun video generato</p>
              </div>
            )}
          </div>

          {previewVideo && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => handleDownload(previewVideo)}
            >
              <Download className="w-4 h-4 mr-2" />
              Scarica Video
            </Button>
          )}

          {/* Generated Videos History */}
          {generatedVideos.length > 0 && (
            <div className="space-y-2">
              <Label>Video Generati</Label>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {generatedVideos.map((video) => (
                    <div
                      key={video.id}
                      className={`p-2 rounded-lg border cursor-pointer transition-all ${
                        previewVideo === video.url
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setPreviewVideo(video.url)}
                    >
                      <div className="flex items-center gap-2">
                        <Video className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{video.prompt}</p>
                          <p className="text-xs text-muted-foreground">
                            {video.createdAt.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Prompt Preview */}
          {(scenePrompt || dialogueText || audioDescription) && (
            <div className="space-y-2 pt-4 border-t">
              <Label className="flex items-center gap-1">
                <AudioLines className="w-3 h-3" />
                Prompt Completo
              </Label>
              <div className="p-3 bg-muted rounded-lg text-sm font-mono break-all">
                {buildFullPrompt() || 'Compila i campi per vedere il prompt...'}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default TalkingAvatarGenerator;
