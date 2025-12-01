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
    const KLING_ACCESS_KEY = Deno.env.get("KLING_ACCESS_KEY");
    const KLING_SECRET_KEY = Deno.env.get("KLING_SECRET_KEY");
    
    if (!GOOGLE_AI_API_KEY) {
      throw new Error("GOOGLE_AI_API_KEY is not set");
    }

    // Validate Kling credentials have actual values, not just empty strings
    const hasValidKlingCredentials = KLING_ACCESS_KEY && KLING_ACCESS_KEY.trim().length > 0 && 
                                     KLING_SECRET_KEY && KLING_SECRET_KEY.trim().length > 0;
    
    console.log("Kling credentials check:", {
      hasAccessKey: !!KLING_ACCESS_KEY,
      hasSecretKey: !!KLING_SECRET_KEY,
      accessKeyLength: KLING_ACCESS_KEY?.length || 0,
      secretKeyLength: KLING_SECRET_KEY?.length || 0,
      isValid: hasValidKlingCredentials
    });

    body = await req.json();
    console.log("Generate video request:", body);

    // Check if it's a polling request
    if (body.operationId) {
      console.log("Polling operation status:", body.operationId);
      
      // Check if it's a Kling task (format: kling:task_id)
      if (body.operationId.startsWith('kling:')) {
        if (!hasValidKlingCredentials) {
          throw new Error("KLING_ACCESS_KEY or KLING_SECRET_KEY is not properly configured. Please check your Lovable Cloud secrets.");
        }
        
        const taskId = body.operationId.replace('kling:', '');
        console.log("Polling Kling task:", taskId);
        
        const klingResponse = await fetch(`https://api.klingai.com/v1/videos/image2video/${taskId}`, {
          method: "GET",
          headers: {
            "X-Access-Key": KLING_ACCESS_KEY,
            "X-Secret-Key": KLING_SECRET_KEY,
          },
        });

        if (!klingResponse.ok) {
          const error = await klingResponse.text();
          throw new Error(`Kling API error: ${klingResponse.status} - ${error}`);
        }

        const klingData = await klingResponse.json();
        console.log("Kling task status:", klingData);
        
        if (klingData.data.task_status === "succeed") {
          const videoUrl = klingData.data.task_result.videos[0].url;
          
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
        } else if (klingData.data.task_status === "failed") {
          throw new Error(`Kling generation failed: ${klingData.data.task_status_msg || "Unknown error"}`);
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
    const { type, prompt, image_url, image, start_image, end_image, duration, resolution, generationId } = body;

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

    // For image-to-video, at least start_image is required
    if (type === "image_to_video" && !image && !image_url && !start_image) {
      return new Response(
        JSON.stringify({ 
          error: "Missing required field: start_image is required for image-to-video" 
        }), 
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Use Kling API if end_image is provided (it supports start/end frames)
    if (type === "image_to_video" && end_image && hasValidKlingCredentials) {
      console.log("Starting video generation with Kling 2.1 (supports start/end frames)");
      
      const startImageData = start_image || image || image_url;
      
      // Prepare Kling API request
      const klingPayload: any = {
        model_name: "kling-v1-5",
        prompt: prompt || "Smooth transition between images",
        negative_prompt: "",
        cfg_scale: 0.5,
        mode: "std",
        camera_control: {
          type: "simple",
          config: {
            horizontal: 0,
            vertical: 0,
            pan: 0,
            tilt: 0,
            roll: 0,
            zoom: 0
          }
        },
        image: startImageData.split(',')[1], // Remove data:image/...;base64, prefix
        image_tail: end_image.split(',')[1],  // End frame
        duration: duration || 5
      };

      console.log("Calling Kling API for image-to-video with start/end frames");

      const klingResponse = await fetch("https://api.klingai.com/v1/videos/image2video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Access-Key": KLING_ACCESS_KEY,
          "X-Secret-Key": KLING_SECRET_KEY,
        },
        body: JSON.stringify(klingPayload),
      });

      if (!klingResponse.ok) {
        const error = await klingResponse.text();
        console.error("Kling API error:", error);
        throw new Error(`Kling API error: ${klingResponse.status} - ${error}`);
      }

      const klingData = await klingResponse.json();
      console.log("Kling task started:", klingData);

      // Save Kling task ID to database
      if (generationId) {
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabaseClient = createClient(supabaseUrl, supabaseKey);

        await supabaseClient
          .from('video_generations')
          .update({
            status: 'processing',
            prediction_id: `kling:${klingData.data.task_id}`,
          })
          .eq('id', generationId);
      }

      return new Response(JSON.stringify({ 
        status: "starting",
        operationId: `kling:${klingData.data.task_id}`,
        provider: "kling"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
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
    if (type === "image_to_video") {
      // Use start_image if provided, otherwise fallback to legacy image/image_url
      const startImageData = start_image || image || image_url;
      
      if (startImageData) {
        const base64Data = startImageData.split(',')[1]; // Remove data:image/...;base64, prefix
        const mimeType = startImageData.startsWith('data:image/png') ? 'image/png' : 
                        startImageData.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
        
        requestBody.instances[0].image = {
          bytesBase64Encoded: base64Data,
          mimeType: mimeType
        };
        console.log("Added start image for image-to-video generation");
      }
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

      // For image-to-video, add the image(s)
      if (type === "image_to_video") {
        const startImageData = start_image || image || image_url;
        if (startImageData) {
          replicateInput.first_frame_image = startImageData;
        }
        // Note: Replicate minimax/video-01 may not support end_frame
        // If end_image is provided, we just use the start frame for Replicate fallback
        if (end_image) {
          console.log("Warning: Replicate fallback may not support end_frame. Using start frame only.");
        }
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
