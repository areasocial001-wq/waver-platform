export type TransitionType = "crossfade" | "fade_black" | "dissolve" | "wipe_left" | "wipe_right" | "none";

export interface StoryScene {
  sceneNumber: number;
  duration: number;
  narration: string;
  imagePrompt: string;
  cameraMovement: string;
  mood: string;
  voiceId?: string;
  transition?: TransitionType;
  transitionDuration?: number;
  sfxPrompt?: string;
  sfxUrl?: string;
  sfxStatus?: "idle" | "generating" | "completed" | "error";
  // Generation state
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  previewAudioUrl?: string;
  imageStatus?: "idle" | "generating" | "completed" | "error";
  videoStatus?: "idle" | "generating" | "completed" | "error";
  audioStatus?: "idle" | "generating" | "completed" | "error";
  error?: string;
  /** Epoch ms when videoStatus was last set to "generating" — used to detect stuck scenes */
  videoGeneratingStartedAt?: number;
  /** Real measured dimensions of the generated image (after load) — used to validate aspect ratio */
  imageWidth?: number;
  imageHeight?: number;
  /** Set when measured aspect ratio deviates >5% from requested — shows warning + offers regeneration */
  imageAspectWarning?: string;
  /** Real measured dimensions of the generated video (after metadata load) */
  videoWidth?: number;
  videoHeight?: number;
  /** Set when measured video aspect ratio deviates >5% from requested */
  videoAspectWarning?: string;
  /** Real measured duration (seconds) of the generated video file */
  videoDuration?: number;
  /** Set when measured video duration deviates >10% from scene.duration */
  videoDurationWarning?: string;
  /** Real measured duration (seconds) of the narration audio file */
  audioDuration?: number;
  /** Set when narration audio is LONGER than scene.duration (would be cut by render) */
  audioDurationWarning?: string;
  /** Previous asset URLs kept for visual before/after comparison after regeneration (legacy single-slot) */
  previousImageUrl?: string;
  previousVideoUrl?: string;
  previousAudioUrl?: string;
  previousSfxUrl?: string;
  /** Last correction notes (sticky for re-edits) */
  lastImageCorrectionNote?: string;
  lastVideoCorrectionNote?: string;
  /** Sticky preference: when true, regenerations of this scene default to character identity lock. */
  lockCharacter?: boolean;
  /** Full version history per asset — newest first. Capped at MAX_VERSION_HISTORY entries. */
  versionHistory?: AssetVersionHistory;
}

export interface AssetVersion {
  /** Stable id for selection */
  id: string;
  /** Asset URL */
  url: string;
  /** Epoch ms when this version was created */
  createdAt: number;
  /** Optional correction note used to produce this version (image/video) */
  correctionNote?: string;
}

export interface AssetVersionHistory {
  image?: AssetVersion[];
  video?: AssetVersion[];
  audio?: AssetVersion[];
  sfx?: AssetVersion[];
}

export const MAX_VERSION_HISTORY = 10;

export interface StoryScript {
  title: string;
  synopsis: string;
  scenes: StoryScene[];
  suggestedMusic: string;
  narrationVolume?: number; // 0-100, default 100
  musicVolume?: number; // 0-100, default 25
}

export type StoryStep = "input" | "script" | "generation" | "complete";

export type VideoAspectRatio = "16:9" | "4:3" | "9:16";

export type VideoQuality = "sd" | "hd" | "fhd";

export type VideoFps = "24" | "30" | "60";

export type CharacterFidelity = "low" | "medium" | "high";

export interface StoryModeInput {
  imageUrl: string;
  imageFile: File | null;
  styleId: string;
  styleName: string;
  stylePromptModifier: string;
  description: string;
  language: string;
  voiceId: string;
  numScenes: number;
  videoAspectRatio: VideoAspectRatio;
  videoQuality: VideoQuality;
  videoFps: VideoFps;
  characterFidelity: CharacterFidelity;
}
