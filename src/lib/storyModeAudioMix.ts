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

/** Per-channel maximum allowed level (in dBFS RMS). The render report uses
 *  these to flag scenes whose ambience/SFX/music exceed the headroom budget. */
export interface AudioHeadroom {
  /** Maximum RMS for narration. Above this we warn for clipping risk. Default -10. */
  voiceMaxDb: number;
  /** Max RMS for ambience. Default -22 (≈12dB below voice). */
  ambienceMaxDb: number;
  /** Max RMS for SFX. Default -18. */
  sfxMaxDb: number;
  /** Max RMS for music. Default -20. */
  musicMaxDb: number;
}

export const DEFAULT_HEADROOM: AudioHeadroom = {
  voiceMaxDb: -10,
  ambienceMaxDb: -22,
  sfxMaxDb: -18,
  musicMaxDb: -20,
};

/** A user-saved custom preset, named and stored alongside the global mix. */
export interface CustomAudioPreset {
  /** Stable id (uuid-ish, generated client-side). */
  id: string;
  /** Display name shown in the preset list. */
  name: string;
  /** Snapshot of the mix values (excluding the `preset` key). */
  values: Omit<StoryModeAudioMix, "preset" | "customPresets">;
  /** Created timestamp (ms). */
  createdAt: number;
}

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
  /** Per-channel max RMS (dBFS) — used by the post-render report to flag overly hot tracks. */
  headroom: AudioHeadroom;
  /** Last preset key the user picked (purely cosmetic — drives the highlighted button). */
  preset: AudioMixPreset;
  /** User-saved custom presets (synced via JSONB). */
  customPresets: CustomAudioPreset[];
}

export const DEFAULT_AUDIO_MIX: StoryModeAudioMix = {
  narrationVolume: 100,
  ambienceVolume: 18,
  sfxVolume: 22,
  musicVolume: 25,
  autoMix: true,
  lufsTarget: -14,
  headroom: { ...DEFAULT_HEADROOM },
  preset: "balanced",
  customPresets: [],
};

export const AUDIO_MIX_PRESETS: Record<Exclude<AudioMixPreset, "custom">, Omit<StoryModeAudioMix, "preset" | "customPresets">> = {
  balanced: {
    narrationVolume: 100, ambienceVolume: 18, sfxVolume: 22, musicVolume: 25,
    autoMix: true, lufsTarget: -14,
    headroom: { ...DEFAULT_HEADROOM },
  },
  "voice-forward": {
    narrationVolume: 100, ambienceVolume: 12, sfxVolume: 16, musicVolume: 14,
    autoMix: true, lufsTarget: -14,
    headroom: { voiceMaxDb: -9, ambienceMaxDb: -26, sfxMaxDb: -22, musicMaxDb: -24 },
  },
  cinematic: {
    narrationVolume: 92, ambienceVolume: 28, sfxVolume: 32, musicVolume: 38,
    autoMix: true, lufsTarget: -14,
    headroom: { voiceMaxDb: -10, ambienceMaxDb: -18, sfxMaxDb: -14, musicMaxDb: -16 },
  },
  "music-bed": {
    narrationVolume: 75, ambienceVolume: 14, sfxVolume: 18, musicVolume: 55,
    autoMix: false, lufsTarget: -16,
    headroom: { voiceMaxDb: -12, ambienceMaxDb: -24, sfxMaxDb: -20, musicMaxDb: -12 },
  },
};

const KEY = "story_mode_audio_mix_v1";

const sanitizeHeadroom = (raw: Partial<AudioHeadroom> | null | undefined): AudioHeadroom => {
  const clamp = (v: unknown, def: number) => {
    const n = typeof v === "number" && Number.isFinite(v) ? v : def;
    return Math.max(-40, Math.min(0, n));
  };
  return {
    voiceMaxDb: clamp(raw?.voiceMaxDb, DEFAULT_HEADROOM.voiceMaxDb),
    ambienceMaxDb: clamp(raw?.ambienceMaxDb, DEFAULT_HEADROOM.ambienceMaxDb),
    sfxMaxDb: clamp(raw?.sfxMaxDb, DEFAULT_HEADROOM.sfxMaxDb),
    musicMaxDb: clamp(raw?.musicMaxDb, DEFAULT_HEADROOM.musicMaxDb),
  };
};

const sanitizeCustomPresets = (raw: unknown): CustomAudioPreset[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p): p is CustomAudioPreset => !!p && typeof p === "object" && typeof (p as any).id === "string" && typeof (p as any).name === "string" && !!(p as any).values)
    .slice(0, 20) // hard cap to keep JSONB size reasonable
    .map((p) => ({
      id: p.id,
      name: p.name.slice(0, 60),
      createdAt: typeof p.createdAt === "number" ? p.createdAt : Date.now(),
      values: {
        narrationVolume: clampNum(p.values.narrationVolume, 0, 200, DEFAULT_AUDIO_MIX.narrationVolume),
        ambienceVolume: clampNum(p.values.ambienceVolume, 0, 200, DEFAULT_AUDIO_MIX.ambienceVolume),
        sfxVolume: clampNum(p.values.sfxVolume, 0, 200, DEFAULT_AUDIO_MIX.sfxVolume),
        musicVolume: clampNum(p.values.musicVolume, 0, 200, DEFAULT_AUDIO_MIX.musicVolume),
        autoMix: !!p.values.autoMix,
        lufsTarget: clampNum(p.values.lufsTarget, -30, -6, DEFAULT_AUDIO_MIX.lufsTarget),
        headroom: sanitizeHeadroom(p.values.headroom),
      },
    }));
};

const clampNum = (v: unknown, lo: number, hi: number, def: number) => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : def;
  return Math.max(lo, Math.min(hi, n));
};

const sanitize = (raw: Partial<StoryModeAudioMix> | null | undefined): StoryModeAudioMix => ({
  narrationVolume: clampNum(raw?.narrationVolume, 0, 200, DEFAULT_AUDIO_MIX.narrationVolume),
  ambienceVolume: clampNum(raw?.ambienceVolume, 0, 200, DEFAULT_AUDIO_MIX.ambienceVolume),
  sfxVolume: clampNum(raw?.sfxVolume, 0, 200, DEFAULT_AUDIO_MIX.sfxVolume),
  musicVolume: clampNum(raw?.musicVolume, 0, 200, DEFAULT_AUDIO_MIX.musicVolume),
  autoMix: raw?.autoMix ?? DEFAULT_AUDIO_MIX.autoMix,
  lufsTarget: clampNum(raw?.lufsTarget, -30, -6, DEFAULT_AUDIO_MIX.lufsTarget),
  headroom: sanitizeHeadroom(raw?.headroom),
  preset: (raw?.preset as AudioMixPreset) ?? DEFAULT_AUDIO_MIX.preset,
  customPresets: sanitizeCustomPresets(raw?.customPresets),
});

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

/** Generate a short stable id for a custom preset without importing uuid. */
export const newPresetId = (): string =>
  `cp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
