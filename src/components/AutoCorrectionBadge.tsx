import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AutoCorrectionBadgeProps {
  originalValue: string | number;
  correctedValue: string | number;
  label: string;
  className?: string;
}

export function AutoCorrectionBadge({
  originalValue,
  correctedValue,
  label,
  className = ""
}: AutoCorrectionBadgeProps) {
  if (originalValue === correctedValue) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={`bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px] gap-1 cursor-help ${className}`}
          >
            <AlertTriangle className="w-3 h-3" />
            Auto-corretto
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-xs font-medium mb-1">{label} adattato</p>
          <p className="text-xs text-muted-foreground">
            Valore richiesto: <span className="line-through">{originalValue}</span>
            <br />
            Valore corretto: <span className="font-medium text-foreground">{correctedValue}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Il modello selezionato non supporta il valore originale.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
