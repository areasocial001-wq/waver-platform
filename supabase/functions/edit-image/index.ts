import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not set');
    }

    const { prompt, referenceImage } = await req.json();

    if (!prompt || !referenceImage) {
      return new Response(
        JSON.stringify({ error: 'Prompt and reference image are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Editing image with Lovable AI, prompt:", prompt);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt
              },
              {
                type: "image_url",
                image_url: {
                  url: referenceImage
                }
              }
            ]
          }
        ],
        modalities: ["image", "text"]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lovable AI error:", errorText);
      throw new Error(`Lovable AI error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("Lovable AI response structure:", JSON.stringify({
      hasChoices: !!data.choices,
      choicesLength: data.choices?.length,
      hasMessage: !!data.choices?.[0]?.message,
      hasImages: !!data.choices?.[0]?.message?.images,
      imagesLength: data.choices?.[0]?.message?.images?.length,
      messageContent: data.choices?.[0]?.message?.content?.substring?.(0, 200),
    }));

    // Try multiple possible image locations in the response
    let editedImageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    // Alternative: check if image is directly in content
    if (!editedImageUrl && data.choices?.[0]?.message?.content) {
      const content = data.choices[0].message.content;
      // Check if content is an array with image objects
      if (Array.isArray(content)) {
        for (const item of content) {
          if (item.type === 'image_url' || item.type === 'image') {
            editedImageUrl = item.image_url?.url || item.url;
            if (editedImageUrl) break;
          }
        }
      }
    }

    // Alternative: check for base64 in response
    if (!editedImageUrl && data.choices?.[0]?.message?.images?.[0]) {
      const imageObj = data.choices[0].message.images[0];
      if (typeof imageObj === 'string' && imageObj.startsWith('data:')) {
        editedImageUrl = imageObj;
      } else if (imageObj.url) {
        editedImageUrl = imageObj.url;
      }
    }

    if (!editedImageUrl) {
      const assistantText = data.choices?.[0]?.message?.content;
      console.error("Full response data:", JSON.stringify(data).substring(0, 2000));

      // Common case: model refuses watermark removal and answers with text only
      const looksLikeWatermarkRefusal =
        typeof assistantText === "string" &&
        /watermark/i.test(assistantText) &&
        /(cannot|can't|unable|won't|refuse)/i.test(assistantText);

      const errorMessage = looksLikeWatermarkRefusal
        ? "The AI cannot remove watermarks. Try removing only subtitles/text overlays, or use an unwatermarked source."
        : "No image returned from AI (the model replied with text only).";

      return new Response(
        JSON.stringify({
          error: errorMessage,
          // Small excerpt for debugging / UX
          aiMessage: typeof assistantText === "string" ? assistantText.slice(0, 400) : null,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ 
        imageUrl: editedImageUrl,
        success: true 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in edit-image function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Failed to edit image" 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
