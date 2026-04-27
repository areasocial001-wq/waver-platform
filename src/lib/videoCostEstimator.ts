// Stima costi €/sec per ogni provider video.
// Tariffe aggiornate al 2026-04, basate su pricing pubblico AIML / Luma diretta / PiAPI.
// Aggiornare quando cambiano i prezzi upstream.

export interface CostEstimate {
  totalEur: number;
  perScene: number[];
  provider: string;
  warning?: string;
}

// €/secondo (include qualsiasi audio nativo del modello)
const PRICE_PER_SECOND_EUR: Record<string, number> = {
  // ===== Luma diretta (più economico) =====
  "luma-direct-ray2": 0.05,
  "luma-direct-ray-flash-2": 0.03,
  "luma-direct-ray-1.6": 0.04,

  // ===== Kling via PiAPI =====
  "piapi-kling-2.5": 0.06,
  "piapi-kling-2.1": 0.05,
  "piapi-kling-1.6": 0.04,
  "kling-2.1": 0.05, // legacy default
  "auto": 0.05, // fallback Story Mode (di solito kling)

  // ===== Sora via AIML =====
  "aiml-sora-2-t2v": 0.10,
  "aiml-sora-2-i2v": 0.10,
  "aiml-sora-2-pro-t2v": 0.18,
  "aiml-sora-2-pro-i2v": 0.18,

  // ===== Veo via AIML (più caro, attenzione!) =====
  "aiml-veo3": 0.20,
  "aiml-veo3-fast": 0.10,
  "aiml-veo3-i2v": 0.20,
  "aiml-veo3-i2v-fast": 0.10,
  "aiml-veo3.1-t2v": 0.25,
  "aiml-veo3.1-i2v": 0.25,
  "aiml-veo3.1-t2v-fast": 0.12,
  "aiml-veo3.1-i2v-fast": 0.12,
  "aiml-veo3.1-ref-to-video": 0.25,
  "aiml-veo3.1-first-last-i2v": 0.25,

  // ===== Pixverse =====
  "aiml-pixverse-v5-t2v": 0.04,
  "aiml-pixverse-v5-i2v": 0.04,

  // ===== Vidu / LTX =====
  "vidu-q2": 0.06,
  "ltx-video": 0.03,

  // ===== Runway =====
  "aiml-runway-gen4-turbo": 0.08,
  "aiml-runway-gen3-turbo": 0.06,

  // ===== Google VEO nativo (DISABILITATO – tariffa storica per riferimento) =====
  "google-veo": 0.35,
};

const DEFAULT_PRICE_EUR = 0.08; // fallback prudenziale per provider sconosciuti

export function getPricePerSecond(provider: string | undefined | null): number {
  if (!provider) return DEFAULT_PRICE_EUR;
  return PRICE_PER_SECOND_EUR[provider] ?? DEFAULT_PRICE_EUR;
}

export function estimateProjectCost(
  provider: string,
  sceneDurations: number[]
): CostEstimate {
  const pricePerSec = getPricePerSecond(provider);
  const perScene = sceneDurations.map(d => +(d * pricePerSec).toFixed(2));
  const totalEur = +perScene.reduce((s, v) => s + v, 0).toFixed(2);

  let warning: string | undefined;
  if (pricePerSec >= 0.20) {
    warning = `⚠️ Provider premium (€${pricePerSec.toFixed(2)}/sec). Considera Luma Ray 2 o Kling per scene non chiave.`;
  } else if (pricePerSec >= 0.10) {
    warning = `Provider di fascia alta (€${pricePerSec.toFixed(2)}/sec).`;
  }

  return { totalEur, perScene, provider, warning };
}

export function formatEur(value: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}
