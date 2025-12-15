import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const getDateFilterValue = (dateFilter: string): string | null => {
  const now = new Date();
  switch (dateFilter) {
    case "last_week":
      now.setDate(now.getDate() - 7);
      return now.toISOString().split("T")[0];
    case "last_month":
      now.setMonth(now.getMonth() - 1);
      return now.toISOString().split("T")[0];
    case "last_3_months":
      now.setMonth(now.getMonth() - 3);
      return now.toISOString().split("T")[0];
    case "last_year":
      now.setFullYear(now.getFullYear() - 1);
      return now.toISOString().split("T")[0];
    default:
      return null;
  }
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
    const { action, term, contentType, order, page, limit, orientation, license, excludeAI, dateFilter, resourceId } = body;

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
        return new Response(
          JSON.stringify({
            error: "Freepik API error",
            status: response.status,
            details: errorText,
          }),
          {
            status: response.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
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
        return new Response(
          JSON.stringify({
            error: "Freepik API error",
            status: response.status,
            details: errorText,
          }),
          {
            status: response.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
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

    // License filter (supported across endpoints; also used for post-filter fallback)
    if (license && license !== "all") {
      params.append("filters[license]", license);
    }

    switch (contentType) {
      case "icons":
        endpoint = "https://api.freepik.com/v1/icons";
        break;
      case "videos":
        endpoint = "https://api.freepik.com/v1/videos";
        break;
      default:
        endpoint = "https://api.freepik.com/v1/resources";
        // Orientation filter
        if (orientation && orientation !== "all") {
          params.append("filters[orientation]", orientation);
        }
        // Exclude AI-generated content
        if (excludeAI) {
          params.append("filters[ai-generated]", "excluded");
        }
        // Date filter
        if (dateFilter && dateFilter !== "all") {
          const dateValue = getDateFilterValue(dateFilter);
          if (dateValue) {
            params.append("filters[added-from]", dateValue);
          }
        }
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
      return new Response(
        JSON.stringify({
          error: "Freepik API error",
          status: response.status,
          details: errorText,
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const data = await response.json();

    // Fallback: if the API doesn't honor license filters on some endpoints,
    // enforce "free" client-side by removing premium items.
    if (license === "free" && Array.isArray(data?.data)) {
      data.data = data.data.filter((item: any) => {
        const isPremiumFlag = item?.premium === 1 || item?.premium === true;
        const hasPremiumLicense = Array.isArray(item?.licenses)
          ? item.licenses.some((l: any) => l?.type === "premium")
          : false;
        return !isPremiumFlag && !hasPremiumLicense;
      });
    }

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
