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
    const FREEPIK_API_KEY = Deno.env.get("FREEPIK_API_KEY");
    if (!FREEPIK_API_KEY) {
      throw new Error("FREEPIK_API_KEY is not configured");
    }

    const body = await req.json();
    const { action, term, contentType, order, page, limit, orientation, license, aiGenerated, resourceId } = body;

    // Get resource details
    if (action === "details" && resourceId) {
      console.log("Getting resource details:", resourceId);
      
      const response = await fetch(`https://api.freepik.com/v1/resources/${resourceId}`, {
        headers: {
          "x-freepik-api-key": FREEPIK_API_KEY,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Freepik details error:", response.status, errorText);
        throw new Error(`Freepik API error: ${response.status}`);
      }

      const data = await response.json();
      console.log("Resource details response:", JSON.stringify(data));
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download resource
    if (action === "download" && resourceId) {
      console.log("Downloading resource:", resourceId);
      
      const response = await fetch(`https://api.freepik.com/v1/resources/${resourceId}/download`, {
        headers: {
          "x-freepik-api-key": FREEPIK_API_KEY,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Freepik download error:", response.status, errorText);
        throw new Error(`Freepik API error: ${response.status}`);
      }

      const data = await response.json();
      console.log("Download response:", JSON.stringify(data));
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Search resources
    let endpoint: string;
    const params = new URLSearchParams();

    if (term) params.append("term", term);
    if (order) params.append("order", order);
    if (page) params.append("page", page.toString());
    if (limit) params.append("limit", (limit || 20).toString());

    switch (contentType) {
      case "icons":
        endpoint = "https://api.freepik.com/v1/icons";
        break;
      case "videos":
        endpoint = "https://api.freepik.com/v1/videos";
        break;
      default:
        endpoint = "https://api.freepik.com/v1/resources";
        // Additional filters for resources
        if (orientation) params.append("filters[orientation]", orientation);
        if (license) params.append("filters[license]", license);
        if (aiGenerated) params.append("filters[ai-generated]", aiGenerated);
        break;
    }

    console.log("Searching stock content:", { endpoint, params: params.toString() });

    const response = await fetch(`${endpoint}?${params.toString()}`, {
      headers: {
        "x-freepik-api-key": FREEPIK_API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Freepik search error:", response.status, errorText);
      throw new Error(`Freepik API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("Search response - found", data.data?.length || 0, "items");

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in freepik-stock function:", error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
