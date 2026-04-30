import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const token = authHeader.replace("Bearer ", "");
    let userId: string | undefined;
    try {
      const { data, error } = await supabase.auth.getClaims(token);
      if (!error && data?.claims) userId = data.claims.sub as string;
    } catch (_) {}
    if (!userId) {
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user)
        return new Response(JSON.stringify({ error: "Invalid" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      userId = data.user.id;
    }

    const { projectId } = await req.json();
    const { data: project } = await adminClient
      .from("agent_projects")
      .select("*")
      .eq("id", projectId)
      .eq("user_id", userId)
      .single();
    if (project?.execution_status !== "rendering") {
      return new Response(JSON.stringify({ status: project?.execution_status || "idle" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!project?.json2video_project_id) {
      return new Response(JSON.stringify({ error: "No render in progress" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const J2V = Deno.env.get("JSON2VIDEO_API_KEY")!;
    const r = await fetch(
      `https://api.json2video.com/v2/movies?project=${project.json2video_project_id}`,
      { headers: { "x-api-key": J2V } }
    );
    const data = await r.json();
    const movie = data?.movie;

    let updates: Record<string, unknown> = {};
    if (movie?.status === "done" && movie?.url) {
      // Mirror to our storage for permanence
      try {
        const vr = await fetch(movie.url);
        const buf = await vr.arrayBuffer();
        const path = `${userId}/${projectId}/final-${Date.now()}.mp4`;
        const { error: upErr } = await adminClient.storage
          .from("generated-videos")
          .upload(path, new Uint8Array(buf), {
            contentType: "video/mp4",
            upsert: true,
          });
        let finalUrl = movie.url;
        if (!upErr) {
          const { data: signed } = await adminClient.storage
            .from("generated-videos")
            .createSignedUrl(path, 60 * 60 * 24 * 7);
          if (signed?.signedUrl) finalUrl = signed.signedUrl;
        }
        updates = {
          final_video_url: finalUrl,
          execution_status: "done",
          progress_pct: 100,
          execution_step: "done",
        };
      } catch (e) {
        console.error("mirror failed:", e);
        updates = {
          final_video_url: movie.url,
          execution_status: "done",
          progress_pct: 100,
          execution_step: "done",
        };
      }
    } else if (movie?.status === "error") {
      updates = {
        execution_status: "error",
        error_message: movie?.message || "JSON2Video reported error",
      };
    }

    if (Object.keys(updates).length > 0) {
      await adminClient.from("agent_projects").update(updates).eq("id", projectId);
    }

    return new Response(
      JSON.stringify({ status: movie?.status, message: movie?.message, ...updates }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
