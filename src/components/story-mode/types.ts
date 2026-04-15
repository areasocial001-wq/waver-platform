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
}

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
  characterFidelity: CharacterFidelity;
}
