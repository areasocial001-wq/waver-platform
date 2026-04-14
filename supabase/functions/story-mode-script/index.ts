import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
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
                  title: {
                    type: "string",
                    description: "Creative title for the video",
                  },
                  synopsis: {
                    type: "string",
                    description: "One-paragraph synopsis of the story",
                  },
                  scenes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        sceneNumber: { type: "number" },
                        duration: {
                          type: "number",
                          description: "Duration in seconds (6-10)",
                        },
                        narration: {
                          type: "string",
                          description: "Voiceover narration text for this scene",
                        },
                        imagePrompt: {
                          type: "string",
                          description:
                            "Detailed English prompt for AI image generation, including style modifiers",
                        },
                        cameraMovement: {
                          type: "string",
                          enum: [
                            "static",
                            "slow_zoom_in",
                            "slow_zoom_out",
                            "pan_left",
                            "pan_right",
                            "tilt_up",
                            "tilt_down",
                            "dolly_forward",
                          ],
                          description: "Camera movement for video generation",
                        },
                        mood: {
                          type: "string",
                          description: "Emotional tone of this scene",
                        },
                      },
                      required: [
                        "sceneNumber",
                        "duration",
                        "narration",
                        "imagePrompt",
                        "cameraMovement",
                        "mood",
                      ],
                      additionalProperties: false,
                    },
                  },
                  suggestedMusic: {
                    type: "string",
                    description: "Description of background music mood/style",
                  },
                },
                required: ["title", "synopsis", "scenes", "suggestedMusic"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: {
          type: "function",
          function: { name: "generate_story_script" },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
