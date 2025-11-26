import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Download, Plus, X, Image as ImageIcon, Type, Clock, ArrowLeftRight, ListOrdered, Grid3x3 } from "lucide-react";
import html2canvas from "html2canvas";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface StoryboardPanel {
  id: string;
  imageUrl: string | null;
  caption: string;
}

type LayoutType = "2x2" | "3x2" | "4x2" | "2x3" | "3x3";

type TemplateType = "custom" | "timeline" | "before-after" | "process" | "comparison";

interface StoryboardTemplate {
  id: TemplateType;
  name: string;
  description: string;
  icon: any;
  layout: LayoutType;
  defaultCaptions: string[];
  title: string;
}

const LAYOUT_CONFIG: Record<LayoutType, { cols: number; rows: number; label: string }> = {
  "2x2": { cols: 2, rows: 2, label: "2x2 (4 pannelli)" },
  "3x2": { cols: 3, rows: 2, label: "3x2 (6 pannelli)" },
  "4x2": { cols: 4, rows: 2, label: "4x2 (8 pannelli)" },
  "2x3": { cols: 2, rows: 3, label: "2x3 (6 pannelli)" },
  "3x3": { cols: 3, rows: 3, label: "3x3 (9 pannelli)" },
};

const TEMPLATES: StoryboardTemplate[] = [
  {
    id: "custom",
    name: "Personalizzato",
    description: "Crea il tuo layout personalizzato da zero",
    icon: Grid3x3,
    layout: "3x2",
    defaultCaptions: [],
    title: "Il Mio Storyboard"
  },
  {
    id: "timeline",
    name: "Sequenza Temporale",
    description: "Perfetto per mostrare l'evoluzione di un progetto nel tempo",
    icon: Clock,
    layout: "4x2",
    defaultCaptions: [
      "Inizio - Fase di concept",
      "Sviluppo iniziale",
      "Prototipo",
      "Test e iterazione",
      "Rifinitura",
      "Versione finale",
      "Lancio",
      "Risultati"
    ],
    title: "Sequenza Temporale del Progetto"
  },
  {
    id: "before-after",
    name: "Prima/Dopo",
    description: "Ideale per confrontare stati iniziali e finali",
    icon: ArrowLeftRight,
    layout: "2x3",
    defaultCaptions: [
      "Prima - Vista frontale",
      "Dopo - Vista frontale",
      "Prima - Dettaglio",
      "Dopo - Dettaglio",
      "Prima - Ambiente",
      "Dopo - Ambiente"
    ],
    title: "Confronto Prima/Dopo"
  },
  {
    id: "process",
    name: "Processo Step-by-Step",
    description: "Mostra i passaggi di un processo o tutorial",
    icon: ListOrdered,
    layout: "3x2",
    defaultCaptions: [
      "Step 1: Preparazione",
      "Step 2: Impostazione",
      "Step 3: Esecuzione",
      "Step 4: Verifica",
      "Step 5: Rifinitura",
      "Step 6: Completamento"
    ],
    title: "Guida Passo-Passo"
  },
  {
    id: "comparison",
    name: "Confronto Multi-Opzione",
    description: "Confronta diverse varianti o opzioni",
    icon: Grid3x3,
    layout: "2x2",
    defaultCaptions: [
      "Opzione A",
      "Opzione B",
      "Opzione C",
      "Opzione D"
    ],
    title: "Confronto Opzioni"
  }
];

export const StoryboardEditor = () => {
  const [layout, setLayout] = useState<LayoutType>("3x2");
  const [title, setTitle] = useState("Il Mio Storyboard");
  const [panels, setPanels] = useState<StoryboardPanel[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>("custom");
  const storyboardRef = useRef<HTMLDivElement>(null);

  const initializePanels = (layoutType: LayoutType, captions: string[] = []) => {
    const config = LAYOUT_CONFIG[layoutType];
    const totalPanels = config.cols * config.rows;
    const newPanels: StoryboardPanel[] = Array.from({ length: totalPanels }, (_, i) => ({
      id: `panel-${i}`,
      imageUrl: null,
      caption: captions[i] || "",
    }));
    setPanels(newPanels);
  };

  const handleTemplateSelect = (templateId: TemplateType) => {
    const template = TEMPLATES.find(t => t.id === templateId);
    if (!template) return;
    
    setSelectedTemplate(templateId);
    setLayout(template.layout);
  };

  const handleCreateStoryboard = () => {
    const template = TEMPLATES.find(t => t.id === selectedTemplate);
    if (!template) return;

    setTitle(template.title);
    initializePanels(template.layout, template.defaultCaptions);
    toast.success(`Storyboard "${template.name}" creato!`);
  };

  const handleLayoutChange = (newLayout: LayoutType) => {
    setLayout(newLayout);
    initializePanels(newLayout);
  };

  const handleImageUpload = (panelId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const imageUrl = e.target?.result as string;
      setPanels(prev => prev.map(panel => 
        panel.id === panelId ? { ...panel, imageUrl } : panel
      ));
    };
    reader.readAsDataURL(file);
  };

  const handleCaptionChange = (panelId: string, caption: string) => {
    setPanels(prev => prev.map(panel => 
      panel.id === panelId ? { ...panel, caption } : panel
    ));
  };

  const handleRemoveImage = (panelId: string) => {
    setPanels(prev => prev.map(panel => 
      panel.id === panelId ? { ...panel, imageUrl: null } : panel
    ));
  };

  const handleExport = async () => {
    if (!storyboardRef.current) return;
    
    setIsExporting(true);
    try {
      const canvas = await html2canvas(storyboardRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: true,
      });

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `${title.replace(/\s+/g, "_")}_storyboard.png`;
          link.click();
          URL.revokeObjectURL(url);
          toast.success("Storyboard esportato con successo!");
        }
      }, "image/png");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Errore durante l'esportazione");
    } finally {
      setIsExporting(false);
    }
  };

  const config = LAYOUT_CONFIG[layout];

  if (panels.length === 0) {
    return (
      <div className="space-y-6">
        <Alert className="border-primary/50 bg-primary/10">
          <ImageIcon className="h-4 w-4 text-primary" />
          <AlertDescription>
            Scegli un template predefinito o crea un layout personalizzato per il tuo storyboard professionale
          </AlertDescription>
        </Alert>

        <Card className="p-6 space-y-6">
          <div className="space-y-3">
            <Label className="text-lg font-semibold">Seleziona Template</Label>
            <RadioGroup value={selectedTemplate} onValueChange={(value) => handleTemplateSelect(value as TemplateType)}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {TEMPLATES.map((template) => {
                  const IconComponent = template.icon;
                  return (
                    <Card 
                      key={template.id}
                      className={`p-4 cursor-pointer transition-all hover:border-primary/50 ${
                        selectedTemplate === template.id ? "border-primary bg-primary/5" : "border-border"
                      }`}
                      onClick={() => handleTemplateSelect(template.id)}
                    >
                      <div className="flex items-start gap-3">
                        <RadioGroupItem value={template.id} id={template.id} className="mt-1" />
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <IconComponent className="h-5 w-5 text-primary" />
                            <Label htmlFor={template.id} className="font-semibold cursor-pointer">
                              {template.name}
                            </Label>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {template.description}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Layout: {LAYOUT_CONFIG[template.layout].label}
                          </p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </RadioGroup>
          </div>

          {selectedTemplate === "custom" && (
            <div className="space-y-2">
              <Label htmlFor="layout">Layout Personalizzato</Label>
              <Select value={layout} onValueChange={(value) => setLayout(value as LayoutType)}>
                <SelectTrigger id="layout" className="bg-background/50 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LAYOUT_CONFIG).map(([key, value]) => (
                    <SelectItem key={key} value={key}>
                      {value.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button 
            onClick={handleCreateStoryboard}
            className="w-full bg-gradient-to-r from-primary to-primary/80"
            size="lg"
          >
            <Plus className="mr-2 h-4 w-4" />
            Crea Storyboard
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex-1 min-w-[200px]">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titolo storyboard..."
            className="bg-background/50 border-border text-lg font-semibold"
          />
        </div>
        
        <div className="flex gap-2">
          <Select value={layout} onValueChange={(value) => handleLayoutChange(value as LayoutType)}>
            <SelectTrigger className="w-[180px] bg-background/50 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(LAYOUT_CONFIG).map(([key, value]) => (
                <SelectItem key={key} value={key}>
                  {value.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button 
            onClick={handleExport}
            disabled={isExporting || panels.every(p => !p.imageUrl)}
            variant="outline"
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Esportazione...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Esporta PNG
              </>
            )}
          </Button>
        </div>
      </div>

      <Card className="p-8 bg-card/50" ref={storyboardRef}>
        <div className="mb-6 text-center">
          <h2 className="text-3xl font-bold text-foreground">{title}</h2>
        </div>

        <div 
          className="grid gap-4"
          style={{
            gridTemplateColumns: `repeat(${config.cols}, 1fr)`,
            gridTemplateRows: `repeat(${config.rows}, 1fr)`,
          }}
        >
          {panels.map((panel, index) => (
            <Card 
              key={panel.id}
              className="relative group overflow-hidden border-border bg-background/30 aspect-video"
            >
              {panel.imageUrl ? (
                <>
                  <img 
                    src={panel.imageUrl} 
                    alt={`Panel ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleRemoveImage(panel.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  {panel.caption && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-2 text-sm">
                      {panel.caption}
                    </div>
                  )}
                </>
              ) : (
                <label className="flex flex-col items-center justify-center h-full cursor-pointer hover:bg-accent/10 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(panel.id, file);
                    }}
                  />
                  <ImageIcon className="h-12 w-12 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">Clicca per caricare</span>
                  <span className="text-xs text-muted-foreground">Pannello {index + 1}</span>
                </label>
              )}
            </Card>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Type className="h-5 w-5 text-primary" />
          Didascalie
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {panels.map((panel, index) => (
            <div key={panel.id} className="space-y-2">
              <Label htmlFor={`caption-${panel.id}`}>
                Pannello {index + 1}
              </Label>
              <Textarea
                id={`caption-${panel.id}`}
                value={panel.caption}
                onChange={(e) => handleCaptionChange(panel.id, e.target.value)}
                placeholder="Aggiungi una didascalia..."
                rows={2}
                className="resize-none bg-background/50 border-border"
                disabled={!panel.imageUrl}
              />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};