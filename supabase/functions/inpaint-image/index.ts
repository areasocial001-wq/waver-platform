import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ⚠️ DO NOT call api.openai.com from this project.
// The previous implementation used DALL-E (gpt-image-1) and was responsible
// for unwanted OpenAI costs. This function has been migrated to Freepik
// (Mystic / image edit), for which the user already pays via FREEPIK_API_KEY.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function dataURLtoUint8(dataURL: string): Promise<{ bytes: Uint8Array; mime: string }> {
  const match = dataURL.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid data URL");
  const mime = match[1];
  const b64 = match[2];
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return { bytes, mime };
}

async function persistBytesToStorage(
  bytes: Uint8Array,
  mime: string,
  userId: string,
): Promise<string | null> {
  const ext = mime.split("/")[1]?.split("+")[0] || "png";
  const fileName = `generated/${userId}/${crypto.randomUUID()}.${ext}`;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!serviceKey || !supabaseUrl) return null;
  const admin = createClient(supabaseUrl, serviceKey);
  const { error: upErr } = await admin.storage
    .from("story-references")
    .upload(fileName, bytes, { contentType: mime, upsert: false });
  if (upErr) {
    console.error("Storage upload failed:", upErr.message);
    return null;
  }
  const { data: pub } = admin.storage.from("story-references").getPublicUrl(fileName);
  return pub?.publicUrl || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    let userId: string | undefined;
    try {
      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
      if (!claimsError && claimsData?.claims) userId = claimsData.claims.sub as string;
    } catch (_) { /* SDK without getClaims */ }
    if (!userId) {
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData?.user) {
        return new Response(JSON.stringify({ error: "Invalid authentication token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = userData.user.id;
    }

    const FREEPIK_API_KEY = Deno.env.get("FREEPIK_API_KEY");
    if (!FREEPIK_API_KEY) {
      return new Response(
        JSON.stringify({
          error:
            "Freepik non è configurato. L'inpainting via OpenAI è stato disabilitato per evitare costi imprevisti. Configura FREEPIK_API_KEY oppure usa un altro tool di editing immagini.",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { prompt, image, mask } = await req.json();
    if (!prompt || !image) {
      return new Response(
        JSON.stringify({ error: "Prompt and image are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!mask) {
      return new Response(
        JSON.stringify({ error: "Una maschera è richiesta per l'inpainting con Freepik." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("[inpaint-image] Using Freepik provider, prompt:", prompt);

    // Freepik requires base64 (no data: prefix)
    const stripPrefix = (s: string) => s.replace(/^data:[^;]+;base64,/, "");

    const taskRes = await fetch(
      "https://api.freepik.com/v1/ai/beta/text-to-image/flux-dev/inpaint",
      {
        method: "POST",
        headers: {
          "x-freepik-api-key": FREEPIK_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          image: stripPrefix(image),
          mask: stripPrefix(mask),
        }),
      },
    );

    if (!taskRes.ok) {
      const errText = await taskRes.text();
      console.error("[inpaint-image] Freepik error:", taskRes.status, errText);
      return new Response(
        JSON.stringify({ error: `Freepik error: ${taskRes.status}`, detail: errText.slice(0, 300) }),
        { status: taskRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const taskJson = await taskRes.json();
    const taskId: string | undefined = taskJson?.data?.task_id;
    if (!taskId) {
      return new Response(
        JSON.stringify({ error: "Freepik did not return a task_id", raw: taskJson }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Poll up to ~60s
    let resultUrl: string | null = null;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const pollRes = await fetch(
        `https://api.freepik.com/v1/ai/beta/text-to-image/flux-dev/inpaint/${taskId}`,
        { headers: { "x-freepik-api-key": FREEPIK_API_KEY } },
      );
      if (!pollRes.ok) continue;
      const pollJson = await pollRes.json();
      const status = pollJson?.data?.status;
      if (status === "COMPLETED") {
        resultUrl = pollJson?.data?.generated?.[0] || null;
        break;
      }
      if (status === "FAILED") {
        return new Response(
          JSON.stringify({ error: "Freepik inpaint task failed", raw: pollJson }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    if (!resultUrl) {
      return new Response(
        JSON.stringify({ error: "Freepik inpaint timed out" }),
        { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Mirror to our storage so the URL doesn't expire
    let finalUrl = resultUrl;
    try {
      const imgRes = await fetch(resultUrl);
      if (imgRes.ok) {
        const buf = new Uint8Array(await imgRes.arrayBuffer());
        const mime = imgRes.headers.get("content-type") || "image/png";
        const stored = await persistBytesToStorage(buf, mime, userId);
        if (stored) finalUrl = stored;
      }
    } catch (mirrorErr) {
      console.warn("[inpaint-image] Could not mirror to storage:", mirrorErr);
    }

    return new Response(
      JSON.stringify({ imageUrl: finalUrl, success: true, provider: "freepik" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Error in inpaint-image function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to inpaint image" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
