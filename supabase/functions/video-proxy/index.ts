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

    // Build fetch headers based on the target URL
    const fetchHeaders: Record<string, string> = {};
    
    // Only add Google API key for Google-hosted URIs
    if (videoUri.includes("generativelanguage.googleapis.com") || videoUri.includes("google")) {
      const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
      if (GOOGLE_AI_API_KEY) {
        fetchHeaders["x-goog-api-key"] = GOOGLE_AI_API_KEY;
      }
    }

    // Forward range header for partial content requests (needed for video seeking)
    const rangeHeader = req.headers.get("Range");
    if (rangeHeader) {
      fetchHeaders["Range"] = rangeHeader;
    }

    const videoResponse = await fetch(videoUri, {
      headers: fetchHeaders,
    });

    if (!videoResponse.ok && videoResponse.status !== 206) {
      throw new Error(`Failed to fetch video: ${videoResponse.status}`);
    }

    // Build response headers
    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
      "Content-Type": videoResponse.headers.get("Content-Type") || "video/mp4",
      "Cache-Control": "public, max-age=31536000",
      "Accept-Ranges": "bytes",
    };

    // Forward content-length if available
    const contentLength = videoResponse.headers.get("Content-Length");
    if (contentLength) {
      responseHeaders["Content-Length"] = contentLength;
    }

    // Forward content-range for partial responses
    const contentRange = videoResponse.headers.get("Content-Range");
    if (contentRange) {
      responseHeaders["Content-Range"] = contentRange;
    }

    return new Response(videoResponse.body, {
      status: videoResponse.status,
      headers: responseHeaders,
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
