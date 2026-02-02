import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  FileCode2, Plus, Trash2, Copy, Variable, Save, FolderOpen, 
  Loader2, Sparkles, Edit, Check, X
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { AIImage, AIVoice } from "./JSON2VideoAIAssets";

interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'url';
  defaultValue?: string | number;
  description?: string;
}

interface Template {
  id: string;
  name: string;
  description?: string;
  template_json: Record<string, unknown>;
  variables: TemplateVariable[];
  category: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

// Configuration interface that matches JSON2VideoEditor state
export interface JSON2VideoConfig {
  clips?: unknown[];
  subtitles?: unknown;
  intro?: unknown;
  outro?: unknown;
  audioTrack?: unknown | null;
  transition?: { type: string; duration: number };
  resolution?: string;
  soundEffects?: unknown[];
  aiImages?: AIImage[];
  aiVoices?: AIVoice[];
}

interface JSON2VideoTemplateManagerProps {
  onApplyTemplate: (config: JSON2VideoConfig) => void;
  currentConfig?: JSON2VideoConfig;
  onTemplatesCountChange?: (count: number) => void;
}

const CATEGORIES = [
  { value: 'custom', label: 'Personalizzato' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'social', label: 'Social Media' },
  { value: 'product', label: 'Prodotto' },
  { value: 'tutorial', label: 'Tutorial' },
  { value: 'promo', label: 'Promozione' },
];

export default function JSON2VideoTemplateManager({ 
  onApplyTemplate, 
  currentConfig,
  onTemplatesCountChange
}: JSON2VideoTemplateManagerProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  
  // Save template form
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateCategory, setTemplateCategory] = useState("custom");
  const [templateVariables, setTemplateVariables] = useState<TemplateVariable[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Apply template form
  const [variableValues, setVariableValues] = useState<Record<string, string | number>>({});

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Devi essere autenticato");
        return;
      }

      const { data, error } = await supabase
        .from("json2video_templates" as any)
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      
      // Type assertion since Supabase types might not be updated yet
      const loadedTemplates = (data as unknown as Template[]) || [];
      setTemplates(loadedTemplates);
      onTemplatesCountChange?.(loadedTemplates.length);
    } catch (error) {
      console.error("Error loading templates:", error);
      toast.error("Errore nel caricamento dei template");
    } finally {
      setIsLoading(false);
    }
  };

  // Extract variables from a config string (find {{variable}} patterns)
  const extractVariables = (config: JSON2VideoConfig): string[] => {
    const configStr = JSON.stringify(config);
    const matches = configStr.match(/\{\{(\w+)\}\}/g) || [];
    const uniqueVars = [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))];
    return uniqueVars;
  };

  const openSaveDialog = () => {
    if (!currentConfig) {
      toast.error("Nessuna configurazione da salvare");
      return;
    }

    // Auto-extract variables from current config
    const detectedVars = extractVariables(currentConfig);
    setTemplateVariables(detectedVars.map(name => ({
      name,
      type: 'string' as const,
      defaultValue: '',
    })));
    
    setShowSaveDialog(true);
  };

  const saveTemplate = async () => {
    if (!templateName.trim()) {
      toast.error("Inserisci un nome per il template");
      return;
    }

    if (!currentConfig) {
      toast.error("Nessuna configurazione da salvare");
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non autenticato");

      // Use rpc or raw insert with proper typing
      const insertData = {
        user_id: user.id,
        name: templateName,
        description: templateDescription,
        template_json: currentConfig as Record<string, unknown>,
        variables: templateVariables as unknown,
        category: templateCategory,
        is_public: false,
      };

      const { data, error } = await supabase
        .from("json2video_templates" as any)
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      toast.success("Template salvato!");
      setShowSaveDialog(false);
      setTemplateName("");
      setTemplateDescription("");
      setTemplateVariables([]);
      loadTemplates();
    } catch (error) {
      console.error("Error saving template:", error);
      toast.error("Errore nel salvataggio del template");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    try {
      const { error } = await supabase
        .from("json2video_templates" as any)
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Template eliminato");
      const newTemplates = templates.filter(t => t.id !== id);
      setTemplates(newTemplates);
      onTemplatesCountChange?.(newTemplates.length);
    } catch (error) {
      console.error("Error deleting template:", error);
      toast.error("Errore nell'eliminazione");
    }
  };

  const openApplyDialog = (template: Template) => {
    setSelectedTemplate(template);
    
    // Initialize variable values with defaults
    const initialValues: Record<string, string | number> = {};
    (template.variables || []).forEach(v => {
      initialValues[v.name] = v.defaultValue || '';
    });
    setVariableValues(initialValues);
    
    setShowApplyDialog(true);
  };

  const applyTemplate = () => {
    if (!selectedTemplate) return;

    // Replace variables in template JSON
    let templateStr = JSON.stringify(selectedTemplate.template_json);
    
    Object.entries(variableValues).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      templateStr = templateStr.split(placeholder).join(String(value));
    });

    const processedConfig = JSON.parse(templateStr) as JSON2VideoConfig;
    onApplyTemplate(processedConfig);
    
    toast.success(`Template "${selectedTemplate.name}" applicato!`);
    setShowApplyDialog(false);
    setSelectedTemplate(null);
  };

  const addVariable = () => {
    setTemplateVariables([
      ...templateVariables,
      { name: `var${templateVariables.length + 1}`, type: 'string', defaultValue: '' }
    ]);
  };

  const updateVariable = (index: number, updates: Partial<TemplateVariable>) => {
    setTemplateVariables(templateVariables.map((v, i) => 
      i === index ? { ...v, ...updates } : v
    ));
  };

  const removeVariable = (index: number) => {
    setTemplateVariables(templateVariables.filter((_, i) => i !== index));
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileCode2 className="h-5 w-5" />
              Template con Variabili
            </CardTitle>
            <CardDescription>
              Salva e riutilizza configurazioni con placeholder dinamici
            </CardDescription>
          </div>
          <Button onClick={openSaveDialog} variant="outline" size="sm">
            <Save className="mr-2 h-4 w-4" />
            Salva Attuale
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileCode2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nessun template salvato</p>
            <p className="text-xs">Configura il tuo video e salva come template</p>
          </div>
        ) : (
          <ScrollArea className="h-[200px]">
            <div className="space-y-2">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:border-primary/50 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{template.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {CATEGORIES.find(c => c.value === template.category)?.label || template.category}
                      </Badge>
                      {template.variables && template.variables.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          <Variable className="h-3 w-3 mr-1" />
                          {template.variables.length} var
                        </Badge>
                      )}
                    </div>
                    {template.description && (
                      <p className="text-xs text-muted-foreground truncate">{template.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => openApplyDialog(template)}
                    >
                      <Sparkles className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => deleteTemplate(template.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      {/* Save Template Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Salva come Template</DialogTitle>
            <DialogDescription>
              Salva la configurazione attuale come template riutilizzabile
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome Template *</Label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Es: Video Prodotto con Prezzo"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Descrizione</Label>
              <Textarea
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                placeholder="Descrivi quando usare questo template..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={templateCategory} onValueChange={setTemplateCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Variabili (placeholder)</Label>
                <Button variant="ghost" size="sm" onClick={addVariable}>
                  <Plus className="h-4 w-4 mr-1" />
                  Aggiungi
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Usa {"{{nome_variabile}}"} nel tuo testo per creare placeholder
              </p>
              
              {templateVariables.length > 0 && (
                <div className="space-y-2 mt-2">
                  {templateVariables.map((v, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={v.name}
                        onChange={(e) => updateVariable(i, { name: e.target.value })}
                        placeholder="nome_variabile"
                        className="flex-1"
                      />
                      <Select 
                        value={v.type} 
                        onValueChange={(val: 'string' | 'number' | 'url') => updateVariable(i, { type: val })}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="string">Testo</SelectItem>
                          <SelectItem value="number">Numero</SelectItem>
                          <SelectItem value="url">URL</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        value={String(v.defaultValue || '')}
                        onChange={(e) => updateVariable(i, { 
                          defaultValue: v.type === 'number' ? Number(e.target.value) : e.target.value 
                        })}
                        placeholder="Default"
                        className="w-32"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeVariable(i)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Annulla
            </Button>
            <Button onClick={saveTemplate} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salva Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply Template Dialog */}
      <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Applica Template</DialogTitle>
            <DialogDescription>
              {selectedTemplate?.name} - Compila le variabili per personalizzare
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedTemplate?.variables && selectedTemplate.variables.length > 0 ? (
              selectedTemplate.variables.map((v) => (
                <div key={v.name} className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Variable className="h-3 w-3" />
                    {v.name}
                    <Badge variant="outline" className="text-xs">{v.type}</Badge>
                  </Label>
                  <Input
                    type={v.type === 'number' ? 'number' : 'text'}
                    value={String(variableValues[v.name] || '')}
                    onChange={(e) => setVariableValues({
                      ...variableValues,
                      [v.name]: v.type === 'number' ? Number(e.target.value) : e.target.value
                    })}
                    placeholder={v.description || `Inserisci ${v.name}`}
                  />
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Questo template non ha variabili da compilare
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApplyDialog(false)}>
              Annulla
            </Button>
            <Button onClick={applyTemplate}>
              <Sparkles className="mr-2 h-4 w-4" />
              Applica Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
