import { useMemo, useCallback } from 'react';
import { VideoProviderType } from '@/lib/videoProviderConfig';
import { 
  getModelCapabilities, 
  ModelCapabilities,
  getClosestValidDuration,
  getClosestValidResolution,
  isValidDuration,
  supportsFeature
} from '@/lib/modelCapabilities';

export interface UseModelCapabilitiesResult {
  /** Full capabilities object for current provider */
  capabilities: ModelCapabilities;
  
  /** Valid duration options */
  durationOptions: { value: number; label: string }[];
  
  /** Valid resolution options */
  resolutionOptions: { value: string; label: string }[];
  
  /** Valid aspect ratio options (if supported) */
  aspectRatioOptions: { value: string; label: string }[] | undefined;
  
  /** Valid FPS options (if supported) */
  fpsOptions: { value: number; label: string }[] | undefined;
  
  /** Check if a specific duration is valid */
  isDurationValid: (duration: number) => boolean;
  
  /** Get closest valid duration to requested */
  getValidDuration: (requested: number) => number;
  
  /** Get closest valid resolution to requested */
  getValidResolution: (requested: string) => string;
  
  /** Check if provider supports text-to-video */
  supportsT2V: boolean;
  
  /** Check if provider supports image-to-video */
  supportsI2V: boolean;
  
  /** Check if provider supports audio generation */
  supportsAudio: boolean;
  
  /** Check if provider supports end frame (e.g., Luma keyframes) */
  supportsEndFrame: boolean;
  
  /** Check if provider requires end frame (e.g., transition models) */
  requiresEndFrame: boolean;
  
  /** Check if provider supports motion control video input */
  supportsMotionControl: boolean;
  
  /** Check if provider supports reference/video-to-video */
  supportsReferenceVideo: boolean;
  
  /** Check if provider supports multiple input images */
  supportsMultipleImages: boolean;
  
  /** Default duration for this provider */
  defaultDuration: number;
  
  /** Default resolution for this provider */
  defaultResolution: string;
  
  /** Default aspect ratio for this provider (if supported) */
  defaultAspectRatio: string | undefined;
}

/**
 * Hook to get model capabilities for a video provider
 * Automatically constrains form options based on provider limits
 */
export function useModelCapabilities(provider: VideoProviderType): UseModelCapabilitiesResult {
  const capabilities = useMemo(() => getModelCapabilities(provider), [provider]);
  
  const isDurationValid = useCallback(
    (duration: number) => isValidDuration(provider, duration),
    [provider]
  );
  
  const getValidDuration = useCallback(
    (requested: number) => getClosestValidDuration(provider, requested),
    [provider]
  );
  
  const getValidResolution = useCallback(
    (requested: string) => getClosestValidResolution(provider, requested),
    [provider]
  );
  
  return useMemo(() => ({
    capabilities,
    durationOptions: capabilities.durations,
    resolutionOptions: capabilities.resolutions,
    aspectRatioOptions: capabilities.aspectRatios,
    isDurationValid,
    getValidDuration,
    getValidResolution,
    supportsT2V: capabilities.supportsTextToVideo,
    supportsI2V: capabilities.supportsImageToVideo,
    supportsAudio: !!capabilities.supportsAudio,
    supportsEndFrame: !!capabilities.supportsEndFrame,
    requiresEndFrame: !!capabilities.requiresEndFrame,
    supportsMotionControl: !!capabilities.supportsMotionControl,
    supportsReferenceVideo: !!capabilities.supportsReferenceVideo,
    supportsMultipleImages: !!capabilities.supportsMultipleImages,
    defaultDuration: capabilities.defaultDuration,
    defaultResolution: capabilities.defaultResolution,
    defaultAspectRatio: capabilities.defaultAspectRatio,
  }), [capabilities, isDurationValid, getValidDuration, getValidResolution]);
}

/**
 * Hook to auto-adjust form values when provider changes
 * Returns adjusted values that are valid for the new provider
 */
export function useAdjustedFormValues(
  provider: VideoProviderType,
  currentDuration: number,
  currentResolution: string,
  currentAspectRatio?: string
) {
  const { getValidDuration, getValidResolution, capabilities } = useModelCapabilities(provider);
  
  return useMemo(() => {
    const adjustedDuration = getValidDuration(currentDuration);
    const adjustedResolution = getValidResolution(currentResolution);
    
    let adjustedAspectRatio = currentAspectRatio;
    if (capabilities.aspectRatios && currentAspectRatio) {
      const validRatios = capabilities.aspectRatios.map(r => r.value);
      if (!validRatios.includes(currentAspectRatio)) {
        adjustedAspectRatio = capabilities.defaultAspectRatio || validRatios[0];
      }
    }
    
    return {
      duration: adjustedDuration,
      resolution: adjustedResolution,
      aspectRatio: adjustedAspectRatio,
      durationChanged: adjustedDuration !== currentDuration,
      resolutionChanged: adjustedResolution !== currentResolution,
      aspectRatioChanged: adjustedAspectRatio !== currentAspectRatio,
    };
  }, [provider, currentDuration, currentResolution, currentAspectRatio, getValidDuration, getValidResolution, capabilities]);
}
