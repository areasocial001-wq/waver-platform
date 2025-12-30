import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWorkflows, SavedWorkflow } from "@/hooks/useWorkflows";
import { WorkflowNode, WorkflowEdge } from "./types";
import { Save, FolderOpen, Trash2, Clock, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

interface SaveWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  currentWorkflowId?: string;
  currentWorkflowName?: string;
  onSaved: (id: string, name: string) => void;
}

export const SaveWorkflowDialog = ({
  open,
  onOpenChange,
  nodes,
  edges,
  currentWorkflowId,
  currentWorkflowName,
  onSaved,
}: SaveWorkflowDialogProps) => {
  const { saveWorkflow } = useWorkflows();
  const [name, setName] = useState(currentWorkflowName || "");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    
    setIsSaving(true);
    const id = await saveWorkflow(name, description, nodes, edges, currentWorkflowId);
    setIsSaving(false);
    
    if (id) {
      onSaved(id, name);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            Salva Workflow
          </DialogTitle>
          <DialogDescription>
            Salva il tuo workflow per riutilizzarlo in futuro
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input
              placeholder="Nome del workflow..."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Descrizione (opzionale)</Label>
            <Textarea
              placeholder="Descrivi il workflow..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          
          <div className="text-sm text-muted-foreground">
            {nodes.length} nodi, {edges.length} connessioni
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvataggio...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salva
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface LoadWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoad: (workflow: SavedWorkflow) => void;
}

export const LoadWorkflowDialog = ({
  open,
  onOpenChange,
  onLoad,
}: LoadWorkflowDialogProps) => {
  const { workflows, isLoading, deleteWorkflow } = useWorkflows();

  const handleLoad = (workflow: SavedWorkflow) => {
    onLoad(workflow);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Carica Workflow
          </DialogTitle>
          <DialogDescription>
            Seleziona un workflow salvato per caricarlo
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="h-[400px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : workflows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <FolderOpen className="h-12 w-12 mb-2 opacity-50" />
              <p>Nessun workflow salvato</p>
            </div>
          ) : (
            <div className="space-y-3">
              {workflows.map((workflow) => (
                <Card key={workflow.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1" onClick={() => handleLoad(workflow)}>
                        <CardTitle className="text-base">{workflow.name}</CardTitle>
                        {workflow.description && (
                          <CardDescription className="mt-1">{workflow.description}</CardDescription>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteWorkflow(workflow.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0" onClick={() => handleLoad(workflow)}>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <Badge variant="secondary">
                        {workflow.nodes.length} nodi
                      </Badge>
                      <Badge variant="secondary">
                        {workflow.edges.length} connessioni
                      </Badge>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(workflow.updated_at), { addSuffix: true, locale: it })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
