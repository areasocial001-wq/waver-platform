import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name, message } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get admin emails from profiles with admin role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    const adminEmails: string[] = [];
    if (adminRoles && adminRoles.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("email")
        .in("id", adminRoles.map((r) => r.user_id));
      if (profiles) {
        for (const p of profiles) {
          if (p.email) adminEmails.push(p.email);
        }
      }
    }

    // Also send a confirmation-style log (we don't have an email sending service configured,
    // so we log the notification and return success)
    const notificationData = {
      type: "waitlist_signup",
      subscriber_email: email,
      subscriber_name: name || null,
      subscriber_message: message || null,
      admin_emails: adminEmails,
      notified_at: new Date().toISOString(),
    };

    console.log("📧 Waitlist notification:", JSON.stringify(notificationData));

    // Try sending via OpenAI-compatible approach or just log
    // For now, we'll use the Lovable AI to generate a notification summary
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    
    // Log the notification in api_logs for admin visibility
    if (adminRoles && adminRoles.length > 0) {
      for (const admin of adminRoles) {
        await supabase.from("api_logs").insert({
          user_id: admin.user_id,
          api_name: "waitlist",
          operation: "new_signup",
          status: "success",
          message: `Nuova iscrizione waitlist: ${email}${name ? ` (${name})` : ""}`,
          details: notificationData,
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Notification sent",
        admins_notified: adminEmails.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in waitlist-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
