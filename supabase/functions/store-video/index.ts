import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { generationId, videoUrl } = await req.json();

    if (!generationId || !videoUrl) {
      return new Response(
        JSON.stringify({ error: "Missing generationId or videoUrl" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Skip if already stored in our bucket
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    if (videoUrl.includes(supabaseUrl) && videoUrl.includes("/storage/")) {
      console.log("Video already in storage, skipping:", generationId);
      return new Response(
        JSON.stringify({ status: "already_stored", videoUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Storing video ${generationId} from: ${videoUrl.slice(0, 100)}...`);

    // Build fetch headers for the source video
    const fetchHeaders: Record<string, string> = {};
    
    // Add Google API key for Google-hosted URIs
    if (videoUrl.includes("generativelanguage.googleapis.com") || videoUrl.includes("googleapis.com")) {
      const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
      if (GOOGLE_AI_API_KEY) {
        fetchHeaders["x-goog-api-key"] = GOOGLE_AI_API_KEY;
      }
    }

    // Download the video
    const videoResponse = await fetch(videoUrl, { headers: fetchHeaders });
    
    if (!videoResponse.ok) {
      throw new Error(`Failed to download video: ${videoResponse.status} ${videoResponse.statusText}`);
    }

    const videoBlob = await videoResponse.blob();
    const videoSize = videoBlob.size;
    
    // Sanity check: video should be at least 10KB
    if (videoSize < 10000) {
      throw new Error(`Video too small (${videoSize} bytes), likely not a valid video`);
    }

    console.log(`Downloaded video: ${(videoSize / 1024 / 1024).toFixed(2)} MB`);

    // Determine content type
    const contentType = videoResponse.headers.get("Content-Type") || "video/mp4";
    const extension = contentType.includes("webm") ? "webm" : "mp4";

    // Create Supabase client with service role for storage access
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get user_id from the generation record
    const { data: genData, error: genError } = await supabaseAdmin
      .from("video_generations")
      .select("user_id")
      .eq("id", generationId)
      .single();

    if (genError || !genData) {
      throw new Error(`Generation not found: ${genError?.message}`);
    }

    const filePath = `${genData.user_id}/${generationId}.${extension}`;

    // Upload to storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from("generated-videos")
      .upload(filePath, videoBlob, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Create a signed URL (valid for 7 days - will be refreshed on access)
    const { data: signedData, error: signedError } = await supabaseAdmin.storage
      .from("generated-videos")
      .createSignedUrl(filePath, 60 * 60 * 24 * 7); // 7 days

    if (signedError || !signedData?.signedUrl) {
      throw new Error(`Failed to create signed URL: ${signedError?.message}`);
    }

    // Store the storage path (not the signed URL) so we can always regenerate signed URLs
    // We use a special format: storage://bucket/path
    const storageRef = `storage://generated-videos/${filePath}`;

    // Update the generation record with the storage reference
    const { error: updateError } = await supabaseAdmin
      .from("video_generations")
      .update({ video_url: storageRef })
      .eq("id", generationId);

    if (updateError) {
      throw new Error(`Failed to update generation: ${updateError.message}`);
    }

    console.log(`Video stored successfully: ${filePath} (${(videoSize / 1024 / 1024).toFixed(2)} MB)`);

    return new Response(
      JSON.stringify({ 
        status: "stored",
        storageRef,
        signedUrl: signedData.signedUrl,
        size: videoSize
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in store-video:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
