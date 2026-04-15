import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { script, maxPanels = 12, action = "parse" } = await req.json();

    if (action === "parse") {
      if (!script || typeof script !== "string" || script.length < 10) {
        return new Response(
          JSON.stringify({ error: "Script troppo corto o mancante" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const clampedMax = Math.min(Math.max(maxPanels, 2), 24);

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `You are a professional storyboard artist and cinematographer. Analyze the given screenplay/synopsis and break it into individual shots for a storyboard. For each shot provide detailed visual and cinematic information. Return EXACTLY the JSON structure requested via the tool call. All text must be in Italian.`
            },
            {
              role: "user",
              content: `Analizza questa sceneggiatura/sinossi e dividila in massimo ${clampedMax} inquadrature per uno storyboard professionale:\n\n${script.slice(0, 4000)}`
            }
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "create_storyboard_shots",
                description: "Create storyboard shots from a screenplay",
                parameters: {
                  type: "object",
                  properties: {
                    shots: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          shotNumber: { type: "number", description: "Sequential shot number" },
                          caption: { type: "string", description: "Descrizione breve della scena in italiano (max 80 chars)" },
                          visualDescription: { type: "string", description: "Descrizione visiva dettagliata per la generazione dell'immagine in inglese (soggetto, ambiente, illuminazione, colori)" },
                          cameraAngle: { type: "string", enum: ["wide shot", "medium shot", "close-up", "extreme close-up", "bird's eye", "low angle", "high angle", "over the shoulder", "POV", "dutch angle"] },
                          cameraMovement: { type: "string", enum: ["static", "pan left", "pan right", "tilt up", "tilt down", "dolly in", "dolly out", "tracking", "crane", "handheld"] },
                          lens: { type: "string", enum: ["14mm ultra-wide", "24mm wide", "35mm standard", "50mm normal", "85mm portrait", "135mm telephoto", "200mm+ super telephoto", "macro"] },
                          lighting: { type: "string", description: "Tipo di illuminazione (es. naturale, drammatica, soffusa, controluce, neon)" },
                          mood: { type: "string", description: "Atmosfera/mood della scena" },
                          duration: { type: "number", description: "Durata stimata in secondi (2-10)" },
                          notes: { type: "string", description: "Note di regia o indicazioni aggiuntive in italiano" }
                        },
                        required: ["shotNumber", "caption", "visualDescription", "cameraAngle", "cameraMovement", "lens", "lighting", "mood", "duration"],
                        additionalProperties: false
                      }
                    },
                    title: { type: "string", description: "Titolo suggerito per lo storyboard in italiano" },
                    synopsis: { type: "string", description: "Sinossi breve (1-2 frasi) in italiano" }
                  },
                  required: ["shots", "title", "synopsis"],
                  additionalProperties: false
                }
              }
            }
          ],
          tool_choice: { type: "function", function: { name: "create_storyboard_shots" } }
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Troppi richieste, riprova tra poco" }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Crediti AI esauriti" }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const errText = await response.text();
        console.error("AI gateway error:", response.status, errText);
        throw new Error("AI gateway error");
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) throw new Error("No tool call response");

      const result = JSON.parse(toolCall.function.arguments);

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "generate_sketch") {
      return new Response(JSON.stringify({ error: "Use generate-sketch endpoint" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("script-to-storyboard error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
