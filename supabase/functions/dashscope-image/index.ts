import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function persistDataUrlToStorage(imageUrl: string, userId: string): Promise<string> {
  if (!imageUrl || !imageUrl.startsWith("data:")) return imageUrl;
  const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return imageUrl;
  const mime = match[1];
  const b64 = match[2];
  const ext = mime.split("/")[1]?.split("+")[0] || "png";
  const fileName = `generated/${userId}/${crypto.randomUUID()}.${ext}`;
  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!serviceKey || !supabaseUrl) return imageUrl;
    const admin = createClient(supabaseUrl, serviceKey);
    const binary = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const { error: upErr } = await admin.storage
      .from("story-references")
      .upload(fileName, binary, { contentType: mime, upsert: false });
    if (upErr) return imageUrl;
    const { data: pub } = admin.storage.from("story-references").getPublicUrl(fileName);
    return pub?.publicUrl || imageUrl;
  } catch {
    return imageUrl;
  }
}

const ENDPOINTS = {
  singapore: "https://dashscope-intl.aliyuncs.com",
  virginia: "https://dashscope-us.aliyuncs.com",
  beijing: "https://dashscope.aliyuncs.com",
};

interface ImageRequest {
  prompt: string;
  negativePrompt?: string;
  model?: string;
  size?: string;
  n?: number;
  region?: "singapore" | "virginia" | "beijing";
  style?: string;
  refImage?: string;
  healthCheck?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const DASHSCOPE_API_KEY = Deno.env.get("DASHSCOPE_API_KEY");
    
    const body: ImageRequest = await req.json();
    
    // Health check
    if (body.healthCheck) {
      return new Response(JSON.stringify({
        healthy: true,
        hasDashScopeKey: !!DASHSCOPE_API_KEY,
        provider: "alibaba-dashscope",
        models: [
          "wanx2.1-t2i-turbo",
          "wanx2.1-t2i-plus", 
          "wanx-v1",
          "flux-schnell",
          "flux-dev"
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
      negativePrompt,
      model = "wanx2.1-t2i-turbo",
      size = "1024*1024",
      n = 1,
      region = "singapore",
      style,
      refImage,
    } = body;

    const endpoint = ENDPOINTS[region];

    // Build request payload based on model
    const isFluxModel = model.startsWith("flux");
    
    let apiPath: string;
    let payload: Record<string, unknown>;

    if (isFluxModel) {
      // Flux models use different endpoint
      apiPath = "/api/v1/services/aigc/text2image/image-synthesis";
      payload = {
        model,
        input: {
          prompt,
        },
        parameters: {
          size,
          n,
        }
      };
    } else {
      // Wanx models
      apiPath = "/api/v1/services/aigc/text2image/image-synthesis";
      payload = {
        model,
        input: {
          prompt,
        },
        parameters: {
          size,
          n,
          style: style || "<auto>",
        }
      };

      if (negativePrompt) {
        (payload.input as Record<string, unknown>).negative_prompt = negativePrompt;
      }

      // Reference image for style transfer
      if (refImage) {
        (payload.input as Record<string, unknown>).ref_img = refImage;
      }
    }

    console.log(`Creating DashScope image task: ${model}, size: ${size}`);

    // Create image generation task (async)
    const createResponse = await fetch(`${endpoint}${apiPath}`, {
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
      console.error("DashScope create image error:", createData);
      return new Response(JSON.stringify({ 
        error: createData.message || "Failed to create DashScope image task",
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

    console.log(`DashScope image task created: ${taskId}`);

    // Poll for result (images are usually fast)
    let attempts = 0;
    const maxAttempts = 30;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;

      const statusResponse = await fetch(`${endpoint}/api/v1/tasks/${taskId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${DASHSCOPE_API_KEY}`,
        },
      });

      const statusData = await statusResponse.json();
      const taskStatus = statusData.output?.task_status;

      if (taskStatus === "SUCCEEDED") {
        const results = statusData.output?.results;
        const imageUrls = results?.map((r: { url: string }) => r.url) || [];
        
        return new Response(JSON.stringify({
          success: true,
          taskId,
          provider: "dashscope",
          model,
          images: imageUrls,
          imageUrl: imageUrls[0],
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (taskStatus === "FAILED") {
        return new Response(JSON.stringify({ 
          error: statusData.output?.message || "Image generation failed"
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Timeout - return task ID for later polling
    return new Response(JSON.stringify({
      success: true,
      taskId,
      provider: "dashscope",
      model,
      status: "processing",
      message: "Image generation in progress, check status later"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("DashScope image error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
