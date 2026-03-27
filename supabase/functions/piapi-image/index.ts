import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Input validation schemas
const statusSchema = z.object({
  action: z.literal('status'),
  taskId: z.string().min(1).max(100),
});

const generateSchema = z.object({
  action: z.literal('generate').optional(),
  prompt: z.string().min(1, 'Prompt obbligatorio').max(2000, 'Prompt troppo lungo'),
  model: z.enum(['flux', 'qwen', 'nano-banana']).optional(),
  aspectRatio: z.string().max(20).optional(),
  width: z.number().int().min(256).max(2048).optional(),
  height: z.number().int().min(256).max(2048).optional(),
});

// PIAPI model mapping
const PIAPI_IMAGE_MODELS: Record<string, string> = {
  "flux": "flux",
  "qwen": "qwen-image", 
  "nano-banana": "nano-banana",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Handle health check (no auth needed)
    if (body.healthCheck) {
      return new Response(
        JSON.stringify({ status: 'ok', service: 'piapi-image' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // JWT validation
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid JWT" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const PIAPI_API_KEY = Deno.env.get("PIAPI_API_KEY");
    if (!PIAPI_API_KEY) {
      throw new Error("PIAPI_API_KEY is not configured");
    }
      return new Response(
        JSON.stringify({ status: 'ok', service: 'piapi-image' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, taskId, prompt, model, aspectRatio, width, height } = body;

    // Check status of existing task
    if (action === "status" && taskId) {
      const parseResult = statusSchema.safeParse(body);
      if (!parseResult.success) {
        return new Response(
          JSON.stringify({ error: parseResult.error.errors[0].message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log("Checking PIAPI image task status:", taskId);

      const response = await fetch(`https://api.piapi.ai/api/v1/task/${taskId}`, {
        headers: {
          "x-api-key": PIAPI_API_KEY,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("PIAPI status error:", response.status, errorText);
        throw new Error(`PIAPI error: ${response.status}`);
      }

      const data = await response.json();
      console.log("PIAPI image status response:", JSON.stringify(data));
      
      const taskStatus = data.data?.status || data.status;
      
      if (taskStatus === "completed" || taskStatus === "SUCCESS") {
        const imageUrl = data.data?.output?.image_url || 
                        data.data?.output?.images?.[0] ||
                        data.data?.image_url ||
                        data.output?.image_url;
        
        return new Response(JSON.stringify({ 
          status: "completed",
          imageUrl,
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

    // Generate new image - validate input
    const parseResult = generateSchema.safeParse(body);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: parseResult.error.errors[0].message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!prompt) {
      throw new Error("Prompt is required");
    }

    const selectedModel = PIAPI_IMAGE_MODELS[model || "flux"] || "flux";
    
    console.log("Generating PIAPI image with params:", { prompt, model: selectedModel, aspectRatio, width, height });

    const piApiPayload: any = {
      model: selectedModel,
      task_type: "txt2img",
      input: {
        prompt,
      }
    };

    // Add dimensions if specified
    if (width && height) {
      piApiPayload.input.width = width;
      piApiPayload.input.height = height;
    } else if (aspectRatio) {
      piApiPayload.input.aspect_ratio = aspectRatio;
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
      console.error("PIAPI generation error:", response.status, errorText);
      throw new Error(`PIAPI error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("PIAPI image generation response:", JSON.stringify(data));

    const taskIdResult = data.data?.task_id || data.task_id;
    
    return new Response(JSON.stringify({ 
      taskId: taskIdResult,
      model: selectedModel,
      status: "processing"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in piapi-image function:", error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
