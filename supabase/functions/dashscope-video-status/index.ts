import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ENDPOINTS = {
  singapore: "https://dashscope-intl.aliyuncs.com",
  virginia: "https://dashscope-us.aliyuncs.com",
  beijing: "https://dashscope.aliyuncs.com",
};

interface StatusRequest {
  taskId: string;
  region?: "singapore" | "virginia" | "beijing";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const DASHSCOPE_API_KEY = Deno.env.get("DASHSCOPE_API_KEY");
    
    if (!DASHSCOPE_API_KEY) {
      return new Response(JSON.stringify({ error: "DASHSCOPE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { taskId, region = "singapore" }: StatusRequest = await req.json();

    if (!taskId) {
      return new Response(JSON.stringify({ error: "taskId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const endpoint = ENDPOINTS[region];

    // Query task status
    const statusResponse = await fetch(`${endpoint}/api/v1/tasks/${taskId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${DASHSCOPE_API_KEY}`,
      },
    });

    const statusData = await statusResponse.json();

    if (!statusResponse.ok) {
      console.error("DashScope status error:", statusData);
      return new Response(JSON.stringify({ 
        error: statusData.message || "Failed to get task status",
        code: statusData.code
      }), {
        status: statusResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const output = statusData.output;
    const taskStatus = output?.task_status;

    // Map DashScope status to our status
    let status: "pending" | "processing" | "completed" | "failed";
    switch (taskStatus) {
      case "PENDING":
        status = "pending";
        break;
      case "RUNNING":
        status = "processing";
        break;
      case "SUCCEEDED":
        status = "completed";
        break;
      case "FAILED":
      case "UNKNOWN":
        status = "failed";
        break;
      default:
        status = "processing";
    }

    const result: Record<string, unknown> = {
      taskId,
      status,
      taskStatus,
      provider: "dashscope",
    };

    // Add video URL if completed
    if (status === "completed" && output?.video_url) {
      result.videoUrl = output.video_url;
    }

    // Add error message if failed
    if (status === "failed") {
      result.error = output?.message || statusData.message || "Video generation failed";
    }

    // Add metrics if available
    if (output?.submit_time) {
      result.submitTime = output.submit_time;
    }
    if (output?.scheduled_time) {
      result.scheduledTime = output.scheduled_time;
    }
    if (output?.end_time) {
      result.endTime = output.end_time;
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("DashScope status error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
