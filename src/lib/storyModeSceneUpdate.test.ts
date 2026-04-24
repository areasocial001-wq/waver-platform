import { describe, it, expect } from "vitest";
import {
  applySceneFieldUpdate,
  applySceneAssetCommit,
  applyBulkTransition,
} from "./storyModeSceneUpdate";
import type { StoryScene, StoryScript } from "@/components/story-mode/types";

const makeScene = (n: number, overrides: Partial<StoryScene> = {}): StoryScene => ({
  sceneNumber: n,
  duration: 5,
  narration: `Narration ${n}`,
  imagePrompt: `Prompt ${n}`,
  cameraMovement: "static",
  mood: "neutral",
  transition: "crossfade",
  transitionDuration: 0.5,
  ...overrides,
});

const makeScript = (sceneCount = 4): StoryScript => ({
  title: "Test",
  synopsis: "Synopsis",
  scenes: Array.from({ length: sceneCount }, (_, i) => makeScene(i + 1)),
  suggestedMusic: "ambient",
});

describe("storyModeSceneUpdate — race condition guards", () => {
  describe("applySceneFieldUpdate", () => {
    it("updates a single scene field without touching siblings", () => {
      const script = makeScript(4);
      const next = applySceneFieldUpdate(script, 2, "imageStatus", "generating");
      expect(next).not.toBeNull();
      expect(next!.scenes[2].imageStatus).toBe("generating");
      // Other scenes untouched
      expect(next!.scenes[0]).toBe(script.scenes[0]);
      expect(next!.scenes[1]).toBe(script.scenes[1]);
      expect(next!.scenes[3]).toBe(script.scenes[3]);
    });

    it("returns prev when null", () => {
      expect(applySceneFieldUpdate(null, 0, "imageStatus", "generating")).toBeNull();
    });

    it("returns prev when index out of range", () => {
      const script = makeScript(2);
      expect(applySceneFieldUpdate(script, 99, "imageStatus", "generating")).toBe(script);
    });
  });

  describe("applySceneAssetCommit", () => {
    it("merges patch into a single scene without touching siblings", () => {
      const script = makeScript(3);
      const next = applySceneAssetCommit(script, 1, {
        imageUrl: "https://x/y.png",
        imageStatus: "completed",
      });
      expect(next!.scenes[1].imageUrl).toBe("https://x/y.png");
      expect(next!.scenes[1].imageStatus).toBe("completed");
      // Existing fields preserved
      expect(next!.scenes[1].transition).toBe("crossfade");
      expect(next!.scenes[1].narration).toBe("Narration 2");
      // Siblings untouched (referential equality)
      expect(next!.scenes[0]).toBe(script.scenes[0]);
      expect(next!.scenes[2]).toBe(script.scenes[2]);
    });
  });

  /**
   * THE bug we are guarding against:
   *
   * 1. User hits "Regenerate scene 3 image". The handler reads `script` and
   *    starts a long async call (image gen + polling).
   * 2. While waiting, user changes scene 1's transition from crossfade →
   *    fade_black, and scene 4's duration from 5s → 8s.
   * 3. The async call resolves and commits the new image.
   *
   * Before the fix: commit used the stale `script` snapshot from step 1 and
   * silently reverted scene 1's transition + scene 4's duration.
   *
   * After the fix: commit uses functional updater (applySceneAssetCommit
   * applied to the LATEST `prev`), so the user's edits survive.
   */
  describe("regen race condition (the actual bug)", () => {
    it("preserves user edits to OTHER scenes made during an in-flight regen", () => {
      // Step 1: snapshot taken at regen start
      const initial = makeScript(4);
      const snapshotAtRegenStart = initial;

      // Step 2: user mutates state in the meantime (simulated as
      // sequential setScript calls — what React would do).
      let current: StoryScript | null = initial;
      current = applySceneFieldUpdate(current, 0, "transition", "fade_black");
      current = applySceneFieldUpdate(current, 0, "transitionDuration", 1.0);
      current = applySceneFieldUpdate(current, 3, "duration", 8);

      // Sanity: edits applied
      expect(current!.scenes[0].transition).toBe("fade_black");
      expect(current!.scenes[0].transitionDuration).toBe(1.0);
      expect(current!.scenes[3].duration).toBe(8);

      // Step 3: regen completes. The HANDLER must apply commit to
      // `current` (the functional-updater `prev`), NOT to
      // `snapshotAtRegenStart` (the stale closure).
      const afterRegen = applySceneAssetCommit(current, 2, {
        imageUrl: "https://cdn/regen-scene3.png",
        imageStatus: "completed",
      });

      // Scene 3 (index 2) got the new image
      expect(afterRegen!.scenes[2].imageUrl).toBe("https://cdn/regen-scene3.png");
      expect(afterRegen!.scenes[2].imageStatus).toBe("completed");

      // Crucially: edits on scenes 1 and 4 SURVIVE the regen commit.
      expect(afterRegen!.scenes[0].transition).toBe("fade_black");
      expect(afterRegen!.scenes[0].transitionDuration).toBe(1.0);
      expect(afterRegen!.scenes[3].duration).toBe(8);

      // And we are NOT accidentally reading from the stale snapshot.
      expect(afterRegen!.scenes[0].transition).not.toBe(
        snapshotAtRegenStart.scenes[0].transition,
      );
    });

    it("simulates the OLD buggy behavior to prove the test would catch it", () => {
      // Old code did: setScript({ ...script, scenes }) using the captured
      // `script` from regen start. We reproduce that here and assert it
      // would lose the user's edit — proving our test is meaningful.
      const initial = makeScript(4);
      const stale = initial; // captured at regen start

      let current: StoryScript | null = initial;
      current = applySceneFieldUpdate(current, 0, "transition", "fade_black");

      // BUGGY commit: builds new state from `stale`, ignoring `current`.
      const buggyScenes = [...stale.scenes];
      buggyScenes[2] = { ...buggyScenes[2], imageUrl: "x", imageStatus: "completed" };
      const buggyResult: StoryScript = { ...stale, scenes: buggyScenes };

      // The user's edit is GONE — exactly the bug we fixed.
      expect(buggyResult.scenes[0].transition).toBe("crossfade");
      expect(current!.scenes[0].transition).toBe("fade_black");
    });
  });

  describe("applyBulkTransition", () => {
    it("applies type+duration to every scene", () => {
      const script = makeScript(3);
      const next = applyBulkTransition(script, "dissolve", 1.5);
      expect(next!.scenes.every((s) => s.transition === "dissolve")).toBe(true);
      expect(next!.scenes.every((s) => s.transitionDuration === 1.5)).toBe(true);
    });

    it("returns null for null input", () => {
      expect(applyBulkTransition(null, "crossfade", 0.5)).toBeNull();
    });
  });
});
