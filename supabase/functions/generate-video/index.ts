import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) {
      throw new Error("GOOGLE_AI_API_KEY is not set");
    }

    body = await req.json();
    console.log("Generate video request:", body);

    // Check if it's a polling request
    if (body.operationId) {
      console.log("Polling operation status:", body.operationId);
      
      const pollResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${body.operationId}`,
        {
          method: "GET",
          headers: {
            "x-goog-api-key": GOOGLE_AI_API_KEY,
            "Content-Type": "application/json",
          },
        }
      );

      if (!pollResponse.ok) {
        const error = await pollResponse.text();
        throw new Error(`Google AI API error: ${pollResponse.status} - ${error}`);
      }

      const operation = await pollResponse.json();
      console.log("Operation status:", operation);

      // Check if operation is complete
      if (operation.done) {
        if (operation.error) {
          throw new Error(`Video generation failed: ${operation.error.message}`);
        }

        // Get video URL from response (REST API format)
        const videoUri = operation.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
        if (!videoUri) {
          throw new Error("No video URI in response");
        }

        // Download video and convert to base64
        const videoResponse = await fetch(videoUri, {
          headers: {
            "x-goog-api-key": GOOGLE_AI_API_KEY,
          },
        });
        
        if (!videoResponse.ok) {
          throw new Error(`Failed to download video: ${videoResponse.status}`);
        }
        
        const videoBlob = await videoResponse.blob();
        const arrayBuffer = await videoBlob.arrayBuffer();
        
        // Manual base64 encoding to avoid stack overflow with btoa()
        const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        const uint8Array = new Uint8Array(arrayBuffer);
        let base64 = '';
        
        for (let i = 0; i < uint8Array.length; i += 3) {
          const byte1 = uint8Array[i];
          const byte2 = i + 1 < uint8Array.length ? uint8Array[i + 1] : 0;
          const byte3 = i + 2 < uint8Array.length ? uint8Array[i + 2] : 0;
          
          const enc1 = byte1 >> 2;
          const enc2 = ((byte1 & 3) << 4) | (byte2 >> 4);
          const enc3 = ((byte2 & 15) << 2) | (byte3 >> 6);
          const enc4 = byte3 & 63;
          
          base64 += base64Chars[enc1] + base64Chars[enc2];
          base64 += (i + 1 < uint8Array.length) ? base64Chars[enc3] : '=';
          base64 += (i + 2 < uint8Array.length) ? base64Chars[enc4] : '=';
        }
        
        const videoUrl = `data:video/mp4;base64,${base64}`;

        // Update database
        if (body.generationId) {
          const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
          const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
          const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
          const supabaseClient = createClient(supabaseUrl, supabaseKey);

          await supabaseClient
            .from('video_generations')
            .update({
              status: 'completed',
              video_url: videoUrl,
            })
            .eq('id', body.generationId);
        }

        return new Response(JSON.stringify({ 
          status: "succeeded",
          output: videoUrl 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      } else {
        // Still processing
        return new Response(JSON.stringify({ 
          status: "processing"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    // Start new video generation
    const { type, prompt, image_url, image, duration, resolution, generationId } = body;

    if (!type) {
      return new Response(
        JSON.stringify({ 
          error: "Missing required field: type is required" 
        }), 
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // For text-to-video, prompt is required
    if (type === "text_to_video" && !prompt) {
      return new Response(
        JSON.stringify({ 
          error: "Missing required field: prompt is required for text-to-video" 
        }), 
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // For image-to-video, image is required
    if (type === "image_to_video" && !image && !image_url) {
      return new Response(
        JSON.stringify({ 
          error: "Missing required field: image is required for image-to-video" 
        }), 
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    console.log("Starting video generation with Google Veo 3.1");
    console.log("Received duration:", duration, "Type:", typeof duration);

    // Prepare request body for Google AI
    // Veo 3.1 only accepts exactly 4, 6, or 8 seconds (not values in between)
    const parsedDuration = typeof duration === 'string' ? parseInt(duration) : duration;
    let validDuration = 6; // default to 6
    
    if (parsedDuration <= 5) {
      validDuration = 4;
    } else if (parsedDuration <= 7) {
      validDuration = 6;
    } else {
      validDuration = 8;
    }
    
    console.log("Using validDuration:", validDuration);
    
    const requestBody: any = {
      instances: [{}],
      parameters: {
        durationSeconds: validDuration,
        aspectRatio: "16:9"
      }
    };

    // Add prompt if provided
    if (prompt) {
      requestBody.instances[0].prompt = prompt;
    }

    // Add image for image-to-video generation
    if (type === "image_to_video" && (image || image_url)) {
      const imageData = image || image_url;
      const base64Data = imageData.split(',')[1]; // Remove data:image/...;base64, prefix
      const mimeType = imageData.startsWith('data:image/png') ? 'image/png' : 
                      imageData.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
      
      requestBody.instances[0].image = {
        bytesBase64Encoded: base64Data,
        mimeType: mimeType
      };
      console.log("Added image for image-to-video generation");
    }

    // Add resolution for text-to-video if provided
    if (type === "text_to_video" && resolution) {
      requestBody.parameters.resolution = resolution;
    }

    console.log("Calling Google AI API for video generation");

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GOOGLE_AI_API_KEY,
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("Google AI API error:", error);
      throw new Error(`Google AI API error: ${response.status} - ${error}`);
    }

    const operation = await response.json();
    console.log("Operation started:", operation);

    // Save operation ID to database for polling
    if (generationId) {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabaseClient = createClient(supabaseUrl, supabaseKey);

      await supabaseClient
        .from('video_generations')
        .update({
          status: 'processing',
          prediction_id: operation.name, // Store operation ID
        })
        .eq('id', generationId);
    }

    return new Response(JSON.stringify({ 
      status: "starting",
      operationId: operation.name 
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
