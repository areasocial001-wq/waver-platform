import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface VoiceOption {
  id: string;
  name: string;
  description: string;
  isCloned?: boolean;
}

// Supported languages for ElevenLabs multilingual_v2
export interface LanguageOption {
  code: string;
  name: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "it", name: "Italiano", flag: "🇮🇹" },
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "pt", name: "Português", flag: "🇵🇹" },
  { code: "pl", name: "Polski", flag: "🇵🇱" },
  { code: "ja", name: "日本語", flag: "🇯🇵" },
  { code: "zh", name: "中文", flag: "🇨🇳" },
  { code: "ko", name: "한국어", flag: "🇰🇷" },
];

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

/**
 * Inworld TTS voice catalog. The `id` matches the Inworld voice name (the API
 * accepts a name like "Sarah" directly), and is what we send when the user
 * picks the Inworld provider for narration.
 */
export const INWORLD_VOICE_OPTIONS: VoiceOption[] = [
  { id: "Sarah",    name: "Sarah",    description: "Femminile naturale" },
  { id: "Olivia",   name: "Olivia",   description: "Femminile giovane" },
  { id: "Ashley",   name: "Ashley",   description: "Femminile matura" },
  { id: "Wendy",    name: "Wendy",    description: "Femminile calda" },
  { id: "Julia",    name: "Julia",    description: "Femminile espressiva" },
  { id: "Pixie",    name: "Pixie",    description: "Femminile vivace" },
  { id: "Deborah",  name: "Deborah",  description: "Femminile rassicurante" },
  { id: "Priya",    name: "Priya",    description: "Femminile internazionale" },
  { id: "Liam",     name: "Liam",     description: "Maschile chiaro" },
  { id: "Mark",     name: "Mark",     description: "Maschile narrativo" },
  { id: "Edward",   name: "Edward",   description: "Maschile profondo" },
  { id: "Roger",    name: "Roger",    description: "Maschile caldo" },
  { id: "Alex",     name: "Alex",     description: "Maschile professionale" },
  { id: "Dennis",   name: "Dennis",   description: "Maschile autorevole" },
  { id: "Theodore", name: "Theodore", description: "Maschile neutro" },
  { id: "Ronald",   name: "Ronald",   description: "Maschile maturo" },
  { id: "Craig",    name: "Craig",    description: "Maschile colloquiale" },
  { id: "Hades",    name: "Hades",    description: "Maschile drammatico" },
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
