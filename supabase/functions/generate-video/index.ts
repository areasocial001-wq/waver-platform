import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Replicate from "https://esm.sh/replicate@0.25.2";
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// PiAPI is now the only Kling provider (direct API removed)

// PiAPI model configuration
interface PiAPIModelConfig {
  model: string;
  model_name?: string;
  mode?: string;
  task_type_txt2video?: string; // Custom task type for text-to-video
  task_type_img2video?: string; // Custom task type for image-to-video
}

const PIAPI_MODELS: Record<string, PiAPIModelConfig> = {
  // Kling models - use video_generation for text-to-video, img2video for image-to-video
  "kling-2.6": { model: "kling", model_name: "kling-v2-6", mode: "std", task_type_txt2video: "video_generation", task_type_img2video: "img2video" },
  "kling-2.6-motion": { model: "kling", model_name: "kling-v2-6", mode: "std", task_type_txt2video: "video_generation", task_type_img2video: "img2video" },
  "kling-2.5": { model: "kling", model_name: "kling-v2-5", mode: "std", task_type_txt2video: "video_generation", task_type_img2video: "img2video" },
  "kling-2.1": { model: "kling", model_name: "kling-v2-1", mode: "std", task_type_txt2video: "video_generation", task_type_img2video: "img2video" },
  "kling-2.0": { model: "kling", model_name: "kling-v2", mode: "std", task_type_txt2video: "video_generation", task_type_img2video: "img2video" },
  "kling-1.6": { model: "kling", model_name: "kling-v1-6", mode: "std", task_type_txt2video: "video_generation", task_type_img2video: "img2video" },
  // Other video models - these use txt2video/img2video
  "hailuo": { model: "hailuo", task_type_txt2video: "txt2video", task_type_img2video: "img2video" },
  "luma": { model: "luma", task_type_txt2video: "txt2video", task_type_img2video: "img2video" },
  "wan": { model: "wan", task_type_txt2video: "txt2video", task_type_img2video: "img2video" },
  "hunyuan": { model: "hunyuan", task_type_txt2video: "txt2video", task_type_img2video: "img2video" },
  // New models from PIAPI Creator subscription
  "skyreels": { model: "skyreels", task_type_txt2video: "txt2video", task_type_img2video: "img2video" },
  "framepack": { model: "framepack", task_type_txt2video: "txt2video", task_type_img2video: "img2video" },
  // Veo3 uses specific task_types: veo3-video or veo3-video-fast
  "veo3": { model: "veo3", task_type_txt2video: "veo3-video", task_type_img2video: "veo3-video" },
  "sora2": { model: "sora2", task_type_txt2video: "sora2-video", task_type_img2video: "sora2-video" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let body: any;

  try {
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    const PIAPI_API_KEY = Deno.env.get("PIAPI_API_KEY");
    const AIML_API_KEY = Deno.env.get("AIML_API_KEY");
    
    const hasValidGoogleKey = GOOGLE_AI_API_KEY && GOOGLE_AI_API_KEY.trim().length > 0;
    const hasValidPiAPIKey = PIAPI_API_KEY && PIAPI_API_KEY.trim().length > 0;
    const hasValidAIMLKey = AIML_API_KEY && AIML_API_KEY.trim().length > 0;
    
    // At least one provider must be configured
    if (!hasValidGoogleKey && !hasValidPiAPIKey && !hasValidAIMLKey) {
      throw new Error("No video generation API configured. Please set GOOGLE_AI_API_KEY, PIAPI_API_KEY, or AIML_API_KEY");
    }
    
    console.log("API credentials check:", {
      hasGoogleKey: hasValidGoogleKey,
      hasPiAPIKey: hasValidPiAPIKey,
      hasAIMLKey: hasValidAIMLKey
    });

    body = await req.json();
    console.log("Generate video request:", body);

    // Handle health check requests
    if (body.healthCheck) {
      return new Response(
        JSON.stringify({ status: 'ok', service: 'generate-video', hasPiAPIKey: hasValidPiAPIKey }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if it's a polling request
    if (body.operationId) {
      console.log("Polling operation status:", body.operationId);
      
      // AI/ML API polling (format: aiml:model:task_id)
      if (body.operationId.startsWith('aiml:')) {
        if (!hasValidAIMLKey) {
          throw new Error("AIML_API_KEY is not configured");
        }
        
        const parts = body.operationId.split(':');
        const taskId = parts.slice(2).join(':');
        console.log("Polling AI/ML API task:", taskId);
        
        const aimlResponse = await fetch(`https://api.aimlapi.com/v2/video/generations?generation_id=${taskId}`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${AIML_API_KEY}`,
          },
        });

        if (!aimlResponse.ok) {
          const error = await aimlResponse.text();
          throw new Error(`AI/ML API error: ${aimlResponse.status} - ${error}`);
        }

        const aimlData = await aimlResponse.json();
        console.log("AI/ML API task status:", aimlData);
        
        const taskStatus = aimlData.status;
        
        if (taskStatus === "completed" || taskStatus === "succeeded") {
          const videoUrl = aimlData.video_url || aimlData.output?.video_url || aimlData.result?.video_url;
          
          if (!videoUrl) {
            console.error("AI/ML API completed but no video URL found:", aimlData);
            throw new Error("Video completed but URL not found in response");
          }
          
          if (body.generationId) {
            const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
            const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
            const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
            const supabaseClient = createClient(supabaseUrl, supabaseKey);

            await supabaseClient
              .from('video_generations')
              .update({
                status: 'completed',
                video_url: videoUrl,
              })
              .eq('id', body.generationId);
          }

          return new Response(JSON.stringify({ 
            status: "succeeded",
            output: videoUrl 
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        } else if (taskStatus === "failed" || taskStatus === "error") {
          const errorMsg = aimlData.error || aimlData.message || "Unknown error";
          throw new Error(`AI/ML API generation failed: ${errorMsg}`);
        } else {
          // Still processing
          return new Response(JSON.stringify({ 
            status: "processing"
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      }
      
      // PiAPI polling (format: piapi:model:task_id)
      if (body.operationId.startsWith('piapi:')) {
        if (!hasValidPiAPIKey) {
          throw new Error("PIAPI_API_KEY is not configured");
        }
        
        const parts = body.operationId.split(':');
        const taskId = parts.slice(2).join(':'); // Handle task IDs with colons
        console.log("Polling PiAPI task:", taskId);
        
        const piApiResponse = await fetch(`https://api.piapi.ai/api/v1/task/${taskId}`, {
          method: "GET",
          headers: {
            "x-api-key": PIAPI_API_KEY,
          },
        });

        if (!piApiResponse.ok) {
          const error = await piApiResponse.text();
          throw new Error(`PiAPI error: ${piApiResponse.status} - ${error}`);
        }

        const piApiData = await piApiResponse.json();
        console.log("PiAPI task status:", piApiData);
        
        const taskStatus = piApiData.data?.status || piApiData.status;
        
        if (taskStatus === "completed" || taskStatus === "SUCCESS") {
          const videoUrl = piApiData.data?.output?.video_url || 
                          piApiData.data?.output?.video || 
                          piApiData.data?.video_url ||
                          piApiData.output?.video_url;
          
          if (!videoUrl) {
            console.error("PiAPI completed but no video URL found:", piApiData);
            throw new Error("Video completed but URL not found in response");
          }
          
          if (body.generationId) {
            const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
            const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
            const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
            const supabaseClient = createClient(supabaseUrl, supabaseKey);

            await supabaseClient
              .from('video_generations')
              .update({
                status: 'completed',
                video_url: videoUrl,
              })
              .eq('id', body.generationId);
          }

          return new Response(JSON.stringify({ 
            status: "succeeded",
            output: videoUrl 
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        } else if (taskStatus === "failed" || taskStatus === "FAILED" || taskStatus === "error") {
          const errorObj = piApiData.data?.error || piApiData.error;
          const errorMsg = typeof errorObj === 'object' ? (errorObj.message || JSON.stringify(errorObj)) : (errorObj || "Unknown error");
          throw new Error(`PiAPI generation failed: ${errorMsg}`);
        } else {
          // Still processing
          return new Response(JSON.stringify({ 
            status: "processing"
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      }
      
      // Kling direct API removed - use PiAPI instead
      // Freepik polling (format: freepik:model:task_id)
      if (body.operationId.startsWith('freepik:')) {
        const FREEPIK_API_KEY = Deno.env.get("FREEPIK_API_KEY");
        if (!FREEPIK_API_KEY) {
          throw new Error("FREEPIK_API_KEY is not set");
        }
        
        const parts = body.operationId.split(':');
        const modelEndpoint = parts[1];
        const taskId = parts[2];
        console.log("Polling Freepik task:", taskId, "model:", modelEndpoint);
        
        const freepikResponse = await fetch(`https://api.freepik.com/v1/ai/image-to-video/${modelEndpoint}/${taskId}`, {
          headers: {
            "x-freepik-api-key": FREEPIK_API_KEY,
          },
        });

        if (!freepikResponse.ok) {
          const error = await freepikResponse.text();
          throw new Error(`Freepik API error: ${freepikResponse.status} - ${error}`);
        }

        const freepikData = await freepikResponse.json();
        console.log("Freepik task status:", freepikData);
        
        if (freepikData.data?.status === "COMPLETED" && freepikData.data?.video?.url) {
          const videoUrl = freepikData.data.video.url;
          
          if (body.generationId) {
            const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
            const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
            const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
            const supabaseClient = createClient(supabaseUrl, supabaseKey);

            await supabaseClient
              .from('video_generations')
              .update({
                status: 'completed',
                video_url: videoUrl,
              })
              .eq('id', body.generationId);
          }

          return new Response(JSON.stringify({ 
            status: "succeeded",
            output: videoUrl 
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        } else if (freepikData.data?.status === "FAILED") {
          throw new Error(`Freepik generation failed: ${freepikData.data?.error || "Unknown error"}`);
        } else {
          return new Response(JSON.stringify({ 
            status: "processing"
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      }
      
      // Replicate polling
      if (body.operationId.startsWith('replicate:')) {
        const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
        if (!REPLICATE_API_KEY) {
          throw new Error("REPLICATE_API_KEY is not set");
        }
        
        const replicate = new Replicate({ auth: REPLICATE_API_KEY });
        const predictionId = body.operationId.replace('replicate:', '');
        
        console.log("Polling Replicate prediction:", predictionId);
        const prediction = await replicate.predictions.get(predictionId);
        console.log("Replicate prediction status:", prediction);
        
        if (prediction.status === "succeeded") {
          const videoUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
          
          if (body.generationId) {
            const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
            const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
            const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
            const supabaseClient = createClient(supabaseUrl, supabaseKey);

            await supabaseClient
              .from('video_generations')
              .update({
                status: 'completed',
                video_url: videoUrl,
              })
              .eq('id', body.generationId);
          }

          return new Response(JSON.stringify({ 
            status: "succeeded",
            output: videoUrl 
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        } else if (prediction.status === "failed") {
          throw new Error(`Replicate generation failed: ${prediction.error || "Unknown error"}`);
        } else {
          return new Response(JSON.stringify({ 
            status: "processing"
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      }
      
      // Google Veo polling
      if (!hasValidGoogleKey) {
        throw new Error("GOOGLE_AI_API_KEY is required for polling Google Veo operations");
      }
      const pollResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${body.operationId}`,
        {
          method: "GET",
          headers: {
            "x-goog-api-key": GOOGLE_AI_API_KEY!,
            "Content-Type": "application/json",
          },
        }
      );

      if (!pollResponse.ok) {
        const error = await pollResponse.text();
        throw new Error(`Google AI API error: ${pollResponse.status} - ${error}`);
      }

      const operation = await pollResponse.json();
      console.log("Operation status:", operation);

      if (operation.done) {
        if (operation.error) {
          const isOverloaded = operation.error.code === 14 || 
            (operation.error.message && operation.error.message.includes("overloaded"));
          
          if (isOverloaded) {
            return new Response(JSON.stringify({
              status: "failed",
              error: "Il modello AI è temporaneamente sovraccarico. Riprova tra qualche minuto.",
              retryable: true
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            });
          }
          
          return new Response(JSON.stringify({
            status: "failed",
            error: operation.error.message || "Errore sconosciuto durante la generazione",
            retryable: false
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }

        const videoUri = operation.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
        if (!videoUri) {
          throw new Error("No video URI in response");
        }

        console.log("Video ready, downloading from Google:", videoUri);

        const videoResponse = await fetch(videoUri, {
          headers: {
            "x-goog-api-key": GOOGLE_AI_API_KEY!,
          },
        });

        if (!videoResponse.ok) {
          throw new Error(`Failed to download video: ${videoResponse.status}`);
        }

        const videoBlob = await videoResponse.blob();
        console.log("Video downloaded, size:", videoBlob.size, "bytes");

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const proxyUrl = `${supabaseUrl}/functions/v1/video-proxy?uri=${encodeURIComponent(videoUri)}`;
        console.log("Using proxy URL:", proxyUrl);

        if (body.generationId) {
          const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
          const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
          const supabaseClient = createClient(supabaseUrl, supabaseKey);

          await supabaseClient
            .from('video_generations')
            .update({
              status: 'completed',
              video_url: proxyUrl,
            })
            .eq('id', body.generationId);
        }

        return new Response(JSON.stringify({
          status: "succeeded",
          output: proxyUrl,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      } else {
        return new Response(JSON.stringify({ 
          status: "processing"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    // Start new video generation
    const { 
      type, prompt, image_url, image, start_image, end_image, duration, resolution, aspect_ratio, generate_audio, generationId, preferredProvider,
      motion_video, motion_control, character_orientation, keep_original_sound
    } = body;

    if (!type) {
      return new Response(
        JSON.stringify({ error: "Missing required field: type is required" }), 
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    if (type === "text_to_video" && !prompt) {
      return new Response(
        JSON.stringify({ error: "Missing required field: prompt is required for text-to-video" }), 
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    if (type === "image_to_video" && !image && !image_url && !start_image) {
      return new Response(
        JSON.stringify({ error: "Missing required field: start_image is required for image-to-video" }), 
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Helper to extract base64 from data URLs
    const extractBase64 = (data: string): string => {
      if (!data) return "";
      if (data.includes(',')) {
        return data.split(',')[1];
      }
      return data;
    };

    // Helper to upload base64 to storage and get URL (for large images)
    const uploadToStorageAndGetUrl = async (base64Data: string, prefix: string = "temp"): Promise<string> => {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabaseClient = createClient(supabaseUrl, supabaseKey);

      // Extract mime type and raw base64
      let mimeType = 'image/jpeg';
      let rawBase64 = base64Data;
      
      if (base64Data.startsWith('data:')) {
        const mimeMatch = base64Data.match(/^data:(image\/[^;]+);base64,/);
        if (mimeMatch) {
          mimeType = mimeMatch[1];
          rawBase64 = base64Data.split(',')[1];
        }
      }

      // Convert base64 to Uint8Array
      const binaryString = atob(rawBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Generate unique filename
      const ext = mimeType.split('/')[1] || 'jpg';
      const fileName = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
      const filePath = `temp-images/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabaseClient.storage
        .from('generated-videos')
        .upload(filePath, bytes, {
          contentType: mimeType,
          upsert: true
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw new Error(`Failed to upload image: ${uploadError.message}`);
      }

      // Get public URL
      const { data: urlData } = supabaseClient.storage
        .from('generated-videos')
        .getPublicUrl(filePath);

      console.log("Uploaded image to storage:", urlData.publicUrl);
      return urlData.publicUrl;
    };

    // Helper to check if base64 is too large (>2MB)
    const isBase64TooLarge = (base64: string): boolean => {
      const rawBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
      // Base64 increases size by ~33%, so 2MB raw = ~2.66MB base64
      // PiAPI limit seems to be around 10MB total payload, be conservative
      return rawBase64.length > 2_000_000; // ~1.5MB raw image
    };

    // Helper to get image URL for PiAPI (upload if too large)
    const getImageUrlForPiAPI = async (imageData: string, prefix: string = "img"): Promise<{ url?: string; base64?: string }> => {
      if (!imageData) return {};
      
      if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
        // Already a URL
        return { url: imageData };
      }
      
      // Check if base64 is too large
      if (isBase64TooLarge(imageData)) {
        console.log("Image is too large for direct base64, uploading to storage...");
        const url = await uploadToStorageAndGetUrl(imageData, prefix);
        return { url };
      }
      
      // Small enough for direct base64
      return { base64: extractBase64(imageData) };
    };

    // ==================== KLING 2.6 MOTION CONTROL ====================
    if (motion_control && motion_video && hasValidPiAPIKey) {
      console.log("Starting Kling 2.6 Motion Control generation");
      
      const startImageData = start_image || image || image_url;
      
      // Handle large images by uploading to storage
      const startImgData = await getImageUrlForPiAPI(startImageData, "motion-start");
      const motionVideoData = await getImageUrlForPiAPI(motion_video, "motion-video");
      
      // Build motion control payload for PIAPI
      const motionControlPayload: any = {
        model: "kling",
        task_type: "motion_control",
        input: {
          prompt: prompt || "Smooth motion transfer",
          image_url: startImgData.url,
          image: startImgData.base64,
          motion_video_url: motionVideoData.url,
          motion_video: motionVideoData.base64,
          character_orientation: character_orientation || "video",
          keep_original_sound: keep_original_sound !== false,
          model_name: "kling-v2-6",
          mode: "std"
        }
      };
      
      console.log("Motion Control payload:", { 
        hasImage: !!motionControlPayload.input.image || !!motionControlPayload.input.image_url,
        hasMotionVideo: !!motionControlPayload.input.motion_video || !!motionControlPayload.input.motion_video_url,
        orientation: motionControlPayload.input.character_orientation
      });
      
      const piApiResponse = await fetch("https://api.piapi.ai/api/v1/task", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": PIAPI_API_KEY,
        },
        body: JSON.stringify(motionControlPayload),
      });

      if (!piApiResponse.ok) {
        const error = await piApiResponse.text();
        console.error("PiAPI Motion Control error:", error);
        throw new Error(`PiAPI Motion Control error: ${piApiResponse.status} - ${error}`);
      }

      const piApiData = await piApiResponse.json();
      console.log("Motion Control task started:", piApiData);
      
      const taskId = piApiData.data?.task_id || piApiData.task_id;
      if (!taskId) {
        throw new Error("PiAPI did not return a task ID for motion control");
      }

      if (generationId) {
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabaseClient = createClient(supabaseUrl, supabaseKey);

        await supabaseClient
          .from('video_generations')
          .update({
            status: 'processing',
            prediction_id: `piapi:kling-2.6-motion:${taskId}`,
          })
          .eq('id', generationId);
      }

      return new Response(JSON.stringify({ 
        status: "starting",
        operationId: `piapi:kling-2.6-motion:${taskId}`,
        message: "Kling 2.6 Motion Control video generation started"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==================== AI/ML API PROVIDERS ====================
    // Use AI/ML API for aiml-runway, aiml-kling, aiml-veo
    if (preferredProvider?.startsWith('aiml-') && hasValidAIMLKey) {
      const modelKey = preferredProvider.replace('aiml-', '') as 'runway' | 'kling' | 'veo';
      const AIML_VIDEO_MODELS: Record<string, string> = {
        runway: 'runway/gen-3-alpha-turbo',
        kling: 'kling-ai/kling-v1.6-pro',
        veo: 'google/veo-3.1',
      };
      const modelId = AIML_VIDEO_MODELS[modelKey] || AIML_VIDEO_MODELS['kling'];
      
      console.log(`Starting AI/ML API video generation with model: ${modelKey} (${modelId})`);
      
      const startImageData = start_image || image || image_url;
      
      // Build AI/ML API request
      const aimlPayload: Record<string, unknown> = {
        model: modelId,
        prompt: prompt || "Smooth cinematic video",
        duration: duration || 5,
      };
      
      // Add image for image-to-video
      if (type === "image_to_video" && startImageData) {
        // AI/ML API accepts URLs, upload large base64 to storage first
        if (startImageData.startsWith('http://') || startImageData.startsWith('https://')) {
          aimlPayload.image_url = startImageData;
        } else {
          const imgData = await getImageUrlForPiAPI(startImageData, "aiml-img");
          if (imgData.url) {
            aimlPayload.image_url = imgData.url;
          } else {
            // For smaller images, upload anyway to get URL
            const url = await uploadToStorageAndGetUrl(startImageData, "aiml-img");
            aimlPayload.image_url = url;
          }
        }
      }
      
      console.log("Calling AI/ML API for video generation:", { model: modelId, hasImage: !!aimlPayload.image_url });
      
      const aimlResponse = await fetch("https://api.aimlapi.com/v2/video/generations", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${AIML_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(aimlPayload),
      });

      if (!aimlResponse.ok) {
        const error = await aimlResponse.text();
        console.error("AI/ML API error:", error);
        throw new Error(`AI/ML API error: ${aimlResponse.status} - ${error}`);
      }

      const aimlData = await aimlResponse.json();
      console.log("AI/ML API task started:", aimlData);
      
      const taskId = aimlData.id || aimlData.task_id;
      if (!taskId) {
        // If completed immediately
        if (aimlData.video_url) {
          if (generationId) {
            const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
            const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
            const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
            const supabaseClient = createClient(supabaseUrl, supabaseKey);

            await supabaseClient
              .from('video_generations')
              .update({
                status: 'completed',
                video_url: aimlData.video_url,
                provider: `aiml-${modelKey}`
              })
              .eq('id', generationId);
          }
          
          return new Response(JSON.stringify({ 
            status: "succeeded",
            output: aimlData.video_url,
            provider: `aiml-${modelKey}`
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
        throw new Error("AI/ML API did not return a task ID or video URL");
      }

      // Save task ID to database for polling
      if (generationId) {
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabaseClient = createClient(supabaseUrl, supabaseKey);

        await supabaseClient
          .from('video_generations')
          .update({
            status: 'processing',
            prediction_id: `aiml:${modelKey}:${taskId}`,
            provider: `aiml-${modelKey}`
          })
          .eq('id', generationId);
      }

      return new Response(JSON.stringify({ 
        status: "starting",
        operationId: `aiml:${modelKey}:${taskId}`,
        provider: `aiml-${modelKey}`
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // ==================== GOOGLE VEO 3.1 DIRECT ====================
    // Use Google API directly when google-veo is selected
    if (preferredProvider === 'google-veo' && hasValidGoogleKey) {
      console.log("Starting video generation with Google Veo 3.1 (direct API, preferred provider)");
      // Fall through to the main Google Veo 3.1 section below
    }
    // ==================== PiAPI PROVIDERS ====================
    // Use PiAPI for piapi-kling, piapi-hailuo, piapi-luma, piapi-wan, piapi-hunyuan
    else if (preferredProvider?.startsWith('piapi-') && hasValidPiAPIKey) {
      const modelKey = preferredProvider.replace('piapi-', '') as keyof typeof PIAPI_MODELS;
      const modelConfig = PIAPI_MODELS[modelKey] || PIAPI_MODELS["kling-2.1"];
      
      console.log(`Starting PiAPI generation with model: ${modelKey}`, modelConfig);
      
      const startImageData = start_image || image || image_url;
      
      // Build PiAPI request payload
      // Determine task_type - some models like veo3 have custom task types
      let taskType: string;
      if (type === "image_to_video") {
        taskType = modelConfig.task_type_img2video || "img2video";
      } else {
        taskType = modelConfig.task_type_txt2video || "txt2video";
      }
      
      const piApiPayload: any = {
        model: modelConfig.model,
        task_type: taskType,
        input: {
          prompt: prompt || "Smooth cinematic video",
        }
      };
      
      // Add duration and model-specific parameters
      if (modelConfig.model === "veo3") {
        piApiPayload.input.duration = `${duration || 8}s`;
        piApiPayload.input.generate_audio = generate_audio !== false; // Default true
        // Veo3 supports aspect_ratio
        if (aspect_ratio) {
          piApiPayload.input.aspect_ratio = aspect_ratio;
        }
      } else if (modelConfig.model === "sora2") {
        piApiPayload.input.duration = duration || 4;
        // Sora2 supports aspect_ratio and resolution
        if (aspect_ratio) {
          piApiPayload.input.aspect_ratio = aspect_ratio;
        }
        if (resolution) {
          piApiPayload.input.resolution = resolution;
        }
      } else {
        piApiPayload.input.duration = duration || 5;
      }
      
      // Add model-specific parameters
      if (modelConfig.model_name) {
        piApiPayload.input.model_name = modelConfig.model_name;
      }
      if (modelConfig.mode) {
        piApiPayload.input.mode = modelConfig.mode;
      }
      
      // Add images for image-to-video (handle large images by uploading to storage)
      if (type === "image_to_video" && startImageData) {
        const startImgData = await getImageUrlForPiAPI(startImageData, "start");
        if (startImgData.url) {
          piApiPayload.input.image_url = startImgData.url;
        } else if (startImgData.base64) {
          piApiPayload.input.image = startImgData.base64;
        }
        
        // Add end image if provided (for transitions)
        if (end_image) {
          const endImgData = await getImageUrlForPiAPI(end_image, "end");
          if (endImgData.url) {
            piApiPayload.input.tail_image_url = endImgData.url;
          } else if (endImgData.base64) {
            piApiPayload.input.tail_image = endImgData.base64;
          }
        }
      }
      
      console.log("Calling PiAPI for video generation:", { model: modelConfig.model, task_type: piApiPayload.task_type });
      
      const piApiResponse = await fetch("https://api.piapi.ai/api/v1/task", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": PIAPI_API_KEY,
        },
        body: JSON.stringify(piApiPayload),
      });

      if (!piApiResponse.ok) {
        const error = await piApiResponse.text();
        console.error("PiAPI error:", error);
        throw new Error(`PiAPI error: ${piApiResponse.status} - ${error}`);
      }

      const piApiData = await piApiResponse.json();
      console.log("PiAPI task started:", piApiData);
      
      const taskId = piApiData.data?.task_id || piApiData.task_id;
      if (!taskId) {
        throw new Error("PiAPI did not return a task ID");
      }

      // Save task ID to database
      if (generationId) {
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabaseClient = createClient(supabaseUrl, supabaseKey);

        await supabaseClient
          .from('video_generations')
          .update({
            status: 'processing',
            prediction_id: `piapi:${modelKey}:${taskId}`,
          })
          .eq('id', generationId);
      }

      return new Response(JSON.stringify({ 
        status: "starting",
        operationId: `piapi:${modelKey}:${taskId}`,
        provider: `piapi-${modelKey}`
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // ==================== FREEPIK PROVIDER ====================
    else if (preferredProvider === "freepik" && type === "image_to_video" && end_image) {
      const FREEPIK_API_KEY = Deno.env.get("FREEPIK_API_KEY");
      if (!FREEPIK_API_KEY) {
        console.log("Freepik API key not set, falling back to other providers");
      } else {
        console.log("Starting video generation with Freepik (preferred provider)");
        
        const startImageData = start_image || image || image_url;
        
        if (!startImageData) {
          throw new Error("Start image is required for Freepik image-to-video generation");
        }
        
        const startBase64 = extractBase64(startImageData);
        const endBase64 = extractBase64(end_image);
        
        const freepikPayload = {
          image: startBase64,
          end_image: endBase64,
          prompt: prompt || "Smooth cinematic transition between scenes",
        };
        
        console.log("Calling Freepik MiniMax API for image-to-video with start/end frames");
        
        const freepikResponse = await fetch("https://api.freepik.com/v1/ai/image-to-video/minimax", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-freepik-api-key": FREEPIK_API_KEY,
          },
          body: JSON.stringify(freepikPayload),
        });

        if (!freepikResponse.ok) {
          const error = await freepikResponse.text();
          console.error("Freepik API error:", error);
          console.log("Freepik failed, falling back to Kling/Veo");
        } else {
          const freepikData = await freepikResponse.json();
          console.log("Freepik task started:", freepikData);

          if (generationId) {
            const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
            const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
            const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
            const supabaseClient = createClient(supabaseUrl, supabaseKey);

            await supabaseClient
              .from('video_generations')
              .update({
                status: 'processing',
                prediction_id: `freepik:minimax:${freepikData.data.task_id}`,
              })
              .eq('id', generationId);
          }

          return new Response(JSON.stringify({ 
            status: "starting",
            operationId: `freepik:minimax:${freepikData.data.task_id}`,
            provider: "freepik"
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      }
    }

    // ==================== FALLBACK TO PIAPI IF NO GOOGLE KEY ====================
    if (!hasValidGoogleKey && hasValidPiAPIKey) {
      console.log("No Google AI key, using PiAPI as default provider");
      
      const modelConfig = PIAPI_MODELS["kling-2.5"]; // Default to kling-2.5
      const startImageData = start_image || image || image_url;
      
      // For Kling fallback, use correct task types
      const taskType = type === "image_to_video" 
        ? (modelConfig.task_type_img2video || "img2video") 
        : (modelConfig.task_type_txt2video || "video_generation");
      
      const piApiPayload: any = {
        model: modelConfig.model,
        task_type: taskType,
        input: {
          prompt: prompt || "Smooth cinematic video",
          duration: duration || 5,
        }
      };
      
      if (modelConfig.model_name) {
        piApiPayload.input.model_name = modelConfig.model_name;
      }
      if (modelConfig.mode) {
        piApiPayload.input.mode = modelConfig.mode;
      }
      
      // Handle large images by uploading to storage
      if (type === "image_to_video" && startImageData) {
        const startImgData = await getImageUrlForPiAPI(startImageData, "start");
        if (startImgData.url) {
          piApiPayload.input.image_url = startImgData.url;
        } else if (startImgData.base64) {
          piApiPayload.input.image = startImgData.base64;
        }
        
        if (end_image) {
          const endImgData = await getImageUrlForPiAPI(end_image, "end");
          if (endImgData.url) {
            piApiPayload.input.tail_image_url = endImgData.url;
          } else if (endImgData.base64) {
            piApiPayload.input.tail_image = endImgData.base64;
          }
        }
      }
      
      console.log("Calling PiAPI for video generation (fallback):", { model: modelConfig.model, task_type: piApiPayload.task_type });
      
      const piApiResponse = await fetch("https://api.piapi.ai/api/v1/task", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": PIAPI_API_KEY!,
        },
        body: JSON.stringify(piApiPayload),
      });

      if (!piApiResponse.ok) {
        const error = await piApiResponse.text();
        console.error("PiAPI error:", error);
        throw new Error(`PiAPI error: ${piApiResponse.status} - ${error}`);
      }

      const piApiData = await piApiResponse.json();
      console.log("PiAPI task started:", piApiData);
      
      const taskId = piApiData.data?.task_id || piApiData.task_id;
      if (!taskId) {
        throw new Error("PiAPI did not return a task ID");
      }

      if (generationId) {
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabaseClient = createClient(supabaseUrl, supabaseKey);

        await supabaseClient
          .from('video_generations')
          .update({
            status: 'processing',
            prediction_id: `piapi:kling-2.5:${taskId}`,
            provider: 'piapi-kling-2.5'
          })
          .eq('id', generationId);
      }

      return new Response(JSON.stringify({ 
        status: "starting",
        operationId: `piapi:kling-2.5:${taskId}`,
        provider: 'piapi-kling-2.5'
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // ==================== GOOGLE VEO 3.1 (DEFAULT) ====================
    console.log("Starting video generation with Google Veo 3.1");
    console.log("Received duration:", duration, "Type:", typeof duration);

    const parsedDuration = typeof duration === 'string' ? parseInt(duration) : duration;
    let validDuration = 6;
    
    if (parsedDuration <= 5) {
      validDuration = 4;
    } else if (parsedDuration <= 7) {
      validDuration = 6;
    } else {
      validDuration = 8;
    }
    
    console.log("Using validDuration:", validDuration);
    
    const requestBody: any = {
      instances: [{}],
      parameters: {
        durationSeconds: validDuration,
        aspectRatio: "16:9"
      }
    };

    if (prompt) {
      requestBody.instances[0].prompt = prompt;
    }

    if (type === "image_to_video") {
      const startImageData = start_image || image || image_url;
      
      if (startImageData) {
        let base64Data: string;
        let mimeType: string;
        
        if (startImageData.startsWith('data:')) {
          const mimeMatch = startImageData.match(/^data:(image\/[^;]+);base64,/);
          if (mimeMatch) {
            mimeType = mimeMatch[1];
            base64Data = startImageData.split(',')[1];
          } else {
            throw new Error("Invalid image data URL format");
          }
        } else if (startImageData.startsWith('http://') || startImageData.startsWith('https://')) {
          console.log("Downloading image from URL:", startImageData.substring(0, 100));
          const imageResponse = await fetch(startImageData);
          if (!imageResponse.ok) {
            throw new Error(`Failed to download image from URL: ${imageResponse.status}`);
          }
          const imageBlob = await imageResponse.blob();
          const arrayBuffer = await imageBlob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          base64Data = btoa(String.fromCharCode(...uint8Array));
          
          const contentType = imageResponse.headers.get('content-type');
          if (contentType && contentType.startsWith('image/')) {
            mimeType = contentType.split(';')[0];
          } else if (startImageData.toLowerCase().includes('.png')) {
            mimeType = 'image/png';
          } else if (startImageData.toLowerCase().includes('.webp')) {
            mimeType = 'image/webp';
          } else {
            mimeType = 'image/jpeg';
          }
        } else {
          base64Data = startImageData;
          mimeType = 'image/jpeg';
        }
        
        if (!base64Data) {
          throw new Error("Failed to extract base64 data from image");
        }
        
        requestBody.instances[0].image = {
          bytesBase64Encoded: base64Data,
          mimeType: mimeType
        };
        console.log("Added start image for image-to-video generation, mimeType:", mimeType);
      }
    }

    if (type === "text_to_video" && resolution) {
      requestBody.parameters.resolution = resolution;
    }

    console.log("Calling Google AI API for video generation");

    let response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GOOGLE_AI_API_KEY!,
        },
        body: JSON.stringify(requestBody),
      }
    );

    // Fallback to Freepik/Replicate if Google quota exceeded
    if (!response.ok && response.status === 429) {
      console.log("Google quota exceeded, trying PiAPI/Freepik then Replicate");
      
      const FREEPIK_API_KEY = Deno.env.get("FREEPIK_API_KEY");
      const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
      
      // Try PiAPI first if available
      if (hasValidPiAPIKey) {
        try {
          console.log("Attempting PiAPI Kling 2.1 generation as fallback");
          
          const startImageData = start_image || image || image_url;
          
          const piApiPayload: any = {
            model: "kling",
            task_type: type === "image_to_video" ? "img2video" : "txt2video",
            input: {
              prompt: prompt || "A video based on the provided image",
              model_name: "kling-v2-1",
              mode: "std",
              duration: duration || 5,
            }
          };
          
          if (type === "image_to_video" && startImageData) {
            if (startImageData.startsWith('data:')) {
              piApiPayload.input.image = extractBase64(startImageData);
            } else {
              piApiPayload.input.image_url = startImageData;
            }
            
            if (end_image) {
              if (end_image.startsWith('data:')) {
                piApiPayload.input.tail_image = extractBase64(end_image);
              } else {
                piApiPayload.input.tail_image_url = end_image;
              }
            }
          }
          
          const piApiResponse = await fetch("https://api.piapi.ai/api/v1/task", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": PIAPI_API_KEY,
            },
            body: JSON.stringify(piApiPayload),
          });
          
          if (piApiResponse.ok) {
            const piApiData = await piApiResponse.json();
            console.log("PiAPI fallback task started:", piApiData);
            
            const taskId = piApiData.data?.task_id || piApiData.task_id;
            
            if (generationId) {
              const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
              const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
              const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
              const supabaseClient = createClient(supabaseUrl, supabaseKey);
              
              await supabaseClient
                .from('video_generations')
                .update({
                  status: 'processing',
                  prediction_id: `piapi:kling-2.1:${taskId}`,
                })
                .eq('id', generationId);
            }
            
            return new Response(JSON.stringify({ 
              status: "starting",
              operationId: `piapi:kling-2.1:${taskId}`,
              provider: "piapi-kling-2.1"
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            });
          } else {
            console.log("PiAPI fallback failed, trying Freepik");
          }
        } catch (piApiError) {
          console.error("PiAPI fallback error:", piApiError);
        }
      }
      
      // Try Freepik
      if (FREEPIK_API_KEY) {
        try {
          console.log("Attempting Freepik video generation");
          
          const freepikPayload: any = {
            prompt: prompt || "A video based on the provided image",
            prompt_optimizer: true,
            duration: duration && duration >= 8 ? 10 : 6,
          };
          
          if (type === "image_to_video") {
            const startImageData = start_image || image || image_url;
            if (startImageData) {
              freepikPayload.first_frame_image = startImageData;
            }
            if (end_image) {
              freepikPayload.last_frame_image = end_image;
            }
          }
          
          const modelEndpoint = end_image ? "minimax-hailuo-02-768p" : "kling-v2-5-pro";
          
          const freepikResponse = await fetch(`https://api.freepik.com/v1/ai/image-to-video/${modelEndpoint}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-freepik-api-key": FREEPIK_API_KEY,
            },
            body: JSON.stringify(freepikPayload),
          });
          
          if (freepikResponse.ok) {
            const freepikData = await freepikResponse.json();
            console.log("Freepik video task started:", freepikData);
            
            if (generationId) {
              const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
              const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
              const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
              const supabaseClient = createClient(supabaseUrl, supabaseKey);
              
              await supabaseClient
                .from('video_generations')
                .update({
                  status: 'processing',
                  prediction_id: `freepik:${modelEndpoint}:${freepikData.data.task_id}`,
                })
                .eq('id', generationId);
            }
            
            return new Response(JSON.stringify({ 
              status: "starting",
              operationId: `freepik:${modelEndpoint}:${freepikData.data.task_id}`,
              provider: "freepik"
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            });
          } else {
            console.log("Freepik failed, falling back to Replicate");
          }
        } catch (freepikError) {
          console.error("Freepik error, falling back to Replicate:", freepikError);
        }
      }
      
      // Fallback to Replicate
      if (!REPLICATE_API_KEY) {
        const error = await response.text();
        throw new Error(`Google AI API error: ${response.status} - ${error}`);
      }

      const replicate = new Replicate({ auth: REPLICATE_API_KEY });
      
      const replicateInput: any = {
        prompt: prompt || "A video based on the provided image",
      };

      if (type === "image_to_video") {
        const startImageData = start_image || image || image_url;
        if (startImageData) {
          replicateInput.first_frame_image = startImageData;
        }
        if (end_image) {
          console.log("Warning: Replicate fallback may not support end_frame. Using start frame only.");
        }
      }

      console.log("Starting Replicate generation with minimax/video-01");
      const prediction = await replicate.predictions.create({
        model: "minimax/video-01",
        input: replicateInput,
      });

      console.log("Replicate prediction started:", prediction);

      if (generationId) {
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabaseClient = createClient(supabaseUrl, supabaseKey);

        await supabaseClient
          .from('video_generations')
          .update({
            status: 'processing',
            prediction_id: `replicate:${prediction.id}`,
          })
          .eq('id', generationId);
      }

      return new Response(JSON.stringify({ 
        status: "starting",
        operationId: `replicate:${prediction.id}`,
        provider: "replicate"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (!response.ok) {
      const error = await response.text();
      console.error("Google AI API error:", error);
      throw new Error(`Google AI API error: ${response.status} - ${error}`);
    }

    const operation = await response.json();
    console.log("Operation started:", operation);

    if (generationId) {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabaseClient = createClient(supabaseUrl, supabaseKey);

      await supabaseClient
        .from('video_generations')
        .update({
          status: 'processing',
          prediction_id: operation.name,
        })
        .eq('id', generationId);
    }

    return new Response(JSON.stringify({ 
      status: "starting",
      operationId: operation.name,
      provider: "veo"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in generate-video function:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to generate video";
    
    const isRetryable = errorMessage.includes("overloaded") || 
                        errorMessage.includes("rate limit") ||
                        errorMessage.includes("quota") ||
                        errorMessage.includes("temporarily") ||
                        errorMessage.includes("RESOURCE_EXHAUSTED") ||
                        errorMessage.includes("429");
    
    if (body?.generationId) {
      try {
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabaseClient = createClient(supabaseUrl, supabaseKey);

        const { data: currentGen } = await supabaseClient
          .from('video_generations')
          .select('retry_count, max_retries')
          .eq('id', body.generationId)
          .single();

        const retryCount = (currentGen?.retry_count || 0) + 1;
        const maxRetries = currentGen?.max_retries || 3;
        
        if (isRetryable && retryCount <= maxRetries) {
          const backoffSeconds = Math.pow(2, retryCount - 1) * 30;
          const nextRetryAt = new Date(Date.now() + backoffSeconds * 1000).toISOString();
          
          await supabaseClient
            .from('video_generations')
            .update({
              status: 'retry_scheduled',
              error_message: errorMessage,
              retry_count: retryCount,
              next_retry_at: nextRetryAt
            })
            .eq('id', body.generationId);

          return new Response(JSON.stringify({
            error: errorMessage,
            retryable: true,
            nextRetryAt: nextRetryAt,
            retryCount: retryCount
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        } else {
          await supabaseClient
            .from('video_generations')
            .update({
              status: 'failed',
              error_message: errorMessage
            })
            .eq('id', body.generationId);
        }
      } catch (dbError) {
        console.error("Failed to update database with error:", dbError);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        retryable: isRetryable 
      }), 
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
