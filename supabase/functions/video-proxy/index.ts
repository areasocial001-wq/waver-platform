import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) {
      throw new Error("GOOGLE_AI_API_KEY is not set");
    }

    // Get video URI from query params
    const url = new URL(req.url);
    const videoUri = url.searchParams.get("uri");
    
    if (!videoUri) {
      return new Response("Missing video URI", {
        status: 400,
        headers: corsHeaders,
      });
    }

    console.log("Proxying video from:", videoUri);

    // Fetch video from Google with API key
    const videoResponse = await fetch(videoUri, {
      headers: {
        "x-goog-api-key": GOOGLE_AI_API_KEY,
      },
    });

    if (!videoResponse.ok) {
      throw new Error(`Failed to fetch video: ${videoResponse.status}`);
    }

    // Stream the video response back to client
    return new Response(videoResponse.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "video/mp4",
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (error) {
    console.error("Error in video-proxy function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }), 
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
