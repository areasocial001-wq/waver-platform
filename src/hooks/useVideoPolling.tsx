import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePushNotifications } from "./usePushNotifications";
import { apiLogger } from "@/lib/apiLogger";

interface VideoGeneration {
  id: string;
  status: string;
  prediction_id?: string;
  video_url?: string;
  prompt?: string;
  retry_count?: number;
  max_retries?: number;
  next_retry_at?: string;
  queue_position?: number;
  priority?: number;
}

// Helper: check if video is already stored in our bucket
const isStoredVideo = (url: string) => url.startsWith("storage://");

// Track videos already being stored or permanently failed to prevent duplicate calls
const storingVideos = new Set<string>();

// Helper: trigger store-video edge function in background (deduplicated)
const storeVideoInBucket = async (generationId: string, videoUrl: string) => {
  if (storingVideos.has(generationId)) return;
  storingVideos.add(generationId);

  try {
    console.log(`Auto-storing video ${generationId}...`);
    const { data, error } = await supabase.functions.invoke("store-video", {
      body: { generationId, videoUrl },
    });
    if (error) {
      console.error("Failed to store video:", error);
      storingVideos.delete(generationId);
      return;
    }
    if (data?.status === "stored") {
      console.log(`Video ${generationId} stored successfully`);
    } else if (data?.status === "source_not_found") {
      console.warn(`Video ${generationId} source gone (404/410), won't retry`);
    } else if (data?.status === "source_temporarily_unavailable") {
      setTimeout(() => storingVideos.delete(generationId), 60000);
    } else {
      storingVideos.delete(generationId);
    }
  } catch (err) {
    console.error("Error calling store-video:", err);
    storingVideos.delete(generationId);
  }
};

export const useVideoPolling = (
  generations: VideoGeneration[],
  onUpdate: () => void
) => {
  // Track which videos we've already notified about
  const notifiedVideos = useRef<Set<string>>(new Set());
  const { isEnabled: pushEnabled, showNotification } = usePushNotifications();
  // Track videos with broken links
  const brokenLinkVideos = useRef<Set<string>>(new Set());
  // Track retry timers
  const retryTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Check if URL is a Google VEO API URL that needs proxying
  const isGoogleVeoUrl = useCallback((url: string) => {
    return url.includes("generativelanguage.googleapis.com") || 
           url.includes("storage.googleapis.com/veo-");
  }, []);

  const repairVideoLink = useCallback(async (videoId: string, currentUrl: string) => {
    try {
      // Only use video-proxy for Google VEO URLs
      if (!isGoogleVeoUrl(currentUrl)) {
        console.log("Skipping video-proxy for non-Google URL:", currentUrl);
        toast.info("URL non riparabile", {
          description: "Questo URL non supporta il proxy automatico"
        });
        return false;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const proxyUrl = `${supabaseUrl}/functions/v1/video-proxy?uri=${encodeURIComponent(currentUrl)}`;
      
      const { error } = await supabase
        .from("video_generations")
        .update({ video_url: proxyUrl })
        .eq("id", videoId);

      if (!error) {
        toast.success("Link video riparato automaticamente");
        onUpdate();
        return true;
      }
    } catch (error) {
      console.error("Error repairing link:", error);
    }
    return false;
  }, [onUpdate, isGoogleVeoUrl]);

  // Check if a video URL is broken (returns 404)
  const checkVideoUrl = useCallback(async (videoId: string, videoUrl: string) => {
    // Skip if already checked or already a proxy URL
    if (brokenLinkVideos.current.has(videoId)) return;
    if (videoUrl.includes("/functions/v1/video-proxy")) return;
    
    // Skip checking for PiAPI/Storage URLs - they don't need proxying and might have CORS issues
    if (videoUrl.includes("piapi.ai") || 
        videoUrl.includes("cdn.piapi.ai") ||
        videoUrl.includes("supabase.co/storage")) {
      return; // These URLs are managed externally and don't need repair
    }

    try {
      const response = await fetch(videoUrl, { method: "HEAD" });
      if (!response.ok) {
        brokenLinkVideos.current.add(videoId);
        
        // Only offer repair for Google VEO URLs
        if (isGoogleVeoUrl(videoUrl)) {
          toast.error("Video non raggiungibile", {
            description: "Il link del video non è più valido",
            duration: 10000,
            action: {
              label: "Ripara",
              onClick: () => repairVideoLink(videoId, videoUrl),
            },
          });
        } else {
          toast.error("Video non raggiungibile", {
            description: "Il link del video non è più valido (non riparabile)",
            duration: 5000,
          });
        }
      }
    } catch (error) {
      // Network error - likely CORS or unreachable
      // Don't mark as broken for CORS errors on external URLs
      console.log("Video URL check failed (might be CORS):", videoUrl);
    }
  }, [repairVideoLink, isGoogleVeoUrl]);

  useEffect(() => {
    // Check completed videos for broken links + auto-store unstored ones
    const completedVideos = generations.filter(
      (g) => g.status === "completed" && g.video_url
    );

    completedVideos.forEach((video) => {
      // Auto-store videos not yet in our bucket
      if (video.video_url && !isStoredVideo(video.video_url) && !video.video_url.includes("/storage/")) {
        storeVideoInBucket(video.id, video.video_url);
      }
      checkVideoUrl(video.id, video.video_url);
    });
  }, [generations, checkVideoUrl]);

  // Handle pending generations with scheduled retries
  const retryPendingGeneration = useCallback(async (gen: VideoGeneration) => {
    if (!gen.next_retry_at) return;
    
    const retryTime = new Date(gen.next_retry_at).getTime();
    const now = Date.now();
    
    if (retryTime <= now) {
      // Time to retry
      console.log(`Retrying generation ${gen.id}, attempt ${(gen.retry_count || 0) + 1}`);
      
      try {
        await supabase
          .from("video_generations")
          .update({ status: "processing", next_retry_at: null })
          .eq("id", gen.id);
        
        toast.info("Nuovo tentativo in corso...", {
          description: `Tentativo ${gen.retry_count || 1}/${gen.max_retries || 3}`,
        });
        
        onUpdate();
      } catch (error) {
        console.error("Error retrying generation:", error);
      }
    } else {
      // Schedule retry
      const delay = retryTime - now;
      
      if (!retryTimers.current.has(gen.id)) {
        const timer = setTimeout(() => {
          retryTimers.current.delete(gen.id);
          retryPendingGeneration(gen);
        }, Math.min(delay, 60000)); // Check at least every minute
        
        retryTimers.current.set(gen.id, timer);
      }
    }
  }, [onUpdate]);

  // Check generations with scheduled retry
  useEffect(() => {
    const pendingWithRetry = generations.filter(
      (g) => (g.status === "pending" || g.status === "retry_scheduled") && g.next_retry_at
    );
    
    pendingWithRetry.forEach(retryPendingGeneration);
    
    return () => {
      retryTimers.current.forEach((timer) => clearTimeout(timer));
      retryTimers.current.clear();
    };
  }, [generations, retryPendingGeneration]);

  useEffect(() => {
    const processingGenerations = generations.filter(
      (g) => g.status === "processing" && g.prediction_id
    );

    if (processingGenerations.length === 0) return;

    const checkStatus = async () => {
      for (const gen of processingGenerations) {
        try {
          const { data, error } = await supabase.functions.invoke("generate-video", {
            body: { operationId: gen.prediction_id, generationId: gen.id }
          });

          if (error) {
            console.error("Error checking status:", error);
            continue;
          }

          if (data.status === "succeeded") {
            const videoUrl = Array.isArray(data.output) ? data.output[0] : data.output;
            
            await supabase
              .from("video_generations")
              .update({
                status: "completed",
                video_url: videoUrl,
                retry_count: 0,
                next_retry_at: null
              })
              .eq("id", gen.id);
            
            // Auto-store video in internal bucket (fire-and-forget)
            if (videoUrl && !isStoredVideo(videoUrl)) {
              storeVideoInBucket(gen.id, videoUrl);
            }
            
            // Log success
            await apiLogger.success("Replicate", "Video Generation", `Video completato: ${gen.prompt?.slice(0, 50)}...`, {
              videoId: gen.id,
              predictionId: gen.prediction_id
            });
            
            // Show toast notification if we haven't already
            if (!notifiedVideos.current.has(gen.id)) {
              notifiedVideos.current.add(gen.id);
              const promptPreview = gen.prompt?.slice(0, 50) || "Video";
              
              // In-app toast
              toast.success("Video completato!", {
                description: `${promptPreview}${gen.prompt?.length > 50 ? "..." : ""}`,
                duration: 5000,
              });
              
              // Push notification (works even if page is in background)
              if (pushEnabled && document.hidden) {
                showNotification(
                  "Video Completato! 🎬",
                  `${promptPreview}${gen.prompt?.length > 50 ? "..." : ""}`,
                  { videoId: gen.id }
                );
              }
            }
            
            onUpdate();
          } else if (data.status === "retry_scheduled") {
            // Retry was scheduled, show info toast
            if (!notifiedVideos.current.has(`retry_${gen.id}_${data.retryCount}`)) {
              notifiedVideos.current.add(`retry_${gen.id}_${data.retryCount}`);
              toast.info("Retry automatico programmato", {
                description: `Tentativo ${data.retryCount}/${data.maxRetries} tra poco...`,
                duration: 5000,
              });
            }
            onUpdate();
          } else if (data.status === "failed") {
            await supabase
              .from("video_generations")
              .update({
                status: "failed",
                error_message: data.error || "Generation failed"
              })
              .eq("id", gen.id);
            
            // Log error
            await apiLogger.error("Replicate", "Video Generation", data.error || "Generation failed", {
              videoId: gen.id,
              predictionId: gen.prediction_id,
              retryable: data.retryable
            });
            
            // Show error toast with retry option if applicable
            if (!notifiedVideos.current.has(gen.id)) {
              notifiedVideos.current.add(gen.id);
              
              // Push notification for failures
              if (pushEnabled && document.hidden) {
                showNotification(
                  "Generazione Fallita ❌",
                  data.error || "Si è verificato un errore",
                  { videoId: gen.id }
                );
              }
              
              if (data.retryable) {
                toast.error("Modello AI sovraccarico", {
                  description: data.error || "Riprova tra qualche minuto",
                  duration: 10000,
                  action: {
                    label: "Riprova",
                    onClick: () => {
                      notifiedVideos.current.delete(gen.id);
                      window.location.reload();
                    },
                  },
                });
              } else {
                toast.error("Generazione fallita", {
                  description: data.error || "Si è verificato un errore",
                  duration: 5000,
                });
              }
            }
            
            onUpdate();
          }
        } catch (error) {
          console.error("Error in polling:", error);
        }
      }
    };

    const interval = setInterval(checkStatus, 10000);
    checkStatus();

    return () => clearInterval(interval);
  }, [generations, onUpdate, pushEnabled, showNotification]);
};
