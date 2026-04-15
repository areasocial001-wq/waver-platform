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

const generateSchema = z.object({
  action: z.literal('generate').optional(),
  prompt: z.string().min(1, 'Prompt obbligatorio').max(2000, 'Prompt troppo lungo'),
  model: z.enum(['udio', 'diffrhythm', 'mmaudio', 'ace-step']).optional(),
  duration: z.number().min(5).max(300).optional(),
  style: z.string().max(100).optional(),
});

// PIAPI audio model mapping
const PIAPI_AUDIO_MODELS: Record<string, string> = {
  "udio": "udio",
  "diffrhythm": "diffrhythm",
  "mmaudio": "mmaudio",
  "ace-step": "ace-step",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    let userId: string | undefined;
    try {
      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
      if (!claimsError && claimsData?.claims) {
        userId = claimsData.claims.sub as string;
      }
    } catch (_) {
      // getClaims not available in this SDK version
    }
    if (!userId) {
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData?.user) {
        console.error("JWT validation failed:", userError);
        return new Response(
          JSON.stringify({ error: "Invalid authentication token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      userId = userData.user.id;
    }
    const PIAPI_API_KEY = Deno.env.get("PIAPI_API_KEY");
    if (!PIAPI_API_KEY) {
      throw new Error("PIAPI_API_KEY is not configured");
    }

    const body = await req.json();

    // Handle health check
    if (body.healthCheck) {
      return new Response(
        JSON.stringify({ status: 'ok', service: 'piapi-audio' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, taskId, prompt, model, duration, style } = body;

    // Check status of existing task
    if (action === "status" && taskId) {
      const parseResult = statusSchema.safeParse(body);
      if (!parseResult.success) {
        return new Response(
          JSON.stringify({ error: parseResult.error.errors[0].message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log("Checking PIAPI audio task status:", taskId);

      const response = await fetch(`https://api.piapi.ai/api/v1/task/${taskId}`, {
        headers: {
          "x-api-key": PIAPI_API_KEY,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("PIAPI audio status error:", response.status, errorText);
        throw new Error(`PIAPI error: ${response.status}`);
      }

      const data = await response.json();
      console.log("PIAPI audio status response:", JSON.stringify(data));
      
      const taskStatus = data.data?.status || data.status;
      
      if (taskStatus === "completed" || taskStatus === "SUCCESS") {
        const audioUrl = data.data?.output?.audio_url || 
                        data.data?.output?.audio ||
                        data.data?.audio_url ||
                        data.output?.audio_url;
        
        return new Response(JSON.stringify({ 
          status: "completed",
          audioUrl,
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

    // Generate new audio - validate input
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

    const selectedModel = PIAPI_AUDIO_MODELS[model || "udio"] || "udio";
    
    console.log("Generating PIAPI audio with params:", { prompt, model: selectedModel, duration, style });

    const piApiPayload: any = {
      model: selectedModel,
      task_type: "txt2audio",
      input: {
        prompt,
      }
    };

    // Add optional parameters
    if (duration) {
      piApiPayload.input.duration = duration;
    }
    if (style) {
      piApiPayload.input.style = style;
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
      console.error("PIAPI audio generation error:", response.status, errorText);
      throw new Error(`PIAPI error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("PIAPI audio generation response:", JSON.stringify(data));

    const taskIdResult = data.data?.task_id || data.task_id;
    
    return new Response(JSON.stringify({ 
      taskId: taskIdResult,
      model: selectedModel,
      status: "processing"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in piapi-audio function:", error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
