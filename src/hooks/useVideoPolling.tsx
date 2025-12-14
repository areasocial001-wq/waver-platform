import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useVideoPolling = (
  generations: any[],
  onUpdate: () => void
) => {
  // Track which videos we've already notified about
  const notifiedVideos = useRef<Set<string>>(new Set());

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
