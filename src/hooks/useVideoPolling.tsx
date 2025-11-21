import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useVideoPolling = (
  generations: any[],
  onUpdate: () => void
) => {
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
            
            onUpdate();
          } else if (data.status === "failed") {
            await supabase
              .from("video_generations")
              .update({
                status: "failed",
                error_message: data.error || "Generation failed"
              })
              .eq("id", gen.id);
            
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
