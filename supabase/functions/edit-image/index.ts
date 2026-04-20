import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Persist a data: URL to the public `story-references` bucket and return the
 * public URL. If the input is already an http(s) URL, it is returned as-is.
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Auth: required to know which user owns the upload path
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    let userId: string | undefined;
    try {
      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
      if (!claimsError && claimsData?.claims) userId = claimsData.claims.sub as string;
    } catch (_) { /* SDK without getClaims */ }
    if (!userId) {
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData?.user) {
        return new Response(
          JSON.stringify({ error: "Invalid authentication token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      userId = userData.user.id;
    }

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
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: referenceImage } }
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

    let editedImageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!editedImageUrl && data.choices?.[0]?.message?.content) {
      const content = data.choices[0].message.content;
      if (Array.isArray(content)) {
        for (const item of content) {
          if (item.type === 'image_url' || item.type === 'image') {
            editedImageUrl = item.image_url?.url || item.url;
            if (editedImageUrl) break;
          }
        }
      }
    }

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
          aiMessage: typeof assistantText === "string" ? assistantText.slice(0, 400) : null,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Never return raw base64 — always persist to Storage first
    const finalUrl = await persistDataUrlToStorage(editedImageUrl, userId);

    return new Response(
      JSON.stringify({ imageUrl: finalUrl, success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    console.error("Error in edit-image function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to edit image" }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
