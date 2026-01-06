import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PIAPI_API_KEY = Deno.env.get("PIAPI_API_KEY");
    
    if (!PIAPI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "PIAPI_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Fetching PiAPI account info...");

    const response = await fetch("https://api.piapi.ai/account/info", {
      method: "GET",
      headers: {
        "X-API-Key": PIAPI_API_KEY,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("PiAPI balance check failed:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: `Failed to fetch balance: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("PiAPI account info:", data);

    // Extract relevant balance information
    const balanceInfo = {
      credits: data.data?.credits || data.credits || 0,
      equivalent_in_usd: data.data?.equivalent_in_usd || data.equivalent_in_usd || 0,
      account_name: data.data?.account_name || data.account_name || "Unknown",
      account_id: data.data?.account_id || data.account_id || null,
    };

    return new Response(
      JSON.stringify(balanceInfo),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in piapi-balance function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
