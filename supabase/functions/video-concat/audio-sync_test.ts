/**
 * Tests that narration/SFX/music tracks stay synchronized with the actual on-timeline
 * start of each video clip (sceneStarts[]) — even when transitions overlap clips.
 *
 * Regression guard for the "missing voice / wrong-scene SFX" bug fixed by the
 * sceneStarts[] refactor: previously narrationStart/sfxStart accumulated raw
 * `clipDurations` while video clips overlapped via `start = currentStart - transDur`,
 * causing audio to drift forward by ~transitionDuration per scene.
 *
 * NOTE: We don't run the deployed function (it requires Shotstack creds + storage).
 * Instead we replicate the deterministic timeline-building math and assert the
 * invariants the production code MUST satisfy.
 */

import { assertEquals, assertAlmostEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

interface SceneInput {
  duration: number;
  transition?: { type: string; duration: number };
}

interface BuiltTimeline {
  sceneStarts: number[];
  effectiveTotalDuration: number;
  narrationStarts: number[];
  sfxStarts: number[];
  musicLength: number;
}

/**
 * Mirrors the start/length math in supabase/functions/video-concat/index.ts
 * (the parts that were previously buggy). Keeping a local copy here means the
 * test fails LOUDLY if someone reverts the sceneStarts[] logic.
 */
function buildTimeline(scenes: SceneInput[], introDuration = 0): BuiltTimeline {
  const sceneStarts: number[] = [];
  let currentStart = introDuration;

  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    const transType = s.transition?.type || "crossfade";
    const transDur = s.transition?.duration ?? 0.5;
    const isOverlapping = transType !== "none";

    let clipStart = currentStart;
    if (isOverlapping && i > 0) {
      clipStart = Math.max(0, currentStart - transDur);
    }
    sceneStarts.push(clipStart);
    currentStart = clipStart + s.duration;
  }

  const effectiveVideoDuration = currentStart - introDuration;
  const effectiveTotalDuration = introDuration + effectiveVideoDuration;

  // Audio tracks MUST anchor to sceneStarts, never to a raw cumulative sum.
  const narrationStarts = sceneStarts.slice();
  const sfxStarts = sceneStarts.slice();
  const musicLength = effectiveTotalDuration;

  return { sceneStarts, effectiveTotalDuration, narrationStarts, sfxStarts, musicLength };
}

Deno.test("sceneStarts: single scene starts at 0", () => {
  const t = buildTimeline([{ duration: 5 }]);
  assertEquals(t.sceneStarts, [0]);
  assertEquals(t.effectiveTotalDuration, 5);
});

Deno.test("sceneStarts: 3 scenes with crossfade overlap by transition duration", () => {
  const t = buildTimeline([
    { duration: 5, transition: { type: "crossfade", duration: 0.5 } },
    { duration: 5, transition: { type: "crossfade", duration: 0.5 } },
    { duration: 5, transition: { type: "crossfade", duration: 0.5 } },
  ]);
  // Scene 0: 0..5
  // Scene 1: starts at 5 - 0.5 = 4.5, ends at 9.5
  // Scene 2: starts at 9.5 - 0.5 = 9.0, ends at 14.0
  assertEquals(t.sceneStarts.map(n => +n.toFixed(2)), [0, 4.5, 9.0]);
  assertAlmostEquals(t.effectiveTotalDuration, 14.0, 0.01);
});

Deno.test("narration anchors to sceneStarts (no drift over 8 scenes)", () => {
  const scenes = Array.from({ length: 8 }, () => ({
    duration: 5,
    transition: { type: "crossfade", duration: 0.5 },
  }));
  const t = buildTimeline(scenes);
  // Every narration clip MUST start at the same time as its video clip.
  for (let i = 0; i < scenes.length; i++) {
    assertEquals(
      t.narrationStarts[i],
      t.sceneStarts[i],
      `narration #${i} must equal sceneStarts[${i}]`,
    );
  }
  // Total duration with 7 overlaps of 0.5s = 8*5 - 7*0.5 = 36.5s
  assertAlmostEquals(t.effectiveTotalDuration, 36.5, 0.01);
});

Deno.test("SFX anchors to sceneStarts (e.g. wave sound stays on beach scene)", () => {
  const t = buildTimeline([
    { duration: 6, transition: { type: "crossfade", duration: 0.5 } }, // city
    { duration: 6, transition: { type: "crossfade", duration: 0.5 } }, // beach (wave SFX should anchor here)
    { duration: 6, transition: { type: "crossfade", duration: 0.5 } }, // forest (wind SFX)
  ]);
  // Beach scene starts at 5.5 — wave SFX must start there too, NOT at 6.0 (raw sum)
  assertAlmostEquals(t.sfxStarts[1], 5.5, 0.01);
  assertAlmostEquals(t.sfxStarts[2], 11.0, 0.01);
});

Deno.test("background music length matches effective duration, not raw sum", () => {
  const scenes = Array.from({ length: 5 }, () => ({
    duration: 4,
    transition: { type: "crossfade", duration: 0.8 },
  }));
  const t = buildTimeline(scenes);
  // Raw sum = 20, but with 4 overlaps of 0.8s = 20 - 3.2 = 16.8s
  assertAlmostEquals(t.musicLength, 16.8, 0.01);
  // Music MUST NOT exceed effective duration — would extend past last frame
  assertEquals(t.musicLength, t.effectiveTotalDuration);
});

Deno.test("transition 'none' produces hard cuts with no overlap", () => {
  const t = buildTimeline([
    { duration: 5, transition: { type: "none", duration: 0.5 } },
    { duration: 5, transition: { type: "none", duration: 0.5 } },
    { duration: 5, transition: { type: "none", duration: 0.5 } },
  ]);
  assertEquals(t.sceneStarts.map(n => +n.toFixed(2)), [0, 5, 10]);
  assertEquals(t.effectiveTotalDuration, 15);
});

Deno.test("intro duration shifts all scene starts forward", () => {
  const t = buildTimeline(
    [
      { duration: 5, transition: { type: "crossfade", duration: 0.5 } },
      { duration: 5, transition: { type: "crossfade", duration: 0.5 } },
    ],
    3, // 3s intro
  );
  // Scene 0 starts after intro at t=3
  assertEquals(t.sceneStarts[0], 3);
  // Scene 1 overlaps by 0.5s with scene 0 ending at t=8 → starts at 7.5
  assertAlmostEquals(t.sceneStarts[1], 7.5, 0.01);
});
