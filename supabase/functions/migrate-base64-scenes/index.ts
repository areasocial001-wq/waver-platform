import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MigrationResult {
  projectId: string;
  title: string;
  scenesMigrated: number;
  bytesFreed: number;
  errors: string[];
}

Deno.serve(async (req) => {
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    let userId: string | undefined;
    try {
      const { data: claims } = await userClient.auth.getClaims(token);
      userId = claims?.claims?.sub as string | undefined;
    } catch (_) {
      // fallback below
    }
    if (!userId) {
      const { data: u, error: uErr } = await userClient.auth.getUser(token);
      if (uErr || !u?.user) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = u.user.id;
    }

    const body = await req.json().catch(() => ({}));
    const projectIds: string[] | undefined = body.projectIds;

    // Service-role client for storage upload + db update bypassing RLS
    const admin = createClient(supabaseUrl, serviceKey);

    // Fetch projects belonging to this user (security: filter by user_id)
    let query = admin
      .from("story_mode_projects")
      .select("id, title, scenes")
      .eq("user_id", userId);
    if (projectIds && projectIds.length > 0) {
      query = query.in("id", projectIds);
    }
    const { data: projects, error: fetchErr } = await query;
    if (fetchErr) throw fetchErr;
    if (!projects || projects.length === 0) {
      return new Response(JSON.stringify({ migrated: [], message: "No projects found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: MigrationResult[] = [];

    for (const project of projects) {
      const result: MigrationResult = {
        projectId: project.id,
        title: project.title,
        scenesMigrated: 0,
        bytesFreed: 0,
        errors: [],
      };

      const scenes = Array.isArray(project.scenes) ? [...project.scenes] : [];
      let modified = false;

      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        if (!scene || typeof scene !== "object") continue;

        // Migrate every base64 field (imageUrl, audioUrl, sfxUrl, videoUrl)
        for (const key of ["imageUrl", "audioUrl", "sfxUrl", "videoUrl"]) {
          const value = (scene as any)[key];
          if (typeof value !== "string" || !value.startsWith("data:")) continue;

          // Parse data URL: data:<mime>;base64,<payload>
          const match = value.match(/^data:([^;]+);base64,(.+)$/);
          if (!match) {
            result.errors.push(`scene ${i + 1} ${key}: invalid data URL`);
            continue;
          }
          const mime = match[1];
          const b64 = match[2];
          const originalBytes = value.length;

          // Determine extension
          const ext = mime.split("/")[1]?.split("+")[0] || "bin";
          const fileName = `migrated/${userId}/${project.id}/scene-${i + 1}-${key}.${ext}`;

          // Decode base64
          const binary = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

          // Upload to story-references bucket (public)
          const { error: upErr } = await admin.storage
            .from("story-references")
            .upload(fileName, binary, {
              contentType: mime,
              upsert: true,
            });
          if (upErr) {
            result.errors.push(`scene ${i + 1} ${key}: upload failed - ${upErr.message}`);
            continue;
          }

          // Get public URL
          const { data: pub } = admin.storage
            .from("story-references")
            .getPublicUrl(fileName);
          if (!pub?.publicUrl) {
            result.errors.push(`scene ${i + 1} ${key}: no public url`);
            continue;
          }

          (scene as any)[key] = pub.publicUrl;
          result.scenesMigrated++;
          result.bytesFreed += originalBytes;
          modified = true;
        }
      }

      if (modified) {
        const { error: updErr } = await admin
          .from("story_mode_projects")
          .update({ scenes })
          .eq("id", project.id)
          .eq("user_id", userId);
        if (updErr) {
          result.errors.push(`db update failed: ${updErr.message}`);
        }
      }

      results.push(result);
    }

    return new Response(
      JSON.stringify({ success: true, migrated: results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("migrate-base64-scenes error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
