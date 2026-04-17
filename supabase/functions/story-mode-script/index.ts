import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
    const { description, style, stylePromptModifier, numScenes, language } = await req.json();

    if (!description || !style) {
      return new Response(
        JSON.stringify({ error: "description and style are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const scenes = numScenes || 8;
    const lang = language || "it";

    const systemPrompt = `You are a professional screenwriter and visual storyteller. You create compelling short-form video scripts optimized for AI video generation.

Your task is to generate a structured script for a ${scenes}-scene short video (total ~60-80 seconds).

Rules:
- Each scene should be 6-10 seconds long
- Write narration text in ${lang === "it" ? "Italian" : lang === "en" ? "English" : lang}
- Image prompts must be in English and highly descriptive for AI image generation
- Apply the visual style "${style}" consistently: ${stylePromptModifier || ""}
- Create a compelling narrative arc: hook → development → climax → resolution
- Each scene should flow naturally into the next
- Include camera movement suggestions for dynamic video generation
- Narration should be concise and impactful (max 2 sentences per scene)`;

    const userPrompt = `Create a ${scenes}-scene video script based on this description:

"${description}"

Visual style to apply: ${style} (${stylePromptModifier || ""})

Generate a complete script with title, scenes, and metadata.`;

    // Build the AI Gateway request payload (reused for primary + fallback model)
    const buildPayload = (model: string) => ({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "generate_story_script",
            description: "Generate a structured story script for video production",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string", description: "Creative title for the video" },
                synopsis: { type: "string", description: "One-paragraph synopsis of the story" },
                scenes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      sceneNumber: { type: "number" },
                      duration: { type: "number", description: "Duration in seconds (6-10)" },
                      narration: { type: "string", description: "Voiceover narration text for this scene" },
                      imagePrompt: { type: "string", description: "Detailed English prompt for AI image generation, including style modifiers" },
                      cameraMovement: {
                        type: "string",
                        enum: ["static", "slow_zoom_in", "slow_zoom_out", "pan_left", "pan_right", "tilt_up", "tilt_down", "dolly_forward"],
                        description: "Camera movement for video generation",
                      },
                      mood: { type: "string", description: "Emotional tone of this scene" },
                    },
                    required: ["sceneNumber", "duration", "narration", "imagePrompt", "cameraMovement", "mood"],
                    additionalProperties: false,
                  },
                },
                suggestedMusic: { type: "string", description: "Description of background music mood/style" },
              },
              required: ["title", "synopsis", "scenes", "suggestedMusic"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "generate_story_script" } },
    });

    // Retry a single model on transient 5xx with backoff
    const callModel = async (model: string): Promise<Response> => {
      const MAX_ATTEMPTS = 3;
      let lastResponse: Response | null = null;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(buildPayload(model)),
        });
        lastResponse = r;
        if (r.ok || ![502, 503, 504].includes(r.status)) return r;
        const waitMs = attempt * 2000;
        console.warn(`[story-mode-script] ${model} ${r.status} attempt ${attempt}/${MAX_ATTEMPTS}, retrying in ${waitMs}ms`);
        await new Promise((res) => setTimeout(res, waitMs));
      }
      return lastResponse!;
    };

    // Try primary (Gemini), fallback to OpenAI on persistent 5xx
    const callAIGateway = async (): Promise<Response> => {
      const primary = await callModel("google/gemini-3-flash-preview");
      if (primary.ok || ![502, 503, 504].includes(primary.status)) return primary;
      console.warn("[story-mode-script] Gemini unavailable, falling back to openai/gpt-5-mini");
      const fallback = await callModel("openai/gpt-5-mini");
      return fallback.ok ? fallback : primary;
    };

    const response = await callAIGateway();

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later.", retryable: true }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // 5xx upstream → return 200 with structured error so the client can show a friendly message and offer retry
      if (response.status >= 500) {
        return new Response(
          JSON.stringify({
            error: "AI_SERVICE_UNAVAILABLE",
            message: "Il servizio AI è temporaneamente non disponibile (Gemini sovraccarico). Riprova tra qualche istante.",
            fallback: true,
            retryable: true,
            upstreamStatus: response.status,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("No structured output received from AI");
    }

    const script = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(script), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("story-mode-script error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
