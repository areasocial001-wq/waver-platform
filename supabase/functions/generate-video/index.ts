import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Replicate from "https://esm.sh/replicate@0.25.2";
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate JWT token for Kling API authentication
async function generateKlingJWT(accessKey: string, secretKey: string): Promise<string> {
  const header = { alg: "HS256" as const, typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: accessKey,
    exp: now + 1800, // 30 minutes expiration
    nbf: now - 5,    // valid from 5 seconds ago
  };
  
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  return await create(header, payload, key);
}

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
        
        // Generate JWT token for Kling API
        const klingJWT = await generateKlingJWT(KLING_ACCESS_KEY!, KLING_SECRET_KEY!);
        console.log("Generated Kling JWT for polling");
        
        const klingResponse = await fetch(`https://api.klingai.com/v1/videos/image2video/${taskId}`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${klingJWT}`,
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
      
      // Check if it's a Freepik task (format: freepik:model:task_id)
      if (body.operationId.startsWith('freepik:')) {
        const FREEPIK_API_KEY = Deno.env.get("FREEPIK_API_KEY");
        if (!FREEPIK_API_KEY) {
          throw new Error("FREEPIK_API_KEY is not set");
        }
        
        const parts = body.operationId.split(':');
        const modelEndpoint = parts[1];
        const taskId = parts[2];
        console.log("Polling Freepik task:", taskId, "model:", modelEndpoint);
        
        const freepikResponse = await fetch(`https://api.freepik.com/v1/ai/image-to-video/${modelEndpoint}/${taskId}`, {
          headers: {
            "x-freepik-api-key": FREEPIK_API_KEY,
          },
        });

        if (!freepikResponse.ok) {
          const error = await freepikResponse.text();
          throw new Error(`Freepik API error: ${freepikResponse.status} - ${error}`);
        }

        const freepikData = await freepikResponse.json();
        console.log("Freepik task status:", freepikData);
        
        if (freepikData.data?.status === "COMPLETED" && freepikData.data?.video?.url) {
          const videoUrl = freepikData.data.video.url;
          
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
        } else if (freepikData.data?.status === "FAILED") {
          throw new Error(`Freepik generation failed: ${freepikData.data?.error || "Unknown error"}`);
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
          // Check if it's a temporary overload error (code 14)
          const isOverloaded = operation.error.code === 14 || 
            (operation.error.message && operation.error.message.includes("overloaded"));
          
          if (isOverloaded) {
            // Return as failed with specific error so frontend can show retry option
            return new Response(JSON.stringify({
              status: "failed",
              error: "Il modello AI è temporaneamente sovraccarico. Riprova tra qualche minuto.",
              retryable: true
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200, // Return 200 so frontend can handle gracefully
            });
          }
          
          // For other errors, return as failed
          return new Response(JSON.stringify({
            status: "failed",
            error: operation.error.message || "Errore sconosciuto durante la generazione",
            retryable: false
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }

        // Get video URL from response (REST API format)
        const videoUri = operation.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
        if (!videoUri) {
          throw new Error("No video URI in response");
        }

        console.log("Video ready, downloading from Google:", videoUri);

        // Download video from Google's API
        const videoResponse = await fetch(videoUri, {
          headers: {
            "x-goog-api-key": GOOGLE_AI_API_KEY,
          },
        });

        if (!videoResponse.ok) {
          throw new Error(`Failed to download video: ${videoResponse.status}`);
        }

        // Get video as blob
        const videoBlob = await videoResponse.blob();
        console.log("Video downloaded, size:", videoBlob.size, "bytes");

        // Instead of uploading to Storage (bucket may not exist in some environments),
        // store a proxy URL that streams the video through our backend function.
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const proxyUrl = `${supabaseUrl}/functions/v1/video-proxy?uri=${encodeURIComponent(videoUri)}`;
        console.log("Using proxy URL:", proxyUrl);

        // Update database with proxy URL
        if (body.generationId) {
          const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
          const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
          const supabaseClient = createClient(supabaseUrl, supabaseKey);

          await supabaseClient
            .from('video_generations')
            .update({
              status: 'completed',
              video_url: proxyUrl,
            })
            .eq('id', body.generationId);

          return new Response(JSON.stringify({
            status: "succeeded",
            output: proxyUrl,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }

        return new Response(JSON.stringify({
          status: "succeeded",
          output: proxyUrl,
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
    const { type, prompt, image_url, image, start_image, end_image, duration, resolution, generationId, preferredProvider } = body;

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

    // Use Freepik if explicitly requested as preferred provider
    if (preferredProvider === "freepik" && type === "image_to_video" && end_image) {
      const FREEPIK_API_KEY = Deno.env.get("FREEPIK_API_KEY");
      if (!FREEPIK_API_KEY) {
        console.log("Freepik API key not set, falling back to other providers");
      } else {
        console.log("Starting video generation with Freepik (preferred provider)");
        
        const startImageData = start_image || image || image_url;
        
        if (!startImageData) {
          throw new Error("Start image is required for Freepik image-to-video generation");
        }
        
        // Extract base64 data from data URLs
        const extractBase64 = (data: string): string => {
          if (!data) return "";
          if (data.includes(',')) {
            return data.split(',')[1];
          }
          return data;
        };
        
        const startBase64 = extractBase64(startImageData);
        const endBase64 = extractBase64(end_image);
        
        // Use minimax endpoint for start/end frame transitions
        const freepikPayload = {
          image: startBase64,
          end_image: endBase64,
          prompt: prompt || "Smooth cinematic transition between scenes",
        };
        
        console.log("Calling Freepik MiniMax API for image-to-video with start/end frames");
        
        const freepikResponse = await fetch("https://api.freepik.com/v1/ai/image-to-video/minimax", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-freepik-api-key": FREEPIK_API_KEY,
          },
          body: JSON.stringify(freepikPayload),
        });

        if (!freepikResponse.ok) {
          const error = await freepikResponse.text();
          console.error("Freepik API error:", error);
          // Don't throw, fall back to other providers
          console.log("Freepik failed, falling back to Kling/Veo");
        } else {
          const freepikData = await freepikResponse.json();
          console.log("Freepik task started:", freepikData);

          // Save Freepik task ID to database
          if (generationId) {
            const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
            const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
            const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
            const supabaseClient = createClient(supabaseUrl, supabaseKey);

            await supabaseClient
              .from('video_generations')
              .update({
                status: 'processing',
                prediction_id: `freepik:minimax:${freepikData.data.task_id}`,
              })
              .eq('id', generationId);
          }

          return new Response(JSON.stringify({ 
            status: "starting",
            operationId: `freepik:minimax:${freepikData.data.task_id}`,
            provider: "freepik"
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      }
    }

    // Use Kling API if end_image is provided (it supports start/end frames)
    if (type === "image_to_video" && end_image && hasValidKlingCredentials) {
      console.log("Starting video generation with Kling 2.1 (supports start/end frames)");
      
      const startImageData = start_image || image || image_url;
      
      console.log("DEBUG - start_image present:", !!start_image);
      console.log("DEBUG - image present:", !!image);
      console.log("DEBUG - image_url present:", !!image_url);
      console.log("DEBUG - startImageData present:", !!startImageData);
      console.log("DEBUG - end_image present:", !!end_image);
      
      if (!startImageData) {
        throw new Error("Start image is required for Kling image-to-video generation");
      }
      
      // Extract base64 data from data URLs
      const extractBase64 = (data: string): string => {
        if (!data) return "";
        if (data.includes(',')) {
          return data.split(',')[1];
        }
        return data;
      };
      
      const startBase64 = extractBase64(startImageData);
      const endBase64 = extractBase64(end_image);
      
      console.log("DEBUG - startBase64 length:", startBase64?.length || 0);
      console.log("DEBUG - endBase64 length:", endBase64?.length || 0);
      
      if (!startBase64 || startBase64.length < 100) {
        throw new Error("Invalid start image base64 data");
      }
      
      // Prepare Kling API request
      // For image_tail (start/end frame) support, use pro mode for better compatibility
      const requestedDuration = duration && duration >= 8 ? 10 : 5;
      // Always use pro mode with image_tail for better compatibility
      const klingMode = "pro";
      const klingDuration = String(requestedDuration);
      
      console.log(`Kling config: mode=${klingMode}, duration=${klingDuration}s`);
      
      const klingPayload: any = {
        model_name: "kling-v1-5",
        prompt: prompt || "Smooth transition between images",
        negative_prompt: "",
        cfg_scale: 0.5,
        mode: klingMode,
        image: startBase64,
        image_tail: endBase64,
        duration: klingDuration
      };
      
      console.log("Kling payload keys:", Object.keys(klingPayload));
      console.log("Kling image field length:", klingPayload.image?.length || 0);
      console.log("Kling image_tail field length:", klingPayload.image_tail?.length || 0);

      console.log("Calling Kling API for image-to-video with start/end frames");

      // Generate JWT token for Kling API
      const klingJWT = await generateKlingJWT(KLING_ACCESS_KEY!, KLING_SECRET_KEY!);
      console.log("Generated Kling JWT for video generation");

      const klingResponse = await fetch("https://api.klingai.com/v1/videos/image2video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${klingJWT}`,
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
        let base64Data: string;
        let mimeType: string;
        
        // Check if it's a data URL with base64 content
        if (startImageData.startsWith('data:')) {
          // Extract MIME type from data URL
          const mimeMatch = startImageData.match(/^data:(image\/[^;]+);base64,/);
          if (mimeMatch) {
            mimeType = mimeMatch[1];
            base64Data = startImageData.split(',')[1];
          } else {
            console.error("Invalid data URL format:", startImageData.substring(0, 50));
            throw new Error("Invalid image data URL format. Expected data:image/...;base64,...");
          }
        } else if (startImageData.startsWith('http://') || startImageData.startsWith('https://')) {
          // It's a URL - need to download and convert to base64
          console.log("Downloading image from URL:", startImageData.substring(0, 100));
          const imageResponse = await fetch(startImageData);
          if (!imageResponse.ok) {
            throw new Error(`Failed to download image from URL: ${imageResponse.status}`);
          }
          const imageBlob = await imageResponse.blob();
          const arrayBuffer = await imageBlob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          base64Data = btoa(String.fromCharCode(...uint8Array));
          
          // Determine MIME type from content-type header or URL extension
          const contentType = imageResponse.headers.get('content-type');
          if (contentType && contentType.startsWith('image/')) {
            mimeType = contentType.split(';')[0]; // Remove charset if present
          } else if (startImageData.toLowerCase().includes('.png')) {
            mimeType = 'image/png';
          } else if (startImageData.toLowerCase().includes('.webp')) {
            mimeType = 'image/webp';
          } else {
            mimeType = 'image/jpeg';
          }
        } else {
          // Assume it's raw base64 without prefix, default to JPEG
          base64Data = startImageData;
          mimeType = 'image/jpeg';
        }
        
        if (!base64Data) {
          throw new Error("Failed to extract base64 data from image");
        }
        
        requestBody.instances[0].image = {
          bytesBase64Encoded: base64Data,
          mimeType: mimeType
        };
        console.log("Added start image for image-to-video generation, mimeType:", mimeType);
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

    // Check if Google API returned quota error (429), fallback to Freepik or Replicate
    if (!response.ok && response.status === 429) {
      console.log("Google quota exceeded, trying Freepik then Replicate");
      
      const FREEPIK_API_KEY = Deno.env.get("FREEPIK_API_KEY");
      const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
      
      // Try Freepik first if API key is available
      if (FREEPIK_API_KEY) {
        try {
          console.log("Attempting Freepik video generation");
          
          const freepikPayload: any = {
            prompt: prompt || "A video based on the provided image",
            prompt_optimizer: true,
            duration: duration && duration >= 8 ? 10 : 6,
          };
          
          // For image-to-video, add the image(s)
          if (type === "image_to_video") {
            const startImageData = start_image || image || image_url;
            if (startImageData) {
              freepikPayload.first_frame_image = startImageData;
            }
            if (end_image) {
              freepikPayload.last_frame_image = end_image;
            }
          }
          
          // Use MiniMax for start/end frame support, Kling for single image
          const modelEndpoint = end_image ? "minimax-hailuo-02-768p" : "kling-v2-5-pro";
          
          const freepikResponse = await fetch(`https://api.freepik.com/v1/ai/image-to-video/${modelEndpoint}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-freepik-api-key": FREEPIK_API_KEY,
            },
            body: JSON.stringify(freepikPayload),
          });
          
          if (freepikResponse.ok) {
            const freepikData = await freepikResponse.json();
            console.log("Freepik video task started:", freepikData);
            
            // Save Freepik task ID to database
            if (generationId) {
              const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
              const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
              const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
              const supabaseClient = createClient(supabaseUrl, supabaseKey);
              
              await supabaseClient
                .from('video_generations')
                .update({
                  status: 'processing',
                  prediction_id: `freepik:${modelEndpoint}:${freepikData.data.task_id}`,
                })
                .eq('id', generationId);
            }
            
            return new Response(JSON.stringify({ 
              status: "starting",
              operationId: `freepik:${modelEndpoint}:${freepikData.data.task_id}`,
              provider: "freepik"
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            });
          } else {
            console.log("Freepik failed, falling back to Replicate");
          }
        } catch (freepikError) {
          console.error("Freepik error, falling back to Replicate:", freepikError);
        }
      }
      
      // Fallback to Replicate
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
    
    // Check if error is retryable (model overload, rate limits, etc.)
    const isRetryable = errorMessage.includes("overloaded") || 
                        errorMessage.includes("rate limit") ||
                        errorMessage.includes("quota") ||
                        errorMessage.includes("temporarily") ||
                        errorMessage.includes("RESOURCE_EXHAUSTED") ||
                        errorMessage.includes("429");
    
    // Update database with error and retry info
    if (body?.generationId) {
      try {
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabaseClient = createClient(supabaseUrl, supabaseKey);

        // Get current retry count
        const { data: currentGen } = await supabaseClient
          .from('video_generations')
          .select('retry_count, max_retries')
          .eq('id', body.generationId)
          .single();

        const retryCount = (currentGen?.retry_count || 0) + 1;
        const maxRetries = currentGen?.max_retries || 3;
        
        if (isRetryable && retryCount <= maxRetries) {
          // Calculate exponential backoff: 30s, 60s, 120s
          const backoffSeconds = Math.pow(2, retryCount - 1) * 30;
          const nextRetryAt = new Date(Date.now() + backoffSeconds * 1000).toISOString();
          
          await supabaseClient
            .from('video_generations')
            .update({
              status: 'pending',
              retry_count: retryCount,
              next_retry_at: nextRetryAt,
              error_message: `Tentativo ${retryCount}/${maxRetries} - ${errorMessage}`,
            })
            .eq('id', body.generationId);
          
          console.log(`Scheduled retry ${retryCount}/${maxRetries} in ${backoffSeconds}s`);
          
          return new Response(
            JSON.stringify({ 
              status: "retry_scheduled",
              retryCount,
              maxRetries,
              nextRetryAt,
              error: errorMessage
            }), 
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            }
          );
        } else {
          await supabaseClient
            .from('video_generations')
            .update({
              status: 'failed',
              error_message: retryCount > maxRetries 
                ? `Fallito dopo ${maxRetries} tentativi: ${errorMessage}`
                : errorMessage,
            })
            .eq('id', body.generationId);
        }
      } catch (dbError) {
        console.error("Error updating database:", dbError);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        retryable: isRetryable
      }), 
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
