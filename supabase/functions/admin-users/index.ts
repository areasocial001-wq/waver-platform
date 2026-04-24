import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, targetUserId, role } = await req.json();

    switch (action) {
      case "list_users": {
        const { data: users, error } = await serviceClient.auth.admin.listUsers();
        if (error) throw error;

        // Get roles and profiles
        const { data: allRoles } = await serviceClient.from("user_roles").select("*");
        const { data: allProfiles } = await serviceClient.from("profiles").select("*");

        const enrichedUsers = users.users.map((u: any) => ({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          roles: (allRoles || []).filter((r: any) => r.user_id === u.id).map((r: any) => r.role),
          profile: (allProfiles || []).find((p: any) => p.id === u.id),
        }));

        return new Response(JSON.stringify({ users: enrichedUsers }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "assign_role": {
        if (!targetUserId || !role) {
          return new Response(JSON.stringify({ error: "targetUserId and role required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { error } = await serviceClient
          .from("user_roles")
          .upsert({ user_id: targetUserId, role }, { onConflict: "user_id,role" });
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "remove_role": {
        if (!targetUserId || !role) {
          return new Response(JSON.stringify({ error: "targetUserId and role required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { error } = await serviceClient
          .from("user_roles")
          .delete()
          .eq("user_id", targetUserId)
          .eq("role", role);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "block_user": {
        if (!targetUserId) {
          return new Response(JSON.stringify({ error: "targetUserId required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // Update profile
        await serviceClient
          .from("profiles")
          .upsert({ id: targetUserId, is_blocked: true }, { onConflict: "id" });
        // Ban in auth
        const { error } = await serviceClient.auth.admin.updateUserById(targetUserId, {
          ban_duration: "876000h", // ~100 years
        });
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "unblock_user": {
        if (!targetUserId) {
          return new Response(JSON.stringify({ error: "targetUserId required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        await serviceClient
          .from("profiles")
          .upsert({ id: targetUserId, is_blocked: false }, { onConflict: "id" });
        const { error } = await serviceClient.auth.admin.updateUserById(targetUserId, {
          ban_duration: "0",
        });
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete_user": {
        if (!targetUserId) {
          return new Response(JSON.stringify({ error: "targetUserId required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (targetUserId === user.id) {
          return new Response(JSON.stringify({ error: "Cannot delete yourself" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { error } = await serviceClient.auth.admin.deleteUser(targetUserId);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("Admin users error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
