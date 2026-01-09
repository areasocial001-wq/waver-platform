import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  BookOpen, 
  Sparkles, 
  MessageCircle,
  Presentation,
  Megaphone,
  GraduationCap,
  Heart,
  Clapperboard,
  Wand2
} from 'lucide-react';
import type { BatchScene } from './TalkingAvatarBatch';

export interface StoryTemplate {
  id: string;
  name: string;
  description: string;
  category: 'tutorial' | 'promo' | 'narrative' | 'educational' | 'social';
  icon: React.ReactNode;
  scenes: Omit<BatchScene, 'id' | 'status' | 'videoUrl' | 'error' | 'progress'>[];
  suggestedMusicEmotion: string;
  estimatedDuration: number; // in seconds
}

// Predefined story templates
export const STORY_TEMPLATES: StoryTemplate[] = [
  {
    id: 'product-intro',
    name: 'Introduzione Prodotto',
    description: 'Presenta un nuovo prodotto o servizio con entusiasmo',
    category: 'promo',
    icon: <Megaphone className="w-5 h-5" />,
    suggestedMusicEmotion: 'excited',
    estimatedDuration: 45,
    scenes: [
      {
        order: 0,
        scenePrompt: 'Professional presenter looking excited at the camera in a modern office',
        dialogueText: 'Ciao a tutti! Oggi vi presento qualcosa di incredibile!',
        expression: 'excited',
        audioDescription: 'Enthusiastic and energetic voice',
      },
      {
        order: 1,
        scenePrompt: 'Presenter gesturing with hands, explaining features confidently',
        dialogueText: 'Questo prodotto cambierà il vostro modo di lavorare. Ecco le caratteristiche principali...',
        expression: 'confident',
        audioDescription: 'Confident and clear voice',
      },
      {
        order: 2,
        scenePrompt: 'Presenter smiling warmly, making a personal connection',
        dialogueText: 'Ma la cosa più bella? È facilissimo da usare!',
        expression: 'happy',
        audioDescription: 'Warm and friendly voice',
      },
      {
        order: 3,
        scenePrompt: 'Presenter with call-to-action expression, pointing forward',
        dialogueText: 'Non perdete questa opportunità! Visitate il nostro sito per scoprire di più.',
        expression: 'excited',
        audioDescription: 'Motivating and urgent voice',
      },
    ],
  },
  {
    id: 'tutorial-basic',
    name: 'Tutorial Passo-Passo',
    description: 'Guida educativa con spiegazioni chiare',
    category: 'tutorial',
    icon: <GraduationCap className="w-5 h-5" />,
    suggestedMusicEmotion: 'neutral',
    estimatedDuration: 60,
    scenes: [
      {
        order: 0,
        scenePrompt: 'Friendly instructor looking at camera, welcoming gesture',
        dialogueText: 'Benvenuti a questo tutorial! Oggi imparerete qualcosa di nuovo e utile.',
        expression: 'happy',
        audioDescription: 'Warm and welcoming voice',
      },
      {
        order: 1,
        scenePrompt: 'Instructor with thoughtful expression, explaining step one',
        dialogueText: 'Prima di tutto, vediamo cosa ci serve per iniziare. Ecco il primo passo...',
        expression: 'thinking',
        audioDescription: 'Clear instructional voice',
      },
      {
        order: 2,
        scenePrompt: 'Instructor nodding, demonstrating understanding',
        dialogueText: 'Ottimo! Ora passiamo al secondo passo. Questa parte è molto importante.',
        expression: 'confident',
        audioDescription: 'Encouraging voice',
      },
      {
        order: 3,
        scenePrompt: 'Instructor with satisfied expression, concluding',
        dialogueText: 'Perfetto! Avete completato tutti i passaggi. Complimenti!',
        expression: 'happy',
        audioDescription: 'Congratulatory and warm voice',
      },
      {
        order: 4,
        scenePrompt: 'Instructor waving goodbye with a smile',
        dialogueText: 'Se avete domande, lasciate un commento. Alla prossima!',
        expression: 'happy',
        audioDescription: 'Friendly farewell voice',
      },
    ],
  },
  {
    id: 'story-emotional',
    name: 'Storia Emozionale',
    description: 'Narrativa con arco emotivo completo',
    category: 'narrative',
    icon: <Heart className="w-5 h-5" />,
    suggestedMusicEmotion: 'sad',
    estimatedDuration: 75,
    scenes: [
      {
        order: 0,
        scenePrompt: 'Thoughtful person looking at the camera with contemplative expression',
        dialogueText: 'Vi racconto una storia che mi ha cambiato la vita...',
        expression: 'thinking',
        audioDescription: 'Soft, reflective voice',
      },
      {
        order: 1,
        scenePrompt: 'Same person with sad expression, remembering difficult times',
        dialogueText: 'È iniziato tutto in un momento difficile. Non sapevo cosa fare.',
        expression: 'sad',
        audioDescription: 'Melancholic, vulnerable voice',
      },
      {
        order: 2,
        scenePrompt: 'Person looking surprised, moment of realization',
        dialogueText: 'Ma poi è successo qualcosa di inaspettato...',
        expression: 'surprised',
        audioDescription: 'Voice filled with wonder',
      },
      {
        order: 3,
        scenePrompt: 'Person smiling with hope, transformation evident',
        dialogueText: 'Da quel momento, tutto è cambiato. Ho trovato la mia strada.',
        expression: 'happy',
        audioDescription: 'Hopeful, uplifting voice',
      },
      {
        order: 4,
        scenePrompt: 'Person with confident, inspired expression',
        dialogueText: 'Ora so che ogni difficoltà nasconde un\'opportunità. Credeteci anche voi.',
        expression: 'confident',
        audioDescription: 'Inspiring, empowering voice',
      },
    ],
  },
  {
    id: 'social-hook',
    name: 'Hook per Social Media',
    description: 'Contenuto breve e coinvolgente per social',
    category: 'social',
    icon: <MessageCircle className="w-5 h-5" />,
    suggestedMusicEmotion: 'excited',
    estimatedDuration: 20,
    scenes: [
      {
        order: 0,
        scenePrompt: 'Person with surprised, attention-grabbing expression',
        dialogueText: 'Aspetta! Non scrollare via! Devo dirti una cosa importante.',
        expression: 'surprised',
        audioDescription: 'Urgent, attention-grabbing voice',
      },
      {
        order: 1,
        scenePrompt: 'Person with excited expression, sharing secret',
        dialogueText: 'Ho scoperto un trucco che devi assolutamente conoscere...',
        expression: 'excited',
        audioDescription: 'Excited, conspiratorial voice',
      },
      {
        order: 2,
        scenePrompt: 'Person pointing at camera with confident smile',
        dialogueText: 'Seguimi per scoprire tutti i dettagli!',
        expression: 'confident',
        audioDescription: 'Confident call-to-action voice',
      },
    ],
  },
  {
    id: 'presentation-formal',
    name: 'Presentazione Aziendale',
    description: 'Presentazione professionale e strutturata',
    category: 'educational',
    icon: <Presentation className="w-5 h-5" />,
    suggestedMusicEmotion: 'confident',
    estimatedDuration: 90,
    scenes: [
      {
        order: 0,
        scenePrompt: 'Professional presenter in business attire, corporate setting',
        dialogueText: 'Buongiorno a tutti. Oggi vi presenterò i risultati del nostro progetto.',
        expression: 'neutral',
        audioDescription: 'Professional, authoritative voice',
      },
      {
        order: 1,
        scenePrompt: 'Presenter with confident expression, showing data',
        dialogueText: 'Iniziamo con i dati principali. Come potete vedere, i numeri parlano chiaro.',
        expression: 'confident',
        audioDescription: 'Clear, data-driven voice',
      },
      {
        order: 2,
        scenePrompt: 'Presenter thinking, analyzing challenges',
        dialogueText: 'Naturalmente, abbiamo affrontato alcune sfide durante il percorso.',
        expression: 'thinking',
        audioDescription: 'Thoughtful, analytical voice',
      },
      {
        order: 3,
        scenePrompt: 'Presenter with proud expression, showing achievements',
        dialogueText: 'Ma i risultati raggiunti superano le aspettative iniziali.',
        expression: 'happy',
        audioDescription: 'Proud, satisfied voice',
      },
      {
        order: 4,
        scenePrompt: 'Presenter looking forward, discussing next steps',
        dialogueText: 'Per il futuro, abbiamo in programma ulteriori sviluppi entusiasmanti.',
        expression: 'excited',
        audioDescription: 'Forward-looking, enthusiastic voice',
      },
      {
        order: 5,
        scenePrompt: 'Presenter with open gesture, inviting questions',
        dialogueText: 'Grazie per la vostra attenzione. Sono a disposizione per le vostre domande.',
        expression: 'neutral',
        audioDescription: 'Open, professional voice',
      },
    ],
  },
  {
    id: 'short-film',
    name: 'Cortometraggio',
    description: 'Mini film con struttura cinematografica',
    category: 'narrative',
    icon: <Clapperboard className="w-5 h-5" />,
    suggestedMusicEmotion: 'thinking',
    estimatedDuration: 120,
    scenes: [
      {
        order: 0,
        scenePrompt: 'Character in dramatic lighting, mysterious atmosphere',
        dialogueText: 'Non avrei mai pensato che sarebbe finita così...',
        expression: 'sad',
        audioDescription: 'Dramatic, mysterious voice',
      },
      {
        order: 1,
        scenePrompt: 'Character with neutral expression, flashback beginning',
        dialogueText: 'Tutto è iniziato tre mesi fa. Era una giornata come le altre.',
        expression: 'neutral',
        audioDescription: 'Narrative, storytelling voice',
      },
      {
        order: 2,
        scenePrompt: 'Character meeting someone, surprised expression',
        dialogueText: 'Poi ho incontrato qualcuno che ha cambiato tutto.',
        expression: 'surprised',
        audioDescription: 'Wonder-filled voice',
      },
      {
        order: 3,
        scenePrompt: 'Character happy, enjoying the moment',
        dialogueText: 'Per un momento, tutto sembrava perfetto.',
        expression: 'happy',
        audioDescription: 'Joyful, content voice',
      },
      {
        order: 4,
        scenePrompt: 'Character with angry expression, conflict moment',
        dialogueText: 'Ma poi è arrivato il momento della verità.',
        expression: 'angry',
        audioDescription: 'Tense, conflicted voice',
      },
      {
        order: 5,
        scenePrompt: 'Character with sad, accepting expression',
        dialogueText: 'Alcune cose non si possono cambiare. Bisogna solo accettarle.',
        expression: 'sad',
        audioDescription: 'Melancholic, accepting voice',
      },
      {
        order: 6,
        scenePrompt: 'Character looking at horizon, hopeful expression',
        dialogueText: 'Ma ogni fine è anche un nuovo inizio.',
        expression: 'confident',
        audioDescription: 'Hopeful, resolute voice',
      },
    ],
  },
];

// Category info
const CATEGORY_INFO: Record<string, { label: string; color: string }> = {
  tutorial: { label: 'Tutorial', color: 'bg-blue-500' },
  promo: { label: 'Promozione', color: 'bg-green-500' },
  narrative: { label: 'Narrativa', color: 'bg-purple-500' },
  educational: { label: 'Educativo', color: 'bg-amber-500' },
  social: { label: 'Social', color: 'bg-pink-500' },
};

interface StoryTemplatesProps {
  onSelectTemplate: (scenes: BatchScene[], suggestedEmotion: string) => void;
}

export function StoryTemplates({ onSelectTemplate }: StoryTemplatesProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<StoryTemplate | null>(null);
  const [customizations, setCustomizations] = useState<Record<number, Partial<BatchScene>>>({});

  // Apply template with customizations
  const handleApplyTemplate = useCallback(() => {
    if (!selectedTemplate) return;

    const scenes: BatchScene[] = selectedTemplate.scenes.map((scene, index) => ({
      id: crypto.randomUUID(),
      ...scene,
      ...customizations[index],
      status: 'pending' as const,
      progress: 0,
    }));

    onSelectTemplate(scenes, selectedTemplate.suggestedMusicEmotion);
    setShowDialog(false);
    setSelectedTemplate(null);
    setCustomizations({});
  }, [selectedTemplate, customizations, onSelectTemplate]);

  // Update scene customization
  const updateCustomization = useCallback((index: number, field: keyof BatchScene, value: string) => {
    setCustomizations(prev => ({
      ...prev,
      [index]: {
        ...prev[index],
        [field]: value,
      },
    }));
  }, []);

  // Get merged scene value
  const getSceneValue = useCallback((index: number, field: keyof BatchScene, defaultValue: string) => {
    return customizations[index]?.[field] as string || defaultValue;
  }, [customizations]);

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <BookOpen className="w-4 h-4 mr-2" />
          Template Storie
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Template di Storie Predefinite
          </DialogTitle>
        </DialogHeader>

        {!selectedTemplate ? (
          // Template Selection
          <ScrollArea className="h-[500px]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-4">
              {STORY_TEMPLATES.map((template) => (
                <Card
                  key={template.id}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => setSelectedTemplate(template)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {template.icon}
                        <CardTitle className="text-base">{template.name}</CardTitle>
                      </div>
                      <Badge 
                        variant="secondary" 
                        className={`text-xs text-white ${CATEGORY_INFO[template.category].color}`}
                      >
                        {CATEGORY_INFO[template.category].label}
                      </Badge>
                    </div>
                    <CardDescription>{template.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{template.scenes.length} scene</span>
                      <span>•</span>
                      <span>~{Math.round(template.estimatedDuration / 60)} min</span>
                      <span>•</span>
                      <span>🎵 {template.suggestedMusicEmotion}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        ) : (
          // Template Customization
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {selectedTemplate.icon}
                <h3 className="font-semibold">{selectedTemplate.name}</h3>
                <Badge variant="secondary">
                  {selectedTemplate.scenes.length} scene
                </Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedTemplate(null)}>
                ← Cambia Template
              </Button>
            </div>

            <ScrollArea className="h-[400px]">
              <div className="space-y-4 pr-4">
                {selectedTemplate.scenes.map((scene, index) => (
                  <Card key={index} className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="outline">Scena {index + 1}</Badge>
                      <Badge variant="secondary">
                        {scene.expression}
                      </Badge>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Descrizione Scena</Label>
                        <Input
                          value={getSceneValue(index, 'scenePrompt', scene.scenePrompt)}
                          onChange={(e) => updateCustomization(index, 'scenePrompt', e.target.value)}
                          placeholder={scene.scenePrompt}
                        />
                      </div>
                      
                      <div className="space-y-1">
                        <Label className="text-xs">Dialogo</Label>
                        <Input
                          value={getSceneValue(index, 'dialogueText', scene.dialogueText)}
                          onChange={(e) => updateCustomization(index, 'dialogueText', e.target.value)}
                          placeholder={scene.dialogueText}
                        />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
                Annulla
              </Button>
              <Button onClick={handleApplyTemplate}>
                <Wand2 className="w-4 h-4 mr-2" />
                Applica Template
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default StoryTemplates;
