import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const FORMAT_PROMPTS: Record<string, string> = {
  json2video: `You are a JSON2Video template generator. Convert the user's natural language description into a valid JSON2Video project structure.

The output MUST be a valid JSON object with this structure:
{
  "resolution": "full-hd" | "sd" | "hd",
  "scenes": [
    {
      "comment": "Scene description",
      "elements": [
        {
          "type": "video" | "image" | "text" | "audio" | "component",
          "src": "URL or placeholder",
          "duration": number_in_seconds,
          ... other element-specific properties
        }
      ],
      "duration": number_in_seconds
    }
  ],
  "settings": {
    "transition": { "style": "fade" | "slide" | "wipe", "duration": 0.5 }
  }
}

Include realistic placeholder URLs where media is needed. Add comments to each scene.`,

  storyboard: `You are a storyboard JSON generator. Convert the user's natural language story/script into a structured storyboard JSON.

The output MUST be a valid JSON object with this structure:
{
  "title": "Story title",
  "template_type": "custom",
  "layout": "grid",
  "panels": [
    {
      "id": "panel-1",
      "title": "Scene title",
      "description": "Visual description for AI video generation",
      "prompt": "Detailed prompt for video/image generation",
      "dialogueText": "Character dialogue if any",
      "duration": number_in_seconds,
      "cameraMovement": "pan-left" | "zoom-in" | "static" | "dolly" | etc,
      "audioType": "music" | "sfx" | "voiceover" | "none",
      "audioPrompt": "Audio description if needed"
    }
  ],
  "tags": ["tag1", "tag2"]
}

Create detailed visual prompts optimized for AI video generation. Include camera movements and audio suggestions.`,

  generic: `You are a JSON structure generator. Convert the user's natural language description into a well-structured JSON object.

Analyze the text and create the most appropriate JSON structure. Use clear, descriptive keys in camelCase. Nest objects logically. Use arrays for lists. Include appropriate data types (string, number, boolean, array, object).

Return ONLY valid JSON, no markdown, no explanations.`
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, format = 'generic', language = 'it' } = await req.json();

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Il testo è obbligatorio' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (text.length > 10000) {
      return new Response(
        JSON.stringify({ error: 'Il testo non può superare 10.000 caratteri' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = FORMAT_PROMPTS[format] || FORMAT_PROMPTS.generic;

    const userPrompt = `Convert the following text to JSON. The input language is ${language}, but all JSON keys must be in English. Values can stay in the original language where appropriate (e.g. dialogue, descriptions).

Text:
${text}

Return ONLY the JSON object, no markdown code blocks, no explanations.`;

    console.log(`NL-to-JSON conversion: format=${format}, length=${text.length}`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 4000,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite richieste superato. Riprova tra poco.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Crediti esauriti. Aggiungi crediti al workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error('Errore nella conversione');
    }

    const data = await response.json();
    let rawContent = data.choices?.[0]?.message?.content?.trim() || '';

    // Strip markdown code blocks if present
    rawContent = rawContent.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');

    // Validate JSON
    let parsedJson;
    try {
      parsedJson = JSON.parse(rawContent);
    } catch {
      console.error("Invalid JSON from AI:", rawContent.substring(0, 200));
      return new Response(
        JSON.stringify({ error: 'La risposta AI non è un JSON valido. Riprova con una descrizione più chiara.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ json: parsedJson, rawText: text, format }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error("Error in nl-to-json:", error);
    const errorMessage = error instanceof Error ? error.message : "Errore sconosciuto";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
