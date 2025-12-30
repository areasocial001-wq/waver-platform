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
  is_public: boolean;
  share_code: string | null;
  created_at: string;
  updated_at: string;
  user_id?: string;
}

export const useWorkflows = () => {
  const [workflows, setWorkflows] = useState<SavedWorkflow[]>([]);
  const [publicWorkflows, setPublicWorkflows] = useState<SavedWorkflow[]>([]);
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
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;

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

  const fetchPublicWorkflows = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("ai_workflows")
        .select("*")
        .eq("is_public", true)
        .order("updated_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const parsed = (data || []).map((w) => ({
        ...w,
        nodes: Array.isArray(w.nodes) ? w.nodes as unknown as WorkflowNode[] : [],
        edges: Array.isArray(w.edges) ? w.edges as unknown as WorkflowEdge[] : [],
      }));

      setPublicWorkflows(parsed);
    } catch (err: any) {
      console.error("Error fetching public workflows:", err);
    }
  }, []);

  const saveWorkflow = useCallback(async (
    name: string,
    description: string,
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    existingId?: string,
    isPublic?: boolean
  ): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Devi essere autenticato per salvare workflow");
        return null;
      }

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

      // Generate share code if making public
      const shareCode = isPublic ? `wf-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 6)}` : null;

      if (existingId) {
        const updateData: any = {
          name,
          description,
          nodes: cleanNodes,
          edges: cleanEdges,
        };
        
        if (typeof isPublic === "boolean") {
          updateData.is_public = isPublic;
          if (isPublic) {
            updateData.share_code = shareCode;
          }
        }

        const { error } = await supabase
          .from("ai_workflows")
          .update(updateData)
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
            is_public: isPublic || false,
            share_code: isPublic ? shareCode : null,
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

  const togglePublic = useCallback(async (id: string, isPublic: boolean): Promise<string | null> => {
    try {
      const shareCode = isPublic ? `wf-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 6)}` : null;
      
      const { data, error } = await supabase
        .from("ai_workflows")
        .update({ 
          is_public: isPublic,
          share_code: shareCode,
        })
        .eq("id", id)
        .select("share_code")
        .single();

      if (error) throw error;
      
      toast.success(isPublic ? "Workflow condiviso pubblicamente" : "Workflow reso privato");
      fetchWorkflows();
      return data?.share_code || null;
    } catch (err: any) {
      console.error("Error toggling public:", err);
      toast.error("Errore nel cambio visibilità");
      return null;
    }
  }, [fetchWorkflows]);

  const loadByShareCode = useCallback(async (shareCode: string): Promise<SavedWorkflow | null> => {
    try {
      const { data, error } = await supabase
        .from("ai_workflows")
        .select("*")
        .eq("share_code", shareCode)
        .eq("is_public", true)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast.error("Workflow non trovato o non pubblico");
        return null;
      }

      return {
        ...data,
        nodes: Array.isArray(data.nodes) ? data.nodes as unknown as WorkflowNode[] : [],
        edges: Array.isArray(data.edges) ? data.edges as unknown as WorkflowEdge[] : [],
      };
    } catch (err: any) {
      console.error("Error loading by share code:", err);
      toast.error("Errore nel caricamento del workflow");
      return null;
    }
  }, []);

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
    fetchPublicWorkflows();
  }, [fetchWorkflows, fetchPublicWorkflows]);

  return {
    workflows,
    publicWorkflows,
    isLoading,
    saveWorkflow,
    deleteWorkflow,
    togglePublic,
    loadByShareCode,
    refreshWorkflows: fetchWorkflows,
    refreshPublicWorkflows: fetchPublicWorkflows,
  };
};
