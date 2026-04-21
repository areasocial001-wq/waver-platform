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

/**
 * Same as measureAndValidateAspect but for video URLs. Loads metadata only
 * (no playback) via a hidden `<video>` element and reads videoWidth/videoHeight.
 * Falls back to null if the browser cannot load the metadata (e.g. CORS, bad URL).
 */
export async function measureAndValidateVideoAspect(
  url: string,
  requestedAspect: string,
  tolerance = 0.05,
): Promise<AspectCheckResult | null> {
  const expectedRatio = RATIO_MAP[requestedAspect];
  if (!expectedRatio) return null;

  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "metadata";
    video.muted = true;
    let settled = false;
    const finish = (r: AspectCheckResult | null) => {
      if (settled) return;
      settled = true;
      try { video.src = ""; video.remove(); } catch { /* noop */ }
      resolve(r);
    };
    video.onloadedmetadata = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!width || !height) {
        finish(null);
        return;
      }
      const measuredRatio = width / height;
      const deviation = Math.abs(measuredRatio - expectedRatio) / expectedRatio;
      const mismatch = deviation > tolerance;
      const result: AspectCheckResult = {
        width, height, measuredRatio, expectedRatio, deviation, mismatch,
      };
      if (mismatch) {
        const got = measuredRatio > 1 ? "orizzontale" : measuredRatio < 1 ? "verticale" : "quadrata";
        const want = expectedRatio > 1 ? "orizzontale" : expectedRatio < 1 ? "verticale" : "quadrata";
        result.warning = `Video non conforme: richiesto ${requestedAspect} (${want}) ma ricevuto ${width}×${height} (${got}, scarto ${Math.round(deviation * 100)}%). Rigenera per ottenere il formato corretto.`;
      }
      finish(result);
    };
    video.onerror = () => finish(null);
    // Safety timeout — some videos never fire loadedmetadata (CORS/blocked)
    setTimeout(() => finish(null), 15000);
    video.src = url;
  });
}

export interface DurationCheckResult {
  measured: number;
  expected: number;
  /** Absolute relative deviation, e.g. 0.12 = 12% off */
  deviation: number;
  mismatch: boolean;
  warning?: string;
}

/**
 * Loads only the metadata of a video URL via a hidden <video> element and
 * compares its real duration against the expected scene duration.
 * Returns null when the browser cannot read the metadata (CORS / bad URL / blob expired).
 *
 * @param tolerance fractional tolerance (default 0.10 = 10%)
 */
export async function measureAndValidateVideoDuration(
  url: string,
  expectedSeconds: number,
  tolerance = 0.10,
): Promise<DurationCheckResult | null> {
  if (!expectedSeconds || expectedSeconds <= 0) return null;
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "metadata";
    video.muted = true;
    let settled = false;
    const finish = (r: DurationCheckResult | null) => {
      if (settled) return;
      settled = true;
      try { video.src = ""; video.remove(); } catch { /* noop */ }
      resolve(r);
    };
    video.onloadedmetadata = () => {
      const measured = video.duration;
      if (!measured || !isFinite(measured)) {
        finish(null);
        return;
      }
      const deviation = Math.abs(measured - expectedSeconds) / expectedSeconds;
      const mismatch = deviation > tolerance;
      const result: DurationCheckResult = { measured, expected: expectedSeconds, deviation, mismatch };
      if (mismatch) {
        result.warning = `Durata non conforme: scena ${expectedSeconds.toFixed(1)}s ma video ${measured.toFixed(1)}s (scarto ${Math.round(deviation * 100)}%). Rigenera per allinearla.`;
      }
      finish(result);
    };
    video.onerror = () => finish(null);
    setTimeout(() => finish(null), 15000);
    video.src = url;
  });
}

/**
 * Loads only the metadata of an audio URL via a hidden <audio> element and
 * compares its real duration against the expected scene duration.
 *
 * For narration we only flag a mismatch when the audio is LONGER than expected
 * (Shotstack would cut the voice off). Audio shorter than the scene is fine —
 * the video continues playing in silence.
 *
 * @param tolerance fractional tolerance ABOVE expected (default 0.05 = 5% longer is OK)
 */
export async function measureAndValidateAudioDuration(
  url: string,
  expectedSeconds: number,
  tolerance = 0.05,
): Promise<DurationCheckResult | null> {
  if (!expectedSeconds || expectedSeconds <= 0) return null;
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    audio.crossOrigin = "anonymous";
    audio.preload = "metadata";
    let settled = false;
    const finish = (r: DurationCheckResult | null) => {
      if (settled) return;
      settled = true;
      try { audio.src = ""; audio.remove(); } catch { /* noop */ }
      resolve(r);
    };
    audio.onloadedmetadata = () => {
      const measured = audio.duration;
      if (!measured || !isFinite(measured)) {
        finish(null);
        return;
      }
      // Only flag when audio exceeds (1 + tolerance) * expected
      const overflow = (measured - expectedSeconds) / expectedSeconds;
      const mismatch = overflow > tolerance;
      const deviation = Math.abs(overflow);
      const result: DurationCheckResult = { measured, expected: expectedSeconds, deviation, mismatch };
      if (mismatch) {
        result.warning = `Voce troppo lunga: scena ${expectedSeconds.toFixed(1)}s ma audio ${measured.toFixed(1)}s. Verrà tagliata nel render — accorcia la narrazione o aumenta la durata della scena.`;
      }
      finish(result);
    };
    audio.onerror = () => finish(null);
    setTimeout(() => finish(null), 15000);
    audio.src = url;
  });
}
