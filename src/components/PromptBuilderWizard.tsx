import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Camera, 
  Layout, 
  Volume2, 
  Film, 
  Wand2, 
  ChevronLeft, 
  ChevronRight,
  Check,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PromptBuilderWizardProps {
  onPromptGenerated: (prompt: string) => void;
  trigger?: React.ReactNode;
}

interface WizardStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

interface OptionItem {
  id: string;
  label: string;
  description: string;
  promptText: string;
}

const STEPS: WizardStep[] = [
  { id: 'content', title: 'Contenuto', description: 'Cosa vuoi mostrare nel video?', icon: <Film className="h-5 w-5" /> },
  { id: 'camera', title: 'Camera', description: 'Come si muove la camera?', icon: <Camera className="h-5 w-5" /> },
  { id: 'composition', title: 'Composizione', description: 'Quale inquadratura?', icon: <Layout className="h-5 w-5" /> },
  { id: 'audio', title: 'Audio', description: 'Che tipo di suono?', icon: <Volume2 className="h-5 w-5" /> },
];

const CAMERA_OPTIONS: OptionItem[] = [
  { id: 'static', label: 'Statica', description: 'Camera fissa senza movimento', promptText: 'Static camera, no movement' },
  { id: 'pan-left', label: 'Pan Sinistra', description: 'Movimento orizzontale verso sinistra', promptText: 'Camera panning slowly to the left' },
  { id: 'pan-right', label: 'Pan Destra', description: 'Movimento orizzontale verso destra', promptText: 'Camera panning slowly to the right' },
  { id: 'tilt-up', label: 'Tilt Su', description: 'Movimento verticale verso l\'alto', promptText: 'Camera tilting upward' },
  { id: 'tilt-down', label: 'Tilt Giù', description: 'Movimento verticale verso il basso', promptText: 'Camera tilting downward' },
  { id: 'zoom-in', label: 'Zoom In', description: 'Avvicinamento al soggetto', promptText: 'Camera slowly zooming in' },
  { id: 'zoom-out', label: 'Zoom Out', description: 'Allontanamento dal soggetto', promptText: 'Camera slowly zooming out' },
  { id: 'dolly', label: 'Dolly', description: 'Camera che si muove nello spazio', promptText: 'Smooth dolly movement through the scene' },
  { id: 'crane', label: 'Crane', description: 'Movimento dall\'alto verso il basso', promptText: 'Crane shot descending from above' },
  { id: 'orbit', label: 'Orbita', description: 'Rotazione attorno al soggetto', promptText: 'Camera orbiting around the subject' },
  { id: 'handheld', label: 'Handheld', description: 'Movimento naturale da mano', promptText: 'Handheld camera with natural subtle movement' },
  { id: 'tracking', label: 'Tracking', description: 'Segue il soggetto in movimento', promptText: 'Camera tracking the subject movement' },
];

const COMPOSITION_OPTIONS: OptionItem[] = [
  { id: 'extreme-close', label: 'Primissimo Piano', description: 'Dettaglio ravvicinato', promptText: 'Extreme close-up shot showing intricate details' },
  { id: 'close', label: 'Primo Piano', description: 'Volto o dettaglio principale', promptText: 'Close-up shot of the main subject' },
  { id: 'medium-close', label: 'Mezzo Primo Piano', description: 'Dalla vita in su', promptText: 'Medium close-up shot from chest up' },
  { id: 'medium', label: 'Piano Medio', description: 'Figura intera dalla vita', promptText: 'Medium shot showing the subject from waist up' },
  { id: 'medium-long', label: 'Piano Americano', description: 'Dalle ginocchia in su', promptText: 'Medium long shot from knees up' },
  { id: 'full', label: 'Figura Intera', description: 'Soggetto completo', promptText: 'Full shot showing the complete subject' },
  { id: 'wide', label: 'Campo Lungo', description: 'Ambiente ampio', promptText: 'Wide shot showing the environment' },
  { id: 'extreme-wide', label: 'Campo Lunghissimo', description: 'Vista panoramica', promptText: 'Extreme wide shot establishing the full scene' },
  { id: 'over-shoulder', label: 'Spalla', description: 'Vista da dietro le spalle', promptText: 'Over-the-shoulder shot' },
  { id: 'pov', label: 'Soggettiva', description: 'Punto di vista del soggetto', promptText: 'Point of view shot from the subject perspective' },
  { id: 'aerial', label: 'Aerea', description: 'Vista dall\'alto come drone', promptText: 'Aerial drone shot looking down' },
  { id: 'low-angle', label: 'Dal Basso', description: 'Camera verso l\'alto', promptText: 'Low angle shot looking up at the subject' },
];

const AUDIO_OPTIONS: OptionItem[] = [
  { id: 'none', label: 'Nessuno', description: 'Senza audio specifico', promptText: '' },
  { id: 'ambient', label: 'Ambientale', description: 'Suoni naturali dell\'ambiente', promptText: 'with natural ambient sounds' },
  { id: 'cinematic', label: 'Cinematico', description: 'Musica epica e drammatica', promptText: 'with cinematic orchestral music' },
  { id: 'upbeat', label: 'Energico', description: 'Musica vivace e positiva', promptText: 'with upbeat energetic music' },
  { id: 'calm', label: 'Calmo', description: 'Musica rilassante', promptText: 'with calm relaxing background music' },
  { id: 'dramatic', label: 'Drammatico', description: 'Tensione e suspense', promptText: 'with dramatic tense music' },
  { id: 'electronic', label: 'Elettronico', description: 'Beat e synth moderni', promptText: 'with modern electronic beats' },
  { id: 'acoustic', label: 'Acustico', description: 'Strumenti naturali', promptText: 'with acoustic instrumental music' },
  { id: 'nature', label: 'Natura', description: 'Suoni della natura', promptText: 'with nature sounds like birds and wind' },
  { id: 'urban', label: 'Urbano', description: 'Suoni della città', promptText: 'with urban city ambience' },
];

export function PromptBuilderWizard({ onPromptGenerated, trigger }: PromptBuilderWizardProps) {
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [contentDescription, setContentDescription] = useState("");
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [selectedComposition, setSelectedComposition] = useState<string | null>(null);
  const [selectedAudio, setSelectedAudio] = useState<string | null>(null);

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleReset = () => {
    setCurrentStep(0);
    setContentDescription("");
    setSelectedCamera(null);
    setSelectedComposition(null);
    setSelectedAudio(null);
  };

  const generatePrompt = () => {
    const parts: string[] = [];

    // Camera movement
    const camera = CAMERA_OPTIONS.find(c => c.id === selectedCamera);
    if (camera && camera.promptText) {
      parts.push(camera.promptText);
    }

    // Composition
    const composition = COMPOSITION_OPTIONS.find(c => c.id === selectedComposition);
    if (composition && composition.promptText) {
      parts.push(composition.promptText);
    }

    // Main content
    if (contentDescription.trim()) {
      parts.push(contentDescription.trim());
    }

    // Audio
    const audio = AUDIO_OPTIONS.find(a => a.id === selectedAudio);
    if (audio && audio.promptText) {
      parts.push(audio.promptText);
    }

    return parts.join(', ');
  };

  const handleGenerate = () => {
    const prompt = generatePrompt();
    onPromptGenerated(prompt);
    setOpen(false);
    handleReset();
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: return contentDescription.trim().length > 0;
      case 1: return selectedCamera !== null;
      case 2: return selectedComposition !== null;
      case 3: return selectedAudio !== null;
      default: return false;
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <Label htmlFor="content">Descrivi il contenuto del video</Label>
            <Textarea
              id="content"
              placeholder="Es: Una donna elegante cammina in un giardino fiorito al tramonto..."
              value={contentDescription}
              onChange={(e) => setContentDescription(e.target.value)}
              className="min-h-[120px]"
            />
            <p className="text-sm text-muted-foreground">
              Descrivi la scena, i soggetti, l'ambientazione e l'azione principale.
            </p>
          </div>
        );
      
      case 1:
        return (
          <div className="space-y-4">
            <Label>Seleziona il movimento della camera</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
              {CAMERA_OPTIONS.map((option) => (
                <Card
                  key={option.id}
                  className={cn(
                    "cursor-pointer transition-all hover:border-primary/50",
                    selectedCamera === option.id && "border-primary bg-primary/5"
                  )}
                  onClick={() => setSelectedCamera(option.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{option.label}</p>
                        <p className="text-xs text-muted-foreground">{option.description}</p>
                      </div>
                      {selectedCamera === option.id && (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      
      case 2:
        return (
          <div className="space-y-4">
            <Label>Seleziona la composizione dell'inquadratura</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
              {COMPOSITION_OPTIONS.map((option) => (
                <Card
                  key={option.id}
                  className={cn(
                    "cursor-pointer transition-all hover:border-primary/50",
                    selectedComposition === option.id && "border-primary bg-primary/5"
                  )}
                  onClick={() => setSelectedComposition(option.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{option.label}</p>
                        <p className="text-xs text-muted-foreground">{option.description}</p>
                      </div>
                      {selectedComposition === option.id && (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      
      case 3:
        return (
          <div className="space-y-4">
            <Label>Seleziona il tipo di audio</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
              {AUDIO_OPTIONS.map((option) => (
                <Card
                  key={option.id}
                  className={cn(
                    "cursor-pointer transition-all hover:border-primary/50",
                    selectedAudio === option.id && "border-primary bg-primary/5"
                  )}
                  onClick={() => setSelectedAudio(option.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{option.label}</p>
                        <p className="text-xs text-muted-foreground">{option.description}</p>
                      </div>
                      {selectedAudio === option.id && (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  const previewPrompt = generatePrompt();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Wand2 className="h-4 w-4" />
            Wizard Prompt
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Costruttore Prompt Guidato
          </DialogTitle>
          <DialogDescription>
            Segui i passaggi per costruire un prompt ottimizzato per la generazione video
          </DialogDescription>
        </DialogHeader>

        {/* Progress */}
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between">
            {STEPS.map((step, index) => (
              <div
                key={step.id}
                className={cn(
                  "flex items-center gap-1.5 text-xs",
                  index === currentStep ? "text-primary font-medium" : 
                  index < currentStep ? "text-primary/70" : "text-muted-foreground"
                )}
              >
                {index < currentStep ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  step.icon
                )}
                <span className="hidden sm:inline">{step.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto py-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                {STEPS[currentStep].icon}
                {STEPS[currentStep].title}
              </CardTitle>
              <CardDescription>{STEPS[currentStep].description}</CardDescription>
            </CardHeader>
            <CardContent>
              {renderStepContent()}
            </CardContent>
          </Card>
        </div>

        {/* Preview */}
        {previewPrompt && (
          <div className="bg-muted/50 rounded-lg p-3 border">
            <Label className="text-xs text-muted-foreground">Anteprima Prompt</Label>
            <p className="text-sm mt-1 line-clamp-2">{previewPrompt}</p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-2 border-t">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Indietro
          </Button>

          <div className="flex gap-2">
            <Button variant="ghost" onClick={handleReset}>
              Resetta
            </Button>
            
            {currentStep === STEPS.length - 1 ? (
              <Button onClick={handleGenerate} disabled={!canProceed()}>
                <Sparkles className="h-4 w-4 mr-1" />
                Genera Prompt
              </Button>
            ) : (
              <Button onClick={handleNext} disabled={!canProceed()}>
                Avanti
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
