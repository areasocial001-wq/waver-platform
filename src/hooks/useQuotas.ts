// Commercial features removed: quotas are disabled. Every user gets
// unlimited access. Hook kept to preserve API surface across the codebase.

export interface PlanQuota {
  max_video_generations_monthly: number;
  max_resolution: string;
  max_storyboards: number;
  max_story_mode_monthly: number;
  can_clone_voice: boolean;
  can_use_timeline: boolean;
  can_use_api_access: boolean;
  can_use_multi_provider: boolean;
}

const UNLIMITED_QUOTA: PlanQuota = {
  max_video_generations_monthly: -1,
  max_resolution: "4K",
  max_storyboards: -1,
  max_story_mode_monthly: -1,
  can_clone_voice: true,
  can_use_timeline: true,
  can_use_api_access: true,
  can_use_multi_provider: true,
};

export const useQuotas = () => {
  return {
    quota: UNLIMITED_QUOTA,
    usedGenerations: 0,
    usedStoryMode: 0,
    canGenerate: true,
    remainingGenerations: Infinity,
    canUseStoryMode: true,
    remainingStoryMode: Infinity,
    loading: false,
    isUnlimited: true,
    isStoryModeUnlimited: true,
  };
};
