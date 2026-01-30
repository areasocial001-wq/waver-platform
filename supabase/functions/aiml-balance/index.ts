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
    const AIML_API_KEY = Deno.env.get("AIML_API_KEY");
    
    if (!AIML_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AIML_API_KEY is not configured", hasKey: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Fetching AIML API balance...");

    // Try to get account info from AIML API
    const response = await fetch("https://api.aimlapi.com/v2/account", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${AIML_API_KEY}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AIML balance check failed:", response.status, errorText);
      
      // If 403, credits are exhausted
      if (response.status === 403) {
        return new Response(
          JSON.stringify({ 
            hasKey: true,
            credits: 0,
            status: "exhausted",
            message: "Credits exhausted"
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          hasKey: true,
          error: `Failed to fetch balance: ${response.status}`,
          status: "unknown"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("AIML account info:", data);

    return new Response(
      JSON.stringify({
        hasKey: true,
        credits: data.credits || data.balance || 0,
        status: "active",
        ...data
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in aiml-balance function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage, hasKey: true, status: "error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
