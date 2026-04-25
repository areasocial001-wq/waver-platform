/**
 * Resolve which TTS edge-function to call.
 *
 * ElevenLabs has been removed from the platform. All TTS now goes through
 * Inworld TTS, which supports the legacy ElevenLabs voice IDs via internal
 * mapping plus its own native voices and IVC (instant voice cloning).
 *
 * The hook returns a stable "elevenlabs-tts" endpoint name only as a
 * compatibility alias — the deployed edge function with that name is just a
 * thin proxy that forwards to `inworld-tts`. Callers should prefer
 * "inworld-tts" directly.
 */
import type { ProviderType } from "./providerConfig";

export type TtsEndpoint = "inworld-tts";

export interface ResolveTtsEndpointArgs {
  preference: ProviderType;
  voiceId?: string;
}

export interface ResolveTtsEndpointResult {
  endpoint: TtsEndpoint;
  forcedElevenLabs: boolean;
  isClonedVoice: boolean;
}

export function resolveTtsEndpoint(
  _args: ResolveTtsEndpointArgs,
): ResolveTtsEndpointResult {
  return {
    endpoint: "inworld-tts",
    forcedElevenLabs: false,
    isClonedVoice: false,
  };
}
