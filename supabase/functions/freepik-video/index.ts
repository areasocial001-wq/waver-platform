import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const statusSchema = z.object({
  action: z.literal('status'),
  taskId: z.string().min(1).max(100),
  model: z.string().max(50).optional(),
});

const generateSchema = z.object({
  action: z.literal('generate').optional(),
  prompt: z.string().min(1, 'Prompt obbligatorio').max(2000, 'Prompt troppo lungo'),
  firstFrameImage: z.string().max(500000).optional(),
  lastFrameImage: z.string().max(500000).optional(),
  duration: z.number().int().min(1).max(30).optional(),
  model: z.enum(['kling', 'minimax']).optional(),
});

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
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const FREEPIK_API_KEY = Deno.env.get("FREEPIK_API_KEY");
    if (!FREEPIK_API_KEY) {
      throw new Error("FREEPIK_API_KEY is not configured");
    }

    const body = await req.json();
    const { action, taskId, prompt, firstFrameImage, lastFrameImage, duration, model } = body;

    // Check status of existing task
    if (action === "status" && taskId) {
      const parseResult = statusSchema.safeParse(body);
      if (!parseResult.success) {
        return new Response(
          JSON.stringify({ error: parseResult.error.errors[0].message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log("Checking video task status:", taskId);
      
      // Determine which model endpoint to check
      const modelEndpoint = model === "kling" 
        ? "kling-v2-5-pro" 
        : "minimax-hailuo-02-768p";
      
      const response = await fetch(`https://api.freepik.com/v1/ai/image-to-video/${modelEndpoint}/${taskId}`, {
        headers: {
          "x-freepik-api-key": FREEPIK_API_KEY,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Freepik video status error:", response.status, errorText);
        throw new Error(`Freepik API error: ${response.status}`);
      }

      const data = await response.json();
      console.log("Video status response:", JSON.stringify(data));
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate new video - validate input
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

    // Default to MiniMax for start/end frame support
    const useKling = model === "kling" || !lastFrameImage;
    const modelEndpoint = useKling ? "kling-v2-5-pro" : "minimax-hailuo-02-768p";

    console.log("Generating video with params:", { prompt, modelEndpoint, firstFrameImage: !!firstFrameImage, lastFrameImage: !!lastFrameImage, duration });

    const requestBody: any = {
      prompt,
      prompt_optimizer: true,
      duration: duration || 6,
    };

    if (firstFrameImage) {
      if (useKling) {
        requestBody.image = firstFrameImage;
      } else {
        requestBody.first_frame_image = firstFrameImage;
      }
    }

    if (lastFrameImage && !useKling) {
      requestBody.last_frame_image = lastFrameImage;
    }

    const response = await fetch(`https://api.freepik.com/v1/ai/image-to-video/${modelEndpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-freepik-api-key": FREEPIK_API_KEY,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Freepik video generation error:", response.status, errorText);
      throw new Error(`Freepik API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("Video generation response:", JSON.stringify(data));

    return new Response(JSON.stringify({ ...data, model: modelEndpoint }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in freepik-video function:", error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
