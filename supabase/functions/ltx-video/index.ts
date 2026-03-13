import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const LTX_API_BASE = 'https://api.ltx.video/v1';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LTX_API_KEY = Deno.env.get('LTX_API_KEY');
    if (!LTX_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'LTX_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { action } = body;

    // Health check
    if (body.healthCheck) {
      return new Response(
        JSON.stringify({ status: 'ok', service: 'ltx-video', hasKey: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LTX_API_KEY}`,
    };

    // Helper: call LTX API, receive MP4 binary, upload to storage, return URL
    const callLtxAndStore = async (endpoint: string, payload: Record<string, unknown>, prefix: string): Promise<Response> => {
      console.log(`[LTX] ${endpoint} request:`, JSON.stringify(payload));

      const ltxResponse = await fetch(`${LTX_API_BASE}/${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!ltxResponse.ok) {
        const errorText = await ltxResponse.text();
        console.error(`[LTX] ${endpoint} error: ${ltxResponse.status} - ${errorText}`);
        return new Response(
          JSON.stringify({ error: `LTX error: ${ltxResponse.status}`, details: errorText }),
          { status: ltxResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // LTX returns the video file directly as MP4
      const videoBuffer = await ltxResponse.arrayBuffer();
      const requestId = ltxResponse.headers.get('x-request-id') || Date.now().toString();
      console.log(`[LTX] ${endpoint} completed, video size: ${videoBuffer.byteLength} bytes, request-id: ${requestId}`);

      // Upload to Supabase storage
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const fileName = `ltx-video/${prefix}_${Date.now()}_${requestId}.mp4`;
      const { error: uploadError } = await supabase.storage
        .from('generated-videos')
        .upload(fileName, new Uint8Array(videoBuffer), {
          contentType: 'video/mp4',
          upsert: true,
        });

      if (uploadError) {
        console.error('[LTX] Storage upload error:', uploadError);
        return new Response(
          JSON.stringify({ error: 'Failed to store video', details: uploadError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create signed URL (2h)
      const { data: signedData } = await supabase.storage
        .from('generated-videos')
        .createSignedUrl(fileName, 7200);

      const videoUrl = signedData?.signedUrl || supabase.storage.from('generated-videos').getPublicUrl(fileName).data.publicUrl;

      console.log(`[LTX] Video stored: ${fileName}`);

      return new Response(
        JSON.stringify({
          status: 'succeeded',
          output: videoUrl,
          storagePath: `storage://${fileName}`,
          requestId,
          provider: 'ltx',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    };

    // ==================== TEXT TO VIDEO ====================
    if (action === 'text2video') {
      const { prompt, model = 'ltx-2-3-pro', duration = 8, resolution = '1920x1080', fps, camera_motion, generate_audio } = body;

      if (!prompt) {
        return new Response(
          JSON.stringify({ error: 'prompt is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const payload: Record<string, unknown> = {
        prompt,
        model,
        duration,
        resolution,
      };
      if (fps) payload.fps = fps;
      if (camera_motion && camera_motion !== 'none') payload.camera_motion = camera_motion;
      if (generate_audio !== undefined) payload.generate_audio = generate_audio;

      return callLtxAndStore('text-to-video', payload, 't2v');
    }

    // ==================== IMAGE TO VIDEO ====================
    if (action === 'img2video') {
      const { prompt, image_uri, last_frame_uri, model = 'ltx-2-3-pro', duration = 8, resolution = '1920x1080', fps, camera_motion, generate_audio } = body;

      if (!image_uri) {
        return new Response(
          JSON.stringify({ error: 'image_uri is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const payload: Record<string, unknown> = {
        image_uri,
        prompt: prompt || '',
        model,
        duration,
        resolution,
      };
      if (last_frame_uri) payload.last_frame_uri = last_frame_uri;
      if (fps) payload.fps = fps;
      if (camera_motion && camera_motion !== 'none') payload.camera_motion = camera_motion;
      if (generate_audio !== undefined) payload.generate_audio = generate_audio;

      return callLtxAndStore('image-to-video', payload, 'i2v');
    }

    // ==================== AUDIO TO VIDEO ====================
    if (action === 'audio2video') {
      const { audio_uri, image_uri, prompt, resolution, guidance_scale, model = 'ltx-2-3-pro' } = body;

      if (!audio_uri) {
        return new Response(
          JSON.stringify({ error: 'audio_uri is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const payload: Record<string, unknown> = {
        audio_uri,
        model,
      };
      if (image_uri) payload.image_uri = image_uri;
      if (prompt) payload.prompt = prompt;
      if (resolution) payload.resolution = resolution;
      if (guidance_scale !== undefined) payload.guidance_scale = guidance_scale;

      return callLtxAndStore('audio-to-video', payload, 'a2v');
    }

    // ==================== RETAKE ====================
    if (action === 'retake') {
      const { video_uri, start_time, duration: retakeDuration, prompt, mode = 'replace_audio_and_video', resolution, model = 'ltx-2-3-pro' } = body;

      if (!video_uri || start_time === undefined || !retakeDuration) {
        return new Response(
          JSON.stringify({ error: 'video_uri, start_time, and duration are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const payload: Record<string, unknown> = {
        video_uri,
        start_time,
        duration: retakeDuration,
        model,
      };
      if (prompt) payload.prompt = prompt;
      if (mode) payload.mode = mode;
      if (resolution) payload.resolution = resolution;

      return callLtxAndStore('retake', payload, 'retake');
    }

    // ==================== EXTEND ====================
    if (action === 'extend') {
      const { video_uri, duration: extendDuration, prompt, mode = 'end', model = 'ltx-2-3-pro', context } = body;

      if (!video_uri || !extendDuration) {
        return new Response(
          JSON.stringify({ error: 'video_uri and duration are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const payload: Record<string, unknown> = {
        video_uri,
        duration: extendDuration,
        model,
      };
      if (prompt) payload.prompt = prompt;
      if (mode) payload.mode = mode;
      if (context !== undefined) payload.context = context;

      return callLtxAndStore('extend', payload, 'extend');
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}. Supported: text2video, img2video, audio2video, retake, extend` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[LTX] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
