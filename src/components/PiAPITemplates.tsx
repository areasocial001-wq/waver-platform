import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Upload, X, Wand2, UserRoundX, Shirt, Heart, Sparkles, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type TemplateType = "clean-upscale" | "faceswap" | "effects" | "virtual-tryon" | "ai-hug";

interface TemplateConfig {
  id: TemplateType;
  name: string;
  description: string;
  icon: React.ReactNode;
  requiresTargetImage: boolean;
  options?: { value: string; label: string }[];
}

const TEMPLATES: TemplateConfig[] = [
  {
    id: "clean-upscale",
    name: "Clean & Upscale",
    description: "Migliora la qualità e risoluzione delle immagini",
    icon: <Sparkles className="w-5 h-5" />,
    requiresTargetImage: false,
    options: [
      { value: "2x", label: "2x Upscale" },
      { value: "4x", label: "4x Upscale" },
    ],
  },
  {
    id: "faceswap",
    name: "Faceswap",
    description: "Scambia il volto tra due immagini",
    icon: <UserRoundX className="w-5 h-5" />,
    requiresTargetImage: true,
  },
  {
    id: "effects",
    name: "Effects",
    description: "Applica effetti speciali alle immagini",
    icon: <Wand2 className="w-5 h-5" />,
    requiresTargetImage: false,
    options: [
      { value: "cartoon", label: "Cartoon" },
      { value: "sketch", label: "Sketch" },
      { value: "painting", label: "Painting" },
      { value: "anime", label: "Anime" },
    ],
  },
  {
    id: "virtual-tryon",
    name: "Virtual Try-on",
    description: "Prova virtualmente vestiti e accessori",
    icon: <Shirt className="w-5 h-5" />,
    requiresTargetImage: true,
  },
  {
    id: "ai-hug",
    name: "AI Hug",
    description: "Crea un abbraccio virtuale tra due persone",
    icon: <Heart className="w-5 h-5" />,
    requiresTargetImage: true,
  },
];

export function PiAPITemplates() {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>("clean-upscale");
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [targetImage, setTargetImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const targetInputRef = useRef<HTMLInputElement>(null);

  const currentTemplate = TEMPLATES.find(t => t.id === selectedTemplate)!;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: "source" | "target") => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        if (type === "source") {
          setSourceImage(base64);
        } else {
          setTargetImage(base64);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = (type: "source" | "target") => {
    if (type === "source") {
      setSourceImage(null);
    } else {
      setTargetImage(null);
    }
    setResultImage(null);
  };

  const pollTaskStatus = async (taskId: string): Promise<string | null> => {
    const maxAttempts = 60;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const { data, error } = await supabase.functions.invoke('piapi-templates', {
        body: { action: "status", taskId }
      });
      
      if (error) throw error;
      
      if (data.status === "completed") {
        return data.resultUrl;
      } else if (data.status === "failed") {
        throw new Error(data.error || "Processing failed");
      }
      
      attempts++;
    }
    
    throw new Error("Timeout: processing took too long");
  };

  const handleProcess = async () => {
    if (!sourceImage) {
      toast.error("Carica un'immagine sorgente");
      return;
    }

    if (currentTemplate.requiresTargetImage && !targetImage) {
      toast.error("Carica un'immagine target");
      return;
    }

    setIsProcessing(true);
    setResultImage(null);

    try {
      const requestBody: any = {
        template: selectedTemplate,
        image: sourceImage,
      };

      if (targetImage) {
        requestBody.targetImage = targetImage;
      }

      if (selectedOption) {
        if (selectedTemplate === "clean-upscale") {
          requestBody.upscaleFactor = selectedOption;
        } else if (selectedTemplate === "effects") {
          requestBody.effectType = selectedOption;
        }
      }

      const { data, error } = await supabase.functions.invoke('piapi-templates', {
        body: requestBody
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setTaskId(data.taskId);
      toast.info("Elaborazione in corso...");

      const resultUrl = await pollTaskStatus(data.taskId);
      
      if (resultUrl) {
        setResultImage(resultUrl);
        toast.success("Elaborazione completata!");
      }
    } catch (error: any) {
      console.error("Template processing error:", error);
      toast.error(error.message || "Errore durante l'elaborazione");
    } finally {
      setIsProcessing(false);
      setTaskId(null);
    }
  };

  const handleDownload = () => {
    if (!resultImage) return;
    
    const link = document.createElement('a');
    link.href = resultImage;
    link.download = `piapi-${selectedTemplate}-result.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Immagine scaricata!");
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="w-5 h-5" />
          PIAPI Templates
        </CardTitle>
        <CardDescription>
          Funzionalità avanzate di elaborazione immagini via PIAPI
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Template Selection */}
        <Tabs value={selectedTemplate} onValueChange={(v) => {
          setSelectedTemplate(v as TemplateType);
          setResultImage(null);
          setSelectedOption("");
        }}>
          <TabsList className="grid grid-cols-5 w-full">
            {TEMPLATES.map((template) => (
              <TabsTrigger key={template.id} value={template.id} className="flex items-center gap-1 text-xs">
                {template.icon}
                <span className="hidden md:inline">{template.name}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {TEMPLATES.map((template) => (
            <TabsContent key={template.id} value={template.id} className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">{template.description}</p>

              {/* Options if available */}
              {template.options && (
                <div className="space-y-2">
                  <Label>Opzioni</Label>
                  <Select value={selectedOption} onValueChange={setSelectedOption}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona opzione" />
                    </SelectTrigger>
                    <SelectContent>
                      {template.options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Image Upload Areas */}
              <div className={`grid gap-4 ${template.requiresTargetImage ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
                {/* Source Image */}
                <div className="space-y-2">
                  <Label>{template.requiresTargetImage ? "Immagine Sorgente" : "Immagine"}</Label>
                  {!sourceImage ? (
                    <div
                      className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => sourceInputRef.current?.click()}
                    >
                      <input
                        ref={sourceInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, "source")}
                        className="hidden"
                      />
                      <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Carica immagine</p>
                    </div>
                  ) : (
                    <div className="relative">
                      <img
                        src={sourceImage}
                        alt="Source"
                        className="w-full h-48 object-cover rounded-lg"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6"
                        onClick={() => removeImage("source")}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Target Image (if required) */}
                {template.requiresTargetImage && (
                  <div className="space-y-2">
                    <Label>
                      {template.id === "faceswap" && "Immagine con volto target"}
                      {template.id === "virtual-tryon" && "Immagine vestito/accessorio"}
                      {template.id === "ai-hug" && "Seconda persona"}
                    </Label>
                    {!targetImage ? (
                      <div
                        className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                        onClick={() => targetInputRef.current?.click()}
                      >
                        <input
                          ref={targetInputRef}
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageUpload(e, "target")}
                          className="hidden"
                        />
                        <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Carica immagine</p>
                      </div>
                    ) : (
                      <div className="relative">
                        <img
                          src={targetImage}
                          alt="Target"
                          className="w-full h-48 object-cover rounded-lg"
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-6 w-6"
                          onClick={() => removeImage("target")}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Result Image */}
              {resultImage && (
                <div className="space-y-2">
                  <Label>Risultato</Label>
                  <div className="relative">
                    <img
                      src={resultImage}
                      alt="Result"
                      className="w-full max-h-96 object-contain rounded-lg border border-border"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      className="absolute bottom-2 right-2"
                      onClick={handleDownload}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Scarica
                    </Button>
                  </div>
                </div>
              )}

              {/* Process Button */}
              <Button
                onClick={handleProcess}
                disabled={isProcessing || !sourceImage || (template.requiresTargetImage && !targetImage)}
                className="w-full"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Elaborazione...
                  </>
                ) : (
                  <>
                    {template.icon}
                    <span className="ml-2">Elabora con {template.name}</span>
                  </>
                )}
              </Button>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
