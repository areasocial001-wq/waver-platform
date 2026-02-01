import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Try multiple endpoints to find which region works
const ENDPOINTS = [
  { name: "singapore", url: "https://dashscope-intl.aliyuncs.com" },
  { name: "beijing", url: "https://dashscope.aliyuncs.com" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const DASHSCOPE_API_KEY = Deno.env.get("DASHSCOPE_API_KEY");
    
    if (!DASHSCOPE_API_KEY) {
      return new Response(JSON.stringify({ 
        hasKey: false,
        status: "not_configured",
        message: "DASHSCOPE_API_KEY not configured"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log key prefix for debugging (first 8 chars only)
    const keyPrefix = DASHSCOPE_API_KEY.substring(0, 8);
    console.log(`Testing DashScope key starting with: ${keyPrefix}...`);

    // Try each endpoint
    const results: Record<string, unknown>[] = [];
    
    for (const endpoint of ENDPOINTS) {
      try {
        // Use models API which is lightweight
        const testResponse = await fetch(`${endpoint.url}/api/v1/models`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${DASHSCOPE_API_KEY}`,
          },
        });

        const responseText = await testResponse.text();
        let responseData;
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = { raw: responseText.substring(0, 200) };
        }

        results.push({
          region: endpoint.name,
          status: testResponse.status,
          ok: testResponse.ok,
          data: responseData
        });

        // If we got a successful response, this is the right region
        if (testResponse.ok) {
          return new Response(JSON.stringify({ 
            hasKey: true,
            status: "active",
            message: `DashScope API key is valid (${endpoint.name} region)`,
            region: endpoint.name,
            provider: "alibaba-dashscope",
            models: {
              video: ["wan2.6-i2v-flash", "wan2.5-i2v-preview", "wan2.2-i2v-plus", "wan2.1-t2v-plus"],
              image: ["wanx2.1-t2i-turbo", "wanx2.1-t2i-plus", "flux-schnell", "flux-dev"]
            }
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (error) {
        results.push({
          region: endpoint.name,
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }

    // No endpoint worked - return detailed error
    const allUnauthorized = results.every(r => r.status === 401);
    
    return new Response(JSON.stringify({ 
      hasKey: true,
      status: allUnauthorized ? "invalid" : "error",
      message: allUnauthorized ? "Invalid API key (tried all regions)" : "Could not connect to DashScope",
      keyPrefix: `${keyPrefix}...`,
      regionResults: results
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("DashScope balance check error:", error);
    return new Response(JSON.stringify({ 
      hasKey: !!Deno.env.get("DASHSCOPE_API_KEY"),
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
