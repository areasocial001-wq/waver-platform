import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schemas
const statusSchema = z.object({
  action: z.literal('status'),
  taskId: z.string().min(1).max(100),
});

const templateSchema = z.object({
  action: z.literal('process').optional(),
  template: z.enum(['clean-upscale', 'faceswap', 'virtual-tryon', 'ai-hug']),
  image: z.string().min(1).max(10000000), // base64 or URL
  targetImage: z.string().max(10000000).optional(), // For faceswap, virtual-tryon
  upscaleFactor: z.enum(['2x', '4x']).optional(), // For clean-upscale
});

// PIAPI template mapping
const PIAPI_TEMPLATES: Record<string, { model: string; task_type: string }> = {
  "clean-upscale": { model: "Qubico/image-toolkit", task_type: "upscale" },
  "faceswap": { model: "Qubico/image-toolkit", task_type: "face-swap" },
  "virtual-tryon": { model: "kling", task_type: "ai_try_on" },
  "ai-hug": { model: "Qubico/hug-video", task_type: "image_to_video" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PIAPI_API_KEY = Deno.env.get("PIAPI_API_KEY");
    if (!PIAPI_API_KEY) {
      throw new Error("PIAPI_API_KEY is not configured");
    }

    const body = await req.json();

    // Handle health check
    if (body.healthCheck) {
      return new Response(
        JSON.stringify({ status: 'ok', service: 'piapi-templates' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, taskId, template, image, targetImage, effectType, upscaleFactor } = body;

    // Check status of existing task
    if (action === "status" && taskId) {
      const parseResult = statusSchema.safeParse(body);
      if (!parseResult.success) {
        return new Response(
          JSON.stringify({ error: parseResult.error.errors[0].message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log("Checking PIAPI template task status:", taskId);

      const response = await fetch(`https://api.piapi.ai/api/v1/task/${taskId}`, {
        headers: {
          "x-api-key": PIAPI_API_KEY,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("PIAPI template status error:", response.status, errorText);
        throw new Error(`PIAPI error: ${response.status}`);
      }

      const data = await response.json();
      console.log("PIAPI template status response:", JSON.stringify(data));
      
      const taskStatus = data.data?.status || data.status;
      
      if (taskStatus === "completed" || taskStatus === "SUCCESS") {
        const resultUrl = data.data?.output?.image_url || 
                         data.data?.output?.video_url ||
                         data.data?.output?.result_url ||
                         data.data?.image_url ||
                         data.output?.image_url;
        
        return new Response(JSON.stringify({ 
          status: "completed",
          resultUrl,
          data: data.data
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else if (taskStatus === "failed" || taskStatus === "FAILED") {
        return new Response(JSON.stringify({ 
          status: "failed",
          error: data.data?.error || data.error || "Unknown error"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ 
        status: "processing",
        data: data.data
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process template - validate input
    const parseResult = templateSchema.safeParse(body);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: parseResult.error.errors[0].message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!template || !image) {
      throw new Error("Template and image are required");
    }

    const templateConfig = PIAPI_TEMPLATES[template];
    if (!templateConfig) {
      throw new Error(`Unknown template: ${template}`);
    }
    
    console.log("Processing PIAPI template:", { template, templateConfig });

    // Extract base64 if needed
    const extractBase64 = (data: string): string => {
      if (!data) return "";
      if (data.includes(',')) {
        return data.split(',')[1];
      }
      return data;
    };

    const piApiPayload: any = {
      model: templateConfig.model,
      task_type: templateConfig.task_type,
      input: {}
    };

    // Handle different template types
    switch (template) {
      case "clean-upscale":
        piApiPayload.input.image = image.startsWith('data:') ? extractBase64(image) : image;
        piApiPayload.input.scale = upscaleFactor === "4x" ? 4 : 2;
        piApiPayload.input.face_enhance = true;
        break;
        
      case "faceswap":
        piApiPayload.input.swap_image = image.startsWith('data:') ? extractBase64(image) : image;
        if (targetImage) {
          piApiPayload.input.target_image = targetImage.startsWith('data:') ? extractBase64(targetImage) : targetImage;
        }
        break;
        
      case "virtual-tryon":
        piApiPayload.input.model_input = image.startsWith('data:') ? extractBase64(image) : image;
        if (targetImage) {
          piApiPayload.input.dress_input = targetImage.startsWith('data:') ? extractBase64(targetImage) : targetImage;
        }
        break;
        
      case "ai-hug":
        piApiPayload.input.image_url = image.startsWith('data:') ? extractBase64(image) : image;
        break;
    }

    const response = await fetch("https://api.piapi.ai/api/v1/task", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": PIAPI_API_KEY,
      },
      body: JSON.stringify(piApiPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("PIAPI template error:", response.status, errorText);
      throw new Error(`PIAPI error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("PIAPI template response:", JSON.stringify(data));

    const taskIdResult = data.data?.task_id || data.task_id;
    
    return new Response(JSON.stringify({ 
      taskId: taskIdResult,
      template,
      status: "processing"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in piapi-templates function:", error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
