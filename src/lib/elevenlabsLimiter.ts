/**
 * Process-wide concurrency limiter for ALL ElevenLabs calls (TTS + SFX + Music).
 *
 * The free/starter ElevenLabs plan caps concurrent requests at 2. When Story
 * Mode fires voice/sfx/ambience/music in parallel they collide and the API
 * returns 429 `concurrent_limit_exceeded`. By funnelling every call through
 * this single semaphore we guarantee at most N in-flight requests no matter
 * how many components/hooks initiate them.
 *
 * Default = 2 (matches the ElevenLabs entry-tier concurrency cap). Increase only with a higher API tier.
 */
const MAX_CONCURRENT = 2;

let active = 0;
const queue: Array<() => void> = [];

const next = () => {
  if (active >= MAX_CONCURRENT) return;
  const job = queue.shift();
  if (!job) return;
  active++;
  job();
};

/**
 * Run `task` while respecting the global ElevenLabs concurrency cap.
 * Resolves with the task's result; rejects with whatever the task throws.
 */
export const withElevenlabsSlot = <T>(task: () => Promise<T>): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      task()
        .then(resolve, reject)
        .finally(() => {
          active--;
          // Drain the queue on the next tick so chained awaits don't starve.
          queueMicrotask(next);
        });
    };
    queue.push(run);
    next();
  });
};

/** For debug panels: how many ElevenLabs requests are in flight / waiting. */
export const getElevenlabsQueueStats = () => ({
  active,
  queued: queue.length,
  max: MAX_CONCURRENT,
});
