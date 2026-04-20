import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Allowed domains for proxying
const ALLOWED_DOMAINS = [
  "generativelanguage.googleapis.com",
  "storage.googleapis.com",
  "lh3.googleusercontent.com",
  "replicate.delivery",
  "pbxt.replicate.delivery",
  "api.lumalabs.ai",
  "storage.cdn-luma.com",
  "cdn-luma.com",
  "api.piapi.ai",
  "cdn.piapi.ai",
  "api.freepik.com",
  "img.freepik.com",
  "video-generation.freepik.com",
  "dashscope-result.oss-cn-beijing.aliyuncs.com",
  "viduai.com",
  "cdn.viduai.com",
  "gqzxlwzcxrokzforwgeu.supabase.co",
];

function isAllowedUrl(uri: string): boolean {
  try {
    const url = new URL(uri);
    // Block private/internal IPs
    const hostname = url.hostname;
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "0.0.0.0" ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("169.254.") ||
      hostname.startsWith("172.") ||
      hostname === "metadata.google.internal" ||
      hostname.endsWith(".internal")
    ) {
      return false;
    }
    // Block non-HTTPS
    if (url.protocol !== "https:") {
      return false;
    }
    // Check against allowlist
    return ALLOWED_DOMAINS.some(domain => hostname === domain || hostname.endsWith("." + domain));
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
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
    // Get video URI from query params
    const url = new URL(req.url);
    const videoUri = url.searchParams.get("uri");
    
    if (!videoUri) {
      return new Response("Missing video URI", {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Validate URL against allowlist
    if (!isAllowedUrl(videoUri)) {
      return new Response(JSON.stringify({ error: "URL not allowed" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Proxying video from:", videoUri);

    // Build fetch headers based on the target URL
    const fetchHeaders: Record<string, string> = {};
    
    // Only add Google API key for verified Google-hosted URIs
    const parsedUri = new URL(videoUri);
    if (
      parsedUri.hostname === "generativelanguage.googleapis.com" ||
      parsedUri.hostname === "storage.googleapis.com"
    ) {
      const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
      if (GOOGLE_AI_API_KEY) {
        fetchHeaders["x-goog-api-key"] = GOOGLE_AI_API_KEY;
      }
    }

    // Forward range header for partial content requests
    const rangeHeader = req.headers.get("Range");
    if (rangeHeader) {
      fetchHeaders["Range"] = rangeHeader;
    }

    const videoResponse = await fetch(videoUri, {
      headers: fetchHeaders,
    });

    if (!videoResponse.ok && videoResponse.status !== 206) {
      const errorText = await videoResponse.text().catch(() => "");
      console.error("Upstream fetch failed:", videoResponse.status, errorText.slice(0, 200));
      // Expired/forbidden source URI (common for Google generative video files after TTL)
      const isExpired = videoResponse.status === 403 || videoResponse.status === 404 || videoResponse.status === 410;
      return new Response(
        JSON.stringify({
          error: isExpired ? "VIDEO_EXPIRED" : "UPSTREAM_ERROR",
          fallback: true,
          upstreamStatus: videoResponse.status,
          message: isExpired
            ? "The source video URL has expired. Please regenerate the video."
            : `Upstream returned ${videoResponse.status}`,
        }),
        {
          // Return 200 so client SDK can read the JSON body instead of throwing
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Build response headers
    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
      "Content-Type": videoResponse.headers.get("Content-Type") || "video/mp4",
      "Cache-Control": "public, max-age=31536000",
      "Accept-Ranges": "bytes",
    };

    const contentLength = videoResponse.headers.get("Content-Length");
    if (contentLength) {
      responseHeaders["Content-Length"] = contentLength;
    }

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
    return new Response(
      JSON.stringify({
        error: "PROXY_ERROR",
        fallback: true,
        message: (error as Error)?.message || "Proxy error",
      }),
      {
        // Return 200 so client can parse the JSON instead of crashing on a 500
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  }
});
