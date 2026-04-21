import type { StoryScene, VideoAspectRatio } from "@/components/story-mode/types";

const MAX_PROMPT_LENGTH = 1800;

const normalizeText = (value?: string) => value?.replace(/\s+/g, " ").trim() ?? "";

const humanizeCameraMovement = (value?: string) => normalizeText(value).replace(/_/g, " ");

const splitCorrectionNotes = (value?: string) =>
  normalizeText(value)
    .split(/[\n;,]+/)
    .map((part) => part.trim())
    .filter(Boolean);

export function mergeCorrectionNotes(...notes: Array<string | undefined>) {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const note of notes) {
    for (const part of splitCorrectionNotes(note)) {
      const key = part.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(part);
    }
  }

  return merged.join("; ");
}

const limitPrompt = (prompt: string) => prompt.slice(0, MAX_PROMPT_LENGTH).replace(/[\s,;:.!-]+$/g, "");

const buildCorrectionBlock = (corrections?: string) => {
  const normalized = normalizeText(corrections);
  if (!normalized) return "";

  return `HIGHEST PRIORITY CORRECTIONS: ${normalized}. Apply these corrections literally. If any correction conflicts with the base prompt, the correction wins. Keep everything else unchanged.`;
};

export function buildImageRegenerationPrompt({
  scene,
  stylePrompt,
  aspectRatio,
  previousCorrectionNote,
  nextCorrectionNote,
  lockCharacter,
}: {
  scene: StoryScene;
  stylePrompt?: string;
  aspectRatio?: VideoAspectRatio;
  previousCorrectionNote?: string;
  nextCorrectionNote?: string;
  lockCharacter?: boolean;
}) {
  const effectiveCorrectionNote = nextCorrectionNote
    ? mergeCorrectionNotes(previousCorrectionNote, nextCorrectionNote)
    : normalizeText(previousCorrectionNote);

  const prompt = [
    `BASE SCENE TO RECREATE: ${normalizeText(scene.imagePrompt)}.`,
    scene.narration ? `NARRATION CONTEXT: ${normalizeText(scene.narration)}.` : "",
    scene.mood ? `MOOD TO PRESERVE: ${normalizeText(scene.mood)}.` : "",
    scene.cameraMovement ? `FRAMING / CAMERA INTENT: ${humanizeCameraMovement(scene.cameraMovement)}.` : "",
    stylePrompt ? `STYLE LOCK: ${normalizeText(stylePrompt)}.` : "",
    aspectRatio ? `ASPECT RATIO LOCK: ${aspectRatio}.` : "",
    "CONTINUITY LOCK: keep the same subject identity, outfit, setting, scene logic, and overall composition unless a correction explicitly asks to change one of them.",
    lockCharacter
      ? "CHARACTER LOCK (HIGHEST PRIORITY): the main character must be the EXACT SAME person as in previous scenes — same face shape, eyes, nose, mouth, skin tone, hair color/length/style, body build, height, age. Same outfit (same garments, same colors, same accessories). Same setting/context unless a correction explicitly changes it. Do NOT swap the character for a different person, do NOT change clothing, do NOT alter facial features. Anatomically correct human body, no morphing, no extra limbs."
      : "",
    buildCorrectionBlock(effectiveCorrectionNote),
    "Do not invent random objects, characters, clothing changes, locations, or actions. Prefer strict fidelity to the brief over creativity.",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    prompt: limitPrompt(prompt),
    effectiveCorrectionNote,
  };
}

export function buildVideoRegenerationPrompt({
  scene,
  stylePrompt,
  aspectRatio,
  previousCorrectionNote,
  nextCorrectionNote,
  lockCharacter,
}: {
  scene: StoryScene;
  stylePrompt?: string;
  aspectRatio?: VideoAspectRatio;
  previousCorrectionNote?: string;
  nextCorrectionNote?: string;
  lockCharacter?: boolean;
}) {
  const effectiveCorrectionNote = nextCorrectionNote
    ? mergeCorrectionNotes(previousCorrectionNote, nextCorrectionNote)
    : normalizeText(previousCorrectionNote);

  const prompt = [
    `SOURCE SCENE TO ANIMATE: ${normalizeText(scene.imagePrompt)}.`,
    scene.narration ? `NARRATION CONTEXT: ${normalizeText(scene.narration)}.` : "",
    scene.mood ? `MOOD TO PRESERVE: ${normalizeText(scene.mood)}.` : "",
    scene.cameraMovement ? `CAMERA MOVEMENT LOCK: ${humanizeCameraMovement(scene.cameraMovement)}.` : "",
    stylePrompt ? `STYLE LOCK: ${normalizeText(stylePrompt)}.` : "",
    aspectRatio ? `ASPECT RATIO LOCK: ${aspectRatio}.` : "",
    `DURATION TARGET: ${scene.duration}s.`,
    "ANIMATION LOCK: animate the provided source image faithfully; do not replace the subject, do not change the outfit or location, and do not introduce unrelated events.",
    lockCharacter
      ? "CHARACTER LOCK (HIGHEST PRIORITY): keep the EXACT SAME person from the source image throughout every frame — identical face, hair, skin tone, body, outfit and accessories. No identity drift, no face morphing, no outfit change, no character swap mid-shot."
      : "",
    buildCorrectionBlock(effectiveCorrectionNote),
    "Avoid nonsense motion, face morphing, body deformation, random camera swings, and story changes. Keep the action literal and stable.",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    prompt: limitPrompt(prompt),
    effectiveCorrectionNote,
  };
}