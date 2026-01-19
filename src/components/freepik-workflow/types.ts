import { Node, Edge } from "@xyflow/react";

// Node data types - using Record for React Flow compatibility
export interface ImageInputNodeData extends Record<string, unknown> {
  label: string;
  imageUrl?: string;
  fileName?: string;
}

export interface NoteNodeData extends Record<string, unknown> {
  label: string;
  text: string;
}

export interface InstructionsNodeData extends Record<string, unknown> {
  label: string;
  prompt: string;
  model: string;
  aspectRatio: string;
}

export interface UpscalerNodeData extends Record<string, unknown> {
  label: string;
  mode: "creative" | "precision";
  scaleFactor: string;
  optimizedFor: string;
  creativity: number;
}

export interface FreepikVideoNodeData extends Record<string, unknown> {
  label: string;
  prompt: string;
  model: "kling" | "minimax";
  duration: number;
  lastFrameImageUrl?: string;
  lastFrameFileName?: string;
}

export interface ImageResultNodeData extends Record<string, unknown> {
  label: string;
  imageUrl?: string;
  status: "idle" | "generating" | "completed" | "error";
  error?: string;
}

export interface VideoResultNodeData extends Record<string, unknown> {
  label: string;
  videoUrl?: string;
  status: "idle" | "generating" | "completed" | "error";
  error?: string;
}

export interface AudioNodeData extends Record<string, unknown> {
  label: string;
  audioType: "generate" | "file";
  prompt?: string;
  category?: "music" | "sfx" | "ambient";
  duration?: number;
  volume?: number;
  audioUrl?: string;
  audioFileName?: string;
}

export interface ClipEffects {
  blur: number; // 0-10
  saturation: number; // 0-200, 100 = normal
  contrast: number; // 0-200, 100 = normal
  brightness: number; // 0-200, 100 = normal
}

export interface IntroOutroConfig {
  enabled: boolean;
  text: string;
  duration: number; // seconds
  backgroundColor: string;
  textColor: string;
  animation: "fade" | "slide" | "zoom" | "typewriter";
  fontSize: "small" | "medium" | "large";
}

export interface VideoConcatNodeData extends Record<string, unknown> {
  label: string;
  transition: "none" | "fade" | "crossfade" | "wipe";
  transitionDuration: number;
  outputFormat: "mp4" | "webm";
  resolution: "sd" | "hd" | "fhd";
  aspectRatio: "16:9" | "9:16" | "1:1";
  fps: "24" | "30" | "60";
  videoOrder?: string[];
  clipDurations?: Record<string, number>;
  clipEffects?: Record<string, ClipEffects>;
  intro?: IntroOutroConfig;
  outro?: IntroOutroConfig;
}

export interface FinalVideoNodeData extends Record<string, unknown> {
  label: string;
  videoUrl?: string;
  hasAudio?: boolean;
  audioUrl?: string;
  segments?: string[];
  status: "idle" | "processing" | "completed" | "error";
  error?: string;
}

// Union type for all node data
export type WorkflowNodeData = 
  | ImageInputNodeData 
  | NoteNodeData 
  | InstructionsNodeData 
  | UpscalerNodeData
  | FreepikVideoNodeData
  | ImageResultNodeData
  | VideoResultNodeData
  | AudioNodeData
  | VideoConcatNodeData
  | FinalVideoNodeData;

// Custom node types
export type WorkflowNode = Node<WorkflowNodeData>;
export type WorkflowEdge = Edge;

// Node type identifiers
export const NODE_TYPES = {
  imageInput: "imageInput",
  note: "note",
  instructions: "instructions",
  upscaler: "upscaler",
  freepikVideo: "freepikVideo",
  imageResult: "imageResult",
  videoResult: "videoResult",
  audio: "audio",
  videoConcat: "videoConcat",
  finalVideo: "finalVideo",
} as const;

export type NodeTypeKey = keyof typeof NODE_TYPES;
