/**
 * Client-side helper that resolves the user's audio provider preference into
 * the `provider` field expected by the audio edge functions.
 *
 * ElevenLabs has been removed from the platform; AIML stable-audio is the
 * only backend for music/SFX. The function now always returns "aiml".
 */
import type { ProviderType } from "./providerConfig";

export type AudioProviderRoute = "aiml";

export function resolveAudioProvider(_pref: ProviderType | undefined): AudioProviderRoute {
  return "aiml";
}

export function getStoredAudioProvider(
  _operation: "music_generation" | "sound_effects",
): AudioProviderRoute {
  return "aiml";
}
