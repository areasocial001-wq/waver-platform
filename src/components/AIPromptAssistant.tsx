import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Wand2, Copy, Check, Sparkles, Video, Camera, Music } from 'lucide-react';

interface AIPromptAssistantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string | null;
  panelCaption?: string;
  onPromptGenerated: (prompt: string) => void;
}

interface OptimizedPrompts {
  mainPrompt: string;
  cameraMovement: string;
  audioSuggestion: string;
  style: string;
  duration: number;
  keywords: string[];
}

export const AIPromptAssistant = ({
  open,
  onOpenChange,
  imageUrl,
  panelCaption,
  onPromptGenerated,
}: AIPromptAssistantProps) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [optimizedPrompts, setOptimizedPrompts] = useState<OptimizedPrompts | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [customContext, setCustomContext] = useState('');

  const analyzeAndOptimize = async () => {
    if (!imageUrl) {
      toast.error('Nessuna immagine da analizzare');
      return;
    }

    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('optimize-video-prompt', {
        body: {
          imageUrl,
          caption: panelCaption,
          customContext,
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setOptimizedPrompts(data);
      toast.success('Prompt ottimizzati generati!');
    } catch (error: any) {
      console.error('Error optimizing prompt:', error);
      toast.error(error.message || 'Errore durante l\'analisi');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
    toast.success('Copiato negli appunti!');
  };

  const usePrompt = (prompt: string) => {
    onPromptGenerated(prompt);
    onOpenChange(false);
    toast.success('Prompt applicato!');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            AI Prompt Assistant
          </DialogTitle>
          <DialogDescription>
            Analizza l'immagine e genera prompt ottimizzati per la generazione video
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-6 pr-4">
            {/* Image Preview */}
            {imageUrl && (
              <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                <img
                  src={imageUrl}
                  alt="Panel preview"
                  className="w-full h-full object-contain"
                />
              </div>
            )}

            {/* Custom Context */}
            <div className="space-y-2">
              <Label>Contesto aggiuntivo (opzionale)</Label>
              <Textarea
                placeholder="Descrivi il contesto, lo stile desiderato, o dettagli specifici..."
                value={customContext}
                onChange={(e) => setCustomContext(e.target.value)}
                rows={2}
              />
            </div>

            {/* Analyze Button */}
            <Button
              onClick={analyzeAndOptimize}
              disabled={isAnalyzing || !imageUrl}
              className="w-full"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analisi in corso...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Analizza e Ottimizza
                </>
              )}
            </Button>

            {/* Results */}
            {optimizedPrompts && (
              <div className="space-y-4">
                {/* Main Prompt */}
                <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Video className="h-4 w-4 text-primary" />
                      <Label className="font-semibold">Prompt Principale</Label>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(optimizedPrompts.mainPrompt, 'main')}
                      >
                        {copiedField === 'main' ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => usePrompt(optimizedPrompts.mainPrompt)}
                      >
                        Usa
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-foreground">{optimizedPrompts.mainPrompt}</p>
                </div>

                {/* Camera Movement */}
                <div className="p-4 bg-accent/5 rounded-lg border border-accent/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Camera className="h-4 w-4 text-accent" />
                      <Label className="font-semibold">Movimento Camera</Label>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(optimizedPrompts.cameraMovement, 'camera')}
                    >
                      {copiedField === 'camera' ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-sm text-foreground">{optimizedPrompts.cameraMovement}</p>
                </div>

                {/* Audio Suggestion */}
                <div className="p-4 bg-muted rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Music className="h-4 w-4" />
                      <Label className="font-semibold">Suggerimento Audio</Label>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(optimizedPrompts.audioSuggestion, 'audio')}
                    >
                      {copiedField === 'audio' ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-sm text-foreground">{optimizedPrompts.audioSuggestion}</p>
                </div>

                {/* Metadata */}
                <div className="flex flex-wrap gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Stile</Label>
                    <Badge variant="outline" className="mt-1">{optimizedPrompts.style}</Badge>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Durata consigliata</Label>
                    <Badge variant="outline" className="mt-1">{optimizedPrompts.duration}s</Badge>
                  </div>
                </div>

                {/* Keywords */}
                {optimizedPrompts.keywords && optimizedPrompts.keywords.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Keywords</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {optimizedPrompts.keywords.map((keyword, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Use Full Prompt */}
                <Button
                  onClick={() => {
                    const fullPrompt = `${optimizedPrompts.mainPrompt}. Camera: ${optimizedPrompts.cameraMovement}`;
                    usePrompt(fullPrompt);
                  }}
                  className="w-full"
                >
                  <Wand2 className="h-4 w-4 mr-2" />
                  Usa Prompt Completo
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
