// Temporary edge function to create live Stripe products and prices
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });

  try {
    const results: Record<string, any> = {};

    // Premium - €29.90/month, €23.90/month yearly (€286.80/year)
    const premium = await stripe.products.create({ name: "Premium", description: "Piano Premium - Generazione video AI avanzata" });
    const premiumMonthly = await stripe.prices.create({ product: premium.id, unit_amount: 2990, currency: "eur", recurring: { interval: "month" } });
    const premiumYearly = await stripe.prices.create({ product: premium.id, unit_amount: 28680, currency: "eur", recurring: { interval: "year" } });
    results.premium = { product_id: premium.id, monthly: premiumMonthly.id, yearly: premiumYearly.id };

    // Creator - €49.90/month, €39.90/month yearly (€478.80/year)
    const creator = await stripe.products.create({ name: "Creator", description: "Piano Creator - Per creatori di contenuti professionali" });
    const creatorMonthly = await stripe.prices.create({ product: creator.id, unit_amount: 4990, currency: "eur", recurring: { interval: "month" } });
    const creatorYearly = await stripe.prices.create({ product: creator.id, unit_amount: 47880, currency: "eur", recurring: { interval: "year" } });
    results.creator = { product_id: creator.id, monthly: creatorMonthly.id, yearly: creatorYearly.id };

    // Business - €79.90/month, €63.90/month yearly (€766.80/year)
    const business = await stripe.products.create({ name: "Business", description: "Piano Business - Soluzione completa per team e aziende" });
    const businessMonthly = await stripe.prices.create({ product: business.id, unit_amount: 7990, currency: "eur", recurring: { interval: "month" } });
    const businessYearly = await stripe.prices.create({ product: business.id, unit_amount: 76680, currency: "eur", recurring: { interval: "year" } });
    results.business = { product_id: business.id, monthly: businessMonthly.id, yearly: businessYearly.id };

    return new Response(JSON.stringify(results, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
