/**
 * Persist the user's preferred Story Mode voice in localStorage so it
 * survives reloads and is shared across Story Mode pages (wizard + voice test).
 */
const STORAGE_KEY = "storyMode.preferredVoiceId";

export function loadPreferredVoiceId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function savePreferredVoiceId(voiceId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, voiceId);
  } catch {
    /* ignore quota / privacy mode */
  }
}

export function clearPreferredVoiceId(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
