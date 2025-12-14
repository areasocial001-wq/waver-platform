import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, Loader2, ImagePlus } from "lucide-react";
import { useImageGallery } from "@/contexts/ImageGalleryContext";

interface MysticGeneratorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImageGenerated: (imageUrl: string) => void;
  panelIndex: number;
}

export const MysticGeneratorDialog = ({
  isOpen,
  onClose,
  onImageGenerated,
  panelIndex,
}: MysticGeneratorDialogProps) => {
  const { addImage } = useImageGallery();
  const [prompt, setPrompt] = useState("");
  const [resolution, setResolution] = useState("1k");
  const [aspectRatio, setAspectRatio] = useState("square_1_1");
  const [model, setModel] = useState("realism");
  const [saveToGallery, setSaveToGallery] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!taskId) return;

    const pollStatus = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("freepik-image", {
          body: { action: "status", taskId },
        });

        if (error) throw error;

        if (data?.data?.status === "COMPLETED" && data?.data?.generated?.[0]?.url) {
          const imageUrl = data.data.generated[0].url;
          onImageGenerated(imageUrl);
          
          // Save to gallery if enabled
          if (saveToGallery) {
            addImage({ url: imageUrl, prompt, aspectRatio, model: `freepik-mystic-${model}` });
            toast.success(`Immagine Mystic generata e salvata in galleria!`);
          } else {
            toast.success(`Immagine Mystic generata per il Pannello ${panelIndex + 1}!`);
          }
          
          setTaskId(null);
          setIsLoading(false);
          setProgress(100);
          onClose();
          resetForm();
        } else if (data?.data?.status === "FAILED") {
          setTaskId(null);
          setIsLoading(false);
          toast.error("Generazione fallita");
        } else {
          setProgress((prev) => Math.min(prev + 5, 90));
        }
      } catch (err: any) {
        console.error("Poll error:", err);
      }
    };

    const interval = setInterval(pollStatus, 3000);
    return () => clearInterval(interval);
  }, [taskId, panelIndex, onImageGenerated, onClose, saveToGallery, prompt, aspectRatio, model, addImage]);

  const resetForm = () => {
    setPrompt("");
    setProgress(0);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Inserisci una descrizione");
      return;
    }

    setIsLoading(true);
    setProgress(10);

    try {
      const { data, error } = await supabase.functions.invoke("freepik-image", {
        body: { prompt, resolution, aspectRatio, model, engine: "automatic" },
      });

      if (error) throw error;

      if (data?.data?.task_id) {
        setTaskId(data.data.task_id);
        toast.info("Generazione Mystic avviata...");
      } else if (data?.data?.generated?.[0]?.url) {
        const imageUrl = data.data.generated[0].url;
        onImageGenerated(imageUrl);
        
        // Save to gallery if enabled
        if (saveToGallery) {
          addImage({ url: imageUrl, prompt, aspectRatio, model: `freepik-mystic-${model}` });
          toast.success(`Immagine generata e salvata in galleria!`);
        } else {
          toast.success(`Immagine generata per il Pannello ${panelIndex + 1}!`);
        }
        
        onClose();
        resetForm();
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error("Generate error:", err);
      toast.error(err.message || "Errore generazione");
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            Genera Immagine Mystic - Pannello {panelIndex + 1}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Descrizione</Label>
            <Textarea
              placeholder="Descrivi l'immagine che vuoi creare..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              disabled={isLoading}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Risoluzione</Label>
              <Select value={resolution} onValueChange={setResolution} disabled={isLoading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1k">1K</SelectItem>
                  <SelectItem value="2k">2K</SelectItem>
                  <SelectItem value="4k">4K</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Aspect Ratio</Label>
              <Select value={aspectRatio} onValueChange={setAspectRatio} disabled={isLoading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="square_1_1">1:1</SelectItem>
                  <SelectItem value="widescreen_16_9">16:9</SelectItem>
                  <SelectItem value="portrait_9_16">9:16</SelectItem>
                  <SelectItem value="classic_4_3">4:3</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Stile</Label>
            <Select value={model} onValueChange={setModel} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="realism">Realism</SelectItem>
                <SelectItem value="super_real">Super Real</SelectItem>
                <SelectItem value="editorial_portraits">Editorial</SelectItem>
                <SelectItem value="fluid">Fluid</SelectItem>
                <SelectItem value="zen">Zen</SelectItem>
                <SelectItem value="flexible">Flexible</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading && <Progress value={progress} className="h-2" />}

          <div className="flex items-center justify-between py-2 px-1 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-2">
              <ImagePlus className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="saveToGallery" className="text-sm cursor-pointer">
                Salva anche in galleria
              </Label>
            </div>
            <Switch
              id="saveToGallery"
              checked={saveToGallery}
              onCheckedChange={setSaveToGallery}
              disabled={isLoading}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={isLoading} className="flex-1">
              Annulla
            </Button>
            <Button onClick={handleGenerate} disabled={isLoading || !prompt.trim()} className="flex-1">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Genera
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
