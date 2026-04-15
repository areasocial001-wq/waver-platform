import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LUMA_API_URL = "https://api.lumalabs.ai/dream-machine/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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
    const LUMA_API_KEY = Deno.env.get("LUMA_API_KEY");
    if (!LUMA_API_KEY) {
      return new Response(JSON.stringify({ error: "LUMA_API_KEY is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    console.log("[Luma Video] Request:", JSON.stringify(body));

    // Health check
    if (body.healthCheck) {
      return new Response(JSON.stringify({ status: "ok", service: "luma-video" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Polling
    if (body.generationId) {
      const pollRes = await fetch(`${LUMA_API_URL}/generations/video/${body.generationId}`, {
        headers: {
          "Authorization": `Bearer ${LUMA_API_KEY}`,
          "Accept": "application/json",
        },
      });

      if (!pollRes.ok) {
        const err = await pollRes.text();
        console.error("[Luma Video] Poll error:", pollRes.status, err);
        return new Response(JSON.stringify({ error: `Luma API error: ${pollRes.status}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const pollData = await pollRes.json();
      console.log("[Luma Video] Poll result:", JSON.stringify(pollData));

      if (pollData.state === "completed") {
        const videoUrl = pollData.assets?.video || pollData.video?.url;
        return new Response(JSON.stringify({
          status: "completed",
          videoUrl,
          thumbnail: pollData.assets?.thumbnail,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else if (pollData.state === "failed") {
        return new Response(JSON.stringify({
          status: "failed",
          error: pollData.failure_reason || "Generation failed",
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        return new Response(JSON.stringify({
          status: "processing",
          state: pollData.state,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Create generation
    const {
      prompt,
      model = "ray-2",
      aspect_ratio = "16:9",
      loop = false,
      duration = "5s",
      resolution = "720p",
      // Keyframe support
      keyframes,
      // Extend support
      extend_id,
      reverse_extend = false,
      // Camera control (embedded in prompt)
    } = body;

    // Build request payload
    const payload: Record<string, unknown> = {
      prompt,
      model,
      aspect_ratio,
      loop,
      duration,
      resolution,
    };

    // Keyframes: start/end frame images
    if (keyframes) {
      payload.keyframes = {};
      if (keyframes.frame0) {
        (payload.keyframes as Record<string, unknown>).frame0 = {
          type: "image",
          url: keyframes.frame0,
        };
      }
      if (keyframes.frame1) {
        (payload.keyframes as Record<string, unknown>).frame1 = {
          type: "image",
          url: keyframes.frame1,
        };
      }
    }

    // Extend: extend an existing generation
    let endpoint = `${LUMA_API_URL}/generations/video`;
    if (extend_id) {
      payload.generation_type = "extend";
      (payload.keyframes as Record<string, unknown>) = {
        ...(payload.keyframes || {}),
        frame0: {
          type: "generation",
          id: extend_id,
        },
      };
      if (reverse_extend) {
        // Reverse extend: extend backwards
        const kf = payload.keyframes as Record<string, unknown>;
        kf.frame1 = kf.frame0;
        delete kf.frame0;
      }
    }

    console.log("[Luma Video] Creating generation:", JSON.stringify(payload));

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LUMA_API_KEY}`,
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[Luma Video] Create error:", response.status, errText);
      return new Response(JSON.stringify({
        error: `Luma API error: ${response.status} - ${errText}`,
      }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    console.log("[Luma Video] Created:", JSON.stringify(data));

    return new Response(JSON.stringify({
      id: data.id,
      state: data.state,
      status: "created",
    }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Luma Video] Error:", error);
    return new Response(JSON.stringify({
      error: (error as Error).message || "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
