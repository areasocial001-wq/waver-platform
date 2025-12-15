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
import { Loader2, Play, Video, Check, X, Clock, Sparkles } from 'lucide-react';

interface MultiModelGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string | null;
  panelCaption?: string;
  optimizedPrompt?: string;
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
  {
    id: 'freepik',
    name: 'Freepik MiniMax',
    description: 'Veloce, buon rapporto qualità/prezzo',
    estimatedTime: '~2min',
    supportedDurations: [5],
  },
];

interface GenerationResult {
  provider: Provider;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
  generationId?: string;
}

export const MultiModelGenerator = ({
  open,
  onOpenChange,
  imageUrl,
  panelCaption,
  optimizedPrompt,
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
    setResults(selectedProviders.map(provider => ({
      provider,
      status: 'pending',
    })));

    // Start all generations in parallel
    const generationPromises = selectedProviders.map(async (provider) => {
      try {
        // Update status to processing
        setResults(prev => prev.map(r =>
          r.provider === provider ? { ...r, status: 'processing' as const } : r
        ));

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
          setResults(prev => prev.map(r =>
            r.provider === provider ? {
              ...r,
              status: 'completed' as const,
              videoUrl: Array.isArray(data.output) ? data.output[0] : data.output,
              generationId: genRecord.id,
            } : r
          ));
        } else if (data.status === 'processing' || data.status === 'starting') {
          setResults(prev => prev.map(r =>
            r.provider === provider ? {
              ...r,
              status: 'processing' as const,
              generationId: genRecord.id,
            } : r
          ));
        } else {
          throw new Error(data.error || 'Generazione fallita');
        }
      } catch (error: any) {
        console.error(`Error with ${provider}:`, error);
        setResults(prev => prev.map(r =>
          r.provider === provider ? {
            ...r,
            status: 'failed' as const,
            error: error.message,
          } : r
        ));
      }
    });

    await Promise.allSettled(generationPromises);
    setIsGenerating(false);
    toast.success('Generazione avviata! Controlla lo storico per i risultati.');
  };

  const getProviderInfo = (providerId: Provider) => {
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

            {/* Results */}
            {results.length > 0 && (
              <div className="space-y-3">
                <Label>Risultati</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {results.map((result) => {
                    const provider = getProviderInfo(result.provider);
                    return (
                      <Card key={result.provider} className="p-4">
                        <div className="flex items-center justify-between mb-3">
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
                        {result.error && (
                          <p className="text-xs text-destructive mt-2">{result.error}</p>
                        )}
                        {result.videoUrl && (
                          <div className="mt-3">
                            <video
                              src={result.videoUrl}
                              controls
                              className="w-full rounded"
                            />
                          </div>
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
