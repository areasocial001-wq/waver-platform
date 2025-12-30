import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { WorkflowNode, WorkflowEdge } from "../components/freepik-workflow/types";

export interface SavedWorkflow {
  id: string;
  name: string;
  description: string | null;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  is_template: boolean;
  created_at: string;
  updated_at: string;
}

export const useWorkflows = () => {
  const [workflows, setWorkflows] = useState<SavedWorkflow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchWorkflows = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setWorkflows([]);
        return;
      }

      const { data, error } = await supabase
        .from("ai_workflows")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) throw error;

      // Parse JSONB nodes and edges
      const parsed = (data || []).map((w) => ({
        ...w,
        nodes: Array.isArray(w.nodes) ? w.nodes as unknown as WorkflowNode[] : [],
        edges: Array.isArray(w.edges) ? w.edges as unknown as WorkflowEdge[] : [],
      }));

      setWorkflows(parsed);
    } catch (err: any) {
      console.error("Error fetching workflows:", err);
      toast.error("Errore nel caricamento dei workflow");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveWorkflow = useCallback(async (
    name: string,
    description: string,
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    existingId?: string
  ): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Devi essere autenticato per salvare workflow");
        return null;
      }

      // Clean nodes data - remove any circular references
      const cleanNodes = nodes.map(n => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data,
      }));

      const cleanEdges = edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        animated: e.animated,
        style: e.style,
      }));

      if (existingId) {
        const { error } = await supabase
          .from("ai_workflows")
          .update({
            name,
            description,
            nodes: cleanNodes as any,
            edges: cleanEdges as any,
          })
          .eq("id", existingId);

        if (error) throw error;
        toast.success("Workflow aggiornato");
        fetchWorkflows();
        return existingId;
      } else {
        const { data, error } = await supabase
          .from("ai_workflows")
          .insert({
            user_id: user.id,
            name,
            description,
            nodes: cleanNodes as any,
            edges: cleanEdges as any,
          })
          .select("id")
          .single();

        if (error) throw error;
        toast.success("Workflow salvato");
        fetchWorkflows();
        return data.id;
      }
    } catch (err: any) {
      console.error("Error saving workflow:", err);
      toast.error("Errore nel salvataggio del workflow");
      return null;
    }
  }, [fetchWorkflows]);

  const deleteWorkflow = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from("ai_workflows")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Workflow eliminato");
      fetchWorkflows();
    } catch (err: any) {
      console.error("Error deleting workflow:", err);
      toast.error("Errore nell'eliminazione del workflow");
    }
  }, [fetchWorkflows]);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  return {
    workflows,
    isLoading,
    saveWorkflow,
    deleteWorkflow,
    refreshWorkflows: fetchWorkflows,
  };
};
