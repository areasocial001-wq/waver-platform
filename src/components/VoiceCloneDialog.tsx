import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Mic } from "lucide-react";
import { useState } from "react";

interface VoiceCloneDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialAudioFile?: File | null;
  initialAudioUrl?: string | null;
}

/**
 * Voice cloning is being rebuilt on top of Inworld IVC. The previous
 * ElevenLabs-based flow has been removed along with the `cloned_voices`
 * table, so this dialog currently shows a "coming soon" placeholder.
 */
export const VoiceCloneDialog = ({
  trigger,
  open,
  onOpenChange,
}: VoiceCloneDialogProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const controlledOpen = open !== undefined ? open : internalOpen;
  const setControlledOpen = onOpenChange || setInternalOpen;

  const dialogContent = (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Mic className="w-5 h-5 text-primary" />
          Clonazione Voce
        </DialogTitle>
        <DialogDescription>
          Stiamo migrando la clonazione vocale su Inworld IVC.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-2 text-sm text-muted-foreground">
        <p>
          La precedente integrazione ElevenLabs è stata rimossa. La nuova
          esperienza basata su Inworld arriverà presto e supporterà la
          clonazione istantanea con qualità superiore.
        </p>
        <p>
          Nel frattempo puoi usare le voci preconfezionate dal selettore voce
          nelle pagine di Story Mode, Talking Avatar e Generator.
        </p>
        <Button className="w-full" onClick={() => setControlledOpen(false)}>
          Chiudi
        </Button>
      </div>
    </DialogContent>
  );

  if (trigger) {
    return (
      <Dialog open={controlledOpen} onOpenChange={setControlledOpen}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        {dialogContent}
      </Dialog>
    );
  }

  return (
    <Dialog open={controlledOpen} onOpenChange={setControlledOpen}>
      {dialogContent}
    </Dialog>
  );
};
