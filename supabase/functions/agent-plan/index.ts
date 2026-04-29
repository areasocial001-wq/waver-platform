import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Auth ---
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
      const { data, error } = await supabase.auth.getClaims(token);
      if (!error && data?.claims) userId = data.claims.sub as string;
    } catch (_) {}
    if (!userId) {
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = data.user.id;
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { projectId } = await req.json();
    if (!projectId) {
      return new Response(JSON.stringify({ error: "projectId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load project
    const { data: project, error: pErr } = await supabase
      .from("agent_projects")
      .select("*")
      .eq("id", projectId)
      .eq("user_id", userId)
      .single();
    if (pErr || !project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("agent_projects")
      .update({ plan_status: "generating", error_message: null })
      .eq("id", projectId);

    const systemPrompt = `You are an expert video producer for short marketing/explainer videos.
Given a user brief (and optional reference document text), produce a CONCISE video plan.
Target language: ${project.language}.
Target duration: ~${project.target_duration} seconds (≈${Math.round(project.target_duration * 2.6)} words).
Return STRUCTURED data via the provided tool. Keep transcript natural for voiceover (no bullet points, no headings, no parenthetical stage directions).`;

    const userMsg = `BRIEF:
${project.brief}

${project.pdf_text ? `REFERENCE DOCUMENT EXCERPT:\n${project.pdf_text.slice(0, 8000)}` : ""}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMsg },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "video_plan",
              description: "Structured plan for an explainer/marketing video.",
              parameters: {
                type: "object",
                properties: {
                  topic: { type: "string", description: "Concise video topic (max 80 chars)" },
                  audience: { type: "string", description: "Target audience" },
                  tone: {
                    type: "string",
                    enum: ["professional", "smooth", "energetic", "warm", "authoritative"],
                  },
                  video_type: {
                    type: "string",
                    enum: ["explainer", "promo", "testimonial", "product_demo", "tutorial"],
                  },
                  transcript: {
                    type: "string",
                    description: `Voiceover transcript. ${Math.round(project.target_duration * 2.4)}-${Math.round(project.target_duration * 2.8)} words. Natural spoken style.`,
                  },
                  word_count: { type: "integer" },
                  estimated_duration_seconds: { type: "integer" },
                  scene_keywords: {
                    type: "array",
                    description: "5-7 short visual keywords (1-4 words each) for stock asset search, in English.",
                    items: { type: "string" },
                  },
                  references: {
                    type: "array",
                    description: "2-4 trustworthy real-world references (real titles + plausible source domains)",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        source: { type: "string", description: "Domain like ahrq.gov" },
                      },
                      required: ["title", "source"],
                      additionalProperties: false,
                    },
                  },
                },
                required: [
                  "topic",
                  "audience",
                  "tone",
                  "video_type",
                  "transcript",
                  "word_count",
                  "estimated_duration_seconds",
                  "scene_keywords",
                  "references",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "video_plan" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI plan error:", aiResp.status, t);
      await supabase
        .from("agent_projects")
        .update({ plan_status: "error", error_message: `AI ${aiResp.status}` })
        .eq("id", projectId);
      const status = aiResp.status === 429 || aiResp.status === 402 ? aiResp.status : 500;
      return new Response(JSON.stringify({ error: "AI gateway error", details: t }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall?.function?.arguments;
    const plan = typeof args === "string" ? JSON.parse(args) : args;
    if (!plan?.transcript) {
      throw new Error("No plan returned by AI");
    }

    await supabase
      .from("agent_projects")
      .update({
        plan,
        plan_status: "ready",
        title: plan.topic?.slice(0, 80) || project.title,
      })
      .eq("id", projectId);

    return new Response(JSON.stringify({ success: true, plan }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("agent-plan error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
