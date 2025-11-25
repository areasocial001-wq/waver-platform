import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Replicate from "https://esm.sh/replicate@0.25.2";

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
      
      // Check if it's a Replicate prediction (format: replicate:prediction_id)
      if (body.operationId.startsWith('replicate:')) {
        const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
        if (!REPLICATE_API_KEY) {
          throw new Error("REPLICATE_API_KEY is not set");
        }
        
        const replicate = new Replicate({ auth: REPLICATE_API_KEY });
        const predictionId = body.operationId.replace('replicate:', '');
        
        console.log("Polling Replicate prediction:", predictionId);
        const prediction = await replicate.predictions.get(predictionId);
        console.log("Replicate prediction status:", prediction);
        
        if (prediction.status === "succeeded") {
          const videoUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
          
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

            return new Response(JSON.stringify({ 
              status: "succeeded",
              output: videoUrl 
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            });
          }

          return new Response(JSON.stringify({ 
            status: "succeeded",
            output: videoUrl 
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        } else if (prediction.status === "failed") {
          throw new Error(`Replicate generation failed: ${prediction.error || "Unknown error"}`);
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

        // Store the internal Google URI - we'll proxy it through our endpoint
        const internalVideoUri = videoUri;

        // Update database with internal URI
        if (body.generationId) {
          const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
          const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
          const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
          const supabaseClient = createClient(supabaseUrl, supabaseKey);

          // Create proxy URL for the client to use
          const proxyUrl = `${supabaseUrl}/functions/v1/video-proxy?uri=${encodeURIComponent(internalVideoUri)}`;

          await supabaseClient
            .from('video_generations')
            .update({
              status: 'completed',
              video_url: proxyUrl,
            })
            .eq('id', body.generationId);

          return new Response(JSON.stringify({ 
            status: "succeeded",
            output: proxyUrl 
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }

        return new Response(JSON.stringify({ 
          status: "succeeded",
          output: internalVideoUri 
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

    let response = await fetch(
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

    // Check if Google API returned quota error (429), fallback to Replicate
    if (!response.ok && response.status === 429) {
      console.log("Google quota exceeded, falling back to Replicate");
      
      const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
      if (!REPLICATE_API_KEY) {
        const error = await response.text();
        throw new Error(`Google AI API error: ${response.status} - ${error}`);
      }

      const replicate = new Replicate({ auth: REPLICATE_API_KEY });
      
      // Use minimax/video-01 model on Replicate
      const replicateInput: any = {
        prompt: prompt || "A video based on the provided image",
      };

      // For image-to-video, add the image
      if (type === "image_to_video" && (image || image_url)) {
        replicateInput.first_frame_image = image || image_url;
      }

      console.log("Starting Replicate generation with minimax/video-01");
      const prediction = await replicate.predictions.create({
        model: "minimax/video-01",
        input: replicateInput,
      });

      console.log("Replicate prediction started:", prediction);

      // Save Replicate prediction ID to database
      if (generationId) {
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabaseClient = createClient(supabaseUrl, supabaseKey);

        await supabaseClient
          .from('video_generations')
          .update({
            status: 'processing',
            prediction_id: `replicate:${prediction.id}`,
          })
          .eq('id', generationId);
      }

      return new Response(JSON.stringify({ 
        status: "starting",
        operationId: `replicate:${prediction.id}`,
        provider: "replicate"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

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
