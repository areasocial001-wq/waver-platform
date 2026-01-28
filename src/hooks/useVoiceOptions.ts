import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface VoiceOption {
  id: string;
  name: string;
  description: string;
  isCloned?: boolean;
}

// Default ElevenLabs voices
export const DEFAULT_VOICE_OPTIONS: VoiceOption[] = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", description: "Voce femminile naturale, multilingue" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", description: "Voce maschile profonda e autorevole" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", description: "Voce maschile calda e narrativa" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", description: "Voce femminile giovane e dinamica" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", description: "Voce maschile chiara e professionale" },
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", description: "Voce femminile matura e rassicurante" },
  { id: "9BWtsMINqrJLrRacOk9x", name: "Aria", description: "Voce femminile espressiva e coinvolgente" },
  { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger", description: "Voce maschile calda e avvolgente" },
];

export interface ClonedVoice {
  id: string;
  elevenlabs_voice_id: string;
  name: string;
  description?: string;
  created_at: string;
}

export function useVoiceOptions() {
  const [clonedVoices, setClonedVoices] = useState<ClonedVoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadClonedVoices = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setClonedVoices([]);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('cloned_voices')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading cloned voices:', error);
        setClonedVoices([]);
      } else {
        setClonedVoices(data || []);
      }
    } catch (error) {
      console.error('Error loading cloned voices:', error);
      setClonedVoices([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClonedVoices();
    
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadClonedVoices();
    });

    // Listen for custom event for updates from VoiceCloneDialog
    const handleVoicesUpdated = () => loadClonedVoices();
    window.addEventListener("cloned-voices-updated", handleVoicesUpdated);
    
    return () => {
      subscription.unsubscribe();
      window.removeEventListener("cloned-voices-updated", handleVoicesUpdated);
    };
  }, [loadClonedVoices]);

  const allVoiceOptions: VoiceOption[] = [
    ...DEFAULT_VOICE_OPTIONS,
    ...clonedVoices.map(v => ({
      id: v.elevenlabs_voice_id,
      name: `${v.name} (Clonata)`,
      description: v.description || "Voce clonata personalizzata",
      isCloned: true,
    })),
  ];

  return {
    voiceOptions: allVoiceOptions,
    defaultVoices: DEFAULT_VOICE_OPTIONS,
    clonedVoices,
    hasClonedVoices: clonedVoices.length > 0,
    isLoading,
    refresh: loadClonedVoices,
  };
}
