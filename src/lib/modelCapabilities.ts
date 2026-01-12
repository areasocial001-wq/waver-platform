/**
 * Model Capability Matrix
 * Defines validated constraints for each video provider/model to prevent invalid API requests
 */

import { VideoProviderType } from './videoProviderConfig';

export interface DurationOption {
  value: number;
  label: string;
}

export interface AspectRatioOption {
  value: string;
  label: string;
}

export interface ResolutionOption {
  value: string;
  label: string;
}

export interface ModelCapabilities {
  // Supported duration values (in seconds)
  durations: DurationOption[];
  
  // Supported aspect ratios (if undefined, use default 16:9)
  aspectRatios?: AspectRatioOption[];
  
  // Supported resolutions
  resolutions: ResolutionOption[];
  
  // Input requirements
  supportsTextToVideo: boolean;
  supportsImageToVideo: boolean;
  
  // Special input modes
  requiresStartFrame?: boolean;      // Must provide start image for I2V
  supportsEndFrame?: boolean;        // Can provide end image (e.g., Luma keyframes)
  requiresEndFrame?: boolean;        // Must provide end image
  supportsMultipleImages?: boolean;  // Can provide multiple reference images
  
  // Audio capabilities
  supportsAudio?: boolean;           // Model can generate/include audio
  supportsAudioPrompt?: boolean;     // Can customize audio via prompt
  
  // Special features
  supportsMotionControl?: boolean;   // Supports motion video input
  supportsReferenceVideo?: boolean;  // Supports video-to-video
  
  // Default values when not specified
  defaultDuration: number;
  defaultAspectRatio?: string;
  defaultResolution: string;
}

// Common presets for reuse
const STANDARD_DURATIONS: DurationOption[] = [
  { value: 5, label: '5 secondi' },
  { value: 10, label: '10 secondi' },
];

const LUMA_DURATIONS: DurationOption[] = [
  { value: 5, label: '5 secondi' },
];

const LUMA_RAY_2_DURATIONS: DurationOption[] = [
  { value: 5, label: '5 secondi' },
  { value: 10, label: '10 secondi' },
];

const VEO_DURATIONS: DurationOption[] = [
  { value: 4, label: '4 secondi' },
  { value: 6, label: '6 secondi' },
  { value: 8, label: '8 secondi' },
];

const SORA_DURATIONS: DurationOption[] = [
  { value: 5, label: '5 secondi' },
  { value: 10, label: '10 secondi' },
  { value: 15, label: '15 secondi' },
  { value: 20, label: '20 secondi' },
];

const MINIMAX_DURATIONS: DurationOption[] = [
  { value: 6, label: '6 secondi' },
];

const SEEDANCE_DURATIONS: DurationOption[] = [
  { value: 5, label: '5 secondi' },
  { value: 10, label: '10 secondi' },
];

const WAN_DURATIONS: DurationOption[] = [
  { value: 4, label: '4 secondi' },
  { value: 8, label: '8 secondi' },
];

const STANDARD_RESOLUTIONS: ResolutionOption[] = [
  { value: '720p', label: '720p (HD)' },
  { value: '1080p', label: '1080p (Full HD)' },
];

const BASIC_RESOLUTIONS: ResolutionOption[] = [
  { value: '720p', label: '720p (HD)' },
];

const PREMIUM_RESOLUTIONS: ResolutionOption[] = [
  { value: '720p', label: '720p (HD)' },
  { value: '1080p', label: '1080p (Full HD)' },
  { value: '4k', label: '4K (Ultra HD)' },
];

const STANDARD_ASPECT_RATIOS: AspectRatioOption[] = [
  { value: '16:9', label: '16:9 (Orizzontale)' },
  { value: '9:16', label: '9:16 (Verticale)' },
];

const EXTENDED_ASPECT_RATIOS: AspectRatioOption[] = [
  { value: '16:9', label: '16:9 (Orizzontale)' },
  { value: '9:16', label: '9:16 (Verticale)' },
  { value: '1:1', label: '1:1 (Quadrato)' },
];

const FULL_ASPECT_RATIOS: AspectRatioOption[] = [
  { value: '16:9', label: '16:9 (Orizzontale)' },
  { value: '9:16', label: '9:16 (Verticale)' },
  { value: '1:1', label: '1:1 (Quadrato)' },
  { value: '4:3', label: '4:3 (Standard)' },
  { value: '3:4', label: '3:4 (Ritratto)' },
  { value: '21:9', label: '21:9 (Cinematico)' },
];

// Default capabilities for unknown providers
const DEFAULT_CAPABILITIES: ModelCapabilities = {
  durations: STANDARD_DURATIONS,
  resolutions: STANDARD_RESOLUTIONS,
  aspectRatios: STANDARD_ASPECT_RATIOS,
  supportsTextToVideo: true,
  supportsImageToVideo: true,
  defaultDuration: 5,
  defaultAspectRatio: '16:9',
  defaultResolution: '720p',
};

/**
 * Model Capability Matrix
 * Each provider maps to its specific constraints
 */
export const MODEL_CAPABILITIES: Partial<Record<VideoProviderType, ModelCapabilities>> = {
  // ============ AUTO ============
  'auto': {
    ...DEFAULT_CAPABILITIES,
  },

  // ============ GOOGLE VEO (Direct) ============
  'google-veo': {
    durations: VEO_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    aspectRatios: STANDARD_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    supportsAudio: true,
    defaultDuration: 6,
    defaultAspectRatio: '16:9',
    defaultResolution: '720p',
  },

  // ============ AI/ML API - RUNWAY ============
  'aiml-runway-gen3-turbo': {
    durations: STANDARD_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    aspectRatios: EXTENDED_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    defaultDuration: 5,
    defaultAspectRatio: '16:9',
    defaultResolution: '720p',
  },
  'aiml-runway-gen4-turbo': {
    durations: STANDARD_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    aspectRatios: EXTENDED_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    defaultDuration: 5,
    defaultAspectRatio: '16:9',
    defaultResolution: '720p',
  },
  'aiml-runway-gen4-aleph': {
    durations: STANDARD_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    aspectRatios: EXTENDED_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    defaultDuration: 5,
    defaultAspectRatio: '16:9',
    defaultResolution: '720p',
  },
  'aiml-runway-act-two': {
    durations: STANDARD_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    defaultDuration: 5,
    defaultResolution: '720p',
  },

  // ============ AI/ML API - KLING ============
  'aiml-kling-v1-std': {
    durations: STANDARD_DURATIONS,
    resolutions: BASIC_RESOLUTIONS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    defaultDuration: 5,
    defaultResolution: '720p',
  },
  'aiml-kling-v1-pro': {
    durations: STANDARD_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    defaultDuration: 5,
    defaultResolution: '720p',
  },
  'aiml-kling-v1.6-std': {
    durations: STANDARD_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    defaultDuration: 5,
    defaultResolution: '720p',
  },
  'aiml-kling-v1.6-pro': {
    durations: STANDARD_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    defaultDuration: 5,
    defaultResolution: '720p',
  },
  'aiml-kling-v1.6-pro-effects': {
    durations: STANDARD_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    defaultDuration: 5,
    defaultResolution: '720p',
  },
  'aiml-kling-v1.6-multi-i2v': {
    durations: STANDARD_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    supportsTextToVideo: false,
    supportsImageToVideo: true,
    supportsMultipleImages: true,
    requiresStartFrame: true,
    defaultDuration: 5,
    defaultResolution: '720p',
  },
  'aiml-kling-v2-master': {
    durations: STANDARD_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    defaultDuration: 5,
    defaultResolution: '720p',
  },
  'aiml-kling-v2.1-std': {
    durations: STANDARD_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    defaultDuration: 5,
    defaultResolution: '720p',
  },
  'aiml-kling-v2.1-pro': {
    durations: STANDARD_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    defaultDuration: 5,
    defaultResolution: '720p',
  },
  'aiml-kling-v2.1-master': {
    durations: STANDARD_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    defaultDuration: 5,
    defaultResolution: '720p',
  },
  'aiml-kling-v2.5-turbo-pro': {
    durations: STANDARD_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    defaultDuration: 5,
    defaultResolution: '720p',
  },
  'aiml-kling-v2.6-pro': {
    durations: STANDARD_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    defaultDuration: 5,
    defaultResolution: '720p',
  },
  'aiml-kling-o1': {
    durations: STANDARD_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    supportsReferenceVideo: true,
    defaultDuration: 5,
    defaultResolution: '720p',
  },

  // ============ AI/ML API - LUMA ============
  'aiml-luma-ray-1.6': {
    durations: LUMA_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    aspectRatios: EXTENDED_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    supportsEndFrame: true,  // Luma uses keyframes (frame0, frame1)
    defaultDuration: 5,
    defaultAspectRatio: '16:9',
    defaultResolution: '720p',
  },
  'aiml-luma-ray-2': {
    durations: LUMA_RAY_2_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    aspectRatios: EXTENDED_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    supportsEndFrame: true,
    defaultDuration: 5,
    defaultAspectRatio: '16:9',
    defaultResolution: '720p',
  },
  'aiml-luma-ray-flash-2': {
    durations: LUMA_DURATIONS,
    resolutions: BASIC_RESOLUTIONS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    supportsEndFrame: true,
    defaultDuration: 5,
    defaultResolution: '720p',
  },

  // ============ AI/ML API - SORA (OPENAI) ============
  'aiml-sora-2-t2v': {
    durations: SORA_DURATIONS,
    resolutions: PREMIUM_RESOLUTIONS,
    aspectRatios: EXTENDED_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: false,
    defaultDuration: 5,
    defaultAspectRatio: '16:9',
    defaultResolution: '1080p',
  },
  'aiml-sora-2-i2v': {
    durations: [
      { value: 5, label: '5 secondi' },
      { value: 10, label: '10 secondi' },
      { value: 15, label: '15 secondi' },
    ],
    resolutions: STANDARD_RESOLUTIONS,
    supportsTextToVideo: false,
    supportsImageToVideo: true,
    requiresStartFrame: true,
    defaultDuration: 5,
    defaultResolution: '1080p',
  },
  'aiml-sora-2-pro-t2v': {
    durations: SORA_DURATIONS,
    resolutions: PREMIUM_RESOLUTIONS,
    aspectRatios: EXTENDED_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: false,
    defaultDuration: 5,
    defaultAspectRatio: '16:9',
    defaultResolution: '1080p',
  },
  'aiml-sora-2-pro-i2v': {
    durations: [
      { value: 5, label: '5 secondi' },
      { value: 10, label: '10 secondi' },
      { value: 15, label: '15 secondi' },
    ],
    resolutions: STANDARD_RESOLUTIONS,
    supportsTextToVideo: false,
    supportsImageToVideo: true,
    requiresStartFrame: true,
    defaultDuration: 5,
    defaultResolution: '1080p',
  },

  // ============ AI/ML API - MINIMAX ============
  'aiml-minimax-video-01': {
    durations: MINIMAX_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    defaultDuration: 6,
    defaultResolution: '720p',
  },
  'aiml-minimax-hailuo-02': {
    durations: MINIMAX_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    defaultDuration: 6,
    defaultResolution: '720p',
  },
  'aiml-minimax-hailuo-2.3': {
    durations: MINIMAX_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    defaultDuration: 6,
    defaultResolution: '720p',
  },
  'aiml-minimax-hailuo-2.3-fast': {
    durations: MINIMAX_DURATIONS,
    resolutions: BASIC_RESOLUTIONS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    defaultDuration: 6,
    defaultResolution: '720p',
  },

  // ============ AI/ML API - PIXVERSE ============
  'aiml-pixverse-v5-t2v': {
    durations: STANDARD_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    aspectRatios: EXTENDED_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: false,
    defaultDuration: 5,
    defaultAspectRatio: '16:9',
    defaultResolution: '720p',
  },
  'aiml-pixverse-v5-i2v': {
    durations: STANDARD_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    supportsTextToVideo: false,
    supportsImageToVideo: true,
    requiresStartFrame: true,
    defaultDuration: 5,
    defaultResolution: '720p',
  },
  'aiml-pixverse-v5-transition': {
    durations: STANDARD_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    supportsTextToVideo: false,
    supportsImageToVideo: true,
    requiresStartFrame: true,
    supportsEndFrame: true,
    requiresEndFrame: true,  // Transition needs both start and end frames
    defaultDuration: 5,
    defaultResolution: '720p',
  },
  'aiml-pixverse-v5.5-t2v': {
    durations: STANDARD_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    aspectRatios: EXTENDED_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: false,
    defaultDuration: 5,
    defaultAspectRatio: '16:9',
    defaultResolution: '720p',
  },
  'aiml-pixverse-v5.5-i2v': {
    durations: STANDARD_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    supportsTextToVideo: false,
    supportsImageToVideo: true,
    requiresStartFrame: true,
    defaultDuration: 5,
    defaultResolution: '720p',
  },

  // ============ AI/ML API - VEO ============
  'aiml-veo2-t2v': {
    durations: VEO_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    aspectRatios: STANDARD_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: false,
    supportsAudio: true,
    defaultDuration: 6,
    defaultAspectRatio: '16:9',
    defaultResolution: '720p',
  },
  'aiml-veo2-i2v': {
    durations: VEO_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    aspectRatios: STANDARD_ASPECT_RATIOS,
    supportsTextToVideo: false,
    supportsImageToVideo: true,
    supportsAudio: true,
    requiresStartFrame: true,
    defaultDuration: 6,
    defaultAspectRatio: '16:9',
    defaultResolution: '720p',
  },
  'aiml-veo3': {
    durations: VEO_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    aspectRatios: STANDARD_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: false,
    supportsAudio: true,
    defaultDuration: 6,
    defaultAspectRatio: '16:9',
    defaultResolution: '720p',
  },
  'aiml-veo3-i2v': {
    durations: VEO_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    aspectRatios: STANDARD_ASPECT_RATIOS,
    supportsTextToVideo: false,
    supportsImageToVideo: true,
    supportsAudio: true,
    requiresStartFrame: true,
    defaultDuration: 6,
    defaultAspectRatio: '16:9',
    defaultResolution: '720p',
  },
  'aiml-veo3-fast': {
    durations: VEO_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    aspectRatios: STANDARD_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: false,
    supportsAudio: true,
    defaultDuration: 6,
    defaultAspectRatio: '16:9',
    defaultResolution: '720p',
  },
  'aiml-veo3-i2v-fast': {
    durations: VEO_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    aspectRatios: STANDARD_ASPECT_RATIOS,
    supportsTextToVideo: false,
    supportsImageToVideo: true,
    supportsAudio: true,
    requiresStartFrame: true,
    defaultDuration: 6,
    defaultAspectRatio: '16:9',
    defaultResolution: '720p',
  },
  'aiml-veo3.1-t2v': {
    durations: VEO_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    aspectRatios: STANDARD_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: false,
    supportsAudio: true,
    defaultDuration: 6,
    defaultAspectRatio: '16:9',
    defaultResolution: '720p',
  },
  'aiml-veo3.1-i2v': {
    durations: VEO_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    aspectRatios: STANDARD_ASPECT_RATIOS,
    supportsTextToVideo: false,
    supportsImageToVideo: true,
    supportsAudio: true,
    requiresStartFrame: true,
    defaultDuration: 6,
    defaultAspectRatio: '16:9',
    defaultResolution: '720p',
  },
  'aiml-veo3.1-t2v-fast': {
    durations: VEO_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    aspectRatios: STANDARD_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: false,
    supportsAudio: true,
    defaultDuration: 6,
    defaultAspectRatio: '16:9',
    defaultResolution: '720p',
  },
  'aiml-veo3.1-i2v-fast': {
    durations: VEO_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    aspectRatios: STANDARD_ASPECT_RATIOS,
    supportsTextToVideo: false,
    supportsImageToVideo: true,
    supportsAudio: true,
    requiresStartFrame: true,
    defaultDuration: 6,
    defaultAspectRatio: '16:9',
    defaultResolution: '720p',
  },
  'aiml-veo3.1-ref-to-video': {
    durations: VEO_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    aspectRatios: STANDARD_ASPECT_RATIOS,
    supportsTextToVideo: false,
    supportsImageToVideo: true,
    supportsAudio: true,
    supportsReferenceVideo: true,
    defaultDuration: 6,
    defaultAspectRatio: '16:9',
    defaultResolution: '720p',
  },
  'aiml-veo3.1-first-last-i2v': {
    durations: VEO_DURATIONS, // 4, 6, 8 seconds per API docs
    resolutions: STANDARD_RESOLUTIONS,
    aspectRatios: STANDARD_ASPECT_RATIOS,
    supportsTextToVideo: false,
    supportsImageToVideo: true,
    supportsAudio: true,
    requiresStartFrame: true,
    supportsEndFrame: true,
    requiresEndFrame: true, // Both start and end images required
    defaultDuration: 8, // API default is 8
    defaultAspectRatio: '16:9',
    defaultResolution: '1080p', // API default is 1080p
  },

  // ============ AI/ML API - ALIBABA WAN ============
  'aiml-wan-2.1-t2v': {
    durations: WAN_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    aspectRatios: EXTENDED_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: false,
    defaultDuration: 4,
    defaultAspectRatio: '16:9',
    defaultResolution: '720p',
  },
  'aiml-wan-2.1-i2v': {
    durations: WAN_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    supportsTextToVideo: false,
    supportsImageToVideo: true,
    requiresStartFrame: true,
    defaultDuration: 4,
    defaultResolution: '720p',
  },
  'aiml-wan-2.5-t2v': {
    durations: WAN_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    aspectRatios: EXTENDED_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: false,
    defaultDuration: 4,
    defaultAspectRatio: '16:9',
    defaultResolution: '720p',
  },
  'aiml-wan-2.6-t2v': {
    durations: WAN_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    aspectRatios: EXTENDED_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: false,
    defaultDuration: 4,
    defaultAspectRatio: '16:9',
    defaultResolution: '720p',
  },
  'aiml-wan-2.6-i2v': {
    durations: WAN_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    supportsTextToVideo: false,
    supportsImageToVideo: true,
    requiresStartFrame: true,
    defaultDuration: 4,
    defaultResolution: '720p',
  },
  'aiml-wan-2.6-r2v': {
    durations: WAN_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    supportsTextToVideo: false,
    supportsImageToVideo: true,
    supportsReferenceVideo: true,
    defaultDuration: 4,
    defaultResolution: '720p',
  },

  // ============ AI/ML API - BYTEDANCE SEEDANCE ============
  'aiml-seedance-lite-t2v': {
    durations: SEEDANCE_DURATIONS,
    resolutions: BASIC_RESOLUTIONS,
    aspectRatios: EXTENDED_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: false,
    defaultDuration: 5,
    defaultAspectRatio: '16:9',
    defaultResolution: '720p',
  },
  'aiml-seedance-lite-i2v': {
    durations: SEEDANCE_DURATIONS,
    resolutions: BASIC_RESOLUTIONS,
    supportsTextToVideo: false,
    supportsImageToVideo: true,
    requiresStartFrame: true,
    defaultDuration: 5,
    defaultResolution: '720p',
  },
  'aiml-seedance-pro-t2v': {
    durations: SEEDANCE_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    aspectRatios: EXTENDED_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: false,
    defaultDuration: 5,
    defaultAspectRatio: '16:9',
    defaultResolution: '720p',
  },
  'aiml-seedance-pro-i2v': {
    durations: SEEDANCE_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    supportsTextToVideo: false,
    supportsImageToVideo: true,
    requiresStartFrame: true,
    defaultDuration: 5,
    defaultResolution: '720p',
  },
  'aiml-omnihuman': {
    durations: STANDARD_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    supportsTextToVideo: false,
    supportsImageToVideo: true,
    requiresStartFrame: true,
    defaultDuration: 5,
    defaultResolution: '720p',
  },
  'aiml-omnihuman-1.5': {
    durations: STANDARD_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    supportsTextToVideo: false,
    supportsImageToVideo: true,
    requiresStartFrame: true,
    defaultDuration: 5,
    defaultResolution: '720p',
  },

  // ============ AI/ML API - KREA ============
  'aiml-krea-wan-14b-t2v': {
    durations: WAN_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    aspectRatios: EXTENDED_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: false,
    defaultDuration: 4,
    defaultAspectRatio: '16:9',
    defaultResolution: '720p',
  },
  'aiml-krea-wan-14b-v2v': {
    durations: WAN_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    supportsTextToVideo: false,
    supportsImageToVideo: true,
    supportsReferenceVideo: true,
    defaultDuration: 4,
    defaultResolution: '720p',
  },

  // ============ AI/ML API - KANDINSKY ============
  'aiml-kandinsky5-t2v': {
    durations: STANDARD_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    aspectRatios: EXTENDED_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: false,
    defaultDuration: 5,
    defaultAspectRatio: '16:9',
    defaultResolution: '720p',
  },
  'aiml-kandinsky5-distill-t2v': {
    durations: STANDARD_DURATIONS,
    resolutions: BASIC_RESOLUTIONS,
    aspectRatios: EXTENDED_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: false,
    defaultDuration: 5,
    defaultAspectRatio: '16:9',
    defaultResolution: '720p',
  },

  // ============ AI/ML API - VEED FABRIC ============
  'aiml-veed-fabric-1.0': {
    durations: STANDARD_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    aspectRatios: EXTENDED_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    defaultDuration: 5,
    defaultAspectRatio: '16:9',
    defaultResolution: '720p',
  },
  'aiml-veed-fabric-1.0-fast': {
    durations: STANDARD_DURATIONS,
    resolutions: BASIC_RESOLUTIONS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    defaultDuration: 5,
    defaultResolution: '720p',
  },

  // ============ PiAPI PROVIDERS ============
  'piapi-kling-2.1': {
    durations: STANDARD_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    defaultDuration: 5,
    defaultResolution: '720p',
  },
  'piapi-kling-2.5': {
    durations: STANDARD_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    defaultDuration: 5,
    defaultResolution: '720p',
  },
  'piapi-kling-2.6': {
    durations: STANDARD_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    supportsMotionControl: true,
    defaultDuration: 5,
    defaultResolution: '720p',
  },
  'piapi-hailuo': {
    durations: MINIMAX_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    defaultDuration: 6,
    defaultResolution: '720p',
  },
  'piapi-luma': {
    durations: LUMA_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    aspectRatios: EXTENDED_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    supportsEndFrame: true,
    defaultDuration: 5,
    defaultAspectRatio: '16:9',
    defaultResolution: '720p',
  },
  'piapi-wan': {
    durations: WAN_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    aspectRatios: EXTENDED_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    defaultDuration: 4,
    defaultAspectRatio: '16:9',
    defaultResolution: '720p',
  },
  'piapi-hunyuan': {
    durations: STANDARD_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    supportsAudio: true,
    defaultDuration: 5,
    defaultResolution: '720p',
  },
  'piapi-skyreels': {
    durations: STANDARD_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    defaultDuration: 5,
    defaultResolution: '720p',
  },
  'piapi-framepack': {
    durations: STANDARD_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    defaultDuration: 5,
    defaultResolution: '720p',
  },
  'piapi-veo3': {
    durations: VEO_DURATIONS,
    resolutions: STANDARD_RESOLUTIONS,
    aspectRatios: STANDARD_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: false,
    supportsAudio: true,
    defaultDuration: 6,
    defaultAspectRatio: '16:9',
    defaultResolution: '720p',
  },
  'piapi-sora2': {
    durations: SORA_DURATIONS,
    resolutions: PREMIUM_RESOLUTIONS,
    aspectRatios: EXTENDED_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    defaultDuration: 5,
    defaultAspectRatio: '16:9',
    defaultResolution: '1080p',
  },

  // ============ FREEPIK ============
  'freepik': {
    durations: [
      { value: 4, label: '4 secondi' },
      { value: 6, label: '6 secondi' },
    ],
    resolutions: STANDARD_RESOLUTIONS,
    aspectRatios: EXTENDED_ASPECT_RATIOS,
    supportsTextToVideo: false,
    supportsImageToVideo: true,
    requiresStartFrame: true,
    defaultDuration: 4,
    defaultAspectRatio: '16:9',
    defaultResolution: '720p',
  },
};

/**
 * Get capabilities for a provider, with fallback to defaults
 */
export function getModelCapabilities(provider: VideoProviderType): ModelCapabilities {
  return MODEL_CAPABILITIES[provider] || DEFAULT_CAPABILITIES;
}

/**
 * Validate if a duration is supported by the provider
 */
export function isValidDuration(provider: VideoProviderType, duration: number): boolean {
  const caps = getModelCapabilities(provider);
  return caps.durations.some(d => d.value === duration);
}

/**
 * Get the closest valid duration for a provider
 */
export function getClosestValidDuration(provider: VideoProviderType, requestedDuration: number): number {
  const caps = getModelCapabilities(provider);
  const validDurations = caps.durations.map(d => d.value);
  
  // If exact match exists, use it
  if (validDurations.includes(requestedDuration)) {
    return requestedDuration;
  }
  
  // Find closest valid duration
  return validDurations.reduce((prev, curr) => 
    Math.abs(curr - requestedDuration) < Math.abs(prev - requestedDuration) ? curr : prev
  );
}

/**
 * Get the closest valid resolution for a provider
 */
export function getClosestValidResolution(provider: VideoProviderType, requestedResolution: string): string {
  const caps = getModelCapabilities(provider);
  const validResolutions = caps.resolutions.map(r => r.value);
  
  if (validResolutions.includes(requestedResolution)) {
    return requestedResolution;
  }
  
  return caps.defaultResolution;
}

/**
 * Check if provider supports a feature
 */
export function supportsFeature(
  provider: VideoProviderType, 
  feature: 'audio' | 'endFrame' | 'motionControl' | 'referenceVideo' | 'multipleImages'
): boolean {
  const caps = getModelCapabilities(provider);
  
  switch (feature) {
    case 'audio':
      return !!caps.supportsAudio;
    case 'endFrame':
      return !!caps.supportsEndFrame;
    case 'motionControl':
      return !!caps.supportsMotionControl;
    case 'referenceVideo':
      return !!caps.supportsReferenceVideo;
    case 'multipleImages':
      return !!caps.supportsMultipleImages;
    default:
      return false;
  }
}
