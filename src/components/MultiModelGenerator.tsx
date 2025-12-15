import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Play, Pause, RotateCcw, Video, Check, X, Clock, Sparkles, Download, FileText } from 'lucide-react';

interface MultiModelGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string | null;
  panelCaption?: string;
  optimizedPrompt?: string;
  onResultsUpdate?: (results: GenerationResult[]) => void;
  onOpenReport?: () => void;
}

interface GenerationResult {
  provider: string;
  providerName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
  generationId?: string;
}

type Provider = 'veo' | 'kling' | 'freepik';

interface ProviderConfig {
  id: Provider;
  name: string;
  description: string;
  estimatedTime: string;
  supportedDurations: number[];
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'veo',
    name: 'Google Veo 3.1',
    description: 'Alta qualità, audio nativo',
    estimatedTime: '~90s',
    supportedDurations: [4, 6, 8],
  },
  {
    id: 'kling',
    name: 'Kling 2.1',
    description: 'Transizioni fluide, supporto end-frame',
    estimatedTime: '~4min',
    supportedDurations: [5, 10],
  },
];

export const MultiModelGenerator = ({
  open,
  onOpenChange,
  imageUrl,
  panelCaption,
  optimizedPrompt,
  onResultsUpdate,
  onOpenReport,
}: MultiModelGeneratorProps) => {
  const [selectedProviders, setSelectedProviders] = useState<Provider[]>(['veo', 'kling']);
  const [prompt, setPrompt] = useState(optimizedPrompt || panelCaption || '');
  const [duration, setDuration] = useState('5');
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<GenerationResult[]>([]);

  const toggleProvider = (provider: Provider) => {
    setSelectedProviders(prev =>
      prev.includes(provider)
        ? prev.filter(p => p !== provider)
        : [...prev, provider]
    );
  };

  const startGeneration = async () => {
    if (!imageUrl) {
      toast.error('Nessuna immagine selezionata');
      return;
    }

    if (!prompt.trim()) {
      toast.error('Inserisci un prompt');
      return;
    }

    if (selectedProviders.length === 0) {
      toast.error('Seleziona almeno un provider');
      return;
    }

    setIsGenerating(true);
    const initialResults = selectedProviders.map(provider => {
      const providerInfo = PROVIDERS.find(p => p.id === provider);
      return {
        provider,
        providerName: providerInfo?.name || provider,
        status: 'pending' as const,
      };
    });
    setResults(initialResults);
    onResultsUpdate?.(initialResults);

    // Start all generations in parallel
    const generationPromises = selectedProviders.map(async (provider) => {
      const providerInfo = PROVIDERS.find(p => p.id === provider);
      try {
        // Update status to processing
        setResults(prev => {
          const updated = prev.map(r =>
            r.provider === provider ? { ...r, status: 'processing' as const } : r
          );
          onResultsUpdate?.(updated);
          return updated;
        });

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Non autenticato');

        // Create generation record
        const { data: genRecord, error: insertError } = await supabase
          .from('video_generations')
          .insert({
            user_id: user.id,
            type: 'image_to_video',
            prompt: `[${provider.toUpperCase()}] ${prompt}`,
            image_url: imageUrl,
            duration: parseInt(duration),
            status: 'processing',
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Call video generation
        const { data, error } = await supabase.functions.invoke('generate-video', {
          body: {
            type: 'image_to_video',
            prompt,
            image: imageUrl,
            duration: parseInt(duration),
            generationId: genRecord.id,
            preferredProvider: provider,
          },
        });

        if (error) throw error;

        if (data.status === 'succeeded' && data.output) {
          setResults(prev => {
            const updated = prev.map(r =>
              r.provider === provider ? {
                ...r,
                status: 'completed' as const,
                videoUrl: Array.isArray(data.output) ? data.output[0] : data.output,
                generationId: genRecord.id,
              } : r
            );
            onResultsUpdate?.(updated);
            return updated;
          });
        } else if (data.status === 'processing' || data.status === 'starting') {
          setResults(prev => {
            const updated = prev.map(r =>
              r.provider === provider ? {
                ...r,
                status: 'processing' as const,
                generationId: genRecord.id,
              } : r
            );
            onResultsUpdate?.(updated);
            return updated;
          });
        } else {
          throw new Error(data.error || 'Generazione fallita');
        }
      } catch (error: any) {
        console.error(`Error with ${provider}:`, error);
        setResults(prev => {
          const updated = prev.map(r =>
            r.provider === provider ? {
              ...r,
              status: 'failed' as const,
              error: error.message,
            } : r
          );
          onResultsUpdate?.(updated);
          return updated;
        });
      }
    });

    await Promise.allSettled(generationPromises);
    setIsGenerating(false);
    toast.success('Generazione avviata! Controlla lo storico per i risultati.');
  };

  const getProviderInfo = (providerId: string) => {
    return PROVIDERS.find(p => p.id === providerId);
  };

  const getStatusIcon = (status: GenerationResult['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'completed':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <X className="h-4 w-4 text-destructive" />;
    }
  };

  const getStatusLabel = (status: GenerationResult['status']) => {
    switch (status) {
      case 'pending':
        return 'In attesa';
      case 'processing':
        return 'In elaborazione';
      case 'completed':
        return 'Completato';
      case 'failed':
        return 'Fallito';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Generazione Multi-Modello
          </DialogTitle>
          <DialogDescription>
            Genera video in parallelo con diversi provider per confrontare i risultati
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-6 pr-4">
            {/* Image Preview */}
            {imageUrl && (
              <div className="aspect-video max-h-48 bg-muted rounded-lg overflow-hidden">
                <img
                  src={imageUrl}
                  alt="Source"
                  className="w-full h-full object-contain"
                />
              </div>
            )}

            {/* Provider Selection */}
            <div className="space-y-3">
              <Label>Seleziona Provider</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {PROVIDERS.map((provider) => (
                  <Card
                    key={provider.id}
                    className={`p-4 cursor-pointer transition-all ${
                      selectedProviders.includes(provider.id)
                        ? 'ring-2 ring-primary bg-primary/5'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => toggleProvider(provider.id)}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedProviders.includes(provider.id)}
                        onCheckedChange={() => toggleProvider(provider.id)}
                      />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{provider.name}</p>
                        <p className="text-xs text-muted-foreground">{provider.description}</p>
                        <div className="flex gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            {provider.estimatedTime}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Prompt */}
            <div className="space-y-2">
              <Label>Prompt</Label>
              <Textarea
                placeholder="Descrivi il video che vuoi generare..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
              />
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label>Durata</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">4 secondi</SelectItem>
                  <SelectItem value="5">5 secondi</SelectItem>
                  <SelectItem value="6">6 secondi</SelectItem>
                  <SelectItem value="8">8 secondi</SelectItem>
                  <SelectItem value="10">10 secondi</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Nota: ogni provider supporta durate diverse. La durata verrà adattata automaticamente.
              </p>
            </div>

            {/* Generate Button */}
            <Button
              onClick={startGeneration}
              disabled={isGenerating || selectedProviders.length === 0 || !imageUrl}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generazione in corso...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Genera con {selectedProviders.length} provider
                </>
              )}
            </Button>

            {/* Results with Comparison Panel */}
            {results.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Risultati</Label>
                  {onOpenReport && results.some(r => r.status === 'completed') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onOpenReport}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      Crea Report
                    </Button>
                  )}
                </div>
                
                {/* Synchronized Playback Controls */}
                {results.filter(r => r.status === 'completed' && r.videoUrl).length > 1 && (
                  <div className="flex gap-2 p-3 bg-muted/50 rounded-lg">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        results.forEach(r => {
                          if (r.status === 'completed') {
                            const video = document.getElementById(`multi-video-${r.provider}`) as HTMLVideoElement;
                            if (video) {
                              video.currentTime = 0;
                              video.play();
                            }
                          }
                        });
                      }}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Riproduci Tutti
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        results.forEach(r => {
                          const video = document.getElementById(`multi-video-${r.provider}`) as HTMLVideoElement;
                          if (video) video.pause();
                        });
                      }}
                    >
                      <Pause className="h-4 w-4 mr-1" />
                      Pausa
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        results.forEach(r => {
                          const video = document.getElementById(`multi-video-${r.provider}`) as HTMLVideoElement;
                          if (video) {
                            video.currentTime = 0;
                            video.pause();
                          }
                        });
                      }}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Reset
                    </Button>
                  </div>
                )}

                {/* Side-by-Side Comparison Grid */}
                <div className={`grid gap-4 ${
                  results.length === 1 ? 'grid-cols-1' :
                  results.length === 2 ? 'grid-cols-2' :
                  'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                }`}>
                  {results.map((result) => {
                    const provider = getProviderInfo(result.provider);
                    return (
                      <Card key={result.provider} className="p-4 flex flex-col">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{provider?.name}</p>
                            {getStatusIcon(result.status)}
                          </div>
                          <Badge
                            variant={
                              result.status === 'completed' ? 'default' :
                              result.status === 'failed' ? 'destructive' :
                              'secondary'
                            }
                          >
                            {getStatusLabel(result.status)}
                          </Badge>
                        </div>
                        
                        {result.error && (
                          <p className="text-xs text-destructive mb-2">{result.error}</p>
                        )}
                        
                        <div className="flex-1 min-h-[150px]">
                          {result.status === 'completed' && result.videoUrl ? (
                            <div className="aspect-video bg-black rounded overflow-hidden">
                              <video
                                id={`multi-video-${result.provider}`}
                                src={result.videoUrl}
                                controls
                                className="w-full h-full object-contain"
                              />
                            </div>
                          ) : result.status === 'processing' ? (
                            <div className="aspect-video bg-muted rounded flex items-center justify-center">
                              <div className="text-center">
                                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                                <p className="text-sm text-muted-foreground">In elaborazione...</p>
                                <p className="text-xs text-muted-foreground">{provider?.estimatedTime}</p>
                              </div>
                            </div>
                          ) : result.status === 'failed' ? (
                            <div className="aspect-video bg-destructive/10 rounded flex items-center justify-center">
                              <X className="h-8 w-8 text-destructive" />
                            </div>
                          ) : (
                            <div className="aspect-video bg-muted rounded flex items-center justify-center">
                              <Clock className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}
                        </div>

                        {/* Download button for completed videos */}
                        {result.status === 'completed' && result.videoUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={async () => {
                              try {
                                const response = await fetch(result.videoUrl!);
                                const blob = await response.blob();
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `video-${result.provider}-${Date.now()}.mp4`;
                                a.click();
                                URL.revokeObjectURL(url);
                              } catch (error) {
                                toast.error('Errore durante il download');
                              }
                            }}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Scarica
                          </Button>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
