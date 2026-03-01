// Mirror of the backend AIML_MODEL_IDS mapping for debug/display purposes.
// Keep in sync with supabase/functions/generate-video/index.ts

const AIML_MODEL_IDS: Record<string, { t2v: string; i2v: string }> = {
  'runway-gen3-turbo': { t2v: 'gen3a_turbo', i2v: 'gen3a_turbo' },
  'runway-gen4-turbo': { t2v: 'runway/gen4_turbo', i2v: 'runway/gen4_turbo' },
  'runway-gen4-aleph': { t2v: 'runway/gen4_aleph', i2v: 'runway/gen4_aleph' },
  'runway-act-two': { t2v: 'runway/act_two', i2v: 'runway/act_two' },
  'kling-v1-std': { t2v: 'kling-video/v1/standard/text-to-video', i2v: 'kling-video/v1/standard/image-to-video' },
  'kling-v1-pro': { t2v: 'kling-video/v1/pro/text-to-video', i2v: 'kling-video/v1/pro/image-to-video' },
  'kling-v1.6-std': { t2v: 'kling-video/v1.6/standard/text-to-video', i2v: 'kling-video/v1.6/standard/image-to-video' },
  'kling-v1.6-pro': { t2v: 'kling-video/v1.6/pro/text-to-video', i2v: 'kling-video/v1.6/pro/image-to-video' },
  'kling-v2-master': { t2v: 'klingai/v2-master-text-to-video', i2v: 'klingai/v2-master-image-to-video' },
  'kling-v2.1-std': { t2v: 'kling-video/v2.1/standard/text-to-video', i2v: 'kling-video/v2.1/standard/image-to-video' },
  'kling-v2.1-pro': { t2v: 'kling-video/v2.1/pro/text-to-video', i2v: 'kling-video/v2.1/pro/image-to-video' },
  'kling-v2.1-master': { t2v: 'klingai/v2.1-master-text-to-video', i2v: 'klingai/v2.1-master-image-to-video' },
  'kling-v2.5-turbo-pro': { t2v: 'klingai/v2.5-turbo/pro/text-to-video', i2v: 'klingai/v2.5-turbo/pro/image-to-video' },
  'kling-v2.6-pro': { t2v: 'klingai/video-v2-6-pro-text-to-video', i2v: 'klingai/video-v2-6-pro-image-to-video' },
  'kling-o1': { t2v: 'klingai/video-o1-image-to-video', i2v: 'klingai/video-o1-image-to-video' },
  'luma-ray-1.6': { t2v: 'luma/ray-1-6', i2v: 'luma/ray-1-6' },
  'luma-ray-2': { t2v: 'luma/ray-2', i2v: 'luma/ray-2' },
  'luma-ray-flash-2': { t2v: 'luma/ray-flash-2', i2v: 'luma/ray-flash-2' },
  'veo2-t2v': { t2v: 'veo2', i2v: 'veo2' },
  'veo2-i2v': { t2v: 'veo2/image-to-video', i2v: 'veo2/image-to-video' },
  'veo3': { t2v: 'google/veo3', i2v: 'google/veo3' },
  'veo3-i2v': { t2v: 'google/veo-3.0-i2v', i2v: 'google/veo-3.0-i2v' },
  'veo3.1-t2v': { t2v: 'google/veo-3.1-t2v', i2v: 'google/veo-3.1-t2v' },
  'veo3.1-i2v': { t2v: 'google/veo-3.1-i2v', i2v: 'google/veo-3.1-i2v' },
};

/**
 * Resolve the actual AIML model ID that the backend will use,
 * given the frontend provider key and mode (I2V vs T2V).
 */
export function resolveAimlModelId(
  providerKey: string,
  mode: 'image_to_video' | 'text_to_video'
): string | null {
  if (!providerKey.startsWith('aiml-')) return null;
  const modelKey = providerKey.replace('aiml-', '');
  const entry = AIML_MODEL_IDS[modelKey];
  if (!entry) return null;
  return mode === 'image_to_video' ? entry.i2v : entry.t2v;
}
