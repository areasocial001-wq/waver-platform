import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { BatchScene } from '@/components/TalkingAvatarBatch';
import type { TimelineClip } from '@/components/TalkingAvatarTimeline';

export interface TalkingAvatarProject {
  id: string;
  name: string;
  description?: string;
  scenes: BatchScene[];
  timeline_clips: TimelineClip[];
  reference_images: Array<{ id: string; url: string; name: string }>;
  background_music_url?: string;
  background_music_emotion?: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface ReferenceImage {
  id: string;
  url: string;
  name: string;
  isActive?: boolean;
}

export function useTalkingAvatarProjects() {
  const [projects, setProjects] = useState<TalkingAvatarProject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  // Fetch all projects for current user
  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setProjects([]);
        return;
      }

      const { data, error } = await supabase
        .from('talking_avatar_projects')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Cast the JSON fields to their proper types
      const typedProjects = (data || []).map(p => ({
        ...p,
        scenes: (p.scenes as unknown as BatchScene[]) || [],
        timeline_clips: (p.timeline_clips as unknown as TimelineClip[]) || [],
        reference_images: (p.reference_images as unknown as ReferenceImage[]) || [],
        settings: (p.settings as Record<string, unknown>) || {},
      }));

      setProjects(typedProjects);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Errore sconosciuto';
      console.error('Error fetching projects:', error);
      toast.error(`Errore caricamento progetti: ${message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save new project or update existing
  const saveProject = useCallback(async (
    name: string,
    description: string,
    scenes: BatchScene[],
    timelineClips: TimelineClip[],
    referenceImages: ReferenceImage[],
    backgroundMusicUrl?: string,
    backgroundMusicEmotion?: string,
    settings?: Record<string, unknown>,
    existingId?: string
  ): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Devi essere autenticato per salvare');
        return null;
      }

      // Prepare data as JSON-compatible arrays
      const scenesJson = JSON.parse(JSON.stringify(scenes));
      const clipsJson = JSON.parse(JSON.stringify(timelineClips));
      const imagesJson = referenceImages.map(img => ({
        id: img.id,
        url: img.url,
        name: img.name,
      }));

      const projectData = {
        name,
        description,
        scenes: scenesJson,
        timeline_clips: clipsJson,
        reference_images: imagesJson,
        background_music_url: backgroundMusicUrl || null,
        background_music_emotion: backgroundMusicEmotion || null,
        settings: JSON.parse(JSON.stringify(settings || {})),
        user_id: user.id,
      } as const;

      if (existingId) {
        const { error } = await supabase
          .from('talking_avatar_projects')
          .update(projectData)
          .eq('id', existingId)
          .eq('user_id', user.id);

        if (error) throw error;
        toast.success('Progetto aggiornato!');
        await fetchProjects();
        return existingId;
      } else {
        const { data, error } = await supabase
          .from('talking_avatar_projects')
          .insert(projectData)
          .select('id')
          .single();

        if (error) throw error;
        toast.success('Progetto salvato!');
        setCurrentProjectId(data.id);
        await fetchProjects();
        return data.id;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Errore sconosciuto';
      console.error('Error saving project:', error);
      toast.error(`Errore salvataggio: ${message}`);
      return null;
    }
  }, [fetchProjects]);

  // Load a project
  const loadProject = useCallback(async (projectId: string): Promise<TalkingAvatarProject | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Devi essere autenticato');
        return null;
      }

      const { data, error } = await supabase
        .from('talking_avatar_projects')
        .select('*')
        .eq('id', projectId)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      const typedProject: TalkingAvatarProject = {
        ...data,
        scenes: (data.scenes as unknown as BatchScene[]) || [],
        timeline_clips: (data.timeline_clips as unknown as TimelineClip[]) || [],
        reference_images: (data.reference_images as unknown as ReferenceImage[]) || [],
        settings: (data.settings as Record<string, unknown>) || {},
      };

      setCurrentProjectId(projectId);
      toast.success('Progetto caricato!');
      return typedProject;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Errore sconosciuto';
      console.error('Error loading project:', error);
      toast.error(`Errore caricamento: ${message}`);
      return null;
    }
  }, []);

  // Delete a project
  const deleteProject = useCallback(async (projectId: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Devi essere autenticato');
        return false;
      }

      const { error } = await supabase
        .from('talking_avatar_projects')
        .delete()
        .eq('id', projectId)
        .eq('user_id', user.id);

      if (error) throw error;

      if (currentProjectId === projectId) {
        setCurrentProjectId(null);
      }

      toast.success('Progetto eliminato!');
      await fetchProjects();
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Errore sconosciuto';
      console.error('Error deleting project:', error);
      toast.error(`Errore eliminazione: ${message}`);
      return false;
    }
  }, [currentProjectId, fetchProjects]);

  // Initial fetch
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return {
    projects,
    isLoading,
    currentProjectId,
    setCurrentProjectId,
    fetchProjects,
    saveProject,
    loadProject,
    deleteProject,
  };
}

// Emotion to music prompt mapping
export const EMOTION_MUSIC_PROMPTS: Record<string, string> = {
  happy: 'Uplifting cheerful orchestral music, major key, light and joyful, feel-good background score',
  sad: 'Melancholic piano and strings, minor key, emotional and touching, cinematic sad atmosphere',
  surprised: 'Dramatic orchestral hit with suspenseful strings, mysterious and intriguing, cinematic surprise',
  angry: 'Intense dramatic music, powerful percussion, tension building, aggressive undertones',
  neutral: 'Calm ambient background music, neutral mood, corporate professional, subtle and unobtrusive',
  thinking: 'Contemplative piano with soft pads, thoughtful atmosphere, intellectual and curious mood',
  excited: 'Energetic upbeat electronic music, high tempo, enthusiastic and dynamic, celebration vibes',
  confident: 'Bold confident orchestral theme, heroic and powerful, triumphant brass and strings',
};

// Detect dominant emotion from scenes
export function detectDominantEmotion(scenes: BatchScene[]): string {
  if (scenes.length === 0) return 'neutral';

  const emotionCounts: Record<string, number> = {};
  
  for (const scene of scenes) {
    emotionCounts[scene.expression] = (emotionCounts[scene.expression] || 0) + 1;
  }

  let dominantEmotion = 'neutral';
  let maxCount = 0;

  for (const [emotion, count] of Object.entries(emotionCounts)) {
    if (count > maxCount) {
      maxCount = count;
      dominantEmotion = emotion;
    }
  }

  return dominantEmotion;
}
