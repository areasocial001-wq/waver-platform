import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { PromptTemplate } from '@/components/AIPromptAssistant';

export const usePromptTemplates = () => {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setTemplates([]);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('prompt_templates')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mappedTemplates: PromptTemplate[] = (data || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        category: t.category,
        mainPrompt: t.main_prompt,
        cameraMovement: t.camera_movement || '',
        audioSuggestion: t.audio_suggestion || '',
        style: t.style || '',
        duration: t.duration || 6,
        keywords: t.keywords || [],
        createdAt: new Date(t.created_at),
      }));

      setTemplates(mappedTemplates);
    } catch (error: any) {
      console.error('Error fetching templates:', error);
      toast.error('Errore nel caricamento dei template');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const saveTemplate = async (template: PromptTemplate) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Devi effettuare il login per salvare i template');
        return false;
      }

      const { error } = await supabase
        .from('prompt_templates')
        .insert({
          user_id: user.id,
          name: template.name,
          category: template.category,
          main_prompt: template.mainPrompt,
          camera_movement: template.cameraMovement,
          audio_suggestion: template.audioSuggestion,
          style: template.style,
          duration: template.duration,
          keywords: template.keywords,
        });

      if (error) throw error;

      await fetchTemplates();
      return true;
    } catch (error: any) {
      console.error('Error saving template:', error);
      toast.error('Errore nel salvataggio del template');
      return false;
    }
  };

  const deleteTemplate = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from('prompt_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      setTemplates(prev => prev.filter(t => t.id !== templateId));
      toast.success('Template eliminato');
      return true;
    } catch (error: any) {
      console.error('Error deleting template:', error);
      toast.error('Errore nell\'eliminazione del template');
      return false;
    }
  };

  return {
    templates,
    isLoading,
    saveTemplate,
    deleteTemplate,
    refetch: fetchTemplates,
  };
};