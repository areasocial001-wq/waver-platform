import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Convert base64 data URL to Blob for FormData
async function dataURLtoBlob(dataURL: string): Promise<Blob> {
  const response = await fetch(dataURL);
  return response.blob();
}

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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set");
    }

    const { prompt, image, mask } = await req.json();

    if (!prompt || !image) {
      return new Response(
        JSON.stringify({ error: "Prompt and image are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Inpainting image with OpenAI, prompt:", prompt, "has mask:", !!mask);

    // Prepare FormData for OpenAI API
    const formData = new FormData();

    // Convert base64 to blob
    const imageBlob = await dataURLtoBlob(image);
    formData.append("image", imageBlob, "image.png");

    formData.append("prompt", prompt);
    formData.append("model", "gpt-image-1");
    formData.append("size", "1024x1024");

    if (mask) {
      const maskBlob = await dataURLtoBlob(mask);
      formData.append("mask", maskBlob, "mask.png");
    }

    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);

      let errorMessage = `OpenAI error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorMessage;
      } catch { /* keep default */ }

      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("OpenAI response received, data length:", data.data?.length);

    const imageData = data.data?.[0];
    if (!imageData) {
      throw new Error("No image returned from OpenAI");
    }

    let imageUrl: string;
    if (imageData.b64_json) {
      imageUrl = `data:image/png;base64,${imageData.b64_json}`;
    } else if (imageData.url) {
      imageUrl = imageData.url;
    } else {
      throw new Error("Unexpected response format from OpenAI");
    }

    // Never return raw base64 — always persist to Storage first
    const finalUrl = await persistDataUrlToStorage(imageUrl, userId);

    return new Response(
      JSON.stringify({ imageUrl: finalUrl, success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("Error in inpaint-image function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to inpaint image" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
