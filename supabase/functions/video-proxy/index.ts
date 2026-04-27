import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Allowed domains for proxying
// NOTA: generativelanguage.googleapis.com rimosso (Veo nativo disabilitato per costi).
const ALLOWED_DOMAINS = [
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

// HMAC-SHA256 signing for unauthenticated access (used by Shotstack to download videos)
const SIGNING_SECRET = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

async function verifySignedToken(uri: string, expStr: string, token: string): Promise<boolean> {
  if (!SIGNING_SECRET || !uri || !expStr || !token) return false;
  const exp = parseInt(expStr, 10);
  if (!Number.isFinite(exp) || Date.now() / 1000 > exp) return false;
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(SIGNING_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const msg = `${uri}|${exp}`;
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
    const expected = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    // Constant-time-ish compare
    if (expected.length !== token.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
    return diff === 0;
  } catch (e) {
    console.error("Signature verification failed:", e);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const videoUri = url.searchParams.get("uri");
    const expStr = url.searchParams.get("exp");
    const sigToken = url.searchParams.get("token");

    // Path 1: signed token (no JWT required) — used by external services like Shotstack
    let userId: string | undefined;
    const hasValidSignature = !!videoUri && !!expStr && !!sigToken &&
      (await verifySignedToken(videoUri, expStr, sigToken));

    if (!hasValidSignature) {
      // Path 2: standard JWT auth
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
    }
    // videoUri already parsed at the top of the handler
    if (!videoUri) {
      return new Response("Missing video URI", {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Google AI (Veo nativo) DISABILITATO per controllo costi.
    // Intercettiamo PRIMA dell'allowlist per restituire una risposta gestibile dal client
    // (status 200 + VIDEO_EXPIRED) invece di un 403 che genera schermata bianca.
    let parsedUri: URL;
    try {
      parsedUri = new URL(videoUri);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid URI" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (parsedUri.hostname === "generativelanguage.googleapis.com") {
      console.warn("Blocked legacy Google Veo URL:", videoUri.slice(0, 120));
      return new Response(
        JSON.stringify({
          error: "VIDEO_EXPIRED",
          fallback: true,
          upstreamStatus: 410,
          message: "Questo video era stato generato con Google Veo (ora disabilitato). Rigeneralo con un altro provider (Luma, Kling, Vidu, LTX).",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
