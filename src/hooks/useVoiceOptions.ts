import { useState, useEffect, useCallback } from "react";

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

const CLONED_VOICES_KEY = "cloned-voices";

interface ClonedVoice {
  id: string;
  name: string;
  isCloned: true;
  createdAt?: string;
}

const getStoredClonedVoices = (): ClonedVoice[] => {
  try {
    const stored = localStorage.getItem(CLONED_VOICES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export function useVoiceOptions() {
  const [clonedVoices, setClonedVoices] = useState<ClonedVoice[]>([]);

  const loadClonedVoices = useCallback(() => {
    setClonedVoices(getStoredClonedVoices());
  }, []);

  useEffect(() => {
    loadClonedVoices();
    
    // Listen for storage changes (in case voice is cloned in another tab/component)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === CLONED_VOICES_KEY) {
        loadClonedVoices();
      }
    };
    
    window.addEventListener("storage", handleStorageChange);
    
    // Also listen for custom event for same-tab updates
    const handleVoicesUpdated = () => loadClonedVoices();
    window.addEventListener("cloned-voices-updated", handleVoicesUpdated);
    
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("cloned-voices-updated", handleVoicesUpdated);
    };
  }, [loadClonedVoices]);

  const allVoiceOptions: VoiceOption[] = [
    ...DEFAULT_VOICE_OPTIONS,
    ...clonedVoices.map(v => ({
      id: v.id,
      name: `${v.name} (Clonata)`,
      description: "Voce clonata personalizzata",
      isCloned: true,
    })),
  ];

  return {
    voiceOptions: allVoiceOptions,
    defaultVoices: DEFAULT_VOICE_OPTIONS,
    clonedVoices,
    hasClonedVoices: clonedVoices.length > 0,
    refresh: loadClonedVoices,
  };
}
