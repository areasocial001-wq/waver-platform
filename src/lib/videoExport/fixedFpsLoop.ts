export type FixedFpsFrameInfo = {
  frameIndex: number;
  elapsedMs: number;
  progress01: number;
};

export type FixedFpsLoop = {
  start: () => void;
  stop: () => void;
};

type CreateFixedFpsLoopParams = {
  fps: number;
  durationMs: number;
  onFrame: (info: FixedFpsFrameInfo) => void;
  onDone?: () => void;
};

/**
 * Fixed-FPS scheduler that avoids cumulative drift by always targeting
 * `startTime + frameIndex * frameInterval`.
 */
export function createFixedFpsLoop({
  fps,
  durationMs,
  onFrame,
  onDone,
}: CreateFixedFpsLoopParams): FixedFpsLoop {
  const frameInterval = 1000 / fps;
  let startTime: number | null = null;

  let stopped = false;
  let frameIndex = 0;
  let timeoutId: number | null = null;

  const tick = () => {
    if (stopped) return;

    if (startTime === null) startTime = performance.now();

    const now = performance.now();
    const elapsedMs = now - startTime;
    const progress01 = durationMs <= 0 ? 1 : Math.min(elapsedMs / durationMs, 1);

    if (elapsedMs >= durationMs) {
      onDone?.();
      return;
    }

    onFrame({ frameIndex, elapsedMs, progress01 });
    frameIndex += 1;

    const nextTarget = startTime + frameIndex * frameInterval;
    const delay = Math.max(0, nextTarget - performance.now());
    timeoutId = window.setTimeout(tick, delay);
  };

  return {
    start: () => {
      // reset so successive exports don't inherit timing
      startTime = null;
      frameIndex = 0;
      stopped = false;
      tick();
    },
    stop: () => {
      stopped = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    },
  };
}
