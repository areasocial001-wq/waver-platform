import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FREEPIK_API_KEY = Deno.env.get("FREEPIK_API_KEY");
    if (!FREEPIK_API_KEY) {
      throw new Error("FREEPIK_API_KEY is not configured");
    }

    const body = await req.json();
    const { action, taskId, image, scaleFactor, optimizedFor, prompt, creativity, hdr, resemblance, fractality, engine, mode } = body;

    // Check status of existing task
    if (action === "status" && taskId) {
      console.log("Checking upscale task status:", taskId);
      
      const endpoint = mode === "precision" 
        ? `https://api.freepik.com/v1/ai/image-upscaler-precision-v2/${taskId}`
        : `https://api.freepik.com/v1/ai/image-upscaler/${taskId}`;
      
      const response = await fetch(endpoint, {
        headers: {
          "x-freepik-api-key": FREEPIK_API_KEY,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Freepik upscale status error:", response.status, errorText);
        throw new Error(`Freepik API error: ${response.status}`);
      }

      const data = await response.json();
      console.log("Upscale status response:", JSON.stringify(data));
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upscale image
    if (!image) {
      throw new Error("Image is required");
    }

    console.log("Upscaling image with params:", { scaleFactor, optimizedFor, mode, engine });

    const isPrecisionMode = mode === "precision";
    const endpoint = isPrecisionMode 
      ? "https://api.freepik.com/v1/ai/image-upscaler-precision-v2"
      : "https://api.freepik.com/v1/ai/image-upscaler";

    let requestBody: any = {
      image,
      scale_factor: scaleFactor || "2x",
    };

    if (isPrecisionMode) {
      // Precision mode parameters
      requestBody.flavor = optimizedFor || "photo";
      if (body.sharpen !== undefined) requestBody.sharpen = body.sharpen;
      if (body.smartGrain !== undefined) requestBody.smart_grain = body.smartGrain;
      if (body.ultraDetail !== undefined) requestBody.ultra_detail = body.ultraDetail;
    } else {
      // Creative mode parameters
      requestBody.optimized_for = optimizedFor || "standard";
      if (prompt) requestBody.prompt = prompt;
      if (creativity !== undefined) requestBody.creativity = creativity;
      if (hdr !== undefined) requestBody.hdr = hdr;
      if (resemblance !== undefined) requestBody.resemblance = resemblance;
      if (fractality !== undefined) requestBody.fractality = fractality;
      if (engine) requestBody.engine = engine;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-freepik-api-key": FREEPIK_API_KEY,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Freepik upscale error:", response.status, errorText);
      throw new Error(`Freepik API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("Upscale response:", JSON.stringify(data));

    return new Response(JSON.stringify({ ...data, mode: isPrecisionMode ? "precision" : "creative" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in freepik-upscale function:", error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
