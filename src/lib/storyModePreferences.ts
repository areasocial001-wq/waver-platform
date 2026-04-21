/**
 * Local preferences for Story Mode behavior. Stored in localStorage so they
 * persist across reloads but are per-device (fine for opt-out toggles).
 */

const KEY_AUTO_RECOVERY = "story_mode_auto_recovery_enabled";

export const isAutoRecoveryEnabled = (): boolean => {
  try {
    const raw = localStorage.getItem(KEY_AUTO_RECOVERY);
    // Default: enabled
    return raw === null ? true : raw === "true";
  } catch {
    return true;
  }
};

export const setAutoRecoveryEnabled = (enabled: boolean): void => {
  try {
    localStorage.setItem(KEY_AUTO_RECOVERY, enabled ? "true" : "false");
  } catch {
    /* noop */
  }
};
