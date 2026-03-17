import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getModelCapabilities } from "@/lib/modelCapabilities";
import { VideoProviderType } from "@/lib/videoProviderConfig";

interface SplitPlan {
  needed: boolean;
  clipCount: number;
  clipDuration: number;
  totalDuration: number;
}

interface AutoSplitState {
  isSplitting: boolean;
  currentClip: number;
  totalClips: number;
  phase: "generating" | "waiting" | "extracting_frame" | "concatenating" | "done" | "idle";
  clipVideoUrls: string[];
  continuityFrames: string[]; // base64 frames extracted between clips
}

/**
 * Calculates whether auto-split is needed for a given provider + duration
 */
export function calculateSplitPlan(
  provider: VideoProviderType,
  requestedDuration: number
): SplitPlan {
  const caps = getModelCapabilities(provider);
  const maxDuration = Math.max(...caps.durations.map((d) => d.value));

  if (requestedDuration <= maxDuration) {
    return { needed: false, clipCount: 1, clipDuration: requestedDuration, totalDuration: requestedDuration };
  }

  const clipCount = Math.ceil(requestedDuration / maxDuration);
  return {
    needed: true,
    clipCount,
    clipDuration: maxDuration,
    totalDuration: clipCount * maxDuration,
  };
}

/**
 * Hook for auto-split generation: generates N clips sequentially then concatenates
 */
export function useAutoSplitGeneration() {
  const [state, setState] = useState<AutoSplitState>({
    isSplitting: false,
    currentClip: 0,
    totalClips: 0,
    phase: "idle",
    clipVideoUrls: [],
    continuityFrames: [],
  });
  const abortRef = useRef(false);

  const reset = useCallback(() => {
    abortRef.current = false;
    setState({ isSplitting: false, currentClip: 0, totalClips: 0, phase: "idle", clipVideoUrls: [], continuityFrames: [] });
  }, []);

  /**
   * Extract the last frame from a video URL as a base64 data URL.
   * Uses a hidden <video> + <canvas> to seek to the end and capture.
   */
  const extractLastFrame = useCallback(async (videoUrl: string): Promise<string | null> => {
    try {
      // Resolve storage:// URLs to signed URLs
      let resolvedUrl = videoUrl;
      if (videoUrl.startsWith("storage://")) {
        const path = videoUrl.replace("storage://", "");
        const bucketName = path.split("/")[0];
        const filePath = path.substring(bucketName.length + 1);
        const { data } = await supabase.storage.from(bucketName).createSignedUrl(filePath, 600);
        if (data?.signedUrl) resolvedUrl = data.signedUrl;
        else return null;
      }

      return await new Promise<string | null>((resolve) => {
        const video = document.createElement("video");
        video.crossOrigin = "anonymous";
        video.preload = "auto";
        video.muted = true;

        const timeout = setTimeout(() => {
          console.warn("Last frame extraction timed out");
          video.src = "";
          resolve(null);
        }, 30_000);

        video.onloadedmetadata = () => {
          // Seek to near the end (last 0.1s)
          video.currentTime = Math.max(0, video.duration - 0.1);
        };

        video.onseeked = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d");
            if (!ctx) { clearTimeout(timeout); resolve(null); return; }
            ctx.drawImage(video, 0, 0);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
            clearTimeout(timeout);
            video.src = "";
            resolve(dataUrl);
          } catch (e) {
            console.error("Canvas draw error (CORS?):", e);
            clearTimeout(timeout);
            resolve(null);
          }
        };

        video.onerror = () => {
          console.error("Video load error for frame extraction");
          clearTimeout(timeout);
          resolve(null);
        };

        video.src = resolvedUrl;
      });
    } catch (e) {
      console.error("extractLastFrame error:", e);
      return null;
    }
  }, []);

  /**
   * Wait for a generation to complete by polling the database
   */
  const waitForCompletion = useCallback(async (generationId: string, maxWaitMs = 300_000): Promise<string | null> => {
    const start = Date.now();
    const interval = 5_000;

    while (Date.now() - start < maxWaitMs) {
      if (abortRef.current) return null;

      const { data } = await supabase
        .from("video_generations")
        .select("status, video_url")
        .eq("id", generationId)
        .single();

      if (data?.status === "completed" && data?.video_url) {
        return data.video_url;
      }
      if (data?.status === "failed") {
        return null;
      }

      await new Promise((r) => setTimeout(r, interval));
    }
    return null;
  }, []);

  /**
   * Run auto-split generation: creates N clips and concatenates them
   */
  const runSplitGeneration = useCallback(
    async (params: {
      plan: SplitPlan;
      userId: string;
      type: "text_to_video" | "image_to_video";
      prompt: string;
      originalPrompt?: string;
      resolution?: string;
      aspectRatio?: string;
      preferredProvider?: string;
      modelId?: string;
      startImage?: string;
      generateAudio?: boolean;
    }): Promise<{ success: boolean; finalVideoUrl?: string; generationIds: string[] }> => {
      const { plan, userId, type, prompt, originalPrompt, resolution, aspectRatio, preferredProvider, modelId, startImage, generateAudio } = params;
      const generationIds: string[] = [];
      const clipUrls: string[] = [];

      abortRef.current = false;
      setState({
        isSplitting: true,
        currentClip: 0,
        totalClips: plan.clipCount,
        phase: "generating",
        clipVideoUrls: [],
        continuityFrames: [],
      });

      toast.info(`Auto-split attivato: ${plan.clipCount} clip da ${plan.clipDuration}s ciascuna`, {
        description: `Durata totale: ${plan.totalDuration}s`,
        duration: 5000,
      });

      // Track the current frame to use as start_image for continuity
      let nextStartImage: string | null | undefined = startImage || null;

      for (let i = 0; i < plan.clipCount; i++) {
        if (abortRef.current) break;

        setState((s) => ({ ...s, currentClip: i + 1, phase: "generating" }));

        // Create DB entry for this clip
        const clipPrompt = i === 0
          ? prompt
          : `${prompt}. Continue seamlessly from previous scene, maintaining visual consistency and motion flow.`;

        const { data: genData, error: dbError } = await supabase
          .from("video_generations")
          .insert({
            user_id: userId,
            type,
            prompt: clipPrompt,
            original_prompt: originalPrompt || prompt,
            duration: plan.clipDuration,
            resolution: resolution || "720p",
            status: "processing",
            tags: [`auto-split-${i + 1}-of-${plan.clipCount}`],
          })
          .select()
          .single();

        if (dbError || !genData) {
          toast.error(`Errore creazione clip ${i + 1}`);
          reset();
          return { success: false, generationIds };
        }

        generationIds.push(genData.id);

        // Determine clip type: use image_to_video whenever we have a start image
        const hasStartImage = !!nextStartImage;
        const clipType = hasStartImage ? "image_to_video" : "text_to_video";

        const requestBody: any = {
          type: clipType,
          prompt: clipPrompt,
          duration: plan.clipDuration,
          resolution,
          aspect_ratio: aspectRatio,
          generationId: genData.id,
          preferredProvider: preferredProvider !== "auto" ? preferredProvider : undefined,
          modelId,
        };

        if (hasStartImage) {
          requestBody.start_image = nextStartImage;
        }

        // Only generate audio on last clip to avoid duplication
        if (generateAudio !== undefined) {
          requestBody.generate_audio = i === plan.clipCount - 1 ? generateAudio : false;
        }

        // Call edge function
        const { error } = await supabase.functions.invoke("generate-video", {
          body: requestBody,
        });

        if (error) {
          console.error(`Clip ${i + 1} generation error:`, error);
          toast.error(`Errore generazione clip ${i + 1}`, { description: error.message });
          // Clear start image for next clip since this one failed
          nextStartImage = null;
          continue;
        }

        // Wait for this clip to complete before starting next
        setState((s) => ({ ...s, phase: "waiting" }));
        toast.info(`Attesa completamento clip ${i + 1}/${plan.clipCount}...`);

        const videoUrl = await waitForCompletion(genData.id);

        if (!videoUrl) {
          toast.error(`Clip ${i + 1} non completata, skip...`);
          nextStartImage = null;
          continue;
        }

        clipUrls.push(videoUrl);
        setState((s) => ({ ...s, clipVideoUrls: [...clipUrls] }));
        toast.success(`Clip ${i + 1}/${plan.clipCount} completata!`);

        // Extract last frame for visual continuity in next clip
        if (i < plan.clipCount - 1) {
          toast.info(`Estrazione ultimo frame per continuità visiva...`);
          const lastFrame = await extractLastFrame(videoUrl);
          if (lastFrame) {
            nextStartImage = lastFrame;
            console.log(`Last frame extracted from clip ${i + 1} for continuity`);
          } else {
            console.warn(`Could not extract last frame from clip ${i + 1}, next clip will use text_to_video`);
            nextStartImage = null;
          }
        }
      }

      // If we have less than 2 clips, no concat needed
      if (clipUrls.length < 2) {
        reset();
        return {
          success: clipUrls.length > 0,
          finalVideoUrl: clipUrls[0],
          generationIds,
        };
      }

      // Concatenate clips
      setState((s) => ({ ...s, phase: "concatenating" }));
      toast.info("Concatenazione clip in corso...", { duration: 10000 });

      try {
        // Resolve storage:// URLs to public URLs
        const resolvedUrls = await Promise.all(
          clipUrls.map(async (url) => {
            if (url.startsWith("storage://")) {
              const path = url.replace("storage://", "");
              const { data } = supabase.storage.from("generated-videos").getPublicUrl(path);
              return data.publicUrl;
            }
            return url;
          })
        );

        const { data: concatData, error: concatError } = await supabase.functions.invoke("video-concat", {
          body: {
            videoUrls: resolvedUrls,
            clipDurations: Array(resolvedUrls.length).fill(plan.clipDuration),
            transition: "crossfade",
            transitionDuration: 0.3,
            resolution: resolution === "1080p" ? "fhd" : resolution === "720p" ? "hd" : "sd",
            aspectRatio: aspectRatio || "16:9",
          },
        });

        if (concatError) {
          console.error("Concat error:", concatError);
          toast.error("Errore concatenazione", { description: concatError.message });
          reset();
          return { success: true, finalVideoUrl: clipUrls[0], generationIds };
        }

        const finalUrl = concatData?.videoUrl || concatData?.url;

        if (finalUrl) {
          // Create a final "merged" generation entry
          const { data: mergedGen } = await supabase
            .from("video_generations")
            .insert({
              user_id: userId,
              type,
              prompt: `[Auto-split ${plan.clipCount}x${plan.clipDuration}s] ${prompt}`,
              original_prompt: originalPrompt || prompt,
              duration: plan.totalDuration,
              resolution: resolution || "720p",
              status: "completed",
              video_url: finalUrl,
              tags: ["auto-split-merged"],
            })
            .select()
            .single();

          if (mergedGen) generationIds.push(mergedGen.id);

          setState((s) => ({ ...s, phase: "done" }));
          toast.success(`Video ${plan.totalDuration}s creato!`, {
            description: `${plan.clipCount} clip concatenate con successo`,
          });

          reset();
          return { success: true, finalVideoUrl: finalUrl, generationIds };
        }
      } catch (err) {
        console.error("Concat failed:", err);
        toast.error("Concatenazione fallita");
      }

      reset();
      return { success: clipUrls.length > 0, finalVideoUrl: clipUrls[0], generationIds };
    },
    [waitForCompletion, reset]
  );

  return {
    state,
    calculateSplitPlan,
    runSplitGeneration,
    abort: useCallback(() => { abortRef.current = true; }, []),
    reset,
  };
}
