import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Wand2, Camera, Aperture, Sun, Move, Eye, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface ShotDescription {
  cameraAngle: string;
  lensType: string;
  lighting: string;
  cameraMovement: string;
  composition: string;
  mood: string;
}

interface ShotDescriptionGeneratorProps {
  caption: string;
  imageUrl?: string | null;
  onDescriptionGenerated: (description: ShotDescription) => void;
  existingDescription?: ShotDescription | null;
  compact?: boolean;
}

const CAMERA_ANGLES = ['Eye level', 'Low angle', 'High angle', 'Bird\'s eye', 'Dutch angle', 'Worm\'s eye', 'Over the shoulder'];
const LENS_TYPES = ['Wide 16mm', 'Normal 35mm', 'Standard 50mm', 'Portrait 85mm', 'Telephoto 135mm', 'Macro', 'Anamorphic'];
const LIGHTING_STYLES = ['Natural light', 'Golden hour', 'Blue hour', 'Rembrandt', 'Chiaroscuro', 'High key', 'Low key', 'Neon', 'Silhouette'];
const CAMERA_MOVEMENTS = ['Static', 'Pan left', 'Pan right', 'Tilt up', 'Tilt down', 'Dolly in', 'Dolly out', 'Crane up', 'Handheld', 'Steadicam'];

export function ShotDescriptionGenerator({
  caption,
  imageUrl,
  onDescriptionGenerated,
  existingDescription,
  compact = false,
}: ShotDescriptionGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [description, setDescription] = useState<ShotDescription | null>(existingDescription || null);

  const generateDescription = async () => {
    if (!caption && !imageUrl) {
      toast.error('Serve una descrizione o un\'immagine per generare lo shot description');
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-content', {
        body: {
          type: 'custom',
          prompt: `Analizza questa scena per uno storyboard cinematografico e genera una shot description professionale.

Scena: "${caption || 'Immagine senza descrizione'}"

Rispondi SOLO con un JSON valido (senza markdown) con questa struttura esatta:
{
  "cameraAngle": "angolo camera (es: Eye level, Low angle, High angle, Bird's eye, Dutch angle)",
  "lensType": "tipo di lente (es: Wide 16mm, Normal 35mm, Standard 50mm, Portrait 85mm, Telephoto 135mm, Anamorphic)",
  "lighting": "tipo di illuminazione (es: Natural light, Golden hour, Rembrandt, Chiaroscuro, High key, Low key, Neon)",
  "cameraMovement": "movimento camera (es: Static, Pan left, Dolly in, Crane up, Handheld, Steadicam)",
  "composition": "composizione in max 10 parole (es: Rule of thirds, centered subject, leading lines)",
  "mood": "mood/atmosfera in max 5 parole (es: Tense, dramatic, mysterious)"
}`,
          tone: 'technical',
        },
      });

      if (error) throw error;

      const content = data?.content || data?.text || '';
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Nessun JSON nella risposta');

      const parsed: ShotDescription = JSON.parse(jsonMatch[0]);
      setDescription(parsed);
      onDescriptionGenerated(parsed);
      toast.success('Shot description generata!');
    } catch (err: any) {
      console.error('Shot description generation error:', err);
      // Fallback with random selection
      const fallback: ShotDescription = {
        cameraAngle: CAMERA_ANGLES[Math.floor(Math.random() * CAMERA_ANGLES.length)],
        lensType: LENS_TYPES[Math.floor(Math.random() * LENS_TYPES.length)],
        lighting: LIGHTING_STYLES[Math.floor(Math.random() * LIGHTING_STYLES.length)],
        cameraMovement: CAMERA_MOVEMENTS[Math.floor(Math.random() * CAMERA_MOVEMENTS.length)],
        composition: 'Rule of thirds',
        mood: 'Cinematic',
      };
      setDescription(fallback);
      onDescriptionGenerated(fallback);
      toast.info('Shot description generata (fallback)');
    } finally {
      setIsGenerating(false);
    }
  };

  if (compact && description) {
    return (
      <TooltipProvider>
        <div className="flex flex-wrap gap-1 mt-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-[9px] h-4 gap-0.5 bg-primary/10 text-primary border-primary/20">
                <Camera className="w-2.5 h-2.5" /> {description.cameraAngle}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Angolo Camera</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-[9px] h-4 gap-0.5 bg-secondary/10 text-secondary border-secondary/20">
                <Aperture className="w-2.5 h-2.5" /> {description.lensType}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Tipo Lente</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-[9px] h-4 gap-0.5 bg-accent/10 text-accent border-accent/20">
                <Sun className="w-2.5 h-2.5" /> {description.lighting}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Illuminazione</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-[9px] h-4 gap-0.5 bg-muted text-muted-foreground">
                <Move className="w-2.5 h-2.5" /> {description.cameraMovement}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Movimento Camera</TooltipContent>
          </Tooltip>
          <Button variant="ghost" size="icon" className="h-4 w-4" onClick={generateDescription} disabled={isGenerating}>
            <RefreshCw className={`w-2.5 h-2.5 ${isGenerating ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="sm"
        className="w-full h-8 gap-1.5 text-xs"
        onClick={generateDescription}
        disabled={isGenerating}
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Analizzando scena...
          </>
        ) : (
          <>
            <Wand2 className="w-3.5 h-3.5" />
            {description ? 'Rigenera Shot Description' : 'Genera Shot Description'}
          </>
        )}
      </Button>

      {description && (
        <Card className="border-primary/20 bg-card/50">
          <CardContent className="p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <div>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Angolo</p>
                  <p className="text-xs font-medium text-foreground">{description.cameraAngle}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Aperture className="w-3.5 h-3.5 text-secondary flex-shrink-0" />
                <div>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Lente</p>
                  <p className="text-xs font-medium text-foreground">{description.lensType}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                <div>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Luce</p>
                  <p className="text-xs font-medium text-foreground">{description.lighting}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Move className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Movimento</p>
                  <p className="text-xs font-medium text-foreground">{description.cameraMovement}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 pt-1 border-t border-border/50">
              <Eye className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Composizione & Mood</p>
                <p className="text-xs text-foreground">{description.composition} — <span className="italic">{description.mood}</span></p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
