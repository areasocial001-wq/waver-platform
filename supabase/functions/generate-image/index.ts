import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Replicate from "https://esm.sh/replicate@0.25.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const REPLICATE_API_KEY = Deno.env.get('REPLICATE_API_KEY');
    if (!REPLICATE_API_KEY) {
      throw new Error('REPLICATE_API_KEY is not set');
    }

    const replicate = new Replicate({
      auth: REPLICATE_API_KEY,
    });

    const body = await req.json();

    if (!body.prompt) {
      return new Response(
        JSON.stringify({ 
          error: "Missing required field: prompt is required" 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    const {
      prompt,
      width = 1024,
      height = 1024,
      aspectRatio = "1:1",
      outputFormat = "webp",
      outputQuality = 90,
      numInferenceSteps = 4,
      model = "black-forest-labs/flux-schnell"
    } = body;

    console.log("Generating image with Replicate Flux:", { 
      prompt, 
      width, 
      height, 
      aspectRatio, 
      model 
    });

    const output = await replicate.run(
      model,
      {
        input: {
          prompt,
          go_fast: true,
          megapixels: "1",
          num_outputs: 1,
          aspect_ratio: aspectRatio,
          output_format: outputFormat,
          output_quality: outputQuality,
          num_inference_steps: numInferenceSteps,
          ...(width && height ? { width, height } : {})
        }
      }
    );

    console.log("Image generation successful:", output);

    return new Response(
      JSON.stringify({ 
        imageUrl: Array.isArray(output) ? output[0] : output,
        success: true 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in generate-image function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Failed to generate image" 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});