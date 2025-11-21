import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Replicate from "https://esm.sh/replicate@0.25.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!REPLICATE_API_KEY) {
      throw new Error("REPLICATE_API_KEY is not set");
    }

    const replicate = new Replicate({
      auth: REPLICATE_API_KEY,
    });

    const body = await req.json();
    console.log("Generate video request:", body);

    // Check status of existing prediction
    if (body.predictionId) {
      console.log("Checking status for prediction:", body.predictionId);
      const prediction = await replicate.predictions.get(body.predictionId);
      console.log("Prediction status:", prediction.status);
      
      return new Response(JSON.stringify(prediction), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Start new video generation
    const { type, prompt, image_url, duration } = body;

    if (!type || !prompt) {
      return new Response(
        JSON.stringify({ 
          error: "Missing required fields: type and prompt are required" 
        }), 
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    let output;

    // For image-to-video generation
    if (type === "image_to_video" && image_url) {
      console.log("Starting image-to-video generation");
      output = await replicate.predictions.create({
        version: "b840152c70e887773e95b24d1f1e8fd2aea448fcf093de801d3627f0a197409f",
        input: {
          prompt: prompt || "A cinematic video",
          input_image: image_url,
        }
      });
    } else {
      // For text-to-video generation - using text-to-image as placeholder
      console.log("Starting text-to-image generation (video placeholder)");
      output = await replicate.predictions.create({
        version: "bf53bdb93d739c9c915091cfa5f49ca662d11273a5eb30e7a2ec1939bcf27a00",
        input: {
          prompt: prompt,
          go_fast: true,
          num_outputs: 1,
          aspect_ratio: "16:9",
          output_format: "webp",
          num_inference_steps: 4,
        }
      });
    }

    console.log("Generation started:", output);

    return new Response(JSON.stringify(output), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in generate-video function:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to generate video";
    return new Response(
      JSON.stringify({ 
        error: errorMessage
      }), 
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
