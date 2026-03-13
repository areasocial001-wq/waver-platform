import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Replicate from "https://esm.sh/replicate@0.25.2";
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Normalize structured prompts (e.g. JSON from prompt assistant)
function normalizePrompt(rawPrompt: unknown): string {
  if (typeof rawPrompt !== "string") return "Smooth cinematic video";
  const trimmedPrompt = rawPrompt.trim();
  if (!trimmedPrompt) return "Smooth cinematic video";
  if (trimmedPrompt.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmedPrompt);
      if (typeof parsed?.generated_prompt === "string" && parsed.generated_prompt.trim()) return parsed.generated_prompt.trim();
      if (typeof parsed?.prompt === "string" && parsed.prompt.trim()) return parsed.prompt.trim();
    } catch { /* not JSON */ }
  }
  const jsonStartIdx = trimmedPrompt.indexOf('{');
  if (jsonStartIdx > 0) {
    const jsonCandidate = trimmedPrompt.substring(jsonStartIdx);
    try {
      const parsed = JSON.parse(jsonCandidate);
      if (typeof parsed?.generated_prompt === "string" && parsed.generated_prompt.trim()) {
        const prefix = trimmedPrompt.substring(0, jsonStartIdx).replace(/,\s*$/, '').trim();
        const extracted = parsed.generated_prompt.trim();
        return prefix ? `${prefix}, ${extracted}` : extracted;
      }
    } catch { /* not embedded JSON */ }
  }
  return trimmedPrompt;
}

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
  "hunyuan": { model: "Qubico/hunyuan", task_type_txt2video: "txt2video", task_type_img2video: "img2video-concat" },
  // New models from PIAPI Creator subscription
  "skyreels": { model: "Qubico/skyreels", task_type_txt2video: "txt2video", task_type_img2video: "img2video" },
  "framepack": { model: "Qubico/framepack", task_type_txt2video: "txt2video", task_type_img2video: "img2video" },
  // Veo3 uses specific task_types: veo3-video or veo3-video-fast
  "veo3": { model: "veo3", task_type_txt2video: "veo3-video", task_type_img2video: "veo3-video" },
  "sora2": { model: "sora2", task_type_txt2video: "sora2-video", task_type_img2video: "sora2-video" },
};

// Server-side model duration constraints (fallback safety layer)
// Maps model patterns to valid duration values
const MODEL_DURATION_CONSTRAINTS: Record<string, number[]> = {
  // Runway
  'runway': [5, 10],
  'gen-3': [5, 10],
  'gen-4': [5, 10],
  // Kling
  'kling': [5, 10],
  // Luma Ray 1.6 only supports 5s
  'luma/ray-1-6': [5],
  'luma/ray-1.6': [5],
  // Luma Ray 2 supports 5, 10
  'luma/ray-2': [5, 10],
  'luma/ray-flash-2': [5],
  // Sora
  'sora': [5, 10, 15, 20],
  // MiniMax/Hailuo (fixed 6s)
  'minimax': [6],
  'hailuo': [6],
  // PixVerse
  'pixverse': [5, 10],
  // Veo
  'veo': [4, 6, 8],
  // Seedance
  'seedance': [5, 10],
  'bytedance/seedance': [5, 10],
  // WAN
  'wan': [4, 8],
  'alibaba/wan': [4, 8],
  // Kandinsky
  'kandinsky': [5, 10],
  // VEED Fabric
  'veed': [5, 10],
  'fabric': [5, 10],
  // Krea
  'krea': [4, 8],
  // OmniHuman
  'omnihuman': [5, 10],
  // Default fallback
  'hunyuan': [5],
  'qubico/hunyuan': [5],
  // LTX Video
  'ltx-2-3-fast': [6, 8, 10, 12, 14, 16, 18, 20],
  'ltx-2-3-pro': [6, 8, 10],
  'ltx-2-fast': [6, 8, 10],
  'ltx-2-pro': [6, 8, 10],
  'ltx': [6, 8, 10],
  'default': [5, 10],
};

// Get valid durations for a model ID
function getValidDurations(modelId: string): number[] {
  const lowerModelId = modelId.toLowerCase();
  for (const [pattern, durations] of Object.entries(MODEL_DURATION_CONSTRAINTS)) {
    if (pattern !== 'default' && lowerModelId.includes(pattern.toLowerCase())) {
      return durations;
    }
  }
  return MODEL_DURATION_CONSTRAINTS['default'];
}

// Sanitize duration to nearest valid value
function sanitizeDuration(modelId: string, requestedDuration: number): number {
  const validDurations = getValidDurations(modelId);
  
  // If already valid, return as-is
  if (validDurations.includes(requestedDuration)) {
    return requestedDuration;
  }
  
  // Find closest valid duration
  let closest = validDurations[0];
  let minDiff = Math.abs(requestedDuration - closest);
  
  for (const duration of validDurations) {
    const diff = Math.abs(requestedDuration - duration);
    if (diff < minDiff) {
      minDiff = diff;
      closest = duration;
    }
  }
  
  console.log(`[Duration Sanitizer] Adjusted duration from ${requestedDuration}s to ${closest}s for model ${modelId}`);
  return closest;
}

// Content policy violation detection and user-friendly error formatting
interface ContentPolicyError {
  isContentPolicy: boolean;
  userMessage: string;
  technicalDetails?: string;
}

function parseContentPolicyError(errorMessage: string): ContentPolicyError {
  const lowerError = errorMessage.toLowerCase();
  
  // Check for content policy violations
  const contentPolicyIndicators = [
    'content_policy_violation',
    'content policy',
    'content checker',
    'flagged',
    'inappropriate',
    'safety filter',
    'moderation',
    'prohibited content',
    'violates our policies',
    'not allowed',
    'blocked by content filter',
    'nsfw',
    'adult content',
    'violence',
    'harmful content'
  ];
  
  const isContentPolicy = contentPolicyIndicators.some(indicator => 
    lowerError.includes(indicator)
  );
  
  if (isContentPolicy) {
    // Try to extract specific details from the error
    let category = 'content guidelines';
    
    if (lowerError.includes('violence') || lowerError.includes('destruction') || lowerError.includes('harm')) {
      category = 'violence or destruction';
    } else if (lowerError.includes('adult') || lowerError.includes('nsfw') || lowerError.includes('sexual')) {
      category = 'adult content';
    } else if (lowerError.includes('hate') || lowerError.includes('discriminat')) {
      category = 'hate speech or discrimination';
    } else if (lowerError.includes('illegal') || lowerError.includes('weapon')) {
      category = 'illegal activities or weapons';
    }
    
    return {
      isContentPolicy: true,
      userMessage: `Your prompt was flagged by the content safety filter for potential ${category}. Please modify your prompt to avoid violent, destructive, or otherwise sensitive content and try again.`,
      technicalDetails: errorMessage
    };
  }
  
  return {
    isContentPolicy: false,
    userMessage: errorMessage
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let body: any;

  try {
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    const PIAPI_API_KEY = Deno.env.get("PIAPI_API_KEY");
    const AIML_API_KEY = Deno.env.get("AIML_API_KEY");
    const VIDU_API_KEY = Deno.env.get("VIDU_API_KEY");
    
    const hasValidGoogleKey = GOOGLE_AI_API_KEY && GOOGLE_AI_API_KEY.trim().length > 0;
    const hasValidPiAPIKey = PIAPI_API_KEY && PIAPI_API_KEY.trim().length > 0;
    const hasValidAIMLKey = AIML_API_KEY && AIML_API_KEY.trim().length > 0;
    const hasValidViduKey = VIDU_API_KEY && VIDU_API_KEY.trim().length > 0;
    const hasValidLtxKey = !!Deno.env.get('LTX_API_KEY')?.trim();
    
    // At least one provider must be configured
    if (!hasValidGoogleKey && !hasValidPiAPIKey && !hasValidAIMLKey && !hasValidViduKey && !hasValidLtxKey) {
      throw new Error("No video generation API configured. Please set GOOGLE_AI_API_KEY, PIAPI_API_KEY, AIML_API_KEY, VIDU_API_KEY, or LTX_API_KEY");
    }
    
    console.log("API credentials check:", {
      hasGoogleKey: hasValidGoogleKey,
      hasPiAPIKey: hasValidPiAPIKey,
      hasAIMLKey: hasValidAIMLKey,
      hasViduKey: hasValidViduKey,
    });

    body = await req.json();
    console.log("Generate video request:", body);

    // Handle health check requests
    if (body.healthCheck) {
      return new Response(
        JSON.stringify({ 
          status: 'ok', 
          service: 'generate-video', 
          hasGoogleKey: hasValidGoogleKey,
          hasPiAPIKey: hasValidPiAPIKey,
          hasAIMLKey: hasValidAIMLKey,
          hasFreepikKey: !!Deno.env.get("FREEPIK_API_KEY")?.trim()
        }),
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
        const modelKey = parts[1];
        const taskId = parts.slice(2).join(':');
        
        console.log(`[AI/ML API POLL] ========================================`);
        console.log(`[AI/ML API POLL] Task ID: ${taskId}`);
        console.log(`[AI/ML API POLL] Model Key: ${modelKey}`);
        console.log(`[AI/ML API POLL] Endpoint: https://api.aimlapi.com/v2/video/generations?generation_id=${taskId}`);
        console.log(`[AI/ML API POLL] ========================================`);
        
        const aimlResponse = await fetch(`https://api.aimlapi.com/v2/video/generations?generation_id=${taskId}`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${AIML_API_KEY}`,
          },
        });

        if (!aimlResponse.ok) {
          const error = await aimlResponse.text();
          console.error(`[AI/ML API POLL] Error response: ${aimlResponse.status} - ${error}`);
          throw new Error(`AI/ML API error: ${aimlResponse.status} - ${error}`);
        }

        const aimlData = await aimlResponse.json();
        console.log(`[AI/ML API POLL] Response:`, JSON.stringify(aimlData, null, 2));
        
        const taskStatus = aimlData.status;
        
        if (taskStatus === "completed" || taskStatus === "succeeded") {
          // Check all possible video URL locations in the response
          const videoUrl = aimlData.video_url || 
                          aimlData.video?.url || 
                          aimlData.output?.video_url || 
                          aimlData.result?.video_url ||
                          aimlData.output?.url ||
                          aimlData.result?.url;
          
          if (!videoUrl) {
            console.error("AI/ML API completed but no video URL found:", aimlData);
            throw new Error("Video completed but URL not found in response");
          }
          
          console.log(`[AI/ML API POLL] Video URL found: ${videoUrl}`);
          
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
          // Properly serialize error object to string
          let errorMsg = "Unknown error";
          if (aimlData.error) {
            if (typeof aimlData.error === 'object') {
              errorMsg = JSON.stringify(aimlData.error);
            } else {
              errorMsg = String(aimlData.error);
            }
          } else if (aimlData.message) {
            errorMsg = String(aimlData.message);
          }
          console.error(`[AI/ML API POLL] Generation failed:`, errorMsg);
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
      
      // Vidu polling (format: vidu:model:task_id)
      if (body.operationId.startsWith('vidu:')) {
        if (!hasValidViduKey) {
          throw new Error("VIDU_API_KEY is not configured");
        }
        
        const parts = body.operationId.split(':');
        const taskId = parts.slice(2).join(':');
        console.log("[Vidu] Polling task:", taskId);
        
        const viduResponse = await fetch(`https://api.vidu.com/ent/v2/tasks/${taskId}/creations`, {
          method: "GET",
          headers: {
            "Authorization": `Token ${VIDU_API_KEY}`,
            "Content-Type": "application/json",
          },
        });

        if (!viduResponse.ok) {
          const error = await viduResponse.text();
          throw new Error(`Vidu API error: ${viduResponse.status} - ${error}`);
        }

        const viduData = await viduResponse.json();
        console.log("[Vidu] Poll result:", viduData);
        
        const taskStatus = viduData.state;
        
        if (taskStatus === "success") {
          const videoUrl = viduData.creations?.[0]?.url;
          
          if (!videoUrl) {
            console.error("Vidu completed but no video URL found:", viduData);
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
        } else if (taskStatus === "failed") {
          throw new Error(`Vidu generation failed: ${viduData.err_code || "Unknown error"}`);
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
    // NOTE: third-party providers may not be able to access our public storage URLs depending on bucket/policies.
    // In those cases we can return a signed URL instead.
    const uploadToStorageAndGetUrl = async (
      base64Data: string,
      prefix: string = "temp",
      opts: { signed?: boolean; signedExpiresInSec?: number } = {}
    ): Promise<string> => {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabaseClient = createClient(supabaseUrl, supabaseKey);

      // Extract mime type and raw base64
      let mimeType = 'image/jpeg';
      let rawBase64 = base64Data;

      if (base64Data.startsWith('data:')) {
        const mimeMatch = base64Data.match(/^data:([^;]+);base64,/);
        if (mimeMatch) {
          mimeType = mimeMatch[1];
          rawBase64 = base64Data.split(',')[1];
        }
      }

      // Convert base64 to Uint8Array using chunked approach to avoid stack overflow
      const binaryString = atob(rawBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Generate unique filename
      const extMap: Record<string, string> = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov', 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' };
      const ext = extMap[mimeType] || mimeType.split('/')[1] || 'bin';
      const isVideo = mimeType.startsWith('video/');
      const fileName = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
      const filePath = isVideo ? `temp-videos/${fileName}` : `temp-images/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabaseClient.storage
        .from('generated-videos')
        .upload(filePath, bytes, {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw new Error(`Failed to upload image: ${uploadError.message}`);
      }

      // Signed URL (preferred for external providers)
      if (opts.signed) {
        const expiresIn = opts.signedExpiresInSec ?? 60 * 60; // 1h
        const { data: signedData, error: signedErr } = await supabaseClient.storage
          .from('generated-videos')
          .createSignedUrl(filePath, expiresIn);

        if (signedErr) {
          console.warn("createSignedUrl failed, falling back to public URL:", signedErr);
        } else if (signedData?.signedUrl) {
          console.log("Uploaded image to storage (signed URL):", signedData.signedUrl);
          return signedData.signedUrl;
        }
      }

      // Public URL
      const { data: urlData } = supabaseClient.storage
        .from('generated-videos')
        .getPublicUrl(filePath);

      console.log("Uploaded image to storage (public URL):", urlData.publicUrl);
      return urlData.publicUrl;
    };

    // If a provider can't fetch our public storage URL, try converting it to a signed URL.
    const tryConvertPublicStorageUrlToSigned = async (
      url: string,
      opts: { expiresInSec?: number } = {}
    ): Promise<string | null> => {
      try {
        const marker = '/storage/v1/object/public/generated-videos/';
        const idx = url.indexOf(marker);
        if (idx === -1) return null;

        let objectPath = url.substring(idx + marker.length);
        if (!objectPath) return null;
        // Strip query string if present
        if (objectPath.includes('?')) {
          objectPath = objectPath.split('?')[0];
        }

        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabaseClient = createClient(supabaseUrl, supabaseKey);

        const expiresIn = opts.expiresInSec ?? 60 * 60; // 1h
        const { data, error } = await supabaseClient.storage
          .from('generated-videos')
          .createSignedUrl(objectPath, expiresIn);

        if (error) {
          console.warn('Failed to create signed URL from public URL:', error);
          return null;
        }

        if (data?.signedUrl) {
          console.log('[AI/ML API] Created signed URL for storage object:', objectPath);
        }
        return data?.signedUrl ?? null;
      } catch (e) {
        console.warn('tryConvertPublicStorageUrlToSigned error:', e);
        return null;
      }
    };

    // Pre-check URL accessibility before sending to external APIs
    const checkUrlAccessibility = async (url: string, label: string = 'URL'): Promise<{ accessible: boolean; error?: string }> => {
      try {
        console.log(`[URL Check] Verifying accessibility of ${label}: ${url.substring(0, 100)}...`);
        
        const response = await fetch(url, {
          method: 'HEAD',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; VideoGenerator/1.0)',
          },
        });
        
        if (!response.ok) {
          console.warn(`[URL Check] ${label} returned status ${response.status}`);
          return { 
            accessible: false, 
            error: `URL returned status ${response.status}: ${response.statusText}` 
          };
        }
        
        console.log(`[URL Check] ${label} is accessible (status ${response.status})`);
        return { accessible: true };
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.warn(`[URL Check] ${label} accessibility check failed:`, errorMsg);
        return { 
          accessible: false, 
          error: `Failed to verify URL: ${errorMsg}` 
        };
      }
    };

    // Validate and fix URL before sending to AI/ML API
    const ensureAccessibleUrl = async (
      url: string, 
      label: string = 'image'
    ): Promise<string> => {
      // First check if the URL is accessible
      const check = await checkUrlAccessibility(url, label);
      
      if (check.accessible) {
        return url;
      }
      
      console.log(`[URL Fix] ${label} URL not accessible, attempting to fix...`);
      
      // If it's a public storage URL, try to convert to signed
      if (url.includes('/object/public/')) {
        const signedUrl = await tryConvertPublicStorageUrlToSigned(url, { expiresInSec: 60 * 60 });
        if (signedUrl) {
          // Verify the signed URL is accessible
          const signedCheck = await checkUrlAccessibility(signedUrl, `signed ${label}`);
          if (signedCheck.accessible) {
            console.log(`[URL Fix] Successfully converted to accessible signed URL`);
            return signedUrl;
          }
        }
      }
      
      // If it's already a signed URL that's not accessible, it might be expired
      if (url.includes('/object/sign/') || url.includes('token=')) {
        // Try to extract the object path and create a fresh signed URL
        const signMarker = '/storage/v1/object/sign/generated-videos/';
        const signIdx = url.indexOf(signMarker);
        if (signIdx !== -1) {
          let objectPath = url.substring(signIdx + signMarker.length);
          // Strip query string
          if (objectPath.includes('?')) {
            objectPath = objectPath.split('?')[0];
          }
          
          const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
          const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
          const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
          const supabaseClient = createClient(supabaseUrl, supabaseKey);
          
          const { data, error } = await supabaseClient.storage
            .from('generated-videos')
            .createSignedUrl(objectPath, 60 * 60);
          
          if (!error && data?.signedUrl) {
            const freshCheck = await checkUrlAccessibility(data.signedUrl, `fresh signed ${label}`);
            if (freshCheck.accessible) {
              console.log(`[URL Fix] Created fresh signed URL for expired token`);
              return data.signedUrl;
            }
          }
        }
      }
      
      // Return original URL with warning - let the API handle the error
      console.warn(`[URL Fix] Could not fix ${label} URL, proceeding with original`);
      return url;
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

    // ==================== LTX VIDEO PROVIDERS ====================
    if (preferredProvider?.startsWith('ltx-')) {
      const LTX_API_KEY = Deno.env.get('LTX_API_KEY');
      if (!LTX_API_KEY) {
        throw new Error("LTX_API_KEY is not configured");
      }

      const ltxModel = preferredProvider; // ltx-2-3-fast, ltx-2-3-pro, ltx-2-fast, ltx-2-pro
      const isI2V = type === "image_to_video";
      const startImageData = start_image || image || image_url;
      const normalizedLtxPrompt = normalizePrompt(prompt);

      // Map resolution to LTX format
      const ltxResolutionMap: Record<string, Record<string, string>> = {
        '16:9': { '1080p': '1920x1080', '1440p': '2560x1440', '4k': '3840x2160' },
        '9:16': { '1080p': '1080x1920', '1440p': '1440x2560', '4k': '2160x3840' },
      };
      const ar = aspect_ratio || '16:9';
      const ltxResolution = ltxResolutionMap[ar]?.[resolution || '1080p'] || '1920x1080';

      // Map camera movements to LTX format
      const ltxCameraMotion = body.camera_motion && body.camera_motion !== 'none' ? body.camera_motion : undefined;

      console.log(`[LTX] Starting generation: model=${ltxModel}, type=${type}, duration=${duration}, resolution=${ltxResolution}`);

      const ltxHeaders = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LTX_API_KEY}`,
      };

      let ltxEndpoint: string;
      let ltxPayload: any;

      if (isI2V && startImageData) {
        ltxEndpoint = 'https://api.ltx.video/v1/image-to-video';

        // Need URL for LTX - upload base64 if needed
        let imageUri = startImageData;
        if (startImageData.startsWith('data:') || !startImageData.startsWith('http')) {
          imageUri = await uploadToStorageAndGetUrl(startImageData, "ltx-img", { signed: true, signedExpiresInSec: 3600 });
        }

        ltxPayload = {
          image_uri: imageUri,
          prompt: normalizedLtxPrompt || '',
          model: ltxModel,
          duration: sanitizeDuration(ltxModel, duration || 8),
          resolution: ltxResolution,
          generate_audio: generate_audio !== false,
        };

        // End frame support (LTX 2.3 models only)
        if (end_image && ltxModel.includes('2-3')) {
          let lastFrameUri = end_image;
          if (end_image.startsWith('data:') || !end_image.startsWith('http')) {
            lastFrameUri = await uploadToStorageAndGetUrl(end_image, "ltx-end", { signed: true, signedExpiresInSec: 3600 });
          }
          ltxPayload.last_frame_uri = lastFrameUri;
        }

        if (ltxCameraMotion) ltxPayload.camera_motion = ltxCameraMotion;
      } else {
        ltxEndpoint = 'https://api.ltx.video/v1/text-to-video';
        ltxPayload = {
          prompt: normalizedLtxPrompt,
          model: ltxModel,
          duration: sanitizeDuration(ltxModel, duration || 8),
          resolution: ltxResolution,
          generate_audio: generate_audio !== false,
        };
        if (ltxCameraMotion) ltxPayload.camera_motion = ltxCameraMotion;
      }

      console.log(`[LTX] Payload:`, JSON.stringify(ltxPayload));

      const ltxResponse = await fetch(ltxEndpoint, {
        method: "POST",
        headers: ltxHeaders,
        body: JSON.stringify(ltxPayload),
      });

      if (!ltxResponse.ok) {
        const error = await ltxResponse.text();
        console.error(`[LTX] Error: ${ltxResponse.status} - ${error}`);
        throw new Error(`LTX error: ${ltxResponse.status} - ${error}`);
      }

      // LTX returns video directly as MP4 binary - no polling needed!
      const videoBuffer = await ltxResponse.arrayBuffer();
      const requestId = ltxResponse.headers.get('x-request-id') || Date.now().toString();
      console.log(`[LTX] Video received: ${videoBuffer.byteLength} bytes, request-id: ${requestId}`);

      // Upload to Supabase storage
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabaseClient = createClient(supabaseUrl, supabaseKey);

      const fileName = `ltx-video/${isI2V ? 'i2v' : 't2v'}_${Date.now()}_${requestId}.mp4`;
      const { error: uploadError } = await supabaseClient.storage
        .from('generated-videos')
        .upload(fileName, new Uint8Array(videoBuffer), {
          contentType: 'video/mp4',
          upsert: true,
        });

      if (uploadError) {
        console.error('[LTX] Storage upload error:', uploadError);
        throw new Error(`Failed to store LTX video: ${uploadError.message}`);
      }

      // Get signed URL
      const { data: signedData } = await supabaseClient.storage
        .from('generated-videos')
        .createSignedUrl(fileName, 7200);

      const videoUrl = signedData?.signedUrl || supabaseClient.storage.from('generated-videos').getPublicUrl(fileName).data.publicUrl;

      // Update generation record as completed immediately
      if (generationId) {
        await supabaseClient
          .from('video_generations')
          .update({
            status: 'completed',
            video_url: `storage://${fileName}`,
          })
          .eq('id', generationId);
      }

      return new Response(JSON.stringify({
        status: "succeeded",
        output: videoUrl,
        provider: "ltx",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==================== VIDU PROVIDERS ====================
    if (preferredProvider?.startsWith('vidu-') && hasValidViduKey) {
      const viduModelKey = preferredProvider.replace('vidu-', '');
      // Extract model name: q3-turbo-t2v -> viduq3-turbo, q2-i2v -> viduq2
      const modelMatch = viduModelKey.match(/^(q\d+)(?:-(turbo|pro))?/);
      let viduModel = modelMatch 
        ? `vidu${modelMatch[1]}${modelMatch[2] ? '-' + modelMatch[2] : ''}`
        : 'viduq3-pro';
      
      const isI2V = type === "image_to_video";
      const startImageData = start_image || image || image_url;
      
      // Vidu img2video only supports viduq3-pro and viduq3-turbo (not viduq2 or viduq1)
      const VIDU_I2V_SUPPORTED_MODELS = ['viduq3-pro', 'viduq3-turbo'];
      if (isI2V && !VIDU_I2V_SUPPORTED_MODELS.includes(viduModel)) {
        console.log(`[Vidu] Model ${viduModel} doesn't support img2video, falling back to viduq3-pro`);
        viduModel = 'viduq3-pro';
      }
      
      // Normalize prompt to extract plain text from JSON blobs
      const normalizedViduPrompt = normalizePrompt(prompt);
      
      console.log(`[Vidu] Starting generation: model=${viduModel}, type=${type}, duration=${duration}`);
      
      const viduHeaders = {
        "Content-Type": "application/json",
        "Authorization": `Token ${VIDU_API_KEY}`,
      };
      
      let viduEndpoint: string;
      let viduPayload: any;
      
      if (isI2V && startImageData) {
        viduEndpoint = 'https://api.vidu.com/ent/v2/img2video';
        
        // Need URL for Vidu - upload base64 if needed
        let imageUrl = startImageData;
        if (startImageData.startsWith('data:') || !startImageData.startsWith('http')) {
          imageUrl = await uploadToStorageAndGetUrl(startImageData, "vidu-img", { signed: true, signedExpiresInSec: 3600 });
        }
        
        viduPayload = {
          model: viduModel,
          images: [imageUrl],
          duration: sanitizeDuration(viduModel, duration || 5),
          resolution: resolution || '720p',
        };
        if (normalizedViduPrompt) viduPayload.prompt = normalizedViduPrompt;
        if (viduModel.startsWith('viduq3')) viduPayload.audio = true;
      } else {
        viduEndpoint = 'https://api.vidu.com/ent/v2/text2video';
        viduPayload = {
          model: viduModel,
          prompt: normalizedViduPrompt,
          duration: sanitizeDuration(viduModel, duration || 5),
          aspect_ratio: aspect_ratio || '16:9',
          resolution: resolution || '720p',
        };
        if (viduModel.startsWith('viduq3')) viduPayload.audio = true;
      }
      
      console.log(`[Vidu] Payload:`, JSON.stringify(viduPayload));
      
      const viduResponse = await fetch(viduEndpoint, {
        method: "POST",
        headers: viduHeaders,
        body: JSON.stringify(viduPayload),
      });

      if (!viduResponse.ok) {
        const error = await viduResponse.text();
        console.error(`[Vidu] Error: ${viduResponse.status} - ${error}`);
        throw new Error(`Vidu error: ${viduResponse.status} - ${error}`);
      }

      const viduData = await viduResponse.json();
      console.log(`[Vidu] Response:`, JSON.stringify(viduData));
      
      const viduTaskId = viduData.task_id;
      if (!viduTaskId) {
        throw new Error("Vidu did not return a task_id");
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
            prediction_id: `vidu:${viduModel}:${viduTaskId}`,
          })
          .eq('id', generationId);
      }

      return new Response(JSON.stringify({ 
        status: "starting",
        operationId: `vidu:${viduModel}:${viduTaskId}`,
        message: `Vidu ${viduModel} video generation started`
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==================== AI/ML API PROVIDERS ====================
    // Use AI/ML API for all aiml-* providers with dynamic model IDs
    if (preferredProvider?.startsWith('aiml-') && hasValidAIMLKey) {
      // AI/ML API Model ID mapping - verified from official documentation
      // https://docs.aimlapi.com/api-references/video-models
      const AIML_MODEL_IDS: Record<string, { t2v: string; i2v: string }> = {
        // Runway models
        'runway-gen3-turbo': { t2v: 'gen3a_turbo', i2v: 'gen3a_turbo' },
        'runway-gen4-turbo': { t2v: 'runway/gen4_turbo', i2v: 'runway/gen4_turbo' },
        'runway-gen4-aleph': { t2v: 'runway/gen4_aleph', i2v: 'runway/gen4_aleph' },
        'runway-act-two': { t2v: 'runway/act_two', i2v: 'runway/act_two' },
        // Kling v1
        'kling-v1-std': { t2v: 'kling-video/v1/standard/text-to-video', i2v: 'kling-video/v1/standard/image-to-video' },
        'kling-v1-pro': { t2v: 'kling-video/v1/pro/text-to-video', i2v: 'kling-video/v1/pro/image-to-video' },
        // Kling v1.6
        'kling-v1.6-std': { t2v: 'kling-video/v1.6/standard/text-to-video', i2v: 'kling-video/v1.6/standard/image-to-video' },
        'kling-v1.6-pro': { t2v: 'kling-video/v1.6/pro/text-to-video', i2v: 'kling-video/v1.6/pro/image-to-video' },
        'kling-v1.6-pro-effects': { t2v: 'klingai/kling-video-v1.6-pro-effects', i2v: 'klingai/kling-video-v1.6-pro-effects' },
        'kling-v1.6-multi-i2v': { t2v: 'kling-video/v1.6/standard/multi-image-to-video', i2v: 'kling-video/v1.6/standard/multi-image-to-video' },
        // Kling v2
        'kling-v2-master': { t2v: 'klingai/v2-master-text-to-video', i2v: 'klingai/v2-master-image-to-video' },
        'kling-v2.1-std': { t2v: 'kling-video/v2.1/standard/text-to-video', i2v: 'kling-video/v2.1/standard/image-to-video' },
        'kling-v2.1-pro': { t2v: 'kling-video/v2.1/pro/text-to-video', i2v: 'kling-video/v2.1/pro/image-to-video' },
        'kling-v2.1-master': { t2v: 'klingai/v2.1-master-text-to-video', i2v: 'klingai/v2.1-master-image-to-video' },
        'kling-v2.5-turbo-pro': { t2v: 'klingai/v2.5-turbo/pro/text-to-video', i2v: 'klingai/v2.5-turbo/pro/image-to-video' },
        'kling-v2.6-pro': { t2v: 'klingai/video-v2-6-pro-text-to-video', i2v: 'klingai/video-v2-6-pro-image-to-video' },
        'kling-o1': { t2v: 'klingai/video-o1-image-to-video', i2v: 'klingai/video-o1-image-to-video' },
        // Luma Ray
        // Note: official model id uses hyphen (ray-1-6), not dot.
        'luma-ray-1.6': { t2v: 'luma/ray-1-6', i2v: 'luma/ray-1-6' },
        'luma-ray-2': { t2v: 'luma/ray-2', i2v: 'luma/ray-2' },
        'luma-ray-flash-2': { t2v: 'luma/ray-flash-2', i2v: 'luma/ray-flash-2' },
        // Sora (OpenAI)
        'sora-2-t2v': { t2v: 'sora-2-t2v', i2v: 'sora-2-t2v' },
        'sora-2-i2v': { t2v: 'sora-2-i2v', i2v: 'sora-2-i2v' },
        'sora-2-pro-t2v': { t2v: 'sora-2-pro-t2v', i2v: 'sora-2-pro-t2v' },
        'sora-2-pro-i2v': { t2v: 'sora-2-pro-i2v', i2v: 'sora-2-pro-i2v' },
        // MiniMax
        'minimax-video-01': { t2v: 'video-01', i2v: 'video-01' },
        'minimax-hailuo-02': { t2v: 'minimax/hailuo-02', i2v: 'minimax/hailuo-02' },
        'minimax-hailuo-2.3': { t2v: 'minimax/hailuo-2.3', i2v: 'minimax/hailuo-2.3' },
        'minimax-hailuo-2.3-fast': { t2v: 'minimax/hailuo-2.3-fast', i2v: 'minimax/hailuo-2.3-fast' },
        // PixVerse
        'pixverse-v5-t2v': { t2v: 'pixverse/v5/text-to-video', i2v: 'pixverse/v5/text-to-video' },
        'pixverse-v5-i2v': { t2v: 'pixverse/v5/image-to-video', i2v: 'pixverse/v5/image-to-video' },
        'pixverse-v5-transition': { t2v: 'pixverse/v5/transition', i2v: 'pixverse/v5/transition' },
        'pixverse-v5.5-t2v': { t2v: 'pixverse/v5-5-text-to-video', i2v: 'pixverse/v5-5-text-to-video' },
        'pixverse-v5.5-i2v': { t2v: 'pixverse/v5-5-image-to-video', i2v: 'pixverse/v5-5-image-to-video' },
        // Google Veo
        'veo2-t2v': { t2v: 'veo2', i2v: 'veo2' },
        'veo2-i2v': { t2v: 'veo2/image-to-video', i2v: 'veo2/image-to-video' },
        'veo3': { t2v: 'google/veo3', i2v: 'google/veo3' },
        'veo3-i2v': { t2v: 'google/veo-3.0-i2v', i2v: 'google/veo-3.0-i2v' },
        'veo3-fast': { t2v: 'google/veo-3.0-fast', i2v: 'google/veo-3.0-fast' },
        'veo3-i2v-fast': { t2v: 'google/veo-3.0-i2v-fast', i2v: 'google/veo-3.0-i2v-fast' },
        'veo3.1-t2v': { t2v: 'google/veo-3.1-t2v', i2v: 'google/veo-3.1-t2v' },
        'veo3.1-i2v': { t2v: 'google/veo-3.1-i2v', i2v: 'google/veo-3.1-i2v' },
        'veo3.1-t2v-fast': { t2v: 'google/veo-3.1-t2v-fast', i2v: 'google/veo-3.1-t2v-fast' },
        'veo3.1-i2v-fast': { t2v: 'google/veo-3.1-i2v-fast', i2v: 'google/veo-3.1-i2v-fast' },
        'veo3.1-ref-to-video': { t2v: 'google/veo-3.1-reference-to-video', i2v: 'google/veo-3.1-reference-to-video' },
        'veo3.1-first-last-i2v': { t2v: 'google/veo-3.1-first-last-image-to-video', i2v: 'google/veo-3.1-first-last-image-to-video' },
        // Alibaba Wan
        'wan-2.1-t2v': { t2v: 'alibaba/wan-2.1-t2v', i2v: 'alibaba/wan-2.1-t2v' },
        'wan-2.1-i2v': { t2v: 'alibaba/wan-2.1-i2v', i2v: 'alibaba/wan-2.1-i2v' },
        'wan-2.5-t2v': { t2v: 'alibaba/wan-2.5-t2v', i2v: 'alibaba/wan-2.5-t2v' },
        'wan-2.6-t2v': { t2v: 'alibaba/wan-2.6-t2v', i2v: 'alibaba/wan-2.6-t2v' },
        'wan-2.6-i2v': { t2v: 'alibaba/wan-2.6-i2v', i2v: 'alibaba/wan-2.6-i2v' },
        'wan-2.6-r2v': { t2v: 'alibaba/wan-2-6-r2v', i2v: 'alibaba/wan-2-6-r2v' },
        // ByteDance Seedance
        'seedance-lite-t2v': { t2v: 'bytedance/seedance-1-0-lite-t2v', i2v: 'bytedance/seedance-1-0-lite-t2v' },
        'seedance-lite-i2v': { t2v: 'bytedance/seedance-1-0-lite-i2v', i2v: 'bytedance/seedance-1-0-lite-i2v' },
        'seedance-pro-t2v': { t2v: 'bytedance/seedance-1-0-pro-t2v', i2v: 'bytedance/seedance-1-0-pro-t2v' },
        'seedance-pro-i2v': { t2v: 'bytedance/seedance-1-0-pro-i2v', i2v: 'bytedance/seedance-1-0-pro-i2v' },
        'omnihuman': { t2v: 'bytedance/omnihuman', i2v: 'bytedance/omnihuman' },
        'omnihuman-1.5': { t2v: 'bytedance/omnihuman/v1.5', i2v: 'bytedance/omnihuman/v1.5' },
        // Krea
        'krea-wan-14b-t2v': { t2v: 'krea/krea-wan-14b/text-to-video', i2v: 'krea/krea-wan-14b/text-to-video' },
        'krea-wan-14b-v2v': { t2v: 'krea/krea-wan-14b/video-to-video', i2v: 'krea/krea-wan-14b/video-to-video' },
        // Kandinsky
        'kandinsky5-t2v': { t2v: 'sber-ai/kandinsky5-t2v', i2v: 'sber-ai/kandinsky5-t2v' },
        'kandinsky5-distill-t2v': { t2v: 'sber-ai/kandinsky5-distill-t2v', i2v: 'sber-ai/kandinsky5-distill-t2v' },
        // VEED Fabric
        'veed-fabric-1.0': { t2v: 'veed/fabric-1.0', i2v: 'veed/fabric-1.0' },
        'veed-fabric-1.0-fast': { t2v: 'veed/fabric-1.0-fast', i2v: 'veed/fabric-1.0-fast' },
      };
      
      // Extract model key from provider (e.g., "aiml-kling-v2.6-pro" -> "kling-v2.6-pro")
      const modelKey = preferredProvider.replace('aiml-', '');
      const isI2V = type === "image_to_video";
      const modelConfig = AIML_MODEL_IDS[modelKey];
      
      // IMPORTANT: prefer provider+mode mapping over raw modelId from request body.
      // Some UI configs store a T2V modelId placeholder; using it during I2V makes the API ignore the image.
      const requestedModelId = typeof body.modelId === 'string' ? body.modelId : undefined;
      let modelId = modelConfig
        ? (isI2V ? modelConfig.i2v : modelConfig.t2v)
        : requestedModelId;

      if (requestedModelId && modelId && requestedModelId !== modelId) {
        console.warn(
          `[AI/ML API] Ignoring request modelId "${requestedModelId}" and using "${modelId}" for ${isI2V ? 'image-to-video' : 'text-to-video'} mode`
        );
      }

      // Normalize a few known IDs (docs use hyphens, some UI values may still use dots)
      if (modelId === 'luma/ray-1.6') {
        modelId = 'luma/ray-1-6';
      }

      if (!modelId) {
        // Fallback to default
        modelId = isI2V ? 'kling-video/v1.6/pro/image-to-video' : 'kling-video/v1.6/pro/text-to-video';
        console.warn(`[AI/ML API] Unknown model key "${modelKey}", using fallback: ${modelId}`);
      }

      // Some AIML models are image/video conditioned and will 400 on pure text payloads.
      // Guard against invalid text-to-video requests (e.g. runway/gen4_turbo requires image_url).
      const modelsRequiringImageInput = new Set<string>([
        'gen3a_turbo',
        'runway/gen-3-alpha-turbo',
        'runway/gen4_turbo',
        'runway/gen4_aleph',
        'runway/act_two',
      ]);
      const hasAnyInputImage = Boolean(start_image || image || image_url);
      if (type === 'text_to_video' && modelsRequiringImageInput.has(modelId) && !hasAnyInputImage) {
        console.warn(
          `[AI/ML API] Model ${modelId} requires image input for generation. Falling back to kling-video/v1.6/pro/text-to-video.`
        );
        modelId = 'kling-video/v1.6/pro/text-to-video';
      }
      
      console.log(`[AI/ML API] ========================================`);
      console.log(`[AI/ML API] Starting video generation`);
      console.log(`[AI/ML API] Provider: ${preferredProvider}`);
      console.log(`[AI/ML API] Model Key: ${modelKey}`);
      console.log(`[AI/ML API] Model ID: ${modelId}`);
      console.log(`[AI/ML API] Type: ${type}`);
      console.log(`[AI/ML API] Duration: ${duration || 5}s`);
      console.log(`[AI/ML API] ========================================`);
      
      const startImageData = start_image || image || image_url;

      const getAimlImageUrl = async (img: string, label: string = 'image'): Promise<string> => {
        // AI/ML API expects a URL. If we receive base64, upload it and use a signed URL.
        if (img.startsWith('http://') || img.startsWith('https://')) {
          // If it's our storage URL, ALWAYS prefer a signed URL (some providers can't fetch the public endpoint).
          const signed = await tryConvertPublicStorageUrlToSigned(img, { expiresInSec: 60 * 60 });
          const urlToUse = signed || img;
          
          // Pre-check URL accessibility before sending to AI/ML API
          const accessibleUrl = await ensureAccessibleUrl(urlToUse, label);
          return accessibleUrl;
        }

        const uploadedUrl = await uploadToStorageAndGetUrl(img, "aiml-img", {
          signed: true,
          signedExpiresInSec: 60 * 60,
        });
        
        // Verify the uploaded URL is accessible
        return await ensureAccessibleUrl(uploadedUrl, label);
      };

      const isLumaRay = typeof modelId === 'string' && modelId.startsWith('luma/');
      const isPixVerseTransition = modelId === 'pixverse/v5/transition';
      const isRunwayActTwo = modelId === 'runway/act_two';
      // Veo first-last model uses image_url and last_image_url (per API docs)
      const isVeoFirstLast = modelId === 'google/veo-3.1-first-last-image-to-video';
      // Veo 3.1 reference-to-video uses image_urls as an ARRAY (per API docs)
      const isVeoRefToVideo = modelId === 'google/veo-3.1-reference-to-video';
      
      // Ensure Veo first-last uses the correct model ID (must NOT have -fast suffix)
      if (modelId === 'google/veo-3.1-first-last-image-to-video-fast') {
        console.log('[AI/ML API] Correcting model ID: removing -fast suffix');
        modelId = 'google/veo-3.1-first-last-image-to-video';
      }

      // ==================== RUNWAY ACT TWO (special payload) ====================
      // Act Two is a performance-transfer model: it requires a character (image/video)
      // and a reference performance video. It does NOT use prompt/duration/image_url.
      if (isRunwayActTwo) {
        const characterImageData = start_image || image || image_url;
        const referenceVideoData = body.reference_video || body.motion_video;
        
        if (!characterImageData) {
          throw new Error("Runway Act Two requires a character image. Please upload an image of the character.");
        }
        if (!referenceVideoData) {
          throw new Error("Runway Act Two requires a reference performance video. Please provide a video reference for motion/expression transfer.");
        }
        
        const characterUrl = await getAimlImageUrl(characterImageData, 'act-two-character');
        
        // Reference video: upload if base64, ensure accessible if URL
        let referenceUrl = referenceVideoData;
        if (!referenceVideoData.startsWith('http')) {
          referenceUrl = await uploadToStorageAndGetUrl(referenceVideoData, "act-two-ref", { signed: true, signedExpiresInSec: 3600 });
        } else {
          referenceUrl = await ensureAccessibleUrl(referenceVideoData, 'reference-video');
        }

        const actTwoPayload: Record<string, unknown> = {
          model: 'runway/act_two',
          character: { type: 'image', url: characterUrl },
          reference: { type: 'video', url: referenceUrl },
        };
        
        if (body.body_control !== undefined) actTwoPayload.body_control = body.body_control;
        if (body.expression_intensity) actTwoPayload.expression_intensity = body.expression_intensity;
        if (body.frame_size) actTwoPayload.frame_size = body.frame_size;

        console.log(`[AI/ML API] Runway Act Two payload:`, JSON.stringify(actTwoPayload, null, 2));

        const aimlResponse = await fetch("https://api.aimlapi.com/v2/video/generations", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${AIML_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(actTwoPayload),
        });

        const responseText = await aimlResponse.text();
        console.log(`[AI/ML API] Act Two response status: ${aimlResponse.status}`);
        console.log(`[AI/ML API] Act Two response body: ${responseText}`);

        if (!aimlResponse.ok) {
          throw new Error(`AI/ML API error: ${aimlResponse.status} - ${responseText}`);
        }

        let aimlData;
        try { aimlData = JSON.parse(responseText); } catch { throw new Error(`AI/ML API returned invalid JSON: ${responseText}`); }

        const taskId = aimlData.id || aimlData.task_id;
        if (!taskId) {
          if (aimlData.video?.url) {
            if (generationId) {
              const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
              const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
              const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
              const supabaseClient = createClient(supabaseUrl, supabaseKey);
              await supabaseClient.from('video_generations').update({ status: 'completed', video_url: aimlData.video.url, provider: 'aiml-runway-act-two' }).eq('id', generationId);
            }
            return new Response(JSON.stringify({ status: "succeeded", output: aimlData.video.url, provider: 'aiml-runway-act-two' }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          throw new Error("AI/ML API did not return a task ID or video URL for Act Two");
        }

        if (generationId) {
          const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
          const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
          const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
          const supabaseClient = createClient(supabaseUrl, supabaseKey);
          await supabaseClient.from('video_generations').update({ status: 'processing', prediction_id: `aiml:runway-act-two:${taskId}`, provider: 'aiml-runway-act-two' }).eq('id', generationId);
        }

        return new Response(JSON.stringify({ status: "starting", operationId: `aiml:runway-act-two:${taskId}`, provider: 'aiml-runway-act-two', message: "Runway Act Two generation started" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Sanitize duration for this model (server-side validation)
      const sanitizedDuration = sanitizeDuration(modelId, duration || 5);

      // Build AI/ML API request
      const isKlingI2V = isI2V && typeof modelId === 'string' && modelId.toLowerCase().includes('kling');
      const normalizedPrompt = isKlingI2V
        ? `Use the provided reference image as the exact visual anchor and first frame. Keep subject identity, style, and composition consistent with that image. ${prompt || "Smooth cinematic video"}`
        : (prompt || "Smooth cinematic video");

      // Truncate prompt to model-specific max length (AI/ML API limit differs by model)
      const getAimlPromptMaxLength = (id: string): number => {
        const lower = id.toLowerCase();
        // Runway Gen4 variants have a stricter prompt limit
        if (lower.includes('runway/gen4') || lower.includes('gen4_')) {
          return 1000;
        }
        // Default limit for most AI/ML video models
        return 2500;
      };

      const promptMaxLength = getAimlPromptMaxLength(modelId);
      const truncatedPrompt = normalizedPrompt.length > promptMaxLength
        ? normalizedPrompt.slice(0, Math.max(promptMaxLength - 3, 1)) + '...'
        : normalizedPrompt;
      if (normalizedPrompt.length > promptMaxLength) {
        console.warn(`[AI/ML API] Prompt truncated from ${normalizedPrompt.length} to ${promptMaxLength} chars for model ${modelId}`);
      }

      const aimlPayload: Record<string, unknown> = {
        model: modelId,
        prompt: truncatedPrompt,
        duration: sanitizedDuration,
      };

      // Add aspect_ratio if provided (for models that support it)
      if (aspect_ratio) {
        aimlPayload.aspect_ratio = aspect_ratio;
      }

      // Add image for image-to-video
      if (type === "image_to_video" && startImageData) {
        const startUrl = await getAimlImageUrl(startImageData);

        if (isLumaRay) {
          // Luma Ray models use keyframes (frame0/start, frame1/end)
          const keyframes: Record<string, unknown> = {
            frame0: { type: 'image', url: startUrl },
          };

          if (end_image) {
            const endUrl = await getAimlImageUrl(end_image);
            keyframes.frame1 = { type: 'image', url: endUrl };
          }

          aimlPayload.keyframes = keyframes;
        } else if (isPixVerseTransition) {
          // PixVerse Transition requires both first_image_url and last_image_url
          aimlPayload.first_image_url = startUrl;
          
          if (end_image) {
            const endUrl = await getAimlImageUrl(end_image);
            aimlPayload.last_image_url = endUrl;
          } else {
            // PixVerse Transition requires end image - error if not provided
            throw new Error("PixVerse Transition requires both start and end images");
          }
        } else if (isVeoFirstLast) {
          // Veo 3.1 first-last-i2v uses image_url and last_image_url (per official API docs)
          // https://docs.aimlapi.com/api-references/video-models/google/veo-3-1-first-last-image-to-video
          // CRITICAL: Always upload images with signed URLs for this model
          let veoStartUrl = startUrl;
          if (startUrl.includes('/object/public/')) {
            const signedUrl = await tryConvertPublicStorageUrlToSigned(startUrl, { expiresInSec: 60 * 60 });
            if (signedUrl) {
              veoStartUrl = signedUrl;
              console.log('[AI/ML API] Converted public URL to signed URL for image_url');
            }
          }
          aimlPayload.image_url = veoStartUrl;
          
          if (end_image) {
            const endUrl = await getAimlImageUrl(end_image);
            let veoEndUrl = endUrl;
            if (endUrl.includes('/object/public/')) {
              const signedEndUrl = await tryConvertPublicStorageUrlToSigned(endUrl, { expiresInSec: 60 * 60 });
              if (signedEndUrl) {
                veoEndUrl = signedEndUrl;
                console.log('[AI/ML API] Converted public URL to signed URL for last_image_url');
              }
            }
            aimlPayload.last_image_url = veoEndUrl;
          } else {
            // Veo first-last requires both start and end images
            throw new Error("Veo 3.1 First-Last Frame requires both start and end images");
          }
        } else if (isVeoRefToVideo) {
          // Veo 3.1 reference-to-video uses image_urls as an ARRAY
          // https://docs.aimlapi.com/api-references/video-models/google/veo-3-1-reference-to-video
          const imageUrlsArray: string[] = [startUrl];
          
          // Add end_image to the array if provided
          if (end_image) {
            const endUrl = await getAimlImageUrl(end_image, 'end_image');
            imageUrlsArray.push(endUrl);
          }
          
          // Add reference_images array if provided (multiple reference images from UI)
          if (body.reference_images && Array.isArray(body.reference_images)) {
            console.log(`[AI/ML API] Processing ${body.reference_images.length} additional reference images`);
            for (let i = 0; i < body.reference_images.length; i++) {
              const refUrl = await getAimlImageUrl(body.reference_images[i], `reference_image_${i + 1}`);
              imageUrlsArray.push(refUrl);
            }
          }
          
          aimlPayload.image_urls = imageUrlsArray;
          console.log(`[AI/ML API] Veo ref-to-video: using image_urls array with ${imageUrlsArray.length} images`);
        } else {
          // Most other AI/ML API video models accept a single image URL for I2V
          aimlPayload.image_url = startUrl;
        }
      }
      
      console.log(`[AI/ML API] Request payload:`, JSON.stringify(aimlPayload, null, 2));
      
      let aimlResponse = await fetch("https://api.aimlapi.com/v2/video/generations", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${AIML_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(aimlPayload),
      });

      let responseText = await aimlResponse.text();
      console.log(`[AI/ML API] Response status: ${aimlResponse.status}`);
      console.log(`[AI/ML API] Response body: ${responseText}`);

      // Some providers may return 400(image_url required) for a text model alias.
      // Retry once with a known text-only compatible model.
      const missingImageForText =
        !aimlResponse.ok &&
        type === "text_to_video" &&
        !startImageData &&
        (
          (aimlResponse.status === 400 && responseText.includes('"path":["image_url"]')) ||
          (aimlResponse.status === 404 && responseText.toLowerCase().includes("model not found"))
        );

      if (missingImageForText) {
        const textFallbackModel = "kling-video/v1.6/pro/text-to-video";
        console.warn(
          `[AI/ML API] ${String(aimlPayload.model)} rejected text-only payload (or model unavailable). Retrying with ${textFallbackModel}.`
        );

        aimlPayload.model = textFallbackModel;
        aimlResponse = await fetch("https://api.aimlapi.com/v2/video/generations", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${AIML_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(aimlPayload),
        });

        responseText = await aimlResponse.text();
        console.log(`[AI/ML API] Retry response status: ${aimlResponse.status}`);
        console.log(`[AI/ML API] Retry response body: ${responseText}`);
      }

      if (!aimlResponse.ok) {
        console.error(`[AI/ML API] Error: ${aimlResponse.status} - ${responseText}`);
        
        // Check if it's a billing/credits error (403) or maintenance (500) - attempt fallback to PiAPI
        const shouldFallback = (aimlResponse.status === 403 && responseText.includes("credits"))
          || (aimlResponse.status === 500 && responseText.includes("maintenance"));
        if (shouldFallback) {
          console.log(`[AI/ML API] Error ${aimlResponse.status} detected, attempting fallback to PiAPI...`);
          
          const PIAPI_API_KEY = Deno.env.get("PIAPI_API_KEY");
          if (PIAPI_API_KEY) {
            // Map AIML model to equivalent PiAPI model
            const aimlToPiapiMap: Record<string, string> = {
              "veo3-t2v": "veo3",
              "veo3-i2v": "veo3",
              "kling-2.5-t2v": "kling-2.5",
              "kling-2.5-i2v": "kling-2.5",
              "kling-2.6-t2v": "kling-2.6", 
              "kling-2.6-i2v": "kling-2.6",
            };
            
            const piapiModelKey = aimlToPiapiMap[modelKey] || "kling-2.5";
            const piapiConfig = PIAPI_MODELS[piapiModelKey];
            
            if (piapiConfig) {
              console.log(`[Fallback] Switching from AIML ${modelKey} to PiAPI ${piapiModelKey}`);
              
              const taskType = type === "image_to_video" 
                ? piapiConfig.task_type_img2video 
                : piapiConfig.task_type_txt2video;
              
              const piApiPayload: any = {
                model: piapiConfig.model,
                task_type: taskType,
                input: {
                  prompt: prompt || "",
                }
              };
              
              // Add duration using generic sanitizer
              const sanitizedDuration = sanitizeDuration(piapiConfig.model, duration || 5);
              piApiPayload.input.duration = sanitizedDuration;
              
              // Add model-specific parameters
              if (piapiConfig.model_name) {
                piApiPayload.input.model_name = piapiConfig.model_name;
              }
              if (piapiConfig.mode) {
                piApiPayload.input.mode = piapiConfig.mode;
              }
              
              // Handle image for I2V
              if (type === "image_to_video" && startImageData) {
                const imgData = await getImageUrlForPiAPI(startImageData, "start");
                if (imgData.url) {
                  piApiPayload.input.image_url = imgData.url;
                } else if (imgData.base64) {
                  piApiPayload.input.image = imgData.base64;
                }
              }
              
              console.log("[Fallback] PiAPI payload:", JSON.stringify(piApiPayload, null, 2));
              
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
                const taskId = piApiData.data?.task_id || piApiData.task_id;
                
                if (taskId) {
                  console.log(`[Fallback] PiAPI task started successfully: ${taskId}`);
                  
                  // Update database with PiAPI task
                  if (generationId) {
                    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
                    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
                    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
                    const supabaseClient = createClient(supabaseUrl, supabaseKey);

                    await supabaseClient
                      .from('video_generations')
                      .update({
                        status: 'processing',
                        prediction_id: `piapi:${piapiModelKey}:${taskId}`,
                        provider: `piapi-${piapiModelKey}`
                      })
                      .eq('id', generationId);
                  }
                  
                  return new Response(JSON.stringify({ 
                    status: "starting",
                    operationId: `piapi:${piapiModelKey}:${taskId}`,
                    provider: `piapi-${piapiModelKey}`,
                    fallback: true,
                    originalError: `AIML unavailable (${aimlResponse.status})`
                  }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 200,
                  });
                }
              } else {
                const piError = await piApiResponse.text();
                console.error(`[Fallback] PiAPI also failed: ${piError}`);
              }
            }
          }
        }
        
        throw new Error(`AI/ML API error: ${aimlResponse.status} - ${responseText}`);
      }

      let aimlData;
      try {
        aimlData = JSON.parse(responseText);
      } catch (e) {
        console.error(`[AI/ML API] Failed to parse response as JSON:`, responseText);
        throw new Error(`AI/ML API returned invalid JSON: ${responseText}`);
      }
      console.log(`[AI/ML API] Task started:`, JSON.stringify(aimlData, null, 2));
      
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

      // Guard: PiAPI veo3 and sora2 do NOT truly support image-to-video.
      // Their task_type for i2v is the same as t2v and they ignore the image.
      // Fallback to kling-2.5 for I2V requests targeting these models.
      const piapiNoI2V = ['veo3', 'sora2'];
      if (type === 'image_to_video' && piapiNoI2V.includes(modelConfig.model)) {
        console.warn(`[PiAPI Guard] Model ${modelConfig.model} does not support image-to-video. Falling back to kling-2.5`);
        const fallbackConfig = PIAPI_MODELS["kling-2.5"];
        // Re-enter this block with the corrected model
        Object.assign(modelConfig, fallbackConfig);
      }
      
      console.log(`Starting PiAPI generation with model: ${modelKey}`, modelConfig);
      
      const startImageData = start_image || image || image_url;

      // normalizePrompt is now a top-level function

      const normalizedPrompt = normalizePrompt(prompt);
      
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
          prompt: normalizedPrompt,
        }
      };
      
      // PiAPI duration constraints by model
      const PIAPI_DURATION_CONSTRAINTS: Record<string, number[]> = {
        'kling': [5, 10],
        'hailuo': [6],
        'luma': [5],
        'wan': [4, 8],
        'hunyuan': [5],
        'Qubico/hunyuan': [5],
        'skyreels': [4],
        'Qubico/skyreels': [4],
        'framepack': [5, 10],
        'Qubico/framepack': [5, 10],
        'veo3': [4, 6, 8],
        'sora2': [5, 10, 15, 20],
      };
      
      // Get valid durations for this PiAPI model
      const getValidPiAPIDurations = (model: string): number[] => {
        return PIAPI_DURATION_CONSTRAINTS[model] || [5, 10];
      };
      
      // Sanitize duration for PiAPI
      const sanitizePiAPIDuration = (model: string, requestedDuration: number): number => {
        const validDurations = getValidPiAPIDurations(model);
        if (validDurations.includes(requestedDuration)) {
          return requestedDuration;
        }
        // Find closest valid duration
        let closest = validDurations[0];
        let minDiff = Math.abs(requestedDuration - closest);
        for (const d of validDurations) {
          const diff = Math.abs(requestedDuration - d);
          if (diff < minDiff) {
            minDiff = diff;
            closest = d;
          }
        }
        console.log(`[PiAPI Duration Sanitizer] Adjusted duration from ${requestedDuration}s to ${closest}s for model ${model}`);
        return closest;
      };
      
      // Add duration and model-specific parameters
      if (modelConfig.model === "veo3") {
        const sanitizedDuration = sanitizePiAPIDuration("veo3", duration || 8);
        piApiPayload.input.duration = `${sanitizedDuration}s`;
        piApiPayload.input.generate_audio = generate_audio !== false; // Default true
        // Veo3 supports aspect_ratio
        if (aspect_ratio) {
          piApiPayload.input.aspect_ratio = aspect_ratio;
        }
      } else if (modelConfig.model === "sora2") {
        const sanitizedDuration = sanitizePiAPIDuration("sora2", duration || 4);
        piApiPayload.input.duration = sanitizedDuration;
        // Sora2 supports aspect_ratio and resolution
        if (aspect_ratio) {
          piApiPayload.input.aspect_ratio = aspect_ratio;
        }
        if (resolution) {
          piApiPayload.input.resolution = resolution;
        }
      } else if (modelConfig.model === "skyreels") {
        // SkyReels V2 specific handling - uses Qubico/skyreels model
        // SkyReels is IMAGE-TO-VIDEO ONLY - optimized for human-centric video generation
        piApiPayload.model = "Qubico/skyreels";
        piApiPayload.task_type = "img2video";
        
        // SkyReels specific parameters
        piApiPayload.input.guidance_scale = 3.5; // Default optimal value
        
        // SkyReels currently returns fixed-length output (~4s)
        const sanitizedDuration = sanitizePiAPIDuration("skyreels", duration || 4);
        piApiPayload.input.duration = sanitizedDuration;

        // SkyReels currently uses a fixed native resolution from provider side.
        // We intentionally do not send `resolution` because the API ignores it.
        if (resolution && resolution !== "540p") {
          console.log(`[PiAPI SkyReels] Requested resolution '${resolution}' ignored by provider; using native output`);
        }

        // Aspect ratio (16:9, 9:16, 1:1 supported)
        if (aspect_ratio && ["16:9", "9:16", "1:1"].includes(aspect_ratio)) {
          piApiPayload.input.aspect_ratio = aspect_ratio;
        } else {
          piApiPayload.input.aspect_ratio = "16:9"; // Default
        }

        // SkyReels recommends including "FPS-24" in prompt
        if (normalizedPrompt && !normalizedPrompt.includes("FPS-24")) {
          piApiPayload.input.prompt = `FPS-24, ${normalizedPrompt}`;
        }
        
        // Negative prompt for better results
        piApiPayload.input.negative_prompt = "chaotic, distortion, morphing, blurry, low quality";
        
        console.log(`[PiAPI SkyReels] duration=${sanitizedDuration}s (provider fixed), aspect_ratio=${piApiPayload.input.aspect_ratio}`);
      } else if (modelConfig.model === "framepack") {
        // Framepack specific handling - uses Qubico/framepack model
        // Framepack is IMAGE-TO-VIDEO ONLY - optimized for smooth frame interpolation
        piApiPayload.model = "Qubico/framepack";
        piApiPayload.task_type = "img2video";
        
        // Duration (5-10 seconds supported, FPS fixed at 30)
        const sanitizedDuration = sanitizePiAPIDuration("framepack", duration || 5);
        piApiPayload.input.duration = sanitizedDuration;
        
        // Framepack uses start_image and end_image (not image_url)
        // This will be handled in the image processing section below
        // but we need to override the field names
        if (startImageData) {
          const startImgData = await getImageUrlForPiAPI(startImageData, "start");
          if (startImgData.url) {
            piApiPayload.input.start_image = startImgData.url;
          } else if (startImgData.base64) {
            piApiPayload.input.start_image = startImgData.base64;
          }
        }
        
        // End image for interpolation (key feature of Framepack)
        if (end_image) {
          const endImgData = await getImageUrlForPiAPI(end_image, "end");
          if (endImgData.url) {
            piApiPayload.input.end_image = endImgData.url;
          } else if (endImgData.base64) {
            piApiPayload.input.end_image = endImgData.base64;
          }
        }
        
        // Negative prompt for quality
        piApiPayload.input.negative_prompt = "chaotic, distortion, morphing, blurry, low quality, artifacts";
        
        // Resolution and aspect ratio for Framepack
        if (resolution) {
          piApiPayload.input.resolution = resolution;
        }
        if (aspect_ratio) {
          piApiPayload.input.aspect_ratio = aspect_ratio;
        }
        
        console.log(`[PiAPI Framepack] duration=${sanitizedDuration}s, resolution=${resolution || 'default'}, aspect_ratio=${aspect_ratio || 'default'}`);
        
        // Skip the generic image processing below since we handled it above
        // Set a flag to prevent duplicate image handling
        piApiPayload._framepackImagesHandled = true;
      } else {
        const sanitizedDuration = sanitizePiAPIDuration(modelConfig.model, duration || 5);
        piApiPayload.input.duration = sanitizedDuration;
        
        // Pass resolution and aspect_ratio for all generic PiAPI models (wan, hunyuan, hailuo, luma, etc.)
        if (resolution) {
          piApiPayload.input.resolution = resolution;
        }
        if (aspect_ratio) {
          piApiPayload.input.aspect_ratio = aspect_ratio;
        }
      }
      
      // Add model-specific parameters
      if (modelConfig.model_name) {
        piApiPayload.input.model_name = modelConfig.model_name;
      }
      if (modelConfig.mode) {
        piApiPayload.input.mode = modelConfig.mode;
      }
      
      // Add images for image-to-video (handle large images by uploading to storage)
      // Skip if Framepack already handled images (uses different field names)
      if (type === "image_to_video" && startImageData && !piApiPayload._framepackImagesHandled) {
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
      
      // Clean up internal flags before sending to API
      delete piApiPayload._framepackImagesHandled;
      
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
    const rawErrorMessage = error instanceof Error ? error.message : "Failed to generate video";
    
    // Parse content policy violations for user-friendly messages
    const contentPolicyResult = parseContentPolicyError(rawErrorMessage);
    const errorMessage = contentPolicyResult.isContentPolicy 
      ? contentPolicyResult.userMessage 
      : rawErrorMessage;
    
    // Content policy violations are not retryable
    const isRetryable = !contentPolicyResult.isContentPolicy && (
                        rawErrorMessage.includes("overloaded") || 
                        rawErrorMessage.includes("rate limit") ||
                        rawErrorMessage.includes("quota") ||
                        rawErrorMessage.includes("temporarily") ||
                        rawErrorMessage.includes("RESOURCE_EXHAUSTED") ||
                        rawErrorMessage.includes("429") ||
                        rawErrorMessage.toLowerCase().includes("internal server error") ||
                        rawErrorMessage.toLowerCase().includes("failed to do request") ||
                        rawErrorMessage.includes("status code: 500"));
    
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
            status: "retry_scheduled",
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
    
    // For polling requests, always return 200 with structured status so frontend can stop polling cleanly
    if (body?.operationId) {
      return new Response(
        JSON.stringify({
          status: isRetryable ? "retry_scheduled" : "failed",
          error: errorMessage,
          retryable: isRetryable,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
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
