import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_NOTIFICATION_EMAIL = "maxferro66@gmail.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name, message } = await req.json();

    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const notificationData = {
      type: "waitlist_signup",
      subscriber_email: email,
      subscriber_name: name || null,
      subscriber_message: message || null,
      admin_notification_email: ADMIN_NOTIFICATION_EMAIL,
      notified_at: new Date().toISOString(),
    };

    console.log("📧 Waitlist notification:", JSON.stringify(notificationData));

    // Log notification for admin dashboard visibility
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

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

    // Try to send real email notification via transactional email if available
    try {
      const { error: emailError } = await supabase.functions.invoke(
        "send-transactional-email",
        {
          body: {
            templateName: "waitlist-admin-notification",
            recipientEmail: ADMIN_NOTIFICATION_EMAIL,
            idempotencyKey: `waitlist-notify-${email}-${Date.now()}`,
            templateData: {
              subscriberEmail: email,
              subscriberName: name || "Non specificato",
              subscriberMessage: message || "Nessun messaggio",
            },
          },
        }
      );
      if (emailError) {
        console.warn("Email send skipped (not configured yet):", emailError.message);
      } else {
        console.log("✅ Email notification sent to", ADMIN_NOTIFICATION_EMAIL);
      }
    } catch (emailErr) {
      // Email sending not configured yet — silently skip
      console.warn("Email infrastructure not ready, notification logged only:", emailErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Notification processed",
        admin_email: ADMIN_NOTIFICATION_EMAIL,
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
