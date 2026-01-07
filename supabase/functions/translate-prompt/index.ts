import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, dialogueText, title, targetLanguage = 'en' } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log("Translating prompt to English:", prompt.substring(0, 100) + "...");
    if (dialogueText) {
      console.log("Keeping dialogue in original language:", dialogueText.substring(0, 50) + "...");
    }
    if (title) {
      console.log("Preserving title:", title);
    }

    // Use Lovable AI to translate the visual description to English
    // while preserving any dialogue in the original language AND titles/labels
    let systemPrompt = `You are a professional translator specialized in video production prompts.
Your task is to translate the visual/scene description to English for better AI video generation.

IMPORTANT RULES:
1. Translate ONLY the visual descriptions, camera movements, and scene settings to English
2. DO NOT translate any dialogue or spoken text (marked with Dialogue:, SFX:, Ambient:, or in quotes)
3. DO NOT translate titles, scene labels, or panel names (like "Scena 1:", "Scene 1:", "Pannello 1:", "Title:", etc.)
4. Keep technical terms consistent with video production terminology
5. Preserve the exact structure and formatting of the prompt
6. If the prompt contains dialogue, keep it in the ORIGINAL language exactly as provided
7. Return ONLY the translated prompt, no explanations`;

    // Add explicit title preservation if provided
    if (title) {
      systemPrompt += `\n8. CRITICAL: The following title MUST be preserved EXACTLY as written, do NOT translate it: "${title}"`;
    }

    systemPrompt += `

Examples:
Input: "Slow dolly in shot, Una città futuristica di notte con luci al neon. Dialogue: \"Benvenuto nel futuro\""
Output: "Slow dolly in shot, A futuristic city at night with neon lights. Dialogue: \"Benvenuto nel futuro\""

Input: "Scena 1: Il risveglio - Close-up shot, Un uomo si sveglia in una stanza buia"
Output: "Scena 1: Il risveglio - Close-up shot, A man wakes up in a dark room"

Input: "Title: La notte dei ricordi - Wide shot, Una piazza illuminata dalla luna"  
Output: "Title: La notte dei ricordi - Wide shot, A moonlit square"`;

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
          { role: "user", content: prompt }
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Translation API error:", response.status, errorText);
      // Return original prompt if translation fails
      return new Response(
        JSON.stringify({ 
          translatedPrompt: prompt,
          wasTranslated: false,
          error: "Translation failed, using original prompt"
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const translatedPrompt = data.choices?.[0]?.message?.content?.trim() || prompt;

    console.log("Translation complete:", translatedPrompt.substring(0, 100) + "...");

    return new Response(
      JSON.stringify({ 
        translatedPrompt,
        originalPrompt: prompt,
        wasTranslated: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error("Error in translate-prompt function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
