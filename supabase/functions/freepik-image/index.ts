import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function persistDataUrlToStorage(imageUrl: string, userId: string): Promise<string> {
  if (!imageUrl || !imageUrl.startsWith("data:")) return imageUrl;
  const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return imageUrl;
  const mime = match[1];
  const b64 = match[2];
  const ext = mime.split("/")[1]?.split("+")[0] || "png";
  const fileName = `generated/${userId}/${crypto.randomUUID()}.${ext}`;
  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!serviceKey || !supabaseUrl) return imageUrl;
    const admin = createClient(supabaseUrl, serviceKey);
    const binary = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const { error: upErr } = await admin.storage
      .from("story-references")
      .upload(fileName, binary, { contentType: mime, upsert: false });
    if (upErr) return imageUrl;
    const { data: pub } = admin.storage.from("story-references").getPublicUrl(fileName);
    return pub?.publicUrl || imageUrl;
  } catch {
    return imageUrl;
  }
}

function rewriteUrlsInPayload(payload: any, userId: string, promises: Promise<void>[]): void {
  if (!payload || typeof payload !== "object") return;
  for (const key of Object.keys(payload)) {
    const val = payload[key];
    if (typeof val === "string" && val.startsWith("data:")) {
      promises.push(
        persistDataUrlToStorage(val, userId).then((newUrl) => {
          payload[key] = newUrl;
        })
      );
    } else if (val && typeof val === "object") {
      rewriteUrlsInPayload(val, userId, promises);
    }
  }
}

const statusSchema = z.object({
  action: z.literal('status'),
  taskId: z.string().min(1).max(100),
});

const generateSchema = z.object({
  action: z.literal('generate').optional(),
  prompt: z.string().min(1, 'Prompt obbligatorio').max(2000, 'Prompt troppo lungo'),
  resolution: z.enum(['1k', '2k', '4k']).optional(),
  aspectRatio: z.enum(['square_1_1', 'landscape_4_3', 'landscape_16_9', 'portrait_3_4', 'portrait_9_16']).optional(),
  model: z.string().max(50).optional(),
  engine: z.string().max(50).optional(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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
    const FREEPIK_API_KEY = Deno.env.get("FREEPIK_API_KEY");
    if (!FREEPIK_API_KEY) {
      throw new Error("FREEPIK_API_KEY is not configured");
    }

    const body = await req.json();
    
    // Handle health check requests
    if (body.healthCheck) {
      return new Response(
        JSON.stringify({ status: 'ok', service: 'freepik-image' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { action, taskId, prompt, resolution, aspectRatio, model, engine } = body;

    // Check status of existing task
    if (action === "status" && taskId) {
      const parseResult = statusSchema.safeParse(body);
      if (!parseResult.success) {
        return new Response(
          JSON.stringify({ error: parseResult.error.errors[0].message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log("Checking Mystic task status:", taskId);
      const response = await fetch(`https://api.freepik.com/v1/ai/mystic/${taskId}`, {
        headers: {
          "x-freepik-api-key": FREEPIK_API_KEY,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Freepik status error:", response.status, errorText);
        throw new Error(`Freepik API error: ${response.status}`);
      }

      const data = await response.json();
      console.log("Mystic status response:", JSON.stringify(data).slice(0, 500));
      // If Mystic ever returns base64 generated images, persist them to Storage first.
      const rewrites: Promise<void>[] = [];
      rewriteUrlsInPayload(data, userId, rewrites);
      if (rewrites.length > 0) await Promise.all(rewrites);
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate new image - validate input
    const parseResult = generateSchema.safeParse(body);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: parseResult.error.errors[0].message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!prompt) {
      throw new Error("Prompt is required");
    }

    console.log("Generating Mystic image with params:", { prompt, resolution, aspectRatio, model, engine });

    const requestBody: any = {
      prompt,
      resolution: resolution || "1k",
      aspect_ratio: aspectRatio || "square_1_1",
    };

    if (model) requestBody.model = model;
    if (engine) requestBody.engine = engine;

    const response = await fetch("https://api.freepik.com/v1/ai/mystic", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-freepik-api-key": FREEPIK_API_KEY,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Freepik generation error:", response.status, errorText);
      throw new Error(`Freepik API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("Mystic generation response:", JSON.stringify(data).slice(0, 500));
    const rewrites: Promise<void>[] = [];
    rewriteUrlsInPayload(data, userId, rewrites);
    if (rewrites.length > 0) await Promise.all(rewrites);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in freepik-image function:", error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
