import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches a video URL with auth headers and returns a blob URL for playback.
 * Needed because <video src> can't send Authorization headers.
 */
export function useAuthVideo(videoUrl: string | undefined, isActive: boolean) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const prevUrl = useRef<string | undefined>();

  useEffect(() => {
    if (!isActive || !videoUrl) {
      setBlobUrl(null);
      setIsLoading(false);
      return;
    }
    if (videoUrl === prevUrl.current) return;
    prevUrl.current = videoUrl;

    let cancelled = false;
    setIsLoading(true);
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const res = await fetch(videoUrl, {
          headers: token ? {
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          } : {},
        });
        if (!res.ok) throw new Error(`Video fetch failed: ${res.status}`);
        const blob = await res.blob();
        if (!cancelled) {
          setBlobUrl(prev => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(blob);
          });
        }
      } catch (err) {
        console.error("useAuthVideo error:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [videoUrl, isActive]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, []);

  return { blobUrl, isLoading };
}
