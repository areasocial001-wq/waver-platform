/**
 * Utility to validate that a generated image actually matches the requested aspect ratio.
 * Some providers (Replicate Flux, Gemini) silently fall back to a default ratio (1:1 or 16:9)
 * even when width/height/aspect_ratio are passed. We re-measure the resulting image client-side
 * and flag scenes whose ratio deviates more than the tolerance.
 */

const RATIO_MAP: Record<string, number> = {
  "16:9": 16 / 9,
  "9:16": 9 / 16,
  "4:3": 4 / 3,
  "3:4": 3 / 4,
  "1:1": 1,
  "21:9": 21 / 9,
};

export interface AspectCheckResult {
  width: number;
  height: number;
  measuredRatio: number;
  expectedRatio: number;
  /** Absolute relative deviation, e.g. 0.07 = 7% off */
  deviation: number;
  /** True when deviation exceeds tolerance */
  mismatch: boolean;
  /** Human-readable warning when mismatch (Italian, ready for toast/badge) */
  warning?: string;
}

/**
 * Loads an image URL via the browser and measures its real pixel dimensions,
 * then compares against the requested aspect ratio. Pure client-side, no network beyond the image GET.
 *
 * @param url image URL (http(s) or data:)
 * @param requestedAspect e.g. "9:16"
 * @param tolerance fractional tolerance (default 0.05 = 5%)
 */
export async function measureAndValidateAspect(
  url: string,
  requestedAspect: string,
  tolerance = 0.05,
): Promise<AspectCheckResult | null> {
  const expectedRatio = RATIO_MAP[requestedAspect];
  if (!expectedRatio) return null;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      if (!width || !height) {
        resolve(null);
        return;
      }
      const measuredRatio = width / height;
      const deviation = Math.abs(measuredRatio - expectedRatio) / expectedRatio;
      const mismatch = deviation > tolerance;
      const result: AspectCheckResult = {
        width,
        height,
        measuredRatio,
        expectedRatio,
        deviation,
        mismatch,
      };
      if (mismatch) {
        const got = measuredRatio > 1 ? "orizzontale" : measuredRatio < 1 ? "verticale" : "quadrata";
        const want = expectedRatio > 1 ? "orizzontale" : expectedRatio < 1 ? "verticale" : "quadrata";
        result.warning = `Formato non conforme: richiesto ${requestedAspect} (${want}) ma ricevuto ${width}×${height} (${got}, scarto ${Math.round(deviation * 100)}%). Rigenera per ottenere il formato corretto.`;
      }
      resolve(result);
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}
