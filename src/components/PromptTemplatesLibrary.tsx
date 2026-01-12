import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { BookMarked, Save, Trash2, Pencil, MoreVertical, Library, Search, Plus, X } from 'lucide-react';
import { usePromptTemplates } from '@/hooks/usePromptTemplates';
import type { PromptTemplate } from '@/components/AIPromptAssistant';
import { toast } from 'sonner';

const TEMPLATE_CATEGORIES = [
  { value: 'cinematic', label: 'Cinematico' },
  { value: 'commercial', label: 'Commerciale' },
  { value: 'documentary', label: 'Documentario' },
  { value: 'social', label: 'Social Media' },
  { value: 'artistic', label: 'Artistico' },
  { value: 'tutorial', label: 'Tutorial' },
  { value: 'other', label: 'Altro' },
];

interface PromptTemplatesLibraryProps {
  currentPrompt: string;
  onApplyTemplate: (prompt: string) => void;
  onApplyFullTemplate?: (template: PromptTemplate) => void;
}

export const PromptTemplatesLibrary = ({
  currentPrompt,
  onApplyTemplate,
  onApplyFullTemplate,
}: PromptTemplatesLibraryProps) => {
  const { templates, isLoading, saveTemplate, deleteTemplate, updateTemplate } = usePromptTemplates();
  const [isOpen, setIsOpen] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  
  // Save form state
  const [saveName, setSaveName] = useState('');
  const [saveCategory, setSaveCategory] = useState('cinematic');
  
  // Edit form state
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editPrompt, setEditPrompt] = useState('');

  // Filter templates
  const filteredTemplates = templates.filter(t => {
    const matchesSearch = searchQuery === '' || 
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.mainPrompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.keywords?.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  const handleSaveTemplate = async () => {
    if (!saveName.trim()) {
      toast.error('Inserisci un nome per il template');
      return;
    }

    if (!currentPrompt.trim()) {
      toast.error('Il prompt è vuoto');
      return;
    }

    const template: PromptTemplate = {
      id: `template-${Date.now()}`,
      name: saveName,
      category: saveCategory,
      mainPrompt: currentPrompt,
      cameraMovement: '',
      audioSuggestion: '',
      style: '',
      duration: 6,
      keywords: [],
      createdAt: new Date(),
    };

    const success = await saveTemplate(template);
    if (success) {
      setShowSaveDialog(false);
      setSaveName('');
      toast.success('Template salvato!');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    await deleteTemplate(templateId);
  };

  const openEditDialog = (template: PromptTemplate) => {
    setEditingTemplate(template);
    setEditName(template.name);
    setEditCategory(template.category);
    setEditPrompt(template.mainPrompt);
    setShowEditDialog(true);
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate) return;
    
    if (!editName.trim()) {
      toast.error('Inserisci un nome per il template');
      return;
    }

    const success = await updateTemplate(editingTemplate.id, {
      name: editName,
      category: editCategory,
      mainPrompt: editPrompt,
    });

    if (success) {
      setShowEditDialog(false);
      setEditingTemplate(null);
    }
  };

  const applyTemplate = (template: PromptTemplate) => {
    if (onApplyFullTemplate) {
      onApplyFullTemplate(template);
    } else {
      onApplyTemplate(template.mainPrompt);
    }
    setIsOpen(false);
    toast.success(`Template "${template.name}" applicato!`);
  };

  return (
    <>
      {/* Main Library Popover */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs">
            <Library className="h-3.5 w-3.5" />
            Template
            {templates.length > 0 && (
              <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                {templates.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <div className="p-3 border-b">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <BookMarked className="h-4 w-4" />
                Libreria Template
              </h4>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => {
                  setIsOpen(false);
                  setShowSaveDialog(true);
                }}
                disabled={!currentPrompt.trim()}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Salva
              </Button>
            </div>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Cerca template..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 h-8 text-sm"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            
            {/* Category Filter */}
            {templates.length > 0 && (
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-8 text-xs mt-2">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte le categorie</SelectItem>
                  {TEMPLATE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Templates List */}
          <ScrollArea className="max-h-64">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Caricamento...
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {templates.length === 0
                  ? 'Nessun template salvato. Salva il tuo primo prompt!'
                  : 'Nessun template trovato'}
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="group flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                    onClick={() => applyTemplate(template)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-sm truncate">{template.name}</span>
                        <Badge variant="outline" className="text-[10px] h-4 px-1 shrink-0">
                          {TEMPLATE_CATEGORIES.find(c => c.value === template.category)?.label || template.category}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {template.mainPrompt}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 shrink-0"
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditDialog(template);
                            setIsOpen(false);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-2" />
                          Modifica
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTemplate(template.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Elimina
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* Save Template Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Save className="h-5 w-5" />
              Salva Template
            </DialogTitle>
            <DialogDescription>
              Salva questo prompt per riutilizzarlo in futuro
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome Template</Label>
              <Input
                placeholder="Es: Scena cinematica drammatica"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={saveCategory} onValueChange={setSaveCategory}>
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
              <Label>Prompt</Label>
              <div className="p-3 bg-muted rounded-md text-sm max-h-24 overflow-y-auto">
                {currentPrompt || <span className="text-muted-foreground">Nessun prompt</span>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Annulla
            </Button>
            <Button onClick={handleSaveTemplate}>
              <Save className="h-4 w-4 mr-2" />
              Salva Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Template Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Modifica Template
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome Template</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
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
              <Label>Prompt</Label>
              <Textarea
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Annulla
            </Button>
            <Button onClick={handleUpdateTemplate}>
              Salva Modifiche
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
