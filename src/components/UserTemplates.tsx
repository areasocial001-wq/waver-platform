import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, 
  BookMarked, 
  Trash2, 
  Save,
  Share2,
  Loader2,
  Clock,
  Film,
  Download,
  Upload,
  FileJson
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { BatchScene } from './TalkingAvatarBatch';

interface UserTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  scenes: Omit<BatchScene, 'id' | 'status' | 'videoUrl' | 'error' | 'progress'>[];
  suggested_music_emotion: string | null;
  estimated_duration: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

interface UserTemplatesProps {
  currentScenes: BatchScene[];
  onSelectTemplate: (scenes: BatchScene[], suggestedEmotion: string) => void;
}

const EMOTIONS = [
  { id: 'happy', label: 'Felice', emoji: '😊' },
  { id: 'sad', label: 'Triste', emoji: '😢' },
  { id: 'excited', label: 'Eccitato', emoji: '🤩' },
  { id: 'neutral', label: 'Neutro', emoji: '😐' },
  { id: 'confident', label: 'Sicuro', emoji: '😎' },
  { id: 'thinking', label: 'Pensieroso', emoji: '🤔' },
];

export function UserTemplates({ currentScenes, onSelectTemplate }: UserTemplatesProps) {
  const [templates, setTemplates] = useState<UserTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showSelectDialog, setShowSelectDialog] = useState(false);
  
  // Form state
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [selectedEmotion, setSelectedEmotion] = useState('neutral');
  const [isPublic, setIsPublic] = useState(false);

  // Fetch user templates
  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_story_templates')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      // Parse templates with proper type casting
      const parsed = (data || []).map((item: Record<string, unknown>) => ({
        ...item,
        scenes: (Array.isArray(item.scenes) ? item.scenes : []) as UserTemplate['scenes'],
      })) as UserTemplate[];
      setTemplates(parsed);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Errore sconosciuto';
      console.error('Error fetching templates:', error);
      toast.error(`Errore caricamento template: ${message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Save current scenes as template
  const handleSaveTemplate = useCallback(async () => {
    if (!templateName.trim()) {
      toast.error('Inserisci un nome per il template');
      return;
    }

    if (currentScenes.length === 0) {
      toast.error('Non ci sono scene da salvare');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Devi effettuare il login');
        return;
      }

      // Convert scenes to template format (remove generated data)
      const cleanScenes = currentScenes.map(({ scenePrompt, dialogueText, expression, audioDescription, order }) => ({
        scenePrompt,
        dialogueText,
        expression,
        audioDescription,
        order,
      }));

      const estimatedDuration = currentScenes.length * 15; // ~15 sec per scene

      const { error } = await supabase
        .from('user_story_templates')
        .insert({
          user_id: user.id,
          name: templateName,
          description: templateDescription || null,
          category: 'custom',
          scenes: cleanScenes,
          suggested_music_emotion: selectedEmotion,
          estimated_duration: estimatedDuration,
          is_public: isPublic,
        });

      if (error) throw error;

      toast.success('Template salvato!');
      setShowSaveDialog(false);
      setTemplateName('');
      setTemplateDescription('');
      setSelectedEmotion('neutral');
      setIsPublic(false);
      fetchTemplates();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Errore sconosciuto';
      console.error('Error saving template:', error);
      toast.error(`Errore salvataggio: ${message}`);
    }
  }, [templateName, templateDescription, selectedEmotion, isPublic, currentScenes, fetchTemplates]);

  // Delete template
  const handleDeleteTemplate = useCallback(async (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const { error } = await supabase
        .from('user_story_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      toast.success('Template eliminato');
      setTemplates(prev => prev.filter(t => t.id !== templateId));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Errore sconosciuto';
      console.error('Error deleting template:', error);
      toast.error(`Errore eliminazione: ${message}`);
    }
  }, []);

  // Apply template
  const handleApplyTemplate = useCallback((template: UserTemplate) => {
    const scenes: BatchScene[] = template.scenes.map((scene, index) => ({
      id: crypto.randomUUID(),
      ...scene,
      order: scene.order ?? index,
      status: 'pending' as const,
      progress: 0,
    }));

    onSelectTemplate(scenes, template.suggested_music_emotion || 'neutral');
    setShowSelectDialog(false);
    toast.success(`Template "${template.name}" applicato!`);
  }, [onSelectTemplate]);

  // Export template as JSON
  const handleExportTemplate = useCallback((template: UserTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const exportData = {
      name: template.name,
      description: template.description,
      category: template.category,
      scenes: template.scenes,
      suggested_music_emotion: template.suggested_music_emotion,
      estimated_duration: template.estimated_duration,
      exported_at: new Date().toISOString(),
      version: '1.0',
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template-${template.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Template esportato come JSON!');
  }, []);

  // Import template from JSON
  const handleImportTemplate = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      // Validate imported data
      if (!data.name || !data.scenes || !Array.isArray(data.scenes)) {
        throw new Error('Formato template non valido');
      }
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Devi effettuare il login');
        return;
      }
      
      // Save imported template
      const { error } = await supabase
        .from('user_story_templates')
        .insert({
          user_id: user.id,
          name: data.name,
          description: data.description || null,
          category: data.category || 'custom',
          scenes: data.scenes,
          suggested_music_emotion: data.suggested_music_emotion || 'neutral',
          estimated_duration: data.estimated_duration || data.scenes.length * 15,
          is_public: false,
        });
      
      if (error) throw error;
      
      toast.success(`Template "${data.name}" importato!`);
      fetchTemplates();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Errore sconosciuto';
      console.error('Import error:', error);
      toast.error(`Errore importazione: ${message}`);
    }
    
    // Reset input
    e.target.value = '';
  }, [fetchTemplates]);

  const canSaveTemplate = currentScenes.length > 0 && currentScenes.some(s => s.scenePrompt?.trim());

  return (
    <>
      {/* Save Template Button */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogTrigger asChild>
          <Button 
            variant="outline" 
            size="sm"
            disabled={!canSaveTemplate}
            title={!canSaveTemplate ? 'Aggiungi scene per salvare un template' : ''}
          >
            <Save className="w-4 h-4 mr-2" />
            Salva come Template
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookMarked className="w-5 h-5" />
              Salva Template Personalizzato
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome Template</Label>
              <Input 
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Es: La mia presentazione prodotto"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrizione (opzionale)</Label>
              <Textarea 
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                placeholder="Descrivi brevemente il template..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Emozione Musica Suggerita</Label>
              <Select value={selectedEmotion} onValueChange={setSelectedEmotion}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMOTIONS.map(e => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.emoji} {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Condividi Pubblicamente</Label>
                <p className="text-xs text-muted-foreground">
                  Altri utenti potranno vedere questo template
                </p>
              </div>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Scene da salvare: <strong>{currentScenes.length}</strong>
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Annulla
            </Button>
            <Button onClick={handleSaveTemplate}>
              <Save className="w-4 h-4 mr-2" />
              Salva Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Select Template Button */}
      <Dialog open={showSelectDialog} onOpenChange={setShowSelectDialog}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <BookMarked className="w-4 h-4 mr-2" />
            I Miei Template
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <BookMarked className="w-5 h-5" />
                I Miei Template Personalizzati
              </DialogTitle>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportTemplate}
                  className="hidden"
                  id="import-template-input"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('import-template-input')?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Importa JSON
                </Button>
              </div>
            </div>
          </DialogHeader>
          <ScrollArea className="h-[500px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BookMarked className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>Nessun template personalizzato</p>
                <p className="text-sm mt-1">
                  Crea delle scene e salvale come template per riutilizzarle
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-4">
                {templates.map((template) => (
                  <Card 
                    key={template.id}
                    className="cursor-pointer hover:border-primary transition-colors relative group"
                    onClick={() => handleApplyTemplate(template)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        <div className="flex items-center gap-1">
                          {template.is_public && (
                            <Badge variant="outline" className="text-xs">
                              <Share2 className="w-3 h-3 mr-1" />
                              Pubblico
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => handleExportTemplate(template, e)}
                            title="Esporta JSON"
                          >
                            <Download className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                            onClick={(e) => handleDeleteTemplate(template.id, e)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      {template.description && (
                        <CardDescription className="line-clamp-2">
                          {template.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Film className="w-3 h-3" />
                          {template.scenes.length} scene
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          ~{Math.round(template.estimated_duration / 60)} min
                        </div>
                        {template.suggested_music_emotion && (
                          <Badge variant="secondary" className="text-xs">
                            🎵 {template.suggested_music_emotion}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Aggiornato: {new Date(template.updated_at).toLocaleDateString()}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default UserTemplates;
