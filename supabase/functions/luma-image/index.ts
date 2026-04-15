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
    console.log("[Luma Image] Request:", JSON.stringify(body));

    // Health check
    if (body.healthCheck) {
      return new Response(JSON.stringify({ status: "ok", service: "luma-image" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Polling
    if (body.generationId) {
      const pollRes = await fetch(`${LUMA_API_URL}/generations/image/${body.generationId}`, {
        headers: {
          "Authorization": `Bearer ${LUMA_API_KEY}`,
          "Accept": "application/json",
        },
      });

      if (!pollRes.ok) {
        const err = await pollRes.text();
        console.error("[Luma Image] Poll error:", pollRes.status, err);
        return new Response(JSON.stringify({ error: `Luma API error: ${pollRes.status}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const pollData = await pollRes.json();
      console.log("[Luma Image] Poll result:", JSON.stringify(pollData));

      if (pollData.state === "completed") {
        const imageUrl = pollData.assets?.image;
        return new Response(JSON.stringify({
          status: "completed",
          imageUrl,
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

    // Create image generation
    const {
      prompt,
      model = "photon-1",
      aspect_ratio = "16:9",
      // Character reference
      character_ref,
      // Visual/Style reference
      style_ref,
      // Modify image
      modify_image_ref,
    } = body;

    const payload: Record<string, unknown> = {
      prompt,
      model,
      aspect_ratio,
    };

    // Character reference for consistency
    if (character_ref) {
      payload.character_ref = {
        identity0: {
          images: Array.isArray(character_ref) ? character_ref : [character_ref],
        },
      };
    }

    // Style/visual reference
    if (style_ref) {
      payload.style_ref = Array.isArray(style_ref) ? style_ref.map((url: string) => ({ url, weight: 0.85 })) : [{ url: style_ref, weight: 0.85 }];
    }

    // Image modification (edit existing image)
    if (modify_image_ref) {
      payload.modify_image_ref = {
        url: modify_image_ref,
        weight: 0.85,
      };
    }

    console.log("[Luma Image] Creating generation:", JSON.stringify(payload));

    const response = await fetch(`${LUMA_API_URL}/generations/image`, {
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
      console.error("[Luma Image] Create error:", response.status, errText);
      return new Response(JSON.stringify({
        error: `Luma API error: ${response.status} - ${errText}`,
      }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    console.log("[Luma Image] Created:", JSON.stringify(data));

    return new Response(JSON.stringify({
      id: data.id,
      state: data.state,
      status: "created",
    }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Luma Image] Error:", error);
    return new Response(JSON.stringify({
      error: (error as Error).message || "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
