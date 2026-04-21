/**
 * Story Mode user preferences. Stored in localStorage for instant access (sync API)
 * and mirrored to Supabase `user_preferences` table so the choice follows the user
 * across devices. localStorage is treated as a cache; Supabase is the source of truth
 * once the corresponding `loadXxxFromSupabase()` has run.
 */

import { supabase } from "@/integrations/supabase/client";

const KEY_AUTO_RECOVERY = "story_mode_auto_recovery_enabled";
const KEY_LOCK_CHARACTER_DEFAULT = "story_mode_lock_character_default";

// ─────────── auto-recovery ───────────

/** Synchronous read used by hot paths (e.g. inside render effects). Reads cached value. */
export const isAutoRecoveryEnabled = (): boolean => {
  try {
    const raw = localStorage.getItem(KEY_AUTO_RECOVERY);
    // Default: enabled
    return raw === null ? true : raw === "true";
  } catch {
    return true;
  }
};

/** Writes locally AND fires a best-effort sync to Supabase (does not block UI). */
export const setAutoRecoveryEnabled = (enabled: boolean): void => {
  try {
    localStorage.setItem(KEY_AUTO_RECOVERY, enabled ? "true" : "false");
  } catch {
    /* noop */
  }
  void saveAutoRecoveryToSupabase(enabled);
};

export const loadAutoRecoveryFromSupabase = async (): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return isAutoRecoveryEnabled();

    const { data, error } = await supabase
      .from("user_preferences")
      .select("story_mode_auto_recovery")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !data) return isAutoRecoveryEnabled();

    const remoteValue = data.story_mode_auto_recovery;
    try {
      localStorage.setItem(KEY_AUTO_RECOVERY, remoteValue ? "true" : "false");
    } catch { /* noop */ }
    return remoteValue;
  } catch {
    return isAutoRecoveryEnabled();
  }
};

export const saveAutoRecoveryToSupabase = async (enabled: boolean): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("user_preferences")
      .upsert(
        { user_id: user.id, story_mode_auto_recovery: enabled },
        { onConflict: "user_id" },
      );
  } catch {
    /* noop — local cache still works */
  }
};

// ─────────── lock character default ───────────

/** Synchronous read of the global "lock character identity by default" preference. Default: off. */
export const isLockCharacterDefaultEnabled = (): boolean => {
  try {
    const raw = localStorage.getItem(KEY_LOCK_CHARACTER_DEFAULT);
    return raw === "true";
  } catch {
    return false;
  }
};

/** Writes locally AND fires a best-effort sync to Supabase. */
export const setLockCharacterDefaultEnabled = (enabled: boolean): void => {
  try {
    localStorage.setItem(KEY_LOCK_CHARACTER_DEFAULT, enabled ? "true" : "false");
  } catch {
    /* noop */
  }
  void saveLockCharacterDefaultToSupabase(enabled);
};

export const loadLockCharacterDefaultFromSupabase = async (): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return isLockCharacterDefaultEnabled();

    const { data, error } = await supabase
      .from("user_preferences")
      .select("story_mode_lock_character_default")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !data) return isLockCharacterDefaultEnabled();

    const remoteValue = (data as { story_mode_lock_character_default?: boolean })
      .story_mode_lock_character_default ?? false;
    try {
      localStorage.setItem(KEY_LOCK_CHARACTER_DEFAULT, remoteValue ? "true" : "false");
    } catch { /* noop */ }
    return remoteValue;
  } catch {
    return isLockCharacterDefaultEnabled();
  }
};

export const saveLockCharacterDefaultToSupabase = async (enabled: boolean): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("user_preferences")
      .upsert(
        { user_id: user.id, story_mode_lock_character_default: enabled },
        { onConflict: "user_id" },
      );
  } catch {
    /* noop */
  }
};
