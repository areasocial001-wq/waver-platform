/**
 * Resolve which TTS edge-function to call based on user provider preference.
 *
 * Rules:
 *  - If the user picked Inworld → "inworld-tts" (unless the voice is a cloned
 *    ElevenLabs voice, in which case we MUST stay on ElevenLabs because cloned
 *    timbres are not transferable across providers).
 *  - If the user picked ElevenLabs (default) → "elevenlabs-tts" (which itself
 *    will fall back to Inworld server-side for non-cloned voices on 401/402/429).
 *  - Auto resolves to ElevenLabs (current behavior).
 */
import type { ProviderType } from "./providerConfig";

// ElevenLabs default voice IDs — anything outside this list is treated as a
// cloned voice that must stay on ElevenLabs.
const ELEVENLABS_DEFAULT_VOICE_IDS = new Set<string>([
  "EXAVITQu4vr4xnSDxMaL", // Sarah
  "JBFqnCBsd6RMkjVDRZzb", // George
  "onwK4e9ZLuTAKqWW03F9", // Daniel
  "pFZP5JQG7iQjIQuC4Bku", // Lily
  "TX3LPaxmHKxFdv7VOQHJ", // Liam
  "XrExE9yKIg1WjnnlVkGX", // Matilda
  "9BWtsMINqrJLrRacOk9x", // Aria
  "CwhRBWXzGAHq8TQ4Fs17", // Roger
  "FGY2WhTYpPnrIDTdsKH5", // Laura
  "IKne3meq5aSn9XLyUdCD", // Charlie
  "N2lVS1w4EtoT3dr4eOWO", // Callum
  "SAz9YHcvj6GT2YYXdXww", // River
  "Xb7hH8MSUJpSbSDYk0k2", // Alice
  "bIHbv24MWmeRgasZH58o", // Will
  "cgSgspJ2msm6clMCkdW9", // Jessica
  "cjVigY5qzO86Huf0OWal", // Eric
  "iP95p4xoKVk53GoZ742B", // Chris
  "nPczCjzI2devNBz1zQrb", // Brian
]);

export type TtsEndpoint = "elevenlabs-tts" | "inworld-tts";

export interface ResolveTtsEndpointArgs {
  /** User's preference for text_to_speech operation. */
  preference: ProviderType;
  /** Voice ID being requested (used to detect cloned ElevenLabs voices). */
  voiceId?: string;
}

export interface ResolveTtsEndpointResult {
  endpoint: TtsEndpoint;
  /** True if we forced ElevenLabs because the voice is cloned. */
  forcedElevenLabs: boolean;
  /** True if the voice is a cloned ElevenLabs voice. */
  isClonedVoice: boolean;
}

export function resolveTtsEndpoint(
  args: ResolveTtsEndpointArgs,
): ResolveTtsEndpointResult {
  const { preference, voiceId } = args;
  const isClonedVoice = !!voiceId && !ELEVENLABS_DEFAULT_VOICE_IDS.has(voiceId);

  // Cloned ElevenLabs voices must always go through ElevenLabs.
  if (isClonedVoice) {
    return {
      endpoint: "elevenlabs-tts",
      forcedElevenLabs: preference === "inworld",
      isClonedVoice: true,
    };
  }

  if (preference === "inworld") {
    return { endpoint: "inworld-tts", forcedElevenLabs: false, isClonedVoice: false };
  }

  // Default / elevenlabs / auto / aiml / piapi → ElevenLabs (which has its own
  // server-side Inworld fallback for non-cloned voices on rate-limit/credit errors).
  return { endpoint: "elevenlabs-tts", forcedElevenLabs: false, isClonedVoice: false };
}
