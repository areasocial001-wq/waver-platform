import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface StoryboardCharacter {
  id: string;
  name: string;
  description: string | null;
  reference_images: string[]; // array of image URLs
  color: string;
  storyboard_id: string;
}

export function useStoryboardCharacters(storyboardId: string | null) {
  const [characters, setCharacters] = useState<StoryboardCharacter[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCharacters = useCallback(async () => {
    if (!storyboardId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("storyboard_characters")
        .select("*")
        .eq("storyboard_id", storyboardId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setCharacters(
        (data || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          reference_images: (c.reference_images as string[]) || [],
          color: c.color,
          storyboard_id: c.storyboard_id,
        }))
      );
    } catch (err: any) {
      console.error("Error fetching characters:", err);
    } finally {
      setLoading(false);
    }
  }, [storyboardId]);

  useEffect(() => {
    fetchCharacters();
  }, [fetchCharacters]);

  const addCharacter = useCallback(
    async (name: string, description?: string, color?: string) => {
      if (!storyboardId) {
        toast.error("Salva prima lo storyboard per aggiungere personaggi");
        return null;
      }

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Non autenticato");

        const { data, error } = await supabase
          .from("storyboard_characters")
          .insert({
            user_id: user.id,
            storyboard_id: storyboardId,
            name,
            description: description || null,
            color: color || "#6366f1",
            reference_images: [],
          })
          .select()
          .single();

        if (error) throw error;

        const newChar: StoryboardCharacter = {
          id: data.id,
          name: data.name,
          description: data.description,
          reference_images: [],
          color: data.color,
          storyboard_id: data.storyboard_id,
        };

        setCharacters((prev) => [...prev, newChar]);
        toast.success(`Personaggio "${name}" creato!`);
        return newChar;
      } catch (err: any) {
        console.error("Error adding character:", err);
        toast.error("Errore nella creazione del personaggio");
        return null;
      }
    },
    [storyboardId]
  );

  const updateCharacter = useCallback(
    async (id: string, updates: Partial<Pick<StoryboardCharacter, "name" | "description" | "color" | "reference_images">>) => {
      try {
        const { error } = await supabase
          .from("storyboard_characters")
          .update(updates)
          .eq("id", id);

        if (error) throw error;

        setCharacters((prev) =>
          prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
        );
      } catch (err: any) {
        console.error("Error updating character:", err);
        toast.error("Errore nell'aggiornamento");
      }
    },
    []
  );

  const addReferenceImage = useCallback(
    async (characterId: string, imageUrl: string) => {
      const char = characters.find((c) => c.id === characterId);
      if (!char) return;

      const newImages = [...char.reference_images, imageUrl];
      await updateCharacter(characterId, { reference_images: newImages });
      toast.success("Immagine di riferimento aggiunta!");
    },
    [characters, updateCharacter]
  );

  const removeReferenceImage = useCallback(
    async (characterId: string, imageIndex: number) => {
      const char = characters.find((c) => c.id === characterId);
      if (!char) return;

      const newImages = char.reference_images.filter((_, i) => i !== imageIndex);
      await updateCharacter(characterId, { reference_images: newImages });
    },
    [characters, updateCharacter]
  );

  const deleteCharacter = useCallback(
    async (id: string) => {
      try {
        const { error } = await supabase
          .from("storyboard_characters")
          .delete()
          .eq("id", id);

        if (error) throw error;

        setCharacters((prev) => prev.filter((c) => c.id !== id));
        toast.success("Personaggio eliminato");
      } catch (err: any) {
        console.error("Error deleting character:", err);
        toast.error("Errore nell'eliminazione");
      }
    },
    []
  );

  // Get reference images for all characters assigned to a panel
  const getCharacterRefsForPanel = useCallback(
    (panelCharacterIds: string[]): string[] => {
      return characters
        .filter((c) => panelCharacterIds.includes(c.id))
        .flatMap((c) => c.reference_images);
    },
    [characters]
  );

  return {
    characters,
    loading,
    addCharacter,
    updateCharacter,
    addReferenceImage,
    removeReferenceImage,
    deleteCharacter,
    getCharacterRefsForPanel,
    refetch: fetchCharacters,
  };
}
