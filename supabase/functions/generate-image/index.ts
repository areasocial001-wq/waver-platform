import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Replicate from "https://esm.sh/replicate@0.25.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const requestSchema = z.object({
  prompt: z.string().min(1, 'Prompt obbligatorio').max(2000, 'Prompt troppo lungo'),
  width: z.number().int().min(256).max(2048).optional(),
  height: z.number().int().min(256).max(2048).optional(),
  aspectRatio: z.string().max(20).optional(),
  outputFormat: z.enum(['webp', 'png', 'jpg']).optional(),
  outputQuality: z.number().int().min(1).max(100).optional(),
  numInferenceSteps: z.number().int().min(1).max(50).optional(),
  model: z.string().max(100).optional(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const REPLICATE_API_KEY = Deno.env.get('REPLICATE_API_KEY');
    if (!REPLICATE_API_KEY) {
      throw new Error('REPLICATE_API_KEY is not set');
    }

    const replicate = new Replicate({
      auth: REPLICATE_API_KEY,
    });

    const body = await req.json();
    
    // Validate input
    const parseResult = requestSchema.safeParse(body);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: parseResult.error.errors[0].message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      model: rawModel = "black-forest-labs/flux-schnell"
    } = parseResult.data;

    // Map short model aliases to full Replicate model identifiers
    const MODEL_ALIASES: Record<string, string> = {
      "flux": "black-forest-labs/flux-schnell",
      "flux-schnell": "black-forest-labs/flux-schnell",
      "flux-dev": "black-forest-labs/flux-dev",
      "flux-pro": "black-forest-labs/flux-pro",
      "sdxl": "stability-ai/sdxl",
    };
    const model = MODEL_ALIASES[rawModel] || rawModel;

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