import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useVideoPolling = (
  generations: any[],
  onUpdate: () => void
) => {
  // Track which videos we've already notified about
  const notifiedVideos = useRef<Set<string>>(new Set());
  // Track videos with broken links
  const brokenLinkVideos = useRef<Set<string>>(new Set());

  const repairVideoLink = useCallback(async (videoId: string, currentUrl: string) => {
    try {
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
  }, [onUpdate]);

  // Check if a video URL is broken (returns 404)
  const checkVideoUrl = useCallback(async (videoId: string, videoUrl: string) => {
    // Skip if already checked or already a proxy URL
    if (brokenLinkVideos.current.has(videoId)) return;
    if (videoUrl.includes("/functions/v1/video-proxy")) return;

    try {
      const response = await fetch(videoUrl, { method: "HEAD" });
      if (!response.ok) {
        brokenLinkVideos.current.add(videoId);
        
        toast.error("Video non raggiungibile", {
          description: "Il link del video non è più valido",
          duration: 10000,
          action: {
            label: "Ripara",
            onClick: () => repairVideoLink(videoId, videoUrl),
          },
        });
      }
    } catch (error) {
      // Network error - likely CORS or unreachable
      brokenLinkVideos.current.add(videoId);
      
      toast.error("Video non raggiungibile", {
        description: "Impossibile accedere al video",
        duration: 10000,
        action: {
          label: "Ripara",
          onClick: () => repairVideoLink(videoId, videoUrl),
        },
      });
    }
  }, [repairVideoLink]);

  useEffect(() => {
    // Check completed videos for broken links
    const completedVideos = generations.filter(
      (g) => g.status === "completed" && g.video_url
    );

    completedVideos.forEach((video) => {
      checkVideoUrl(video.id, video.video_url);
    });
  }, [generations, checkVideoUrl]);

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
                video_url: videoUrl
              })
              .eq("id", gen.id);
            
            // Show toast notification if we haven't already
            if (!notifiedVideos.current.has(gen.id)) {
              notifiedVideos.current.add(gen.id);
              const promptPreview = gen.prompt?.slice(0, 50) || "Video";
              toast.success("Video completato!", {
                description: `${promptPreview}${gen.prompt?.length > 50 ? "..." : ""}`,
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
            
            // Show error toast
            if (!notifiedVideos.current.has(gen.id)) {
              notifiedVideos.current.add(gen.id);
              toast.error("Generazione fallita", {
                description: data.error || "Si è verificato un errore",
                duration: 5000,
              });
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
  }, [generations, onUpdate]);
};
