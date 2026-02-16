import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const VIDU_API_BASE = 'https://api.vidu.com/ent/v2';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const VIDU_API_KEY = Deno.env.get('VIDU_API_KEY');
    if (!VIDU_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'VIDU_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { action } = body;

    // Health check
    if (body.healthCheck) {
      return new Response(
        JSON.stringify({ status: 'ok', service: 'vidu-video', hasKey: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Token ${VIDU_API_KEY}`,
    };

    // ==================== POLL STATUS ====================
    if (action === 'poll') {
      const { task_id } = body;
      if (!task_id) {
        return new Response(
          JSON.stringify({ error: 'task_id is required for polling' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[Vidu] Polling task: ${task_id}`);
      const pollResponse = await fetch(`${VIDU_API_BASE}/tasks/${task_id}/creations`, {
        method: 'GET',
        headers,
      });

      if (!pollResponse.ok) {
        const error = await pollResponse.text();
        console.error(`[Vidu] Poll error: ${pollResponse.status} - ${error}`);
        return new Response(
          JSON.stringify({ error: `Vidu poll error: ${pollResponse.status}`, details: error }),
          { status: pollResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const pollData = await pollResponse.json();
      console.log(`[Vidu] Poll result:`, JSON.stringify(pollData));

      const state = pollData.state;
      if (state === 'success') {
        const videoUrl = pollData.creations?.[0]?.url;
        const coverUrl = pollData.creations?.[0]?.cover_url;
        return new Response(
          JSON.stringify({ status: 'succeeded', output: videoUrl, coverUrl }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else if (state === 'failed') {
        return new Response(
          JSON.stringify({ status: 'failed', error: pollData.err_code || 'Vidu generation failed' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // created, queueing, processing
        return new Response(
          JSON.stringify({ status: 'processing', state }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ==================== TEXT TO VIDEO ====================
    if (action === 'text2video') {
      const {
        prompt, model = 'viduq3-pro', duration = 5, aspect_ratio = '16:9',
        resolution = '720p', style = 'general', seed, audio, movement_amplitude,
        callback_url,
      } = body;

      if (!prompt) {
        return new Response(
          JSON.stringify({ error: 'prompt is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const payload: any = {
        model,
        prompt,
        duration,
        aspect_ratio,
        resolution,
      };

      // Style only works on q1 model
      if (model === 'viduq1') {
        payload.style = style;
      }
      // Audio only works on q3 models
      if (model.startsWith('viduq3')) {
        payload.audio = audio !== false;
      }
      if (seed !== undefined) payload.seed = seed;
      if (movement_amplitude && model === 'viduq1') payload.movement_amplitude = movement_amplitude;
      if (callback_url) payload.callback_url = callback_url;

      console.log(`[Vidu] Text2Video request:`, JSON.stringify(payload));

      const response = await fetch(`${VIDU_API_BASE}/text2video`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`[Vidu] Text2Video error: ${response.status} - ${error}`);
        return new Response(
          JSON.stringify({ error: `Vidu error: ${response.status}`, details: error }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      console.log(`[Vidu] Text2Video response:`, JSON.stringify(data));

      return new Response(
        JSON.stringify({
          status: 'starting',
          task_id: data.task_id,
          state: data.state,
          credits: data.credits,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================== IMAGE TO VIDEO ====================
    if (action === 'img2video') {
      const {
        prompt, image_url, model = 'viduq3-pro', duration = 5,
        aspect_ratio, resolution = '720p', seed, audio,
        callback_url,
      } = body;

      if (!image_url) {
        return new Response(
          JSON.stringify({ error: 'image_url is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const payload: any = {
        model,
        image: { url: image_url, type: 'url' },
        duration,
        resolution,
      };

      if (prompt) payload.prompt = prompt;
      if (aspect_ratio) payload.aspect_ratio = aspect_ratio;
      if (seed !== undefined) payload.seed = seed;
      if (model.startsWith('viduq3')) {
        payload.audio = audio !== false;
      }
      if (callback_url) payload.callback_url = callback_url;

      console.log(`[Vidu] Img2Video request:`, JSON.stringify(payload));

      const response = await fetch(`${VIDU_API_BASE}/img2video`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`[Vidu] Img2Video error: ${response.status} - ${error}`);
        return new Response(
          JSON.stringify({ error: `Vidu error: ${response.status}`, details: error }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      console.log(`[Vidu] Img2Video response:`, JSON.stringify(data));

      return new Response(
        JSON.stringify({
          status: 'starting',
          task_id: data.task_id,
          state: data.state,
          credits: data.credits,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================== REFERENCE TO VIDEO ====================
    if (action === 'ref2video') {
      const {
        prompt, reference_images, model = 'viduq3-pro', duration = 5,
        aspect_ratio = '16:9', resolution = '720p', seed, audio,
        callback_url,
      } = body;

      if (!prompt || !reference_images || reference_images.length === 0) {
        return new Response(
          JSON.stringify({ error: 'prompt and reference_images are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const payload: any = {
        model,
        prompt,
        images: reference_images.map((url: string) => ({ url, type: 'url' })),
        duration,
        aspect_ratio,
        resolution,
      };

      if (seed !== undefined) payload.seed = seed;
      if (model.startsWith('viduq3')) {
        payload.audio = audio !== false;
      }
      if (callback_url) payload.callback_url = callback_url;

      console.log(`[Vidu] Ref2Video request:`, JSON.stringify(payload));

      const response = await fetch(`${VIDU_API_BASE}/reference2video`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`[Vidu] Ref2Video error: ${response.status} - ${error}`);
        return new Response(
          JSON.stringify({ error: `Vidu error: ${response.status}`, details: error }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      console.log(`[Vidu] Ref2Video response:`, JSON.stringify(data));

      return new Response(
        JSON.stringify({
          status: 'starting',
          task_id: data.task_id,
          state: data.state,
          credits: data.credits,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================== START-END TO VIDEO ====================
    if (action === 'startend2video') {
      const {
        prompt, start_image_url, end_image_url, model = 'viduq3-pro',
        duration = 5, resolution = '720p', seed, audio,
        callback_url,
      } = body;

      if (!start_image_url || !end_image_url) {
        return new Response(
          JSON.stringify({ error: 'start_image_url and end_image_url are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const payload: any = {
        model,
        first_frame: { url: start_image_url, type: 'url' },
        last_frame: { url: end_image_url, type: 'url' },
        duration,
        resolution,
      };

      if (prompt) payload.prompt = prompt;
      if (seed !== undefined) payload.seed = seed;
      if (model.startsWith('viduq3')) {
        payload.audio = audio !== false;
      }
      if (callback_url) payload.callback_url = callback_url;

      console.log(`[Vidu] StartEnd2Video request:`, JSON.stringify(payload));

      const response = await fetch(`${VIDU_API_BASE}/startend2video`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`[Vidu] StartEnd2Video error: ${response.status} - ${error}`);
        return new Response(
          JSON.stringify({ error: `Vidu error: ${response.status}`, details: error }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      console.log(`[Vidu] StartEnd2Video response:`, JSON.stringify(data));

      return new Response(
        JSON.stringify({
          status: 'starting',
          task_id: data.task_id,
          state: data.state,
          credits: data.credits,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================== UPSCALE ====================
    if (action === 'upscale') {
      const { creation_id, model = 'viduq3-pro', callback_url } = body;

      if (!creation_id) {
        return new Response(
          JSON.stringify({ error: 'creation_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const payload: any = {
        model,
        creation_id,
      };
      if (callback_url) payload.callback_url = callback_url;

      console.log(`[Vidu] Upscale request:`, JSON.stringify(payload));

      const response = await fetch(`${VIDU_API_BASE}/upscale`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`[Vidu] Upscale error: ${response.status} - ${error}`);
        return new Response(
          JSON.stringify({ error: `Vidu error: ${response.status}`, details: error }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      return new Response(
        JSON.stringify({ status: 'starting', task_id: data.task_id, state: data.state }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================== LIP SYNC ====================
    if (action === 'lipsync') {
      const { creation_id, audio_url, model = 'viduq3-pro', callback_url } = body;

      if (!creation_id || !audio_url) {
        return new Response(
          JSON.stringify({ error: 'creation_id and audio_url are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const payload: any = {
        model,
        creation_id,
        audio: { url: audio_url, type: 'url' },
      };
      if (callback_url) payload.callback_url = callback_url;

      console.log(`[Vidu] LipSync request:`, JSON.stringify(payload));

      const response = await fetch(`${VIDU_API_BASE}/lipsync`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`[Vidu] LipSync error: ${response.status} - ${error}`);
        return new Response(
          JSON.stringify({ error: `Vidu error: ${response.status}`, details: error }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      return new Response(
        JSON.stringify({ status: 'starting', task_id: data.task_id, state: data.state }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================== ACCOUNT / CREDITS ====================
    if (action === 'account') {
      const response = await fetch(`${VIDU_API_BASE}/credits?show_detail`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const error = await response.text();
        return new Response(
          JSON.stringify({ error: `Vidu error: ${response.status}`, details: error }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      // Sum up remaining credits across all packages
      const totalCredits = data.remains?.reduce((sum: number, r: any) => sum + (r.credit_remain || 0), 0) ?? 0;
      return new Response(
        JSON.stringify({ ...data, credits: totalCredits, hasKey: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}. Supported: text2video, img2video, ref2video, startend2video, upscale, lipsync, poll, account` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[Vidu] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
