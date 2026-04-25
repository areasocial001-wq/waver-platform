/**
 * ElevenLabs has been removed from the platform. This stub keeps the old
 * endpoint reachable so legacy widgets (ApiStatusNavWidget, ProviderCreditsWidget)
 * don't error out — it always reports "not configured".
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  return new Response(
    JSON.stringify({
      hasKey: false,
      status: "removed",
      message: "ElevenLabs is no longer integrated. Audio uses AIML / Inworld now.",
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
