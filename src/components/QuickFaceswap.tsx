import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Upload, X, UserRoundX, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function QuickFaceswap() {
  const [open, setOpen] = useState(false);
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [targetImage, setTargetImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const sourceRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<HTMLInputElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>, type: "source" | "target") => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (type === "source") setSourceImage(reader.result as string);
      else setTargetImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const pollStatus = async (taskId: string): Promise<string | null> => {
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const { data, error } = await supabase.functions.invoke('piapi-templates', {
        body: { action: "status", taskId }
      });
      if (error) throw error;
      if (data.status === "completed") return data.resultUrl;
      if (data.status === "failed") throw new Error(data.error || "Elaborazione fallita");
    }
    throw new Error("Timeout");
  };

  const handleProcess = async () => {
    if (!sourceImage || !targetImage) {
      toast.error("Carica entrambe le immagini");
      return;
    }
    setIsProcessing(true);
    setResultImage(null);
    try {
      const { data, error } = await supabase.functions.invoke('piapi-templates', {
        body: { template: "faceswap", image: sourceImage, targetImage }
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      toast.info("Faceswap in corso...");
      const url = await pollStatus(data.taskId);
      if (url) {
        setResultImage(url);
        toast.success("Faceswap completato!");
      }
    } catch (err: any) {
      toast.error(err.message || "Errore faceswap");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!resultImage) return;
    const a = document.createElement('a');
    a.href = resultImage;
    a.download = `faceswap-result.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const reset = () => {
    setSourceImage(null);
    setTargetImage(null);
    setResultImage(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserRoundX className="w-4 h-4 mr-2" />
          Faceswap
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRoundX className="w-5 h-5" />
            Faceswap Rapido
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          {/* Source */}
          <div className="space-y-2">
            <Label>Volto sorgente</Label>
            <input ref={sourceRef} type="file" accept="image/*" onChange={(e) => handleUpload(e, "source")} className="hidden" />
            {!sourceImage ? (
              <div
                className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => sourceRef.current?.click()}
              >
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Carica immagine</p>
              </div>
            ) : (
              <div className="relative">
                <img src={sourceImage} alt="Source" className="w-full h-40 object-cover rounded-lg" />
                <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => setSourceImage(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Target */}
          <div className="space-y-2">
            <Label>Immagine target</Label>
            <input ref={targetRef} type="file" accept="image/*" onChange={(e) => handleUpload(e, "target")} className="hidden" />
            {!targetImage ? (
              <div
                className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => targetRef.current?.click()}
              >
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Carica immagine</p>
              </div>
            ) : (
              <div className="relative">
                <img src={targetImage} alt="Target" className="w-full h-40 object-cover rounded-lg" />
                <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => setTargetImage(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Result */}
        {resultImage && (
          <div className="space-y-2">
            <Label>Risultato</Label>
            <div className="relative">
              <img src={resultImage} alt="Result" className="w-full max-h-80 object-contain rounded-lg border border-border" />
              <Button variant="secondary" size="sm" className="absolute bottom-2 right-2" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-1" /> Scarica
              </Button>
            </div>
          </div>
        )}

        <Button onClick={handleProcess} disabled={isProcessing || !sourceImage || !targetImage} className="w-full">
          {isProcessing ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Elaborazione...</>
          ) : (
            <><UserRoundX className="w-4 h-4 mr-2" />Esegui Faceswap</>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
