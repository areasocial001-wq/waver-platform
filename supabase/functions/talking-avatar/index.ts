import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schemas
const generateSchema = z.object({
  action: z.literal('generate').optional(),
  prompt: z.string().min(1, 'Prompt richiesto').max(2000, 'Prompt troppo lungo'),
  imageUrl: z.string().url().or(z.string().startsWith('data:')),
  audioUrl: z.string().url().optional(),
  sampleSteps: z.number().int().min(10).max(50).optional(),
});

const statusSchema = z.object({
  action: z.literal('status'),
  eventId: z.string().min(1),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const HF_TOKEN = Deno.env.get("HUGGING_FACE_ACCESS_TOKEN");
    if (!HF_TOKEN) {
      throw new Error("HUGGING_FACE_ACCESS_TOKEN is not configured");
    }

    const body = await req.json();
    const { action } = body;

    // Check status of existing task
    if (action === "status") {
      const parseResult = statusSchema.safeParse(body);
      if (!parseResult.success) {
        return new Response(
          JSON.stringify({ error: parseResult.error.errors[0].message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { eventId } = parseResult.data;
      console.log("Checking talking avatar status:", eventId);

      // Check Gradio queue status
      const statusResponse = await fetch(
        `https://alexnasa-ovi-zerogpu.hf.space/gradio_api/call/${eventId}/status`,
        {
          headers: {
            "Authorization": `Bearer ${HF_TOKEN}`,
          },
        }
      );

      if (!statusResponse.ok) {
        // Try to get result directly
        const resultResponse = await fetch(
          `https://alexnasa-ovi-zerogpu.hf.space/gradio_api/call/${eventId}`,
          {
            headers: {
              "Authorization": `Bearer ${HF_TOKEN}`,
            },
          }
        );

        if (resultResponse.ok) {
          const reader = resultResponse.body?.getReader();
          if (reader) {
            const decoder = new TextDecoder();
            let result = '';
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              result += decoder.decode(value, { stream: true });
            }
            
            // Parse SSE response
            const lines = result.split('\n');
            for (const line of lines) {
              if (line.startsWith('data:')) {
                const data = JSON.parse(line.slice(5).trim());
                if (data && Array.isArray(data) && data[0]) {
                  return new Response(JSON.stringify({
                    status: 'COMPLETED',
                    videoUrl: data[0].url || data[0],
                  }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                  });
                }
              }
            }
          }
        }

        return new Response(JSON.stringify({
          status: 'PROCESSING',
          message: 'Generazione in corso...',
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const statusData = await statusResponse.json();
      return new Response(JSON.stringify(statusData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate new talking avatar video
    const parseResult = generateSchema.safeParse(body);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: parseResult.error.errors[0].message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { prompt, imageUrl, sampleSteps = 20 } = parseResult.data;

    console.log("Generating talking avatar with params:", { 
      prompt: prompt.substring(0, 100), 
      imageUrl: imageUrl.substring(0, 50),
      sampleSteps 
    });

    // Prepare image for Gradio
    let imageData = imageUrl;
    if (imageUrl.startsWith('data:')) {
      // Convert base64 to blob URL by uploading to HF
      const base64Data = imageUrl.split(',')[1];
      const mimeType = imageUrl.split(';')[0].split(':')[1];
      
      // For Gradio, we need to upload the file first
      const uploadResponse = await fetch(
        'https://alexnasa-ovi-zerogpu.hf.space/gradio_api/upload',
        {
          method: 'POST',
          headers: {
            "Authorization": `Bearer ${HF_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            files: [{
              path: `image.${mimeType.split('/')[1] || 'png'}`,
              data: base64Data,
            }]
          }),
        }
      );

      if (uploadResponse.ok) {
        const uploadResult = await uploadResponse.json();
        if (uploadResult && uploadResult[0]) {
          imageData = uploadResult[0];
        }
      }
    }

    // Call Ovi Gradio API
    const response = await fetch(
      'https://alexnasa-ovi-zerogpu.hf.space/gradio_api/call/run',
      {
        method: 'POST',
        headers: {
          "Authorization": `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: [
            prompt,           // Scene prompt with dialogue
            sampleSteps,      // Sample steps
            imageData,        // Image reference
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Ovi API error:", response.status, errorText);
      
      // Fallback: try alternative talking head approach
      return new Response(JSON.stringify({ 
        error: `Ovi API error: ${response.status}`,
        fallback: true,
        message: 'Il modello Ovi non è disponibile. Prova con un altro metodo.',
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    console.log("Ovi generation response:", JSON.stringify(data));

    // Gradio returns an event_id for async processing
    if (data.event_id) {
      return new Response(JSON.stringify({ 
        eventId: data.event_id,
        status: 'PROCESSING',
        message: 'Generazione avviata...',
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If we get direct result
    if (data.data && data.data[0]) {
      return new Response(JSON.stringify({
        status: 'COMPLETED',
        videoUrl: data.data[0].url || data.data[0],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in talking-avatar function:", error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
