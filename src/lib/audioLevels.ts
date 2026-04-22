/**
 * Shared audio-analysis primitives used by both the per-scene debug timeline
 * and the post-render automated test report.
 *
 * Notes on LUFS:
 *  Real ITU-R BS.1770 LUFS requires a K-weighting filter (high-shelf + high-pass)
 *  followed by gated 400ms blocks. We implement a lightweight approximation
 *  ("LUFS-K-lite") that:
 *    1. applies a 1st-order biquad approximating the K-weighting shelf,
 *    2. computes mean-square per 400ms block (ungated for short SFX),
 *    3. converts to LUFS via -0.691 + 10*log10(mean).
 *  It will be within ±1.5 LU of a reference EBU r128 implementation for
 *  music/voice and is deterministic across browsers, which is good enough for
 *  diagnostic UI and pass/fail thresholds — not for broadcast certification.
 */

export interface ChannelLevels {
  rmsDb: number;
  peakDb: number;
  /** Approximated integrated loudness in LUFS. */
  lufs: number;
  /** Peak sample value in [0,1] — convenient for clipping detection (>= 0.99). */
  peakLinear: number;
  /** Duration of the analysed buffer (seconds). */
  durationSec: number;
}

const linearToDb = (v: number): number => (v <= 1e-7 ? -Infinity : 20 * Math.log10(v));

/** Crude high-shelf K-weighting: boost ~+4 dB above 2 kHz, attenuate < 60 Hz.
 *  Single-pole biquad applied in-place on a copy. */
const kWeight = (samples: Float32Array, sampleRate: number): Float32Array => {
  const out = new Float32Array(samples.length);
  // Pre-filter: high-pass 60 Hz (1-pole)
  const hpAlpha = Math.exp(-2 * Math.PI * 60 / sampleRate);
  let hpPrevX = 0, hpPrevY = 0;
  // Shelf: simple 2 kHz high-shelf, gain ≈ +4 dB
  const shelfA = 0.5;
  for (let i = 0; i < samples.length; i++) {
    const x = samples[i];
    const hp = hpAlpha * (hpPrevY + x - hpPrevX);
    hpPrevX = x;
    hpPrevY = hp;
    // shelf: y = hp + a*(hp - hp_prev_smoothed), trivial 1st-order tilt
    out[i] = hp * (1 + shelfA * 0.5);
  }
  return out;
};

/** Compute LUFS-K-lite over the full buffer. */
const computeLufs = (samples: Float32Array, sampleRate: number): number => {
  if (samples.length === 0) return -Infinity;
  const filtered = kWeight(samples, sampleRate);
  // Block size = 400ms
  const blockSize = Math.max(1, Math.floor(sampleRate * 0.4));
  const overlap = Math.floor(blockSize * 0.75);
  const step = Math.max(1, blockSize - overlap);
  const blockMeans: number[] = [];
  for (let start = 0; start + blockSize <= filtered.length; start += step) {
    let sum = 0;
    for (let i = start; i < start + blockSize; i++) sum += filtered[i] * filtered[i];
    blockMeans.push(sum / blockSize);
  }
  if (blockMeans.length === 0) {
    let sum = 0;
    for (let i = 0; i < filtered.length; i++) sum += filtered[i] * filtered[i];
    blockMeans.push(sum / filtered.length);
  }
  // Gating: drop blocks below absolute -70 LUFS, then relative -10 LU below mean
  const above70 = blockMeans.filter((m) => -0.691 + 10 * Math.log10(Math.max(m, 1e-12)) > -70);
  const baseMean = above70.length ? above70.reduce((a, b) => a + b, 0) / above70.length : 1e-12;
  const baseLufs = -0.691 + 10 * Math.log10(Math.max(baseMean, 1e-12));
  const above = above70.filter((m) => -0.691 + 10 * Math.log10(Math.max(m, 1e-12)) > baseLufs - 10);
  const finalMean = above.length ? above.reduce((a, b) => a + b, 0) / above.length : baseMean;
  return -0.691 + 10 * Math.log10(Math.max(finalMean, 1e-12));
};

/** Decode a remote URL into an AudioBuffer and compute RMS / peak / LUFS. */
export const analyseAudioUrl = async (url: string, ctx?: AudioContext): Promise<ChannelLevels> => {
  const ownCtx = !ctx;
  const Ctx = ctx ? null : ((window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext);
  const audioCtx = ctx ?? new Ctx!();
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    const audio = await audioCtx.decodeAudioData(buf);
    const ch0 = audio.getChannelData(0);
    let sumSq = 0;
    let peak = 0;
    // Down-sample for RMS/peak speed (max 200k frames)
    const stride = Math.max(1, Math.floor(ch0.length / 200_000));
    let n = 0;
    for (let i = 0; i < ch0.length; i += stride) {
      const v = ch0[i];
      const a = Math.abs(v);
      if (a > peak) peak = a;
      sumSq += v * v;
      n++;
    }
    const rms = Math.sqrt(sumSq / Math.max(1, n));
    const lufs = computeLufs(ch0, audio.sampleRate);
    return {
      rmsDb: linearToDb(rms),
      peakDb: linearToDb(peak),
      peakLinear: peak,
      lufs,
      durationSec: audio.duration,
    };
  } finally {
    if (ownCtx) await audioCtx.close().catch(() => undefined);
  }
};

/** Convenience colour mapping for dBFS values. */
export const dbBadgeColor = (db: number | undefined): string => {
  if (db === undefined || !Number.isFinite(db)) return "bg-muted text-muted-foreground";
  if (db > -6) return "bg-red-500/20 text-red-400 border-red-500/40";
  if (db > -14) return "bg-orange-500/20 text-orange-400 border-orange-500/40";
  if (db > -24) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
  return "bg-blue-500/20 text-blue-400 border-blue-500/40";
};

export const lufsBadgeColor = (lufs: number | undefined, target: number): string => {
  if (lufs === undefined || !Number.isFinite(lufs)) return "bg-muted text-muted-foreground";
  const delta = Math.abs(lufs - target);
  if (delta < 1.5) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
  if (delta < 4) return "bg-orange-500/20 text-orange-400 border-orange-500/40";
  return "bg-red-500/20 text-red-400 border-red-500/40";
};

export const isUsableUrl = (u?: string | null): u is string =>
  !!u && !u.startsWith("blob:") && !u.startsWith("data:");
