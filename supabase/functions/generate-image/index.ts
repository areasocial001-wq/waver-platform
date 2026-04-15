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
  style: z.string().max(500).optional(),
  referenceImageUrl: z.string().url().optional(),
});

// Lovable AI image generation fallback
async function generateWithLovableAI(prompt: string, style?: string, referenceImageUrl?: string): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.warn("LOVABLE_API_KEY not set, cannot use Lovable AI fallback");
    return null;
  }

  const fullPrompt = style ? `${prompt}, ${style}` : prompt;
  console.log("Falling back to Lovable AI for image generation:", fullPrompt, referenceImageUrl ? "(with reference)" : "");

  // Build message content — include reference image if provided
  const content: unknown[] = [
    {
      type: "text",
      text: referenceImageUrl
        ? `Generate a high-quality image based on this reference character/subject. The generated image MUST maintain the exact same person/character appearance (face, body proportions, hair, clothing) from the reference photo. Ensure correct human anatomy with natural proportions. Prompt: ${fullPrompt}`
        : `Generate a high-quality image with correct human anatomy and natural proportions: ${fullPrompt}`,
    },
  ];

  if (referenceImageUrl) {
    content.push({
      type: "image_url",
      image_url: { url: referenceImageUrl },
    });
  }

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [{ role: "user", content }],
      modalities: ["image", "text"],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Lovable AI image generation failed:", response.status, errText);
    return null;
  }

  const data = await response.json();
  const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

  if (!imageUrl) {
    console.error("No image returned from Lovable AI");
    return null;
  }

  console.log("Lovable AI image generation successful");
  return imageUrl;
}

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
      prompt: rawPrompt,
      width = 1024,
      height = 1024,
      aspectRatio = "1:1",
      outputFormat = "webp",
      outputQuality = 90,
      numInferenceSteps = 4,
      model: rawModel = "black-forest-labs/flux-schnell",
      style,
      referenceImageUrl,
    } = parseResult.data;

    // Enhance prompt for anatomical correctness when generating character scenes
    const anatomyGuard = "anatomically correct, natural human proportions, realistic body structure";
    const prompt = referenceImageUrl
      ? `${rawPrompt}, consistent character appearance matching reference photo, ${anatomyGuard}`
      : `${rawPrompt}, ${anatomyGuard}`;

    // Map short model aliases to full Replicate model identifiers
    const MODEL_ALIASES: Record<string, string> = {
      "flux": "black-forest-labs/flux-schnell",
      "flux-schnell": "black-forest-labs/flux-schnell",
      "flux-dev": "black-forest-labs/flux-dev",
      "flux-pro": "black-forest-labs/flux-pro",
      "sdxl": "stability-ai/sdxl",
    };
    const model = MODEL_ALIASES[rawModel] || rawModel;

    const REPLICATE_API_KEY = Deno.env.get('REPLICATE_API_KEY');

    // Try Replicate first (if key is available)
    if (REPLICATE_API_KEY) {
      const replicate = new Replicate({ auth: REPLICATE_API_KEY });

      console.log("Generating image with Replicate:", { prompt, aspectRatio, model });

      const MAX_RETRIES = 3;
      let replicateFailed = false;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const output = await replicate.run(model, {
            input: {
              prompt: style ? `${prompt}, ${style}` : prompt,
              go_fast: true,
              megapixels: "1",
              num_outputs: 1,
              aspect_ratio: aspectRatio,
              output_format: outputFormat,
              output_quality: outputQuality,
              num_inference_steps: numInferenceSteps,
              ...(width && height ? { width, height } : {}),
            },
          });

          console.log("Replicate image generation successful");
          return new Response(
            JSON.stringify({
              imageUrl: Array.isArray(output) ? output[0] : output,
              success: true,
              provider: 'replicate',
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        } catch (err: any) {
          const message = err?.message || '';
          const retryMatch = message.match(/retry_after["\s:]+(\d+)/);
          const retryAfter = retryMatch ? parseInt(retryMatch[1], 10) : null;
          const isRateLimit = message.includes('429') || message.includes('Too Many Requests');

          if (isRateLimit && attempt < MAX_RETRIES - 1) {
            const waitSec = retryAfter ? retryAfter + 1 : (attempt + 1) * 10;
            console.log(`Rate limited, waiting ${waitSec}s before retry ${attempt + 2}/${MAX_RETRIES}`);
            await new Promise((resolve) => setTimeout(resolve, waitSec * 1000));
            continue;
          }

          const isUpstreamError = isRateLimit || message.includes('status 5');
          if (isUpstreamError) {
            console.warn("Replicate unavailable, falling back to Lovable AI...");
            replicateFailed = true;
            break;
          }

          throw err;
        }
      }

      // If Replicate failed with rate limit / server error, try Lovable AI fallback
      if (replicateFailed) {
        const lovableImageUrl = await generateWithLovableAI(prompt, style, referenceImageUrl);
        if (lovableImageUrl) {
          return new Response(
            JSON.stringify({ imageUrl: lovableImageUrl, success: true, provider: 'lovable-ai' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }

        // Both providers failed
        return new Response(
          JSON.stringify({
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            fallback: true,
            message: 'Tutti i provider di generazione immagini sono temporaneamente non disponibili.',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    }

    // No Replicate key — try Lovable AI directly
    console.log("No REPLICATE_API_KEY, using Lovable AI directly");
    const lovableImageUrl = await generateWithLovableAI(prompt, style, referenceImageUrl);
    if (lovableImageUrl) {
      return new Response(
        JSON.stringify({ imageUrl: lovableImageUrl, success: true, provider: 'lovable-ai' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'SERVICE_UNAVAILABLE',
        fallback: true,
        message: 'Nessun provider di generazione immagini disponibile.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error("Error in generate-image function:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Failed to generate image" }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
