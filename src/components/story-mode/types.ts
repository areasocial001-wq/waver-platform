export type TransitionType = "crossfade" | "fade_black" | "dissolve" | "wipe_left" | "wipe_right" | "none";

export interface StoryScene {
  sceneNumber: number;
  duration: number;
  narration: string;
  imagePrompt: string;
  cameraMovement: string;
  mood: string;
  voiceId?: string; // per-scene voice override
  transition?: TransitionType; // transition to next scene
  transitionDuration?: number; // seconds (0.3-1.5)
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
}

export type StoryStep = "input" | "script" | "generation" | "complete";

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
}
