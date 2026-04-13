import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./useUserRole";

export interface PlanQuota {
  max_video_generations_monthly: number;
  max_resolution: string;
  max_storyboards: number;
  can_clone_voice: boolean;
  can_use_timeline: boolean;
  can_use_api_access: boolean;
  can_use_multi_provider: boolean;
}

const DEFAULT_QUOTA: PlanQuota = {
  max_video_generations_monthly: 5,
  max_resolution: "720p",
  max_storyboards: 1,
  can_clone_voice: false,
  can_use_timeline: false,
  can_use_api_access: false,
  can_use_multi_provider: false,
};

export const useQuotas = () => {
  const { roles, loading: rolesLoading, isAdmin } = useUserRole();
  const [quota, setQuota] = useState<PlanQuota>(DEFAULT_QUOTA);
  const [usedGenerations, setUsedGenerations] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (rolesLoading) return;

    const fetchQuota = async () => {
      // Determine effective role with priority: admin > business > creator > premium > user
      let effectiveRole: string = "user";
      if (isAdmin) {
        effectiveRole = "admin";
      } else if (roles.includes("business" as any)) {
        effectiveRole = "business";
      } else if (roles.includes("creator" as any)) {
        effectiveRole = "creator";
      } else if (roles.includes("premium")) {
        effectiveRole = "premium";
      }

      const { data } = await supabase
        .from("plan_quotas")
        .select("*")
        .eq("role", effectiveRole)
        .single();

      if (data) {
        setQuota({
          max_video_generations_monthly: data.max_video_generations_monthly,
          max_resolution: data.max_resolution,
          max_storyboards: data.max_storyboards,
          can_clone_voice: data.can_clone_voice,
          can_use_timeline: data.can_use_timeline,
          can_use_api_access: data.can_use_api_access,
          can_use_multi_provider: data.can_use_multi_provider,
        });
      }

      // Count this month's generations
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { count } = await supabase
          .from("video_generations")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("created_at", startOfMonth);

        setUsedGenerations(count || 0);
      }

      setLoading(false);
    };

    fetchQuota();
  }, [roles, rolesLoading, isAdmin]);

  const canGenerate = quota.max_video_generations_monthly === -1 || usedGenerations < quota.max_video_generations_monthly;
  const remainingGenerations = quota.max_video_generations_monthly === -1 ? Infinity : Math.max(0, quota.max_video_generations_monthly - usedGenerations);

  return {
    quota,
    usedGenerations,
    canGenerate,
    remainingGenerations,
    loading,
    isUnlimited: quota.max_video_generations_monthly === -1,
  };
};