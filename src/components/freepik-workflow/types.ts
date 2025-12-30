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

// Union type for all node data
export type WorkflowNodeData = 
  | ImageInputNodeData 
  | NoteNodeData 
  | InstructionsNodeData 
  | UpscalerNodeData
  | FreepikVideoNodeData
  | ImageResultNodeData
  | VideoResultNodeData;

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
} as const;

export type NodeTypeKey = keyof typeof NODE_TYPES;
