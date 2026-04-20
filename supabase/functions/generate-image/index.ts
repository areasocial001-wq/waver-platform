import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Replicate from "https://esm.sh/replicate@0.25.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * If the given URL is a data:image/...;base64,... URL, decode it, upload to
 * the public `story-references` bucket under generated/{userId}/...
 * and return the public URL. Otherwise return the URL unchanged.
 *
 * This guarantees the database NEVER stores giant inline base64 blobs.
 */
async function persistDataUrlToStorage(
  imageUrl: string,
  userId: string,
): Promise<string> {
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
    if (!serviceKey || !supabaseUrl) {
      console.warn("Missing service role / url, returning data URL as-is");
      return imageUrl;
    }
    const admin = createClient(supabaseUrl, serviceKey);
    const binary = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const { error: upErr } = await admin.storage
      .from("story-references")
      .upload(fileName, binary, { contentType: mime, upsert: false });
    if (upErr) {
      console.error("Storage upload failed, returning data URL:", upErr.message);
      return imageUrl;
    }
    const { data: pub } = admin.storage
      .from("story-references")
      .getPublicUrl(fileName);
    return pub?.publicUrl || imageUrl;
  } catch (err) {
    console.error("persistDataUrlToStorage error:", err);
    return imageUrl;
  }
}

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
  characterFidelity: z.enum(['low', 'medium', 'high']).optional(),
});

// Map aspect ratio string to a textual orientation hint for models that don't accept aspect_ratio natively
function aspectRatioInstruction(aspectRatio?: string): string {
  switch (aspectRatio) {
    case "9:16":
      return "CRITICAL OUTPUT FORMAT: vertical portrait orientation, aspect ratio exactly 9:16 (1080x1920), full vertical frame composition, NEVER horizontal, NEVER landscape, NEVER 16:9. Frame the subject vertically.";
    case "16:9":
      return "CRITICAL OUTPUT FORMAT: horizontal landscape orientation, aspect ratio exactly 16:9 (1920x1080), wide cinematic frame.";
    case "4:3":
      return "CRITICAL OUTPUT FORMAT: classic 4:3 aspect ratio, slightly horizontal frame.";
    case "1:1":
      return "CRITICAL OUTPUT FORMAT: square 1:1 aspect ratio.";
    default:
      return "";
  }
}

// Lovable AI image generation fallback
async function generateWithLovableAI(
  prompt: string,
  style?: string,
  referenceImageUrl?: string,
  aspectRatio?: string,
): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.warn("LOVABLE_API_KEY not set, cannot use Lovable AI fallback");
    return null;
  }

  const aspectHint = aspectRatioInstruction(aspectRatio);
  const fullPrompt = style ? `${prompt}, ${style}` : prompt;
  console.log("Using Lovable AI for image generation:", fullPrompt.substring(0, 200), referenceImageUrl ? "(with reference)" : "", "aspectRatio:", aspectRatio);

  // Build message content — include reference image if provided
  const content: unknown[] = [];

  if (referenceImageUrl) {
    content.push({
      type: "text",
      text: `${aspectHint}\n\nYou are a character-consistent image generator. Study the reference photo carefully. The generated image MUST depict the EXACT SAME person/character from the reference: same face shape, same eyes, same nose, same mouth, same skin tone, same hair color/style/length, same body build. Do NOT change their appearance. Do NOT switch art styles unless explicitly asked. Ensure anatomically correct human body: correct hands with 5 fingers, correct feet with 5 toes, natural joint positions, proper limb proportions. NEVER generate deformed, extra, or missing body parts. ${aspectHint}\n\nScene to generate: ${fullPrompt}`,
    });
    content.push({
      type: "image_url",
      image_url: { url: referenceImageUrl },
    });
  } else {
    content.push({
      type: "text",
      text: `${aspectHint}\n\nGenerate a high-quality image. Ensure anatomically correct human body: correct hands with 5 fingers, correct feet with 5 toes, natural proportions, no deformities. ${aspectHint}\n\n${fullPrompt}`,
    });
  }

  // Use the pro image model for better quality with reference images
  const imageModel = referenceImageUrl ? "google/gemini-3-pro-image-preview" : "google/gemini-2.5-flash-image";

  // Retry helper for transient AI Gateway errors (502/503/504)
  const MAX_ATTEMPTS = 3;
  let response: Response | null = null;
  let rawText = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: imageModel,
        messages: [{ role: "user", content }],
        modalities: ["image", "text"],
      }),
    });
    rawText = await response.text();

    if (response.ok) break;
    if (![502, 503, 504].includes(response.status) || attempt === MAX_ATTEMPTS) break;

    const waitMs = attempt * 2000;
    console.warn(`[generate-image] Lovable AI ${response.status} attempt ${attempt}/${MAX_ATTEMPTS}, retrying in ${waitMs}ms`);
    await new Promise((res) => setTimeout(res, waitMs));
  }

  if (!response || !response.ok) {
    console.error("Lovable AI image generation failed after retries:", response?.status, rawText.slice(0, 500));
    return null;
  }

  if (!rawText || rawText.trim().length === 0) {
    console.error("Lovable AI returned empty response body (status:", response.status, ")");
    return null;
  }

  let data: any;
  try {
    data = JSON.parse(rawText);
  } catch (_parseErr) {
    console.error("Lovable AI returned non-JSON response:", rawText.slice(0, 500));
    return null;
  }

  const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

  if (!imageUrl) {
    console.error("No image returned from Lovable AI. Response:", JSON.stringify(data).slice(0, 500));
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
        console.error('JWT validation failed:', userError);
        return new Response(
          JSON.stringify({ error: 'Invalid authentication token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      userId = userData.user.id;
    }
    let body: any;
    try {
      body = await req.json();
    } catch (_e) {
      return new Response(JSON.stringify({ error: 'Invalid or empty JSON body' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
      width,
      height,
      aspectRatio = "1:1",
      outputFormat = "webp",
      outputQuality = 90,
      numInferenceSteps = 4,
      model: rawModel = "black-forest-labs/flux-schnell",
      style,
      referenceImageUrl,
      characterFidelity = 'medium',
    } = parseResult.data;

    // Build fidelity-aware prompt enhancement
    const fidelityInstructions: Record<string, string> = {
      low: "loosely inspired by the reference subject",
      medium: "consistent character appearance matching reference photo, same face and body type, same clothing",
      high: "exact same person as the reference photo, identical face features, identical hair color and style, identical body proportions, identical clothing, photorealistic consistency",
    };
    const anatomyGuard = "anatomically correct human anatomy, natural proportions, correct number of fingers and toes, realistic feet with five toes each, no deformed limbs, no extra appendages, no distorted body parts";
    const styleConsistency = style ? `IMPORTANT: maintain this exact visual style throughout: ${style}. Do NOT mix styles.` : "";
    const prompt = referenceImageUrl
      ? `${rawPrompt}, ${fidelityInstructions[characterFidelity]}, ${anatomyGuard}. ${styleConsistency}`
      : `${rawPrompt}, ${anatomyGuard}. ${styleConsistency}`;

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

    // When a reference image is provided, SKIP Replicate (it doesn't support reference images)
    // and go directly to Lovable AI which supports multimodal input
    if (referenceImageUrl) {
      console.log("Reference image provided — using Lovable AI for character-consistent generation");
      const lovableImageUrl = await generateWithLovableAI(prompt, style, referenceImageUrl, aspectRatio);
      if (lovableImageUrl) {
        const finalUrl = await persistDataUrlToStorage(lovableImageUrl, userId);
        return new Response(
          JSON.stringify({ imageUrl: finalUrl, success: true, provider: 'lovable-ai' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: 'SERVICE_UNAVAILABLE', fallback: true, message: 'Generazione con riferimento non disponibile.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Try Replicate first (if key is available, and no reference image)
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
          const replicateUrl = Array.isArray(output) ? output[0] : output;
          const finalUrl = await persistDataUrlToStorage(replicateUrl as string, userId);
          return new Response(
            JSON.stringify({
              imageUrl: finalUrl,
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
        const lovableImageUrl = await generateWithLovableAI(prompt, style, referenceImageUrl, aspectRatio);
        if (lovableImageUrl) {
          const finalUrl = await persistDataUrlToStorage(lovableImageUrl, userId);
          return new Response(
            JSON.stringify({ imageUrl: finalUrl, success: true, provider: 'lovable-ai' }),
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
    const lovableImageUrl = await generateWithLovableAI(prompt, style, referenceImageUrl, aspectRatio);
    if (lovableImageUrl) {
      const finalUrl = await persistDataUrlToStorage(lovableImageUrl, userId);
      return new Response(
        JSON.stringify({ imageUrl: finalUrl, success: true, provider: 'lovable-ai' }),
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
