import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// DashScope is only available on Chinese Alibaba Cloud (aliyun.com), not international
const DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com";

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

    // Test with Beijing endpoint (DashScope is China-only)
    try {
      const testResponse = await fetch(`${DASHSCOPE_BASE_URL}/api/v1/models`, {
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

      console.log(`DashScope response status: ${testResponse.status}`, responseData);

      if (testResponse.ok) {
        return new Response(JSON.stringify({ 
          hasKey: true,
          status: "active",
          message: "DashScope API key is valid (China region)",
          region: "beijing",
          provider: "alibaba-dashscope",
          models: {
            video: ["wan2.6-i2v-flash", "wan2.5-i2v-preview", "wan2.2-i2v-plus", "wan2.1-t2v-plus"],
            image: ["wanx2.1-t2i-turbo", "wanx2.1-t2i-plus", "flux-schnell", "flux-dev"]
          }
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Invalid key or other error
      return new Response(JSON.stringify({ 
        hasKey: true,
        status: testResponse.status === 401 ? "invalid" : "error",
        message: testResponse.status === 401 
          ? "Invalid API key - ensure you're using a key from Chinese Alibaba Cloud (aliyun.com), not international"
          : `DashScope error: ${responseData?.message || responseData?.code || 'Unknown'}`,
        keyPrefix: `${keyPrefix}...`,
        note: "DashScope is only available on Chinese Alibaba Cloud console (dashscope.console.aliyun.com)"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (fetchError) {
      console.error("DashScope fetch error:", fetchError);
      return new Response(JSON.stringify({ 
        hasKey: true,
        status: "error",
        message: `Connection error: ${fetchError instanceof Error ? fetchError.message : 'Unknown'}`,
        note: "DashScope requires access to Chinese Alibaba Cloud servers"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
