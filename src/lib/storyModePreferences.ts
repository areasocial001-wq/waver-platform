/**
 * Story Mode user preferences. Stored in localStorage for instant access (sync API)
 * and mirrored to Supabase `user_preferences` table so the choice follows the user
 * across devices. localStorage is treated as a cache; Supabase is the source of truth
 * once `loadAutoRecoveryFromSupabase()` has run.
 */

import { supabase } from "@/integrations/supabase/client";

const KEY_AUTO_RECOVERY = "story_mode_auto_recovery_enabled";

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
  // Fire-and-forget sync — UI already updated
  void saveAutoRecoveryToSupabase(enabled);
};

/**
 * Loads the persisted preference from Supabase (one-shot, called on app/page mount).
 * Falls back to localStorage when not signed in or the row does not exist yet.
 * After loading, also writes back to localStorage so subsequent sync reads are correct.
 */
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

/** Upserts the value to Supabase. Silently ignores errors (offline, not signed in, etc.). */
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
