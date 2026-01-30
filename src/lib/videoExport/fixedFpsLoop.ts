/**
 * Fixed FPS loop utility for frame-accurate video recording.
 * Uses requestAnimationFrame with timing compensation to maintain target framerate.
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
  let startTime: number | null = null;
  let animationId: number | null = null;
  let stopped = false;

  const loop = (timestamp: number) => {
    if (stopped) return;
    
    if (startTime === null) {
      startTime = timestamp;
    }

    const elapsedMs = timestamp - startTime;
    const expectedFrame = Math.floor(elapsedMs / frameIntervalMs);

    // Catch up if we're behind
    while (frameIndex <= expectedFrame && frameIndex < totalFrames) {
      const progress01 = frameIndex / totalFrames;
      onFrame({ frameIndex, progress01, elapsedMs });
      frameIndex++;
    }

    if (frameIndex >= totalFrames) {
      onDone();
      return;
    }

    animationId = requestAnimationFrame(loop);
  };

  return {
    start: () => {
      stopped = false;
      frameIndex = 0;
      startTime = null;
      animationId = requestAnimationFrame(loop);
    },
    stop: () => {
      stopped = true;
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
    },
  };
}
