import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useWorkflows, SavedWorkflow } from "@/hooks/useWorkflows";
import { WorkflowNode, WorkflowEdge } from "./types";
import { Save, FolderOpen, Trash2, Clock, Loader2, Globe, Lock, Copy, Check, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";

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
  const [isPublic, setIsPublic] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(currentWorkflowName || "");
    }
  }, [open, currentWorkflowName]);

  const handleSave = async () => {
    if (!name.trim()) return;
    
    setIsSaving(true);
    const id = await saveWorkflow(name, description, nodes, edges, currentWorkflowId, isPublic);
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

          <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-2">
              {isPublic ? <Globe className="h-4 w-4 text-green-500" /> : <Lock className="h-4 w-4 text-muted-foreground" />}
              <div>
                <p className="text-sm font-medium">Condividi come template pubblico</p>
                <p className="text-xs text-muted-foreground">Altri utenti potranno usare questo workflow</p>
              </div>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
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
  const { workflows, publicWorkflows, isLoading, deleteWorkflow, togglePublic, loadByShareCode, refreshPublicWorkflows } = useWorkflows();
  const [shareCodeInput, setShareCodeInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      refreshPublicWorkflows();
    }
  }, [open, refreshPublicWorkflows]);

  const handleLoad = (workflow: SavedWorkflow) => {
    onLoad(workflow);
    onOpenChange(false);
  };

  const handleLoadByCode = async () => {
    if (!shareCodeInput.trim()) return;
    const workflow = await loadByShareCode(shareCodeInput.trim());
    if (workflow) {
      handleLoad(workflow);
    }
  };

  const handleCopyShareCode = async (shareCode: string) => {
    await navigator.clipboard.writeText(shareCode);
    setCopiedId(shareCode);
    toast.success("Codice copiato!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleTogglePublic = async (id: string, currentPublic: boolean) => {
    await togglePublic(id, !currentPublic);
  };

  const WorkflowCard = ({ workflow, showActions = true, isOwner = false }: { workflow: SavedWorkflow; showActions?: boolean; isOwner?: boolean }) => (
    <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1" onClick={() => handleLoad(workflow)}>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{workflow.name}</CardTitle>
              {workflow.is_public && (
                <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-500">
                  <Globe className="h-3 w-3 mr-1" />
                  Pubblico
                </Badge>
              )}
            </div>
            {workflow.description && (
              <CardDescription className="mt-1">{workflow.description}</CardDescription>
            )}
          </div>
          {showActions && isOwner && (
            <div className="flex items-center gap-1">
              {workflow.is_public && workflow.share_code && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyShareCode(workflow.share_code!);
                  }}
                >
                  {copiedId === workflow.share_code ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTogglePublic(workflow.id, workflow.is_public);
                }}
              >
                {workflow.is_public ? (
                  <Lock className="h-4 w-4" />
                ) : (
                  <Globe className="h-4 w-4" />
                )}
              </Button>
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
          )}
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
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Carica Workflow
          </DialogTitle>
          <DialogDescription>
            Seleziona un workflow salvato o carica un template pubblico
          </DialogDescription>
        </DialogHeader>

        {/* Load by share code */}
        <div className="flex gap-2">
          <Input
            placeholder="Inserisci codice condivisione (es: wf-abc123)"
            value={shareCodeInput}
            onChange={(e) => setShareCodeInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLoadByCode()}
          />
          <Button onClick={handleLoadByCode} disabled={!shareCodeInput.trim()}>
            Carica
          </Button>
        </div>
        
        <Tabs defaultValue="mine" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="mine" className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              I Miei Workflow
            </TabsTrigger>
            <TabsTrigger value="public" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Template Pubblici
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mine">
            <ScrollArea className="h-[350px] pr-4">
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
                    <WorkflowCard key={workflow.id} workflow={workflow} isOwner={true} />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="public">
            <ScrollArea className="h-[350px] pr-4">
              {publicWorkflows.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <Users className="h-12 w-12 mb-2 opacity-50" />
                  <p>Nessun template pubblico disponibile</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {publicWorkflows.map((workflow) => (
                    <WorkflowCard key={workflow.id} workflow={workflow} showActions={false} />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
