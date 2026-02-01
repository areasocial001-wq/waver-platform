import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Test API key validity by making a lightweight API call
    // DashScope doesn't have a dedicated balance endpoint, so we check key validity
    const testResponse = await fetch("https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${DASHSCOPE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "wanx2.1-t2i-turbo",
        input: { prompt: "test" },
        parameters: { size: "256*256", n: 1 }
      }),
    });

    // Check if we got an auth error
    if (testResponse.status === 401) {
      return new Response(JSON.stringify({ 
        hasKey: true,
        status: "invalid",
        message: "Invalid API key"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for quota exhausted
    const data = await testResponse.json();
    if (data.code === "Throttling.User" || data.code === "QuotaExhausted") {
      return new Response(JSON.stringify({ 
        hasKey: true,
        status: "exhausted",
        message: "Quota exhausted",
        code: data.code
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Key is valid and has quota
    return new Response(JSON.stringify({ 
      hasKey: true,
      status: "active",
      message: "DashScope API key is valid",
      provider: "alibaba-dashscope",
      models: {
        video: ["wan2.6-i2v-flash", "wan2.5-i2v-preview", "wan2.2-i2v-plus", "wan2.1-t2v-plus"],
        image: ["wanx2.1-t2i-turbo", "wanx2.1-t2i-plus", "flux-schnell", "flux-dev"]
      }
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
