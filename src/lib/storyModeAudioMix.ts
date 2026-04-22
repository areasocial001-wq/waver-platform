/**
 * Story Mode global Audio Mix preferences.
 * - localStorage cache for synchronous reads inside render hot paths.
 * - Mirrored to public.user_preferences.story_mode_audio_mix (jsonb).
 *
 * These values are the GLOBAL DEFAULTS applied to every new render; the
 * per-render dialog can still override them locally.
 */

import { supabase } from "@/integrations/supabase/client";

export type AudioMixPreset = "balanced" | "voice-forward" | "cinematic" | "music-bed" | "custom";

export interface StoryModeAudioMix {
  /** Voice/narration linear volume, 0-100 */
  narrationVolume: number;
  /** Ambient soundscape (wind, sea, forest…) — kept low so it never overwhelms the voice. 0-100 */
  ambienceVolume: number;
  /** Punctual sound effects (footsteps, doors, stingers). 0-100 */
  sfxVolume: number;
  /** Background music bed. 0-100 */
  musicVolume: number;
  /** When true, the server applies a per-scene auto-mix that keeps narration dominant
   *  by ducking music+ambience under voice and normalising overall loudness. */
  autoMix: boolean;
  /** Target loudness in LUFS (negative). Reasonable range -23..-9. -14 ≈ streaming standard. */
  lufsTarget: number;
  /** Last preset key the user picked (purely cosmetic — drives the highlighted button). */
  preset: AudioMixPreset;
}

export const DEFAULT_AUDIO_MIX: StoryModeAudioMix = {
  narrationVolume: 100,
  ambienceVolume: 18,
  sfxVolume: 22,
  musicVolume: 25,
  autoMix: true,
  lufsTarget: -14,
  preset: "balanced",
};

export const AUDIO_MIX_PRESETS: Record<Exclude<AudioMixPreset, "custom">, Omit<StoryModeAudioMix, "preset">> = {
  balanced: {
    narrationVolume: 100, ambienceVolume: 18, sfxVolume: 22, musicVolume: 25,
    autoMix: true, lufsTarget: -14,
  },
  "voice-forward": {
    narrationVolume: 100, ambienceVolume: 12, sfxVolume: 16, musicVolume: 14,
    autoMix: true, lufsTarget: -14,
  },
  cinematic: {
    narrationVolume: 92, ambienceVolume: 28, sfxVolume: 32, musicVolume: 38,
    autoMix: true, lufsTarget: -14,
  },
  "music-bed": {
    narrationVolume: 75, ambienceVolume: 14, sfxVolume: 18, musicVolume: 55,
    autoMix: false, lufsTarget: -16,
  },
};

const KEY = "story_mode_audio_mix_v1";

const sanitize = (raw: Partial<StoryModeAudioMix> | null | undefined): StoryModeAudioMix => {
  const clamp = (v: unknown, lo: number, hi: number, def: number) => {
    const n = typeof v === "number" && Number.isFinite(v) ? v : def;
    return Math.max(lo, Math.min(hi, n));
  };
  return {
    narrationVolume: clamp(raw?.narrationVolume, 0, 200, DEFAULT_AUDIO_MIX.narrationVolume),
    ambienceVolume: clamp(raw?.ambienceVolume, 0, 200, DEFAULT_AUDIO_MIX.ambienceVolume),
    sfxVolume: clamp(raw?.sfxVolume, 0, 200, DEFAULT_AUDIO_MIX.sfxVolume),
    musicVolume: clamp(raw?.musicVolume, 0, 200, DEFAULT_AUDIO_MIX.musicVolume),
    autoMix: raw?.autoMix ?? DEFAULT_AUDIO_MIX.autoMix,
    lufsTarget: clamp(raw?.lufsTarget, -30, -6, DEFAULT_AUDIO_MIX.lufsTarget),
    preset: (raw?.preset as AudioMixPreset) ?? DEFAULT_AUDIO_MIX.preset,
  };
};

/** Synchronous read used by hot paths. Returns local cache or defaults. */
export const getAudioMix = (): StoryModeAudioMix => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_AUDIO_MIX;
    return sanitize(JSON.parse(raw));
  } catch {
    return DEFAULT_AUDIO_MIX;
  }
};

/** Write to local cache + best-effort sync to Supabase. */
export const setAudioMix = (next: StoryModeAudioMix): void => {
  const safe = sanitize(next);
  try {
    localStorage.setItem(KEY, JSON.stringify(safe));
  } catch {
    /* noop */
  }
  void saveAudioMixToSupabase(safe);
};

export const loadAudioMixFromSupabase = async (): Promise<StoryModeAudioMix> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return getAudioMix();

    const { data, error } = await supabase
      .from("user_preferences")
      .select("story_mode_audio_mix")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !data) return getAudioMix();

    const remote = sanitize((data as { story_mode_audio_mix?: Partial<StoryModeAudioMix> | null }).story_mode_audio_mix);
    try {
      localStorage.setItem(KEY, JSON.stringify(remote));
    } catch { /* noop */ }
    return remote;
  } catch {
    return getAudioMix();
  }
};

export const saveAudioMixToSupabase = async (mix: StoryModeAudioMix): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await (supabase as any)
      .from("user_preferences")
      .upsert(
        [{ user_id: user.id, story_mode_audio_mix: sanitize(mix) }],
        { onConflict: "user_id" },
      );
  } catch {
    /* noop — local cache still works */
  }
};
