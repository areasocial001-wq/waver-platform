/**
 * Fixed FPS loop utility for frame-accurate video recording.
 * Uses setTimeout for predictable timing that doesn't compete with
 * requestAnimationFrame's display-refresh cadence.
 *
 * Key design decisions:
 * - setTimeout instead of rAF: rAF fires at display refresh rate (often 60/120Hz)
 *   which creates timing conflicts with target FPS. setTimeout lets us space frames
 *   evenly at the exact interval we need.
 * - No catch-up loop: if a frame callback takes too long, we skip to the current
 *   expected frame rather than trying to draw every missed frame (which would draw
 *   the same video frame multiple times, wasting encoder budget).
 * - Small safety margin (0.5ms) on the interval prevents drift accumulation.
 */

export interface FixedFpsLoopOptions {
  fps: number;
  durationMs: number;
  onFrame: (info: { frameIndex: number; progress01: number; elapsedMs: number }) => void;
  onDone: () => void;
}

export interface FixedFpsLoop {
  start: () => void;
  stop: () => void;
}

export function createFixedFpsLoop(options: FixedFpsLoopOptions): FixedFpsLoop {
  const { fps, durationMs, onFrame, onDone } = options;
  const frameIntervalMs = 1000 / fps;
  const totalFrames = Math.ceil((durationMs / 1000) * fps);

  let frameIndex = 0;
  let startTime = 0;
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const tick = () => {
    if (stopped) return;

    const elapsed = performance.now() - startTime;
    // Jump to the frame we SHOULD be on (skip missed frames, don't catch-up draw)
    frameIndex = Math.min(Math.floor(elapsed / frameIntervalMs), totalFrames - 1);

    const progress01 = Math.min(frameIndex / (totalFrames - 1), 1);
    onFrame({ frameIndex, progress01, elapsedMs: elapsed });

    if (frameIndex >= totalFrames - 1 || elapsed >= durationMs) {
      onDone();
      return;
    }

    // Schedule next frame; subtract 0.5ms to account for setTimeout jitter
    const nextFrameTime = (frameIndex + 1) * frameIntervalMs;
    const delay = Math.max(1, nextFrameTime - elapsed - 0.5);
    timerId = setTimeout(tick, delay);
  };

  return {
    start: () => {
      stopped = false;
      frameIndex = 0;
      startTime = performance.now();
      timerId = setTimeout(tick, 0);
    },
    stop: () => {
      stopped = true;
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
    },
  };
}
