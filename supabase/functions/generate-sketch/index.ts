import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { visualDescription, cameraAngle, lighting, mood, lens } = await req.json();

    if (!visualDescription) {
      return new Response(
        JSON.stringify({ error: "visualDescription is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sketchPrompt = `Create a rough pencil sketch / storyboard frame drawing in black and white with light shading. The style should look like a hand-drawn production storyboard used in film pre-production. Camera angle: ${cameraAngle || 'medium shot'}. Lens: ${lens || '35mm'}. Lighting: ${lighting || 'natural'}. Mood: ${mood || 'neutral'}. Scene: ${visualDescription}. Draw it as a single storyboard frame with clean pencil lines, minimal detail, focusing on composition and subject placement. No color, just graphite pencil on white paper style.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: sketchPrompt }],
        modalities: ["image", "text"]
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit, riprova tra poco" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crediti AI esauriti" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("Image generation error:", response.status, errText);
      throw new Error(`Image generation failed: ${response.status}`);
    }

    const data = await response.json();
    const rawImageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!rawImageUrl) {
      throw new Error("No image generated");
    }

    // Persist data URLs to Storage so we never store base64 inline downstream
    const imageUrl = await persistDataUrlToStorage(rawImageUrl, userId);

    return new Response(JSON.stringify({ imageUrl, success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-sketch error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
