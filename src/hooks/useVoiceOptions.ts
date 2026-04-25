import { useState, useEffect, useCallback } from "react";

export interface VoiceOption {
  id: string;
  name: string;
  description: string;
  isCloned?: boolean;
}

// Supported languages for Inworld multilingual TTS
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

/**
 * Default voice catalog. We keep the historical ElevenLabs voice IDs as the
 * `id` values because they are persisted in many existing projects (scenes,
 * storyboards, talking-avatar configs). The `inworld-tts` edge function maps
 * each one to an equivalent Inworld voice on the fly, so users see no break.
 */
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
 * Native Inworld TTS voice catalog. The `id` is the Inworld voice name (the
 * API accepts a name like "Sarah" directly).
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


/**
 * Legacy shape kept for backwards-compatibility with components that still
 * reference cloned voices. Voice cloning is being migrated to Inworld IVC,
 * so we no longer keep a local table — this hook always returns an empty
 * cloned-voice list until the new flow ships.
 */
export interface ClonedVoice {
  id: string;
  /** Kept for backwards-compatibility — no longer populated. */
  elevenlabs_voice_id: string;
  name: string;
  description?: string;
  created_at: string;
}

export function useVoiceOptions() {
  const [clonedVoices] = useState<ClonedVoice[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    // No-op: cloned voices are managed by Inworld IVC now.
    setIsLoading(false);
  }, []);

  useEffect(() => {
    setIsLoading(false);
  }, []);

  return {
    voiceOptions: DEFAULT_VOICE_OPTIONS,
    defaultVoices: DEFAULT_VOICE_OPTIONS,
    clonedVoices,
    hasClonedVoices: false,
    isLoading,
    refresh,
  };
}
