/**
 * Persistent log of music-retry attempts for Story Mode.
 *
 * Each render → verifyMusic round trip appends an entry. Stored in
 * localStorage keyed by project id so it survives reloads and is visible in
 * the UI even after the user re-enters the wizard.
 *
 * Designed as a thin wrapper so the wizard can stay UI-only.
 */

export type MusicRetryStage =
  | "verify-start"        // probing the rendered MP4
  | "verify-ok"           // music detected
  | "verify-missing"      // probe says no audible track
  | "verify-error"        // probe itself failed
  | "regenerate-start"    // we triggered a music regeneration
  | "regenerate-ok"       // got a new music URL back
  | "regenerate-failed"   // music gen failed → user must retry manually
  | "reassemble-start"    // re-running concat with the new music
  | "max-retries"         // capped — surface warning
  | "manual-retry";       // user pressed the 🔄 button

export interface MusicRetryEntry {
  ts: number;
  stage: MusicRetryStage;
  /** Optional human note (e.g. probe response status, decode error). */
  note?: string;
  /** Probe payload kept for inspection. */
  audible?: boolean;
  sizeBytes?: number;
  contentType?: string;
  attempt?: number; // current attempt index (0-based)
}

export interface MusicRetryLog {
  projectId: string | null;
  attempts: number;            // count of regenerate-start entries
  lastAudible: boolean | null; // most recent verify-* outcome
  entries: MusicRetryEntry[];  // bounded to last 30 entries
}

const KEY = "story_mode_music_retry_log_v1";
const MAX_ENTRIES = 30;

const blank = (projectId: string | null): MusicRetryLog => ({
  projectId, attempts: 0, lastAudible: null, entries: [],
});

const readAll = (): Record<string, MusicRetryLog> => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch { return {}; }
};

const writeAll = (data: Record<string, MusicRetryLog>) => {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* noop */ }
};

export const loadMusicRetryLog = (projectId: string | null): MusicRetryLog => {
  if (!projectId) return blank(null);
  const all = readAll();
  return all[projectId] ?? blank(projectId);
};

export const appendMusicRetryEntry = (
  projectId: string | null,
  entry: Omit<MusicRetryEntry, "ts">,
): MusicRetryLog => {
  const ts = Date.now();
  const all = readAll();
  const existing: MusicRetryLog = projectId
    ? (all[projectId] ?? blank(projectId))
    : blank(null);
  const next: MusicRetryEntry = { ts, ...entry };
  const entries = [...existing.entries, next].slice(-MAX_ENTRIES);
  let attempts = existing.attempts;
  if (entry.stage === "regenerate-start") attempts += 1;
  let lastAudible = existing.lastAudible;
  if (entry.stage === "verify-ok") lastAudible = true;
  if (entry.stage === "verify-missing") lastAudible = false;
  const updated: MusicRetryLog = { projectId, attempts, lastAudible, entries };
  if (projectId) {
    all[projectId] = updated;
    writeAll(all);
  }
  return updated;
};

export const resetMusicRetryLog = (projectId: string | null): MusicRetryLog => {
  if (!projectId) return blank(null);
  const all = readAll();
  delete all[projectId];
  writeAll(all);
  return blank(projectId);
};

export const stageLabel = (s: MusicRetryStage): string => {
  switch (s) {
    case "verify-start":      return "Verifica musica";
    case "verify-ok":         return "Musica rilevata ✅";
    case "verify-missing":    return "Musica mancante";
    case "verify-error":      return "Errore verifica";
    case "regenerate-start":  return "Rigenerazione musica…";
    case "regenerate-ok":     return "Nuova musica generata";
    case "regenerate-failed": return "Rigenerazione fallita ❌";
    case "reassemble-start":  return "Re-rendering";
    case "max-retries":       return "Limite retry raggiunto";
    case "manual-retry":      return "Retry manuale";
  }
};

export const stageTone = (s: MusicRetryStage): "ok" | "warn" | "error" | "info" => {
  if (s === "verify-ok" || s === "regenerate-ok") return "ok";
  if (s === "verify-missing" || s === "max-retries") return "warn";
  if (s === "verify-error" || s === "regenerate-failed") return "error";
  return "info";
};
