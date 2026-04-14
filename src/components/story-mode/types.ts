export interface StoryScene {
  sceneNumber: number;
  duration: number;
  narration: string;
  imagePrompt: string;
  cameraMovement: string;
  mood: string;
  voiceId?: string; // per-scene voice override
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
