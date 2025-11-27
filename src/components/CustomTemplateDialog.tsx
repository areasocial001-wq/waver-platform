import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { toast } from "sonner";

type Parameter = {
  name: string;
  description: string;
};

type CustomTemplateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (template: {
    name: string;
    description: string;
    category: string;
    prompt_template: string;
    parameters: Parameter[];
  }) => void;
};

export const CustomTemplateDialog = ({ open, onOpenChange, onSave }: CustomTemplateDialogProps) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [promptTemplate, setPromptTemplate] = useState("");
  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [newParamName, setNewParamName] = useState("");
  const [newParamDesc, setNewParamDesc] = useState("");

  const addParameter = () => {
    if (!newParamName.trim()) {
      toast.error("Inserisci il nome del parametro");
      return;
    }

    setParameters([...parameters, { name: newParamName, description: newParamDesc }]);
    setNewParamName("");
    setNewParamDesc("");
  };

  const removeParameter = (index: number) => {
    setParameters(parameters.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!name.trim() || !promptTemplate.trim()) {
      toast.error("Nome e prompt sono obbligatori");
      return;
    }

    onSave({
      name,
      description,
      category,
      prompt_template: promptTemplate,
      parameters,
    });

    // Reset form
    setName("");
    setDescription("");
    setCategory("general");
    setPromptTemplate("");
    setParameters([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crea Template Personalizzato</DialogTitle>
          <DialogDescription>
            Crea un template riutilizzabile con parametri personalizzabili
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">Nome Template *</Label>
            <Input
              id="template-name"
              placeholder="Es. Post Prodotto E-commerce"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-desc">Descrizione</Label>
            <Input
              id="template-desc"
              placeholder="Breve descrizione del template..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-category">Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">Generale</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="twitter">Twitter</SelectItem>
                <SelectItem value="blog">Blog</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="product">Prodotto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-prompt">Prompt Template *</Label>
            <Textarea
              id="template-prompt"
              placeholder="Scrivi il prompt e usa {{nome_parametro}} per i parametri variabili.&#10;Esempio: Crea un post per {{piattaforma}} su {{argomento}} in tono {{tono}}"
              value={promptTemplate}
              onChange={(e) => setPromptTemplate(e.target.value)}
              className="min-h-[150px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Usa la sintassi {'{{'} e {'}}'} per definire parametri (es: {'{'}{'{'} nome_prodotto {'}}'}
              {'}'}
              )
            </p>
          </div>

          <div className="space-y-2">
            <Label>Parametri</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {parameters.map((param, index) => (
                <Badge key={index} variant="secondary" className="gap-1">
                  {param.name}
                  <button
                    onClick={() => removeParameter(index)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Nome parametro"
                value={newParamName}
                onChange={(e) => setNewParamName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addParameter()}
              />
              <Input
                placeholder="Descrizione (opzionale)"
                value={newParamDesc}
                onChange={(e) => setNewParamDesc(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addParameter()}
              />
              <Button type="button" onClick={addParameter} variant="outline">
                Aggiungi
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={handleSave}>Salva Template</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
