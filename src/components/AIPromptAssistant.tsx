import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Wand2, Copy, Check, Sparkles, Video, Camera, Music, Save, BookMarked, Trash2, Pencil, CopyPlus } from 'lucide-react';

interface AIPromptAssistantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string | null;
  panelCaption?: string;
  onPromptGenerated: (prompt: string) => void;
  savedTemplates?: PromptTemplate[];
  onSaveTemplate?: (template: PromptTemplate) => void;
  onDeleteTemplate?: (templateId: string) => void;
  onUpdateTemplate?: (templateId: string, updates: Partial<PromptTemplate>) => void;
}

interface OptimizedPrompts {
  mainPrompt: string;
  cameraMovement: string;
  audioSuggestion: string;
  style: string;
  duration: number;
  keywords: string[];
}

export interface PromptTemplate {
  id: string;
  name: string;
  category: string;
  mainPrompt: string;
  cameraMovement: string;
  audioSuggestion: string;
  style: string;
  duration: number;
  keywords: string[];
  createdAt: Date;
}

const TEMPLATE_CATEGORIES = [
  { value: 'cinematic', label: 'Cinematico' },
  { value: 'commercial', label: 'Commerciale' },
  { value: 'documentary', label: 'Documentario' },
  { value: 'social', label: 'Social Media' },
  { value: 'artistic', label: 'Artistico' },
  { value: 'tutorial', label: 'Tutorial' },
  { value: 'other', label: 'Altro' },
];

export const AIPromptAssistant = ({
  open,
  onOpenChange,
  imageUrl,
  panelCaption,
  onPromptGenerated,
  savedTemplates = [],
  onSaveTemplate,
  onDeleteTemplate,
  onUpdateTemplate,
}: AIPromptAssistantProps) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [optimizedPrompts, setOptimizedPrompts] = useState<OptimizedPrompts | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [customContext, setCustomContext] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateCategory, setTemplateCategory] = useState('cinematic');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  
  // Edit form state
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editMainPrompt, setEditMainPrompt] = useState('');
  const [editCameraMovement, setEditCameraMovement] = useState('');
  const [editAudioSuggestion, setEditAudioSuggestion] = useState('');
  const [editStyle, setEditStyle] = useState('');
  const [editDuration, setEditDuration] = useState(6);
  const [editKeywords, setEditKeywords] = useState('');

  const analyzeAndOptimize = async () => {
    if (!imageUrl) {
      toast.error('Nessuna immagine da analizzare');
      return;
    }

    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('optimize-video-prompt', {
        body: {
          imageUrl,
          caption: panelCaption,
          customContext,
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setOptimizedPrompts(data);
      toast.success('Prompt ottimizzati generati!');
    } catch (error: any) {
      console.error('Error optimizing prompt:', error);
      toast.error(error.message || 'Errore durante l\'analisi');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
    toast.success('Copiato negli appunti!');
  };

  const usePrompt = (prompt: string) => {
    onPromptGenerated(prompt);
    onOpenChange(false);
    toast.success('Prompt applicato!');
  };

  const handleSaveTemplate = () => {
    if (!optimizedPrompts) return;
    
    if (!templateName.trim()) {
      toast.error('Inserisci un nome per il template');
      return;
    }

    const template: PromptTemplate = {
      id: `template-${Date.now()}`,
      name: templateName,
      category: templateCategory,
      mainPrompt: optimizedPrompts.mainPrompt,
      cameraMovement: optimizedPrompts.cameraMovement,
      audioSuggestion: optimizedPrompts.audioSuggestion,
      style: optimizedPrompts.style,
      duration: optimizedPrompts.duration,
      keywords: optimizedPrompts.keywords,
      createdAt: new Date(),
    };

    onSaveTemplate?.(template);
    setShowSaveDialog(false);
    setTemplateName('');
    toast.success('Template salvato!');
  };

  const loadTemplate = (templateId: string) => {
    const template = savedTemplates.find(t => t.id === templateId);
    if (template) {
      setOptimizedPrompts({
        mainPrompt: template.mainPrompt,
        cameraMovement: template.cameraMovement,
        audioSuggestion: template.audioSuggestion,
        style: template.style,
        duration: template.duration,
        keywords: template.keywords,
      });
      setSelectedTemplate(templateId);
      toast.success(`Template "${template.name}" caricato!`);
    }
  };

  const openEditDialog = (template: PromptTemplate) => {
    setEditingTemplate(template);
    setEditName(template.name);
    setEditCategory(template.category);
    setEditMainPrompt(template.mainPrompt);
    setEditCameraMovement(template.cameraMovement);
    setEditAudioSuggestion(template.audioSuggestion);
    setEditStyle(template.style);
    setEditDuration(template.duration);
    setEditKeywords(template.keywords?.join(', ') || '');
    setShowEditDialog(true);
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate || !onUpdateTemplate) return;
    
    if (!editName.trim()) {
      toast.error('Inserisci un nome per il template');
      return;
    }

    await onUpdateTemplate(editingTemplate.id, {
      name: editName,
      category: editCategory,
      mainPrompt: editMainPrompt,
      cameraMovement: editCameraMovement,
      audioSuggestion: editAudioSuggestion,
      style: editStyle,
      duration: editDuration,
      keywords: editKeywords.split(',').map(k => k.trim()).filter(k => k),
    });

    setShowEditDialog(false);
    setEditingTemplate(null);
  };

  const duplicateTemplate = (template: PromptTemplate) => {
    setOptimizedPrompts({
      mainPrompt: template.mainPrompt,
      cameraMovement: template.cameraMovement,
      audioSuggestion: template.audioSuggestion,
      style: template.style,
      duration: template.duration,
      keywords: template.keywords,
    });
    setTemplateName(`${template.name} (copia)`);
    setTemplateCategory(template.category);
    setShowSaveDialog(true);
    toast.info('Modifica il nome e salva la variante');
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" />
              AI Prompt Assistant
            </DialogTitle>
            <DialogDescription>
              Analizza l'immagine e genera prompt ottimizzati per la generazione video
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[70vh]">
            <div className="space-y-6 pr-4">
              {/* Saved Templates */}
              {savedTemplates.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <BookMarked className="h-4 w-4" />
                    Template Salvati
                  </Label>
                  <div className="space-y-2">
                    {savedTemplates.map((template) => (
                      <div
                        key={template.id}
                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedTemplate === template.id
                            ? 'bg-primary/10 border-primary'
                            : 'bg-muted/50 border-border hover:bg-muted'
                        }`}
                        onClick={() => loadTemplate(template.id)}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="truncate font-medium">{template.name}</span>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {TEMPLATE_CATEGORIES.find(c => c.value === template.category)?.label || template.category}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {onSaveTemplate && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-foreground"
                              onClick={(e) => {
                                e.stopPropagation();
                                duplicateTemplate(template);
                              }}
                              title="Duplica template"
                            >
                              <CopyPlus className="h-4 w-4" />
                            </Button>
                          )}
                          {onUpdateTemplate && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-foreground"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditDialog(template);
                              }}
                              title="Modifica template"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {onDeleteTemplate && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteTemplate(template.id);
                                if (selectedTemplate === template.id) {
                                  setSelectedTemplate(null);
                                }
                              }}
                              title="Elimina template"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Image Preview */}
              {imageUrl && (
                <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                  <img
                    src={imageUrl}
                    alt="Panel preview"
                    className="w-full h-full object-contain"
                  />
                </div>
              )}

              {/* Custom Context */}
              <div className="space-y-2">
                <Label>Contesto aggiuntivo (opzionale)</Label>
                <Textarea
                  placeholder="Descrivi il contesto, lo stile desiderato, o dettagli specifici..."
                  value={customContext}
                  onChange={(e) => setCustomContext(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Analyze Button */}
              <Button
                onClick={analyzeAndOptimize}
                disabled={isAnalyzing || !imageUrl}
                className="w-full"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analisi in corso...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Analizza e Ottimizza
                  </>
                )}
              </Button>

              {/* Results */}
              {optimizedPrompts && (
                <div className="space-y-4">
                  {/* Save Template Button */}
                  {onSaveTemplate && (
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowSaveDialog(true)}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Salva come Template
                      </Button>
                    </div>
                  )}

                  {/* Main Prompt */}
                  <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Video className="h-4 w-4 text-primary" />
                        <Label className="font-semibold">Prompt Principale</Label>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(optimizedPrompts.mainPrompt, 'main')}
                        >
                          {copiedField === 'main' ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => usePrompt(optimizedPrompts.mainPrompt)}
                        >
                          Usa
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-foreground">{optimizedPrompts.mainPrompt}</p>
                  </div>

                  {/* Camera Movement */}
                  <div className="p-4 bg-accent/5 rounded-lg border border-accent/20">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Camera className="h-4 w-4 text-accent" />
                        <Label className="font-semibold">Movimento Camera</Label>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(optimizedPrompts.cameraMovement, 'camera')}
                      >
                        {copiedField === 'camera' ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-sm text-foreground">{optimizedPrompts.cameraMovement}</p>
                  </div>

                  {/* Audio Suggestion */}
                  <div className="p-4 bg-muted rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Music className="h-4 w-4" />
                        <Label className="font-semibold">Suggerimento Audio</Label>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(optimizedPrompts.audioSuggestion, 'audio')}
                      >
                        {copiedField === 'audio' ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-sm text-foreground">{optimizedPrompts.audioSuggestion}</p>
                  </div>

                  {/* Metadata */}
                  <div className="flex flex-wrap gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Stile</Label>
                      <Badge variant="outline" className="mt-1">{optimizedPrompts.style}</Badge>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Durata consigliata</Label>
                      <Badge variant="outline" className="mt-1">{optimizedPrompts.duration}s</Badge>
                    </div>
                  </div>

                  {/* Keywords */}
                  {optimizedPrompts.keywords && optimizedPrompts.keywords.length > 0 && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Keywords</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {optimizedPrompts.keywords.map((keyword, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Use Full Prompt */}
                  <Button
                    onClick={() => {
                      const fullPrompt = `${optimizedPrompts.mainPrompt}. Camera: ${optimizedPrompts.cameraMovement}`;
                      usePrompt(fullPrompt);
                    }}
                    className="w-full"
                  >
                    <Wand2 className="h-4 w-4 mr-2" />
                    Usa Prompt Completo
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Save Template Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Save className="h-5 w-5 text-primary" />
              Salva Template
            </DialogTitle>
            <DialogDescription>
              Salva questo prompt ottimizzato come template riutilizzabile
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Nome Template *</Label>
              <Input
                id="template-name"
                placeholder="Es. Video Prodotto Elegante"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-category">Categoria</Label>
              <Select value={templateCategory} onValueChange={setTemplateCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {optimizedPrompts && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Anteprima</p>
                <p className="text-sm line-clamp-3">{optimizedPrompts.mainPrompt}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Annulla
            </Button>
            <Button onClick={handleSaveTemplate}>
              <Save className="h-4 w-4 mr-2" />
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Template Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Modifica Template
            </DialogTitle>
            <DialogDescription>
              Modifica i dettagli del template salvato
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nome Template *</Label>
                <Input
                  id="edit-name"
                  placeholder="Es. Video Prodotto Elegante"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-category">Categoria</Label>
                <Select value={editCategory} onValueChange={setEditCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-prompt">Prompt Principale *</Label>
                <Textarea
                  id="edit-prompt"
                  placeholder="Descrizione del video..."
                  value={editMainPrompt}
                  onChange={(e) => setEditMainPrompt(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-camera">Movimento Camera</Label>
                <Input
                  id="edit-camera"
                  placeholder="Es. Dolly in, pan left..."
                  value={editCameraMovement}
                  onChange={(e) => setEditCameraMovement(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-audio">Suggerimento Audio</Label>
                <Input
                  id="edit-audio"
                  placeholder="Es. Musica ambient, voce narrante..."
                  value={editAudioSuggestion}
                  onChange={(e) => setEditAudioSuggestion(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-style">Stile</Label>
                  <Input
                    id="edit-style"
                    placeholder="Es. Cinematico, Minimalista..."
                    value={editStyle}
                    onChange={(e) => setEditStyle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-duration">Durata (sec)</Label>
                  <Select value={String(editDuration)} onValueChange={(v) => setEditDuration(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4">4 secondi</SelectItem>
                      <SelectItem value="6">6 secondi</SelectItem>
                      <SelectItem value="8">8 secondi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-keywords">Keywords (separate da virgola)</Label>
                <Input
                  id="edit-keywords"
                  placeholder="Es. prodotto, elegante, moderno"
                  value={editKeywords}
                  onChange={(e) => setEditKeywords(e.target.value)}
                />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Annulla
            </Button>
            <Button onClick={handleUpdateTemplate}>
              <Save className="h-4 w-4 mr-2" />
              Salva Modifiche
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
