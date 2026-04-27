// Suggerisce un provider economico equivalente quando l'utente è sopra la soglia
// di costo. Il match è basato su capability (T2V vs I2V) e gruppo concettuale.
// Manteniamo una whitelist molto piccola di provider "safe & cheap" per non
// proporre modelli con caratteristiche radicalmente diverse.

import { getPricePerSecond } from "./videoCostEstimator";

export interface RecommendedProvider {
  id: string;
  label: string;
  pricePerSec: number;
  reason: string;
}

// Provider economici di riferimento, ordinati per qualità decrescente.
// Tutti sotto €0.06/sec.
const CHEAP_T2V: { id: string; label: string }[] = [
  { id: "luma-direct-ray2", label: "Luma Ray 2 (diretto)" },
  { id: "piapi-kling-2.5", label: "Kling 2.5 via PiAPI" },
  { id: "aiml-pixverse-v5-t2v", label: "Pixverse v5" },
  { id: "luma-direct-ray-flash-2", label: "Luma Ray Flash 2" },
];

const CHEAP_I2V: { id: string; label: string }[] = [
  { id: "luma-direct-ray2", label: "Luma Ray 2 (diretto)" },
  { id: "piapi-kling-2.5", label: "Kling 2.5 via PiAPI" },
  { id: "aiml-pixverse-v5-i2v", label: "Pixverse v5 (I2V)" },
];

function isI2V(providerId: string): boolean {
  return /i2v|image-to-video|first-last/i.test(providerId);
}

/**
 * Restituisce un provider economico raccomandato (o null se quello attuale
 * è già abbastanza economico).
 *
 * @param currentProvider id provider attuale (es. "aiml-veo3.1-t2v")
 * @param maxPricePerSec  soglia max €/sec sotto cui consideriamo "economico"
 */
export function getRecommendedCheaperProvider(
  currentProvider: string,
  maxPricePerSec = 0.06,
): RecommendedProvider | null {
  const currentPps = getPricePerSecond(currentProvider);
  if (currentPps <= maxPricePerSec) return null;

  const pool = isI2V(currentProvider) ? CHEAP_I2V : CHEAP_T2V;

  for (const cand of pool) {
    const pps = getPricePerSecond(cand.id);
    if (pps <= maxPricePerSec && pps < currentPps) {
      const savingsPct = Math.round(((currentPps - pps) / currentPps) * 100);
      return {
        id: cand.id,
        label: cand.label,
        pricePerSec: pps,
        reason: `Risparmio ~${savingsPct}% rispetto a ${currentProvider} (€${currentPps.toFixed(2)}/s → €${pps.toFixed(2)}/s)`,
      };
    }
  }
  return null;
}
