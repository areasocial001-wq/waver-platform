import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// DashScope API endpoints by region
const ENDPOINTS = {
  singapore: "https://dashscope-intl.aliyuncs.com",
  virginia: "https://dashscope-us.aliyuncs.com", 
  beijing: "https://dashscope.aliyuncs.com",
};

interface VideoRequest {
  prompt: string;
  imageUrl?: string;
  audioUrl?: string;
  model?: string;
  duration?: number;
  resolution?: string;
  region?: "singapore" | "virginia" | "beijing";
  promptExtend?: boolean;
  shotType?: "single" | "multi";
  negativePrompt?: string;
  generationId?: string;
  healthCheck?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const DASHSCOPE_API_KEY = Deno.env.get("DASHSCOPE_API_KEY");
    
    const body: VideoRequest = await req.json();
    
    // Health check
    if (body.healthCheck) {
      return new Response(JSON.stringify({
        healthy: true,
        hasDashScopeKey: !!DASHSCOPE_API_KEY,
        provider: "alibaba-dashscope",
        models: [
          "wan2.6-i2v-flash",
          "wan2.5-i2v-preview",
          "wan2.2-i2v-plus",
          "wan2.1-t2v-plus",
          "wan2.1-t2v-turbo"
        ]
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!DASHSCOPE_API_KEY) {
      return new Response(JSON.stringify({ error: "DASHSCOPE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      prompt,
      imageUrl,
      audioUrl,
      model = "wan2.5-i2v-preview",
      duration = 5,
      resolution = "720P",
      region = "singapore",
      promptExtend = true,
      shotType = "single",
      negativePrompt,
      generationId,
    } = body;

    const endpoint = ENDPOINTS[region];
    const isImageToVideo = !!imageUrl;
    
    // Build request payload
    const payload: Record<string, unknown> = {
      model,
      input: {
        prompt,
      },
      parameters: {
        resolution,
        prompt_extend: promptExtend,
        duration: Math.min(Math.max(duration, 2), 15), // Clamp 2-15
      }
    };

    // Image-to-video specific params
    if (isImageToVideo && imageUrl) {
      (payload.input as Record<string, unknown>).img_url = imageUrl;
    }

    // Audio params (wan2.5+)
    if (audioUrl) {
      (payload.input as Record<string, unknown>).audio_url = audioUrl;
    }

    // Multi-shot (wan2.6 only)
    if (shotType === "multi" && model.includes("wan2.6")) {
      (payload.parameters as Record<string, unknown>).shot_type = "multi";
    }

    // Negative prompt
    if (negativePrompt) {
      (payload.input as Record<string, unknown>).negative_prompt = negativePrompt;
    }

    console.log(`Creating DashScope video task: ${model}, duration: ${duration}s, resolution: ${resolution}`);

    // Create video generation task
    const createResponse = await fetch(`${endpoint}/api/v1/services/aigc/video-generation/video-synthesis`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${DASHSCOPE_API_KEY}`,
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable",
      },
      body: JSON.stringify(payload),
    });

    const createData = await createResponse.json();

    if (!createResponse.ok) {
      console.error("DashScope create task error:", createData);
      return new Response(JSON.stringify({ 
        error: createData.message || "Failed to create DashScope video task",
        code: createData.code,
        retryable: createData.code === "Throttling"
      }), {
        status: createResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const taskId = createData.output?.task_id;
    if (!taskId) {
      return new Response(JSON.stringify({ error: "No task_id returned from DashScope" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`DashScope task created: ${taskId}`);

    // Update database if generationId provided
    if (generationId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase
        .from("video_generations")
        .update({
          prediction_id: `dashscope:${taskId}`,
          provider: `dashscope-${model}`,
          status: "processing",
        })
        .eq("id", generationId);
    }

    return new Response(JSON.stringify({
      success: true,
      taskId,
      provider: "dashscope",
      model,
      region,
      status: "processing",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("DashScope video error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
