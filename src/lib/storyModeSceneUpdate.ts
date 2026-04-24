import { StoryScene, StoryScript, TransitionType } from "@/components/story-mode/types";

/**
 * Pure helper that mirrors the functional-updater logic used by
 * `StoryModeWizard.updateScene` and the regen commit blocks.
 *
 * Given the latest `script` snapshot (as React would pass to a setState
 * updater), it returns the next script with `field` of scene `index`
 * patched — and CRITICALLY preserves all other scenes unchanged.
 *
 * This guarantees that long-running async flows (image/video regen) which
 * read `prev` at completion time cannot clobber edits the user made on
 * unrelated scenes (transition, transitionDuration, voiceId, …) while
 * they were waiting.
 */
export function applySceneFieldUpdate<K extends keyof StoryScene>(
  prev: StoryScript | null,
  index: number,
  field: K,
  value: StoryScene[K],
): StoryScript | null {
  if (!prev) return prev;
  const scenes = [...prev.scenes];
  if (!scenes[index]) return prev;
  scenes[index] = { ...scenes[index], [field]: value };
  return { ...prev, scenes };
}

/**
 * Same shape used by the image/video/audio/sfx regen commit blocks: replace
 * a subset of fields on a single scene without touching siblings.
 */
export function applySceneAssetCommit(
  prev: StoryScript | null,
  index: number,
  patch: Partial<StoryScene>,
): StoryScript | null {
  if (!prev) return prev;
  const scenes = [...prev.scenes];
  if (!scenes[index]) return prev;
  scenes[index] = { ...scenes[index], ...patch };
  return { ...prev, scenes };
}

/**
 * Bulk transition apply (used by `BulkTransitionPanel.onApply`). Pure version
 * for testing — same shape as the inline updater inside the wizard.
 */
export function applyBulkTransition(
  prev: StoryScript | null,
  type: TransitionType,
  duration: number,
): StoryScript | null {
  if (!prev) return prev;
  return {
    ...prev,
    scenes: prev.scenes.map((s) => ({ ...s, transition: type, transitionDuration: duration })),
  };
}
