import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { HfInference } from "https://esm.sh/@huggingface/inference@2.3.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let body: any;

  try {
    const HUGGING_FACE_ACCESS_TOKEN = Deno.env.get("HUGGING_FACE_ACCESS_TOKEN");
    if (!HUGGING_FACE_ACCESS_TOKEN) {
      throw new Error("HUGGING_FACE_ACCESS_TOKEN is not set");
    }

    const hf = new HfInference(HUGGING_FACE_ACCESS_TOKEN);

    body = await req.json();
    console.log("Generate video request:", body);

    // Hugging Face Inference API doesn't have a polling mechanism like Replicate
    // Generation is synchronous, so we don't need to check prediction status
    if (body.predictionId) {
      return new Response(
        JSON.stringify({ 
          error: "Hugging Face API doesn't support prediction polling" 
        }), 
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Start new video generation
    const { type, prompt, image_url, duration, generationId } = body;

    if (!type || !prompt) {
      return new Response(
        JSON.stringify({ 
          error: "Missing required fields: type and prompt are required" 
        }), 
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    console.log("Starting video generation with Hugging Face");

    let result;
    
    // For image-to-video generation
    if (type === "image_to_video" && image_url) {
      console.log("Generating video from image");
      
      // Convert base64 to blob if needed
      let imageData;
      if (image_url.startsWith('data:')) {
        imageData = image_url;
      } else {
        // If it's a URL, fetch and convert to base64
        const imageResponse = await fetch(image_url);
        const imageBlob = await imageResponse.blob();
        const arrayBuffer = await imageBlob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        imageData = `data:image/jpeg;base64,${base64}`;
      }

      const response = await fetch(
        "https://api-inference.huggingface.co/models/stabilityai/stable-video-diffusion-img2vid-xt",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${HUGGING_FACE_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: imageData,
            parameters: {
              num_frames: duration === 2 ? 14 : duration === 5 ? 25 : 50,
            }
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Hugging Face API error: ${response.status} - ${error}`);
      }

      const videoBlob = await response.blob();
      const arrayBuffer = await videoBlob.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      result = `data:video/mp4;base64,${base64}`;
    } else {
      // For text-to-video generation
      console.log("Generating video from text");
      
      const response = await fetch(
        "https://api-inference.huggingface.co/models/damo-vilab/text-to-video-ms-1.7b",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${HUGGING_FACE_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: prompt,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Hugging Face API error: ${response.status} - ${error}`);
      }

      const videoBlob = await response.blob();
      const arrayBuffer = await videoBlob.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      result = `data:video/mp4;base64,${base64}`;
    }

    console.log("Video generation completed");

    // Update database with result
    if (generationId) {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabaseClient = createClient(supabaseUrl, supabaseKey);

      await supabaseClient
        .from('video_generations')
        .update({
          status: 'completed',
          video_url: result,
        })
        .eq('id', generationId);
    }

    return new Response(JSON.stringify({ 
      status: "succeeded",
      output: result 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in generate-video function:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to generate video";
    
    // Update database with error
    if (body?.generationId) {
      try {
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabaseClient = createClient(supabaseUrl, supabaseKey);

        await supabaseClient
          .from('video_generations')
          .update({
            status: 'failed',
            error_message: errorMessage,
          })
          .eq('id', body.generationId);
      } catch (dbError) {
        console.error("Error updating database:", dbError);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage
      }), 
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
