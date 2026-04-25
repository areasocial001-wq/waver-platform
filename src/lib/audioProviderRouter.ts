/**
 * Client-side helper that resolves the user's audio provider preference
 * (Settings → Provider AI) into the `provider` field expected by the
 * `elevenlabs-music` and `elevenlabs-sfx` edge functions.
 *
 * Both functions accept:
 *   - 'auto'        → try ElevenLabs, fall back to AIML on 401/402/429
 *   - 'aiml'        → skip ElevenLabs entirely, go straight to AIML
 *   - 'elevenlabs'  → force ElevenLabs only (no AIML fallback)
 *
 * The user-facing preference can be 'auto' | 'aiml' | 'elevenlabs' | 'piapi'.
 * For PiAPI we don't route through these endpoints (use piapi-audio instead).
 */
import type { ProviderType } from "./providerConfig";

export type AudioProviderRoute = "auto" | "aiml" | "elevenlabs";

export function resolveAudioProvider(pref: ProviderType | undefined): AudioProviderRoute {
  if (pref === "elevenlabs") return "elevenlabs";
  if (pref === "aiml") return "aiml";
  // 'auto' (now defaults to AIML), 'piapi', 'inworld', undefined → aiml
  return "aiml";
}

/**
 * Read the cached provider preferences from localStorage without needing the
 * React hook (useful in non-component code paths).
 */
export function getStoredAudioProvider(
  operation: "music_generation" | "sound_effects"
): AudioProviderRoute {
  try {
    const raw = localStorage.getItem("ai-provider-preferences");
    if (!raw) return "auto";
    const parsed = JSON.parse(raw) as Partial<Record<string, ProviderType>>;
    return resolveAudioProvider(parsed[operation]);
  } catch {
    return "auto";
  }
}
