import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Sparkles, 
  Volume2, 
  Image as ImageIcon,
  Film,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type GenerationStep = 
  | 'idle'
  | 'preparing'
  | 'uploading_image'
  | 'generating_audio'
  | 'uploading_audio'
  | 'processing'
  | 'rendering'
  | 'completed'
  | 'failed';

interface GenerationStatusIndicatorProps {
  step: GenerationStep;
  progress: number;
  errorMessage?: string;
  estimatedTime?: number; // seconds
  className?: string;
}

const STEP_CONFIG: Record<GenerationStep, {
  label: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}> = {
  idle: {
    label: 'Pronto',
    icon: <Sparkles className="w-4 h-4" />,
    color: 'text-muted-foreground',
    description: 'Configura i parametri e avvia la generazione',
  },
  preparing: {
    label: 'Preparazione',
    icon: <Clock className="w-4 h-4" />,
    color: 'text-yellow-500',
    description: 'Preparazione dei dati in corso...',
  },
  uploading_image: {
    label: 'Upload Immagine',
    icon: <ImageIcon className="w-4 h-4" />,
    color: 'text-blue-500',
    description: 'Caricamento immagine di riferimento...',
  },
  generating_audio: {
    label: 'Generazione Audio',
    icon: <Volume2 className="w-4 h-4" />,
    color: 'text-purple-500',
    description: 'Generazione TTS in corso...',
  },
  uploading_audio: {
    label: 'Upload Audio',
    icon: <Volume2 className="w-4 h-4" />,
    color: 'text-blue-500',
    description: 'Caricamento traccia audio...',
  },
  processing: {
    label: 'Elaborazione',
    icon: <Zap className="w-4 h-4" />,
    color: 'text-orange-500',
    description: 'Il modello Ovi sta elaborando il video...',
  },
  rendering: {
    label: 'Rendering',
    icon: <Film className="w-4 h-4" />,
    color: 'text-cyan-500',
    description: 'Rendering finale del video...',
  },
  completed: {
    label: 'Completato',
    icon: <CheckCircle2 className="w-4 h-4" />,
    color: 'text-green-500',
    description: 'Video generato con successo!',
  },
  failed: {
    label: 'Errore',
    icon: <XCircle className="w-4 h-4" />,
    color: 'text-destructive',
    description: 'Generazione fallita',
  },
};

const STEPS_ORDER: GenerationStep[] = [
  'preparing',
  'uploading_image',
  'generating_audio',
  'processing',
  'rendering',
  'completed',
];

export function GenerationStatusIndicator({
  step,
  progress,
  errorMessage,
  estimatedTime,
  className,
}: GenerationStatusIndicatorProps) {
  const config = STEP_CONFIG[step];
  const isActive = step !== 'idle' && step !== 'completed' && step !== 'failed';
  const currentStepIndex = STEPS_ORDER.indexOf(step);

  return (
    <div className={cn('space-y-3', className)}>
      {/* Main Status Badge */}
      <div className="flex items-center justify-between">
        <Badge 
          variant={step === 'failed' ? 'destructive' : step === 'completed' ? 'default' : 'secondary'}
          className={cn('flex items-center gap-1.5', config.color)}
        >
          {isActive ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            config.icon
          )}
          {config.label}
        </Badge>
        
        {estimatedTime && isActive && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            ~{Math.ceil(estimatedTime / 60)} min
          </span>
        )}
      </div>

      {/* Progress Bar */}
      {isActive && (
        <div className="space-y-1">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground text-center">
            {config.description} ({Math.round(progress)}%)
          </p>
        </div>
      )}

      {/* Step Indicators */}
      {isActive && (
        <div className="flex items-center justify-between gap-1 px-2">
          {STEPS_ORDER.map((s, index) => {
            const stepConfig = STEP_CONFIG[s];
            const isCompleted = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const isPending = index > currentStepIndex;
            
            return (
              <div 
                key={s} 
                className="flex flex-col items-center gap-1 flex-1"
              >
                <div 
                  className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center transition-all',
                    isCompleted && 'bg-green-500/20 text-green-500',
                    isCurrent && 'bg-primary/20 text-primary ring-2 ring-primary/50',
                    isPending && 'bg-muted text-muted-foreground'
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : isCurrent ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <span className="text-[10px]">{index + 1}</span>
                  )}
                </div>
                <span className={cn(
                  'text-[9px] text-center leading-tight',
                  isCurrent && 'text-primary font-medium',
                  isPending && 'text-muted-foreground'
                )}>
                  {stepConfig.label.split(' ')[0]}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Error Message */}
      {step === 'failed' && errorMessage && (
        <div className="p-2 rounded-md bg-destructive/10 border border-destructive/20">
          <p className="text-xs text-destructive">{errorMessage}</p>
        </div>
      )}

      {/* Completed Status */}
      {step === 'completed' && (
        <div className="p-2 rounded-md bg-green-500/10 border border-green-500/20 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <p className="text-xs text-green-600 dark:text-green-400">
            Video generato con successo! Pronto per il download.
          </p>
        </div>
      )}
    </div>
  );
}

export default GenerationStatusIndicator;
