// Soglia di avviso costo per Story Mode (in EUR), salvata in localStorage.
// Quando la stima del progetto supera la soglia, mostriamo un alert con
// suggerimenti di provider più economici / riduzione durata scena.

const STORAGE_KEY = "story_mode_cost_alert_threshold_eur";
const DEFAULT_THRESHOLD_EUR = 5;

export function getCostAlertThreshold(): number {
  if (typeof window === "undefined") return DEFAULT_THRESHOLD_EUR;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_THRESHOLD_EUR;
    const v = Number(raw);
    return isFinite(v) && v > 0 ? v : DEFAULT_THRESHOLD_EUR;
  } catch {
    return DEFAULT_THRESHOLD_EUR;
  }
}

export function setCostAlertThreshold(valueEur: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, String(Math.max(0.5, valueEur)));
  } catch {
    // ignore
  }
}

export const COST_ALERT_DEFAULT = DEFAULT_THRESHOLD_EUR;
