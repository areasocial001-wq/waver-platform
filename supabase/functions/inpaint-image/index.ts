import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Convert base64 data URL to Blob for FormData
async function dataURLtoBlob(dataURL: string): Promise<Blob> {
  const response = await fetch(dataURL);
  return response.blob();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // If mask is provided, add it
    if (mask) {
      const maskBlob = await dataURLtoBlob(mask);
      formData.append("mask", maskBlob, "mask.png");
    }

    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      
      // Parse error for user-friendly message
      let errorMessage = `OpenAI error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorMessage;
      } catch {
        // Keep default error message
      }
      
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("OpenAI response received, data length:", data.data?.length);

    // gpt-image-1 returns base64 directly
    const imageData = data.data?.[0];
    if (!imageData) {
      throw new Error("No image returned from OpenAI");
    }

    // Handle both URL and base64 responses
    let imageUrl: string;
    if (imageData.b64_json) {
      imageUrl = `data:image/png;base64,${imageData.b64_json}`;
    } else if (imageData.url) {
      imageUrl = imageData.url;
    } else {
      throw new Error("Unexpected response format from OpenAI");
    }

    return new Response(
      JSON.stringify({ 
        imageUrl,
        success: true 
      }),
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
