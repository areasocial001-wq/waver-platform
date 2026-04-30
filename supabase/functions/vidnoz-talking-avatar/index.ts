// Generate a Vidnoz talking-head video synchronously (start + poll until ready).
// Used by agent-execute to replace Freepik B-roll on talking-head scenes.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VIDNOZ_BASE = "https://devapi.vidnoz.com/v2";

async function startGenerate(apiKey: string, payload: {
  text: string; voice_id: string; avatar_url: string; voice_style?: string;
}) {
  const fd = new FormData();
  fd.append("voice_id", payload.voice_id);
  fd.append("text", payload.text.slice(0, 1500));
  fd.append("type", "0"); // preset voice
  fd.append("avatar_url", payload.avatar_url);
  if (payload.voice_style) {
    // Vidnoz accepts emotion / style fields depending on voice version. Send both for safety.
    fd.append("emotion", payload.voice_style);
    fd.append("style", payload.voice_style);
  }

  const r = await fetch(`${VIDNOZ_BASE}/task/generate-talking-head`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, accept: "application/json" },
    body: fd,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data?.code !== 200) {
    throw new Error(`Vidnoz generate failed: ${r.status} ${JSON.stringify(data).slice(0, 300)}`);
  }
  // Vidnoz returns either data.id (already running task) or data.task_id
  const taskId = data?.data?.id ?? data?.data?.task_id;
  if (!taskId) throw new Error("Vidnoz returned no task id");
  return String(taskId);
}

async function pollDetail(apiKey: string, taskId: string, maxMs = 240_000) {
  const start = Date.now();
  let delay = 4000;
  while (Date.now() - start < maxMs) {
    const fd = new FormData();
    fd.append("id", taskId);
    const r = await fetch(`${VIDNOZ_BASE}/task/detail`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, accept: "application/json" },
      body: fd,
    });
    const data = await r.json().catch(() => ({}));
    const status = data?.data?.status;
    const additional = data?.data?.additional_data || {};
    const url: string =
      additional?.video_720p?.url ||
      additional?.url ||
      "";
    // Vidnoz: status -1 not started, -2 running, 0/1 done depending on flavor.
    if (url) return { url, duration: additional?.video_720p?.video_duration ?? additional?.video_duration ?? null };
    if (status === -3 || status === 3 || data?.code !== 200) {
      throw new Error(`Vidnoz task failed: ${JSON.stringify(data).slice(0, 300)}`);
    }
    await new Promise((res) => setTimeout(res, delay));
    delay = Math.min(delay + 1000, 8000);
  }
  throw new Error("Vidnoz task timed out");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
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
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    let userId: string | undefined;
    try {
      const { data } = await supabase.auth.getClaims(token);
      if (data?.claims) userId = data.claims.sub as string;
    } catch (_) {}
    if (!userId) {
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user)
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      userId = data.user.id;
    }

    const VIDNOZ_API_KEY = Deno.env.get("VIDNOZ_API_KEY");
    if (!VIDNOZ_API_KEY) throw new Error("VIDNOZ_API_KEY not configured");

    const body = await req.json();
    const { text, voice_id, avatar_url, voice_style } = body || {};
    if (!text || !voice_id || !avatar_url) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: text, voice_id, avatar_url" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const taskId = await startGenerate(VIDNOZ_API_KEY, { text, voice_id, avatar_url, voice_style });
    const result = await pollDetail(VIDNOZ_API_KEY, taskId);

    return new Response(
      JSON.stringify({ success: true, task_id: taskId, ...result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("vidnoz-talking-avatar error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
