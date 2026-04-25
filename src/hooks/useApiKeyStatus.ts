import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ApiKeyStatus {
  hasGoogleKey: boolean;
  hasPiAPIKey: boolean;
  hasAIMLKey: boolean;
  hasFreepikKey: boolean;
}

const DEFAULT_STATUS: ApiKeyStatus = {
  hasGoogleKey: false,
  hasPiAPIKey: false,
  hasAIMLKey: false,
  hasFreepikKey: false,
};

// Cache the status to avoid too many requests
let cachedStatus: ApiKeyStatus | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export function useApiKeyStatus() {
  const [status, setStatus] = useState<ApiKeyStatus>(cachedStatus || DEFAULT_STATUS);
  const [isLoading, setIsLoading] = useState(!cachedStatus);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async (forceRefresh = false) => {
    // Check cache first
    const now = Date.now();
    if (!forceRefresh && cachedStatus && (now - cacheTimestamp) < CACHE_DURATION_MS) {
      setStatus(cachedStatus);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use a health check request to the generate-video function
      // Retry up to 2 times on transient 503 (SUPABASE_EDGE_RUNTIME_ERROR)
      let data: any = null;
      let fnError: any = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await supabase.functions.invoke('generate-video', {
          body: { healthCheck: true },
        });
        data = res.data;
        fnError = res.error;
        const msg = fnError?.message || '';
        const isTransient = msg.includes('503') || msg.includes('temporarily unavailable') || msg.includes('SUPABASE_EDGE_RUNTIME_ERROR');
        if (!fnError || !isTransient) break;
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }

      if (fnError) {
        throw fnError;
      }

      // The function returns API key status in health check response
      const newStatus: ApiKeyStatus = {
        hasGoogleKey: data?.hasGoogleKey ?? false,
        hasPiAPIKey: data?.hasPiAPIKey ?? false,
        hasAIMLKey: data?.hasAIMLKey ?? false,
        hasFreepikKey: data?.hasFreepikKey ?? false,
      };

      cachedStatus = newStatus;
      cacheTimestamp = now;
      setStatus(newStatus);
    } catch (err) {
      console.error("Error fetching API key status:", err);
      setError(err instanceof Error ? err.message : "Failed to check API status");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    status,
    isLoading,
    error,
    refresh: () => fetchStatus(true),
  };
}
