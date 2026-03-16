import { useState, useRef, DragEvent, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Download, Plus, X, Image as ImageIcon, Type, Clock, ArrowLeftRight, ListOrdered, Grid3x3, Images, GripVertical, Save, Tag as TagIcon, FileText, Lock, Unlock, Library, Undo2, Redo2, Workflow, Wand2, Sparkles, Users } from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { useImageGallery } from "@/contexts/ImageGalleryContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import { SortablePanel, ImageTransform } from "./SortablePanel";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { StoryboardToVideoDialog } from "./StoryboardToVideoDialog";
import { StockLibraryDialog } from "./StockLibraryDialog";
import { MysticGeneratorDialog } from "./MysticGeneratorDialog";
import { useStoryboardHistory } from "@/hooks/useStoryboardHistory";
import { usePromptTemplates } from "@/hooks/usePromptTemplates";
import { WorkflowView } from "./WorkflowView";
import { AIPromptAssistant, PromptTemplate } from "./AIPromptAssistant";
import { MultiModelGenerator } from "./MultiModelGenerator";
import { VideoComparisonReport } from "./VideoComparisonReport";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CharacterLockPanel } from "./CharacterLockPanel";
import { useStoryboardCharacters } from "@/hooks/useStoryboardCharacters";

interface StoryboardPanel {
  id: string;
  imageUrl: string | null;
  caption: string;
  note?: string;
  transform?: ImageTransform;
  characterIds?: string[];
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
  const [searchParams] = useSearchParams();
  const [layout, setLayout] = useState<LayoutType>("3x2");
  const [title, setTitle] = useState("Il Mio Storyboard");
  const {
    state: panels,
    set: setPanels,
    undo,
    redo,
    reset: resetPanels,
    canUndo,
    canRedo,
  } = useStoryboardHistory<StoryboardPanel[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>("custom");
  const [draggedImageUrl, setDraggedImageUrl] = useState<string | null>(null);
  const [showGallery, setShowGallery] = useState(true);
  const [currentStoryboardId, setCurrentStoryboardId] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [sharePassword, setSharePassword] = useState("");
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [mysticDialogOpen, setMysticDialogOpen] = useState(false);
  const [mysticTargetPanelId, setMysticTargetPanelId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'workflow'>('grid');
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [aiAssistantPanelId, setAiAssistantPanelId] = useState<string | null>(null);
  const [aiAssistantImageUrl, setAiAssistantImageUrl] = useState<string | null>(null);
  const [isOptimizingPrompt, setIsOptimizingPrompt] = useState<string | null>(null);
  const [multiModelOpen, setMultiModelOpen] = useState(false);
  const [multiModelImageUrl, setMultiModelImageUrl] = useState<string | null>(null);
  const [multiModelCaption, setMultiModelCaption] = useState<string>('');
  const [optimizedPrompt, setOptimizedPrompt] = useState<string>('');
  const [comparisonReportOpen, setComparisonReportOpen] = useState(false);
  const [comparisonResults, setComparisonResults] = useState<any[]>([]);
  const storyboardRef = useRef<HTMLDivElement>(null);
  const { images } = useImageGallery();
  const { templates: savedTemplates, saveTemplate, deleteTemplate, updateTemplate } = usePromptTemplates();
  const {
    characters,
    addCharacter,
    updateCharacter: updateCharacterData,
    deleteCharacter,
    addReferenceImage,
    removeReferenceImage,
    getCharacterRefsForPanel,
  } = useStoryboardCharacters(currentStoryboardId);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        if (canRedo) redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo, undo, redo]);

  useEffect(() => {
    const storyboardId = searchParams.get('storyboardId');
    if (storyboardId) {
      loadStoryboard(storyboardId);
    }
  }, [searchParams]);

  const loadStoryboard = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('storyboards')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast.error("Storyboard non trovato");
        return;
      }

      setCurrentStoryboardId(data.id);
      setTitle(data.title);
      setLayout(data.layout as LayoutType);
      setSelectedTemplate(data.template_type as TemplateType);
      resetPanels((data.panels as unknown as StoryboardPanel[]) || []);
      setTags((data.tags as string[]) || []);
      setIsPasswordProtected(!!data.share_password);
      setSharePassword(data.share_password || "");
      toast.success("Storyboard caricato!");
    } catch (error: any) {
      console.error("Error loading storyboard:", error);
      toast.error("Errore nel caricamento");
    }
  };

  const initializePanels = (layoutType: LayoutType, captions: string[] = []) => {
    const config = LAYOUT_CONFIG[layoutType];
    const totalPanels = config.cols * config.rows;
    const newPanels: StoryboardPanel[] = Array.from({ length: totalPanels }, (_, i) => ({
      id: `panel-${i}`,
      imageUrl: null,
      caption: captions[i] || "",
      note: "",
      transform: { rotation: 0, flipH: false, flipV: false },
    }));
    resetPanels(newPanels);
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

  const handleNoteChange = (panelId: string, note: string) => {
    setPanels(prev => prev.map(panel => 
      panel.id === panelId ? { ...panel, note } : panel
    ));
  };

  const handleRemoveImage = (panelId: string) => {
    setPanels(prev => prev.map(panel => 
      panel.id === panelId ? { ...panel, imageUrl: null } : panel
    ));
  };

  const handleImageUpdate = (panelId: string, newImageUrl: string) => {
    setPanels(prev => prev.map(panel => 
      panel.id === panelId ? { ...panel, imageUrl: newImageUrl } : panel
    ));
  };

  const handleStockImageSelect = (panelId: string, imageUrl: string) => {
    setPanels(prev => prev.map(panel => 
      panel.id === panelId ? { ...panel, imageUrl } : panel
    ));
    toast.success("Immagine stock aggiunta!");
  };

  const handleTransformChange = (panelId: string, transform: ImageTransform) => {
    setPanels(prev => prev.map(panel => 
      panel.id === panelId ? { ...panel, transform } : panel
    ));
  };

  const handleOpenMysticGenerator = (panelId: string) => {
    setMysticTargetPanelId(panelId);
    setMysticDialogOpen(true);
  };

  const handleMysticImageGenerated = (imageUrl: string) => {
    if (mysticTargetPanelId) {
      setPanels(prev => prev.map(panel => 
        panel.id === mysticTargetPanelId ? { ...panel, imageUrl } : panel
      ));
    }
  };

  const handleAssignCharacter = (panelId: string, characterId: string) => {
    setPanels(prev => prev.map(panel => {
      if (panel.id !== panelId) return panel;
      const ids = panel.characterIds || [];
      if (ids.includes(characterId)) return panel;
      return { ...panel, characterIds: [...ids, characterId] };
    }));
  };

  const handleUnassignCharacter = (panelId: string, characterId: string) => {
    setPanels(prev => prev.map(panel => {
      if (panel.id !== panelId) return panel;
      return { ...panel, characterIds: (panel.characterIds || []).filter(id => id !== characterId) };
    }));
  };

  const handleOptimizePrompt = (panelId: string, imageUrl: string) => {
    const panel = panels.find(p => p.id === panelId);
    setAiAssistantPanelId(panelId);
    setAiAssistantImageUrl(imageUrl);
    setAiAssistantOpen(true);
  };

  const handlePromptGenerated = (prompt: string) => {
    setOptimizedPrompt(prompt);
    toast.success("Prompt ottimizzato salvato!");
  };

  const handleGenerateMultiModel = (panelId: string, imageUrl: string) => {
    const panel = panels.find(p => p.id === panelId);
    setMultiModelImageUrl(imageUrl);
    setMultiModelCaption(panel?.caption || '');
    setMultiModelOpen(true);
  };

  const handleDragStart = (imageUrl: string) => {
    setDraggedImageUrl(imageUrl);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: DragEvent, panelId: string) => {
    e.preventDefault();
    if (draggedImageUrl) {
      setPanels(prev => prev.map(panel => 
        panel.id === panelId ? { ...panel, imageUrl: draggedImageUrl } : panel
      ));
      toast.success("Immagine aggiunta al pannello!");
      setDraggedImageUrl(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setPanels((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        
        const reorderedPanels = arrayMove(items, oldIndex, newIndex);
        toast.success("Pannelli riordinati!");
        return reorderedPanels;
      });
    }
  };

  const handleSaveStoryboard = async () => {
    if (!title.trim()) {
      toast.error("Inserisci un titolo per lo storyboard");
      return;
    }

    if (panels.every(p => !p.imageUrl)) {
      toast.error("Aggiungi almeno un'immagine");
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Devi essere autenticato per salvare");
        return;
      }

      // Hash password if password protection is enabled
      let hashedPassword: string | null = null;
      if (isPasswordProtected && sharePassword.trim()) {
        const { data: hashResponse, error: hashError } = await supabase.functions.invoke(
          'hash-storyboard-password',
          { body: { password: sharePassword.trim() } }
        );
        
        if (hashError || !hashResponse?.success) {
          console.error('Error hashing password:', hashError || hashResponse?.error);
          toast.error("Errore nella protezione con password");
          return;
        }
        hashedPassword = hashResponse.hashedPassword;
      }

      const storyboardData = {
        title,
        layout,
        template_type: selectedTemplate,
        panels: panels as any,
        tags,
        share_password: hashedPassword,
        user_id: user.id,
      };

      if (currentStoryboardId) {
        const { error } = await supabase
          .from('storyboards')
          .update(storyboardData)
          .eq('id', currentStoryboardId);

        if (error) throw error;
        toast.success("Storyboard aggiornato!");
      } else {
        const { data, error } = await supabase
          .from('storyboards')
          .insert([storyboardData])
          .select()
          .single();

        if (error) throw error;
        setCurrentStoryboardId(data.id);
        toast.success("Storyboard salvato!");
      }
    } catch (error: any) {
      console.error("Error saving storyboard:", error);
      toast.error("Errore nel salvataggio");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportPNG = async () => {
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
          toast.success("Storyboard esportato in PNG!");
        }
      }, "image/png");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Errore durante l'esportazione");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!storyboardRef.current) return;
    
    setIsExporting(true);
    try {
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let yPosition = margin;

      // Title
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text(title, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;

      // Tags
      if (tags.length > 0) {
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Tag: ${tags.join(', ')}`, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 10;
      }

      // Storyboard image
      const canvas = await html2canvas(storyboardRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: true,
      });
      
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = pageWidth - (margin * 2);
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      if (yPosition + imgHeight > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }
      
      pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, imgHeight);
      yPosition += imgHeight + 10;

      // Notes section
      const panelsWithNotes = panels.filter(p => p.note?.trim() || p.caption?.trim());
      if (panelsWithNotes.length > 0) {
        if (yPosition > pageHeight - 40) {
          pdf.addPage();
          yPosition = margin;
        }

        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Didascalie e Note', margin, yPosition);
        yPosition += 10;

        panelsWithNotes.forEach((panel, idx) => {
          const panelIndex = panels.findIndex(p => p.id === panel.id);
          
          if (yPosition > pageHeight - 30) {
            pdf.addPage();
            yPosition = margin;
          }

          pdf.setFontSize(12);
          pdf.setFont('helvetica', 'bold');
          pdf.text(`Pannello ${panelIndex + 1}`, margin, yPosition);
          yPosition += 7;

          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'normal');

          if (panel.caption?.trim()) {
            pdf.setFont('helvetica', 'italic');
            const captionLines = pdf.splitTextToSize(`Didascalia: ${panel.caption}`, pageWidth - (margin * 2));
            pdf.text(captionLines, margin + 5, yPosition);
            yPosition += captionLines.length * 5 + 3;
          }

          if (panel.note?.trim()) {
            pdf.setFont('helvetica', 'normal');
            const noteLines = pdf.splitTextToSize(`Note: ${panel.note}`, pageWidth - (margin * 2));
            pdf.text(noteLines, margin + 5, yPosition);
            yPosition += noteLines.length * 5 + 5;
          }

          yPosition += 5;
        });
      }

      pdf.save(`${title.replace(/\s+/g, "_")}_storyboard.pdf`);
      toast.success("Storyboard esportato in PDF!");
    } catch (error) {
      console.error("Export PDF error:", error);
      toast.error("Errore durante l'esportazione PDF");
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
      <div className="space-y-4">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex-1 min-w-[200px]">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titolo storyboard..."
              className="bg-background/50 border-border text-lg font-semibold"
            />
          </div>

        <Card className="p-4 bg-card/50">
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-sm font-semibold">
              <TagIcon className="h-4 w-4 text-primary" />
              Tag Personalizzati
            </Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && tagInput.trim()) {
                    e.preventDefault();
                    const newTags = tagInput.split(/[,\s]+/).filter(t => t.trim());
                    setTags(prev => [...new Set([...prev, ...newTags.map(t => t.trim())])]);
                    setTagInput("");
                  }
                }}
                placeholder="Aggiungi tag (premi Invio o virgola per aggiungere)..."
                className="bg-background/50 border-border"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (tagInput.trim()) {
                    const newTags = tagInput.split(/[,\s]+/).filter(t => t.trim());
                    setTags(prev => [...new Set([...prev, ...newTags.map(t => t.trim())])]);
                    setTagInput("");
                  }
                }}
                disabled={!tagInput.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="gap-1">
                    {tag}
                    <button
                      onClick={() => setTags(prev => prev.filter((_, i) => i !== index))}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Usa tag per categorizzare i tuoi storyboard (es: "commerciale", "2024", "cliente-X")
            </p>
          </div>
        </Card>

        <Card className="p-4 bg-card/50">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                {isPasswordProtected ? (
                  <Lock className="h-4 w-4 text-primary" />
                ) : (
                  <Unlock className="h-4 w-4 text-muted-foreground" />
                )}
                Protezione con Password
              </Label>
              <Switch
                checked={isPasswordProtected}
                onCheckedChange={(checked) => {
                  setIsPasswordProtected(checked);
                  if (!checked) setSharePassword("");
                }}
              />
            </div>
            {isPasswordProtected && (
              <div className="space-y-2">
                <Input
                  type="password"
                  value={sharePassword}
                  onChange={(e) => setSharePassword(e.target.value)}
                  placeholder="Imposta una password..."
                  className="bg-background/50 border-border"
                />
                <p className="text-xs text-muted-foreground">
                  Gli utenti dovranno inserire questa password per visualizzare lo storyboard condiviso
                </p>
              </div>
            )}
            {!isPasswordProtected && (
              <p className="text-xs text-muted-foreground">
                Abilita per richiedere una password prima di visualizzare lo storyboard condiviso
              </p>
            )}
          </div>
        </Card>
      </div>
        
        <div className="flex gap-2">
          {/* Undo/Redo buttons */}
          <Button
            variant="outline"
            size="icon"
            onClick={undo}
            disabled={!canUndo}
            title="Annulla (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={redo}
            disabled={!canRedo}
            title="Ripeti (Ctrl+Y)"
          >
            <Redo2 className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            onClick={() => setShowGallery(!showGallery)}
            className={showGallery ? "bg-primary/10" : ""}
          >
            <Images className="mr-2 h-4 w-4" />
            {showGallery ? "Nascondi" : "Mostra"} Galleria ({images.length})
          </Button>

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
            onClick={handleSaveStoryboard}
            disabled={isSaving || !title.trim()}
            className="bg-gradient-to-r from-primary to-primary/80"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvataggio...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {currentStoryboardId ? "Aggiorna" : "Salva"}
              </>
            )}
          </Button>

          {currentStoryboardId && panels.filter(p => p.imageUrl).length >= 2 && (
            <StoryboardToVideoDialog
              storyboardId={currentStoryboardId}
              panels={panels}
              onSuccess={() => toast.success("Controlla la pagina Storia per vedere i video generati")}
            />
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
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
                    Esporta
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportPNG} disabled={isExporting}>
                <Download className="mr-2 h-4 w-4" />
                Esporta come PNG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPDF} disabled={isExporting}>
                <FileText className="mr-2 h-4 w-4" />
                Esporta come PDF (con note)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* View Mode Tabs */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'grid' | 'workflow')} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="grid" className="flex items-center gap-2">
            <Grid3x3 className="h-4 w-4" />
            Vista Griglia
          </TabsTrigger>
          <TabsTrigger value="workflow" className="flex items-center gap-2">
            <Workflow className="h-4 w-4" />
            Vista Workflow
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workflow" className="mt-4">
          <WorkflowView
            panels={panels}
            onOptimizePrompt={handleOptimizePrompt}
            onGenerateVideo={(panelId, imageUrl) => {
              toast.info("Usa il pulsante Multi per generare video");
            }}
            onGenerateMultiModel={handleGenerateMultiModel}
            isOptimizing={isOptimizingPrompt}
          />
        </TabsContent>

        <TabsContent value="grid" className="mt-4">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {showGallery && images.length > 0 && (
          <Card className="lg:col-span-1 p-4 bg-card/50 border-accent/20">
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-3">
                <Images className="h-5 w-5 text-accent" />
                <h3 className="font-semibold">Galleria Immagini</h3>
              </div>
              <Alert className="border-accent/50 bg-accent/10">
                <AlertDescription className="text-xs">
                  Trascina le immagini nei pannelli dello storyboard
                </AlertDescription>
              </Alert>
              <ScrollArea className="h-[600px]">
                <div className="space-y-3 pr-4">
                  {images.map((image) => (
                    <Card
                      key={image.id}
                      className="cursor-grab active:cursor-grabbing hover:border-accent/50 transition-colors overflow-hidden"
                      draggable
                      onDragStart={() => handleDragStart(image.url)}
                    >
                      <img
                        src={image.url}
                        alt={image.prompt}
                        className="w-full h-auto object-cover"
                      />
                      <div className="p-2">
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {image.prompt}
                        </p>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
            {currentStoryboardId && (
              <CharacterLockPanel
                characters={characters}
                onAddCharacter={addCharacter}
                onUpdateCharacter={updateCharacterData}
                onDeleteCharacter={deleteCharacter}
                onAddReferenceImage={addReferenceImage}
                onRemoveReferenceImage={removeReferenceImage}
                onAssignCharacter={handleAssignCharacter}
                onUnassignCharacter={handleUnassignCharacter}
                disabled={!currentStoryboardId}
              />
            )}
          </Card>
        )}

        {/* Character Lock Panel - show in sidebar when no gallery, or below content */}
        {currentStoryboardId && !(showGallery && images.length > 0) && (
          <div className="lg:col-span-1">
            <CharacterLockPanel
              characters={characters}
              onAddCharacter={addCharacter}
              onUpdateCharacter={updateCharacterData}
              onDeleteCharacter={deleteCharacter}
              onAddReferenceImage={addReferenceImage}
              onRemoveReferenceImage={removeReferenceImage}
              onAssignCharacter={handleAssignCharacter}
              onUnassignCharacter={handleUnassignCharacter}
              disabled={!currentStoryboardId}
            />
          </div>
        )}

        <div className={(showGallery && images.length > 0) || currentStoryboardId ? "lg:col-span-3" : "lg:col-span-4"}>
          <Card className="p-8 bg-card/50" ref={storyboardRef}>
            <div className="mb-6 text-center">
              <h2 className="text-3xl font-bold text-foreground">{title}</h2>
            </div>

            <Alert className="mb-4 border-primary/50 bg-primary/10">
              <GripVertical className="h-4 w-4 text-primary" />
              <AlertDescription>
                Trascina l'icona <GripVertical className="inline h-3 w-3" /> in alto a sinistra di ogni pannello per riordinare la sequenza
              </AlertDescription>
            </Alert>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={panels.map(p => p.id)} strategy={rectSortingStrategy}>
                <div 
                  className="grid gap-4"
                  style={{
                    gridTemplateColumns: `repeat(${config.cols}, 1fr)`,
                    gridTemplateRows: `repeat(${config.rows}, 1fr)`,
                  }}
                >
                  {panels.map((panel, index) => (
                    <div key={panel.id} className="relative">
                      <SortablePanel
                        id={panel.id}
                        imageUrl={panel.imageUrl}
                        caption={panel.caption}
                        index={index}
                        onImageUpload={(file) => handleImageUpload(panel.id, file)}
                        onRemoveImage={() => handleRemoveImage(panel.id)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, panel.id)}
                        onImageUpdate={(newUrl) => handleImageUpdate(panel.id, newUrl)}
                        onGenerateMystic={() => handleOpenMysticGenerator(panel.id)}
                        imageTransform={panel.transform}
                        onTransformChange={(transform) => handleTransformChange(panel.id, transform)}
                      />
                      {/* Character assignment chips */}
                      {characters.length > 0 && panel.imageUrl && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {characters.map((char) => {
                            const isAssigned = (panel.characterIds || []).includes(char.id);
                            return (
                              <button
                                key={char.id}
                                onClick={() => isAssigned 
                                  ? handleUnassignCharacter(panel.id, char.id) 
                                  : handleAssignCharacter(panel.id, char.id)
                                }
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border transition-all ${
                                  isAssigned 
                                    ? "opacity-100 border-current" 
                                    : "opacity-40 border-dashed hover:opacity-70"
                                }`}
                                style={{ color: char.color, borderColor: char.color, backgroundColor: isAssigned ? `${char.color}20` : 'transparent' }}
                                title={isAssigned ? `Rimuovi ${char.name}` : `Assegna ${char.name}`}
                              >
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: char.color }} />
                                {char.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {!panel.imageUrl && (
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
                          <StockLibraryDialog
                            onSelectImage={(url) => handleStockImageSelect(panel.id, url)}
                            trigger={
                              <Button size="sm" variant="secondary" className="text-xs">
                                <Library className="h-3 w-3 mr-1" />
                                Stock
                              </Button>
                            }
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </Card>

          <MysticGeneratorDialog
            isOpen={mysticDialogOpen}
            onClose={() => {
              setMysticDialogOpen(false);
              setMysticTargetPanelId(null);
            }}
            onImageGenerated={handleMysticImageGenerated}
            panelIndex={panels.findIndex(p => p.id === mysticTargetPanelId)}
          />
        </div>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Type className="h-5 w-5 text-primary" />
          Didascalie e Note
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {panels.map((panel, index) => (
            <div key={panel.id} className="space-y-3">
              <Label className="text-base font-semibold">
                Pannello {index + 1}
              </Label>
              <div className="space-y-2">
                <Label htmlFor={`caption-${panel.id}`} className="text-sm text-muted-foreground">
                  Didascalia (visibile sotto l'immagine)
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
              <div className="space-y-2">
                <Label htmlFor={`note-${panel.id}`} className="text-sm text-muted-foreground">
                  Note tecniche/creative (solo per te)
                </Label>
                <Textarea
                  id={`note-${panel.id}`}
                  value={panel.note || ""}
                  onChange={(e) => handleNoteChange(panel.id, e.target.value)}
                  placeholder="Es: Illuminazione naturale, angolo 45°, focus sul prodotto..."
                  rows={3}
                  className="resize-none bg-background/50 border-border"
                  disabled={!panel.imageUrl}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
        </TabsContent>
      </Tabs>

      {/* AI Prompt Assistant Dialog */}
      <AIPromptAssistant
        open={aiAssistantOpen}
        onOpenChange={setAiAssistantOpen}
        imageUrl={aiAssistantImageUrl}
        panelCaption={panels.find(p => p.id === aiAssistantPanelId)?.caption}
        onPromptGenerated={handlePromptGenerated}
        savedTemplates={savedTemplates}
        onSaveTemplate={saveTemplate}
        onDeleteTemplate={deleteTemplate}
        onUpdateTemplate={updateTemplate}
      />

      {/* Multi-Model Generator Dialog */}
      <MultiModelGenerator
        open={multiModelOpen}
        onOpenChange={setMultiModelOpen}
        imageUrl={multiModelImageUrl}
        panelCaption={multiModelCaption}
        optimizedPrompt={optimizedPrompt}
        onResultsUpdate={(results) => setComparisonResults(results)}
        onOpenReport={() => setComparisonReportOpen(true)}
      />

      {/* Video Comparison Report Dialog */}
      <VideoComparisonReport
        open={comparisonReportOpen}
        onOpenChange={setComparisonReportOpen}
        results={comparisonResults}
        prompt={optimizedPrompt || multiModelCaption}
        sourceImageUrl={multiModelImageUrl || undefined}
      />
    </div>
  );
};