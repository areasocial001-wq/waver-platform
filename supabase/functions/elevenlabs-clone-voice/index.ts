/**
 * ElevenLabs voice cloning has been retired. The new flow will use Inworld
 * IVC. This stub returns 410 Gone so any leftover frontend caller surfaces
 * a clear error instead of silently misbehaving.
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
      error: "ElevenLabs voice cloning has been removed. Inworld IVC support is coming soon.",
      reason: "feature_removed",
    }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
