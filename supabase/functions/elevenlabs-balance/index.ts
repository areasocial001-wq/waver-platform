import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY") || Deno.env.get("ELEVENLABS_API_KEY_1");
    
    if (!ELEVENLABS_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ELEVENLABS_API_KEY is not configured", hasKey: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Fetching ElevenLabs subscription info...");

    const response = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      method: "GET",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs balance check failed:", response.status, errorText);
      return new Response(
        JSON.stringify({ 
          hasKey: true,
          error: `Failed to fetch subscription: ${response.status}`,
          status: "error"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("ElevenLabs subscription info:", data);

    // Extract relevant subscription information
    const subscriptionInfo = {
      hasKey: true,
      status: "active",
      tier: data.tier || "unknown",
      character_count: data.character_count || 0,
      character_limit: data.character_limit || 0,
      characters_remaining: (data.character_limit || 0) - (data.character_count || 0),
      usage_percentage: data.character_limit > 0 
        ? Math.round((data.character_count / data.character_limit) * 100) 
        : 0,
      next_character_count_reset_unix: data.next_character_count_reset_unix,
    };

    return new Response(
      JSON.stringify(subscriptionInfo),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in elevenlabs-balance function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage, hasKey: true, status: "error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
