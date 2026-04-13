const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { input, style } = await req.json();

    if (!input || typeof input !== "string" || input.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Input (URL or text) is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (input.trim().length > 10000) {
      return new Response(
        JSON.stringify({ error: "Input too long (max 10000 chars)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine if input is a URL
    const isUrl = /^https?:\/\//i.test(input.trim());
    let articleText = input.trim();

    // If URL, try to fetch the content
    if (isUrl) {
      try {
        const fetchRes = await fetch(input.trim(), {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; WaverBot/1.0)" },
        });
        if (fetchRes.ok) {
          const html = await fetchRes.text();
          // Simple HTML to text extraction
          articleText = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 8000);
        }
      } catch (fetchErr) {
        console.error("Failed to fetch URL:", fetchErr);
        // Fall back to using the URL as-is in the prompt
      }
    }

    const systemPrompt = `You are a professional video script writer. Given an article or text, create a concise, engaging video script suitable for a short-form video (60-90 seconds). 

The script should:
- Have a strong hook in the first 5 seconds
- Be structured in 4-6 scenes with clear visual descriptions
- Include suggested camera movements and transitions
- Be written in the same language as the original article
- Adapt the tone to the visual style: ${style || "animation"}

Return ONLY the video script, formatted with scene markers like [SCENE 1], [SCENE 2], etc.`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Trasforma il seguente contenuto in uno script video:\n\n${articleText}`,
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content || "";

    return new Response(
      JSON.stringify({ summary, style }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("article-to-video error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
