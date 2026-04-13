import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

// Map Stripe product IDs to app roles
const PRODUCT_TO_ROLE: Record<string, string> = {
  "prod_UKQ3SIkQD1YRRq": "premium",
  "prod_UKQ6uV2WdYYFcC": "creator",
  "prod_UKQYpXd3Ztk0Ov": "business",
};

const PAID_ROLES = ["premium", "creator", "business"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey || !webhookSecret) {
    logStep("ERROR: Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
    return new Response(JSON.stringify({ error: "Server misconfiguration" }), { status: 500, headers: corsHeaders });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    logStep("ERROR: No stripe-signature header");
    return new Response(JSON.stringify({ error: "No signature" }), { status: 400, headers: corsHeaders });
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    logStep("ERROR: Webhook signature verification failed", { error: (err as Error).message });
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400, headers: corsHeaders });
  }

  logStep("Event received", { type: event.type, id: event.id });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerEmail = session.customer_email || session.customer_details?.email;
        logStep("Checkout completed", { customerEmail, mode: session.mode });

        if (session.mode === "subscription" && customerEmail) {
          // Retrieve the subscription to get the product ID
          const subscriptionId = session.subscription as string;
          if (subscriptionId) {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            const productId = subscription.items.data[0]?.price?.product as string;
            const role = PRODUCT_TO_ROLE[productId] || "premium";
            await upgradeUserRole(supabase, customerEmail, role);
          } else {
            await upgradeUserRole(supabase, customerEmail, "premium");
          }
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        if (subscription.status === "active") {
          const customer = await stripe.customers.retrieve(subscription.customer as string);
          if ("email" in customer && customer.email) {
            const productId = subscription.items.data[0]?.price?.product as string;
            const role = PRODUCT_TO_ROLE[productId] || "premium";
            logStep("Active subscription, upgrading role", { email: customer.email, role, productId });
            await upgradeUserRole(supabase, customer.email, role);
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customer = await stripe.customers.retrieve(subscription.customer as string);
        if ("email" in customer && customer.email) {
          logStep("Subscription cancelled, downgrading role", { email: customer.email });
          await downgradeUserRole(supabase, customer.email);
        }
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }
  } catch (err) {
    logStep("ERROR processing event", { error: (err as Error).message });
    return new Response(JSON.stringify({ error: "Webhook processing failed" }), { status: 500, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});

async function upgradeUserRole(supabase: ReturnType<typeof createClient>, email: string, role: string) {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (profileError || !profile) {
    logStep("ERROR: User not found by email", { email, error: profileError?.message });
    return;
  }

  const userId = profile.id;

  // Remove any existing paid roles first
  for (const paidRole of PAID_ROLES) {
    await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", paidRole);
  }

  // Add the new role
  const { error: insertError } = await supabase
    .from("user_roles")
    .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });

  if (insertError) {
    logStep("ERROR: Failed to add role", { userId, role, error: insertError.message });
  } else {
    logStep(`Successfully upgraded user to ${role}`, { userId, email });
  }
}

async function downgradeUserRole(supabase: ReturnType<typeof createClient>, email: string) {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (profileError || !profile) {
    logStep("ERROR: User not found by email for downgrade", { email, error: profileError?.message });
    return;
  }

  const userId = profile.id;

  // Remove all paid roles
  for (const paidRole of PAID_ROLES) {
    await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", paidRole);
  }

  logStep("Successfully downgraded user", { userId, email });
}