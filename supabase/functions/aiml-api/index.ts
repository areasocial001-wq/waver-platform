import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Request validation schemas
const musicRequestSchema = z.object({
  operation: z.literal('music'),
  prompt: z.string().min(1).max(2000),
  model: z.enum(['suno', 'udio']).default('suno'),
  duration: z.number().min(5).max(300).optional(),
});

const ttsRequestSchema = z.object({
  operation: z.literal('tts'),
  text: z.string().min(1).max(5000),
  voice: z.string().optional(),
  model: z.enum(['elevenlabs', 'openai']).default('elevenlabs'),
});

const sttRequestSchema = z.object({
  operation: z.literal('stt'),
  audio_url: z.string().url(),
  language: z.string().optional(),
});

const imageRequestSchema = z.object({
  operation: z.literal('image'),
  prompt: z.string().min(1).max(2000),
  model: z.enum(['dalle3', 'flux', 'sdxl']).default('flux'),
  size: z.enum(['1024x1024', '1792x1024', '1024x1792']).default('1024x1024'),
});

const videoRequestSchema = z.object({
  operation: z.literal('video'),
  prompt: z.string().min(1).max(2000),
  model: z.enum(['runway', 'kling', 'veo']).default('kling'),
  image_url: z.string().url().optional(),
  duration: z.number().min(3).max(10).default(5),
});

const chatRequestSchema = z.object({
  operation: z.literal('chat'),
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string(),
  })),
  model: z.enum(['gpt5', 'claude', 'gemini']).default('gpt5'),
  max_tokens: z.number().optional(),
});

const statusRequestSchema = z.object({
  operation: z.literal('status'),
  task_id: z.string(),
});

// AIML API model mappings
const MODEL_MAPPINGS = {
  music: {
    suno: 'suno/suno-v4',
    udio: 'udio/udio-v1.5',
  },
  tts: {
    elevenlabs: 'elevenlabs/eleven_multilingual_v2',
    openai: 'openai/tts-1-hd',
  },
  image: {
    dalle3: 'openai/dall-e-3',
    flux: 'black-forest-labs/flux-1.1-pro',
    sdxl: 'stability-ai/sdxl-1.0',
  },
  video: {
    runway: 'runway/gen-3-alpha-turbo',
    kling: 'kling-ai/kling-v1.6-pro',
    veo: 'google/veo-3.1',
  },
  chat: {
    gpt5: 'openai/gpt-5',
    claude: 'anthropic/claude-4.5-sonnet',
    gemini: 'google/gemini-3-pro',
  }
};

const AIML_BASE_URL = 'https://api.aimlapi.com/v2';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    let userId: string | undefined;
    try {
      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
      if (!claimsError && claimsData?.claims) {
        userId = claimsData.claims.sub as string;
      }
    } catch (_) {
      // getClaims not available in this SDK version
    }
    if (!userId) {
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData?.user) {
        console.error('JWT validation failed:', userError);
        return new Response(
          JSON.stringify({ error: 'Invalid authentication token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      userId = userData.user.id;
    }
    const AIML_API_KEY = Deno.env.get('AIML_API_KEY');
    if (!AIML_API_KEY) {
      throw new Error('AIML_API_KEY is not configured');
    }

    const body = await req.json();
    const { operation } = body;

    console.log('AIML API request:', { operation, body: JSON.stringify(body).slice(0, 200) });

    // Health check
    if (body.healthCheck) {
      return new Response(
        JSON.stringify({ status: 'ok', service: 'aiml-api' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Status check
    if (operation === 'status') {
      const parsed = statusRequestSchema.parse(body);
      const response = await fetch(`${AIML_BASE_URL}/generate/status/${parsed.task_id}`, {
        headers: { 'Authorization': `Bearer ${AIML_API_KEY}` },
      });
      
      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`);
      }
      
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Music generation
    if (operation === 'music') {
      const parsed = musicRequestSchema.parse(body);
      const modelId = MODEL_MAPPINGS.music[parsed.model];
      
      const response = await fetch(`${AIML_BASE_URL}/generate/audio/music`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AIML_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelId,
          prompt: parsed.prompt,
          duration: parsed.duration || 30,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AIML music error:', response.status, errorText);
        throw new Error(`AIML API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('AIML music response:', JSON.stringify(data));
      
      return new Response(JSON.stringify({
        task_id: data.id || data.task_id,
        status: data.status || 'processing',
        audio_url: data.audio_url,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Text-to-Speech
    if (operation === 'tts') {
      const parsed = ttsRequestSchema.parse(body);
      const modelId = MODEL_MAPPINGS.tts[parsed.model];
      
      const response = await fetch(`${AIML_BASE_URL}/generate/audio/speech`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AIML_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelId,
          text: parsed.text,
          voice: parsed.voice || 'alloy',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AIML TTS error:', response.status, errorText);
        throw new Error(`AIML API error: ${response.status}`);
      }

      // For streaming audio response
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('audio')) {
        const audioBuffer = await response.arrayBuffer();
        const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
        return new Response(JSON.stringify({
          audio_content: base64Audio,
          format: 'mp3',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Speech-to-Text
    if (operation === 'stt') {
      const parsed = sttRequestSchema.parse(body);
      
      // Use the correct AIML API v1 STT endpoint
      const response = await fetch('https://api.aimlapi.com/v1/stt', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AIML_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: '#g1_whisper-large',
          url: parsed.audio_url,
          language: parsed.language,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AIML STT error:', response.status, errorText);
        throw new Error(`AIML API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('AIML STT response:', JSON.stringify(data));
      
      // Handle Deepgram-style response structure from AIML API
      // Response format: { results: { channels: [{ alternatives: [{ transcript, words }] }] } }
      let transcriptionText = '';
      let words = [];
      
      if (data.results?.channels?.[0]?.alternatives?.[0]) {
        const alternative = data.results.channels[0].alternatives[0];
        transcriptionText = alternative.transcript || '';
        words = alternative.words || [];
      } else {
        // Fallback to other possible formats
        transcriptionText = data.text || data.transcription || data.result?.text || '';
        words = data.words || data.result?.words || [];
      }
      
      return new Response(JSON.stringify({
        text: transcriptionText,
        words: words,
        duration: data.metadata?.duration,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Image generation
    if (operation === 'image') {
      const parsed = imageRequestSchema.parse(body);
      const modelId = MODEL_MAPPINGS.image[parsed.model];
      
      const response = await fetch(`${AIML_BASE_URL}/generate/image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AIML_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelId,
          prompt: parsed.prompt,
          size: parsed.size,
          n: 1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AIML image error:', response.status, errorText);
        throw new Error(`AIML API error: ${response.status}`);
      }

      const data = await response.json();
      return new Response(JSON.stringify({
        task_id: data.id,
        status: data.status || 'completed',
        image_url: data.data?.[0]?.url || data.image_url,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Video generation
    if (operation === 'video') {
      const parsed = videoRequestSchema.parse(body);
      const modelId = MODEL_MAPPINGS.video[parsed.model];
      
      const payload: Record<string, unknown> = {
        model: modelId,
        prompt: parsed.prompt,
        duration: parsed.duration,
      };
      
      if (parsed.image_url) {
        payload.image_url = parsed.image_url;
      }
      
      const response = await fetch(`${AIML_BASE_URL}/generate/video`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AIML_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AIML video error:', response.status, errorText);
        throw new Error(`AIML API error: ${response.status}`);
      }

      const data = await response.json();
      return new Response(JSON.stringify({
        task_id: data.id || data.task_id,
        status: data.status || 'processing',
        video_url: data.video_url,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Chat completion
    if (operation === 'chat') {
      const parsed = chatRequestSchema.parse(body);
      const modelId = MODEL_MAPPINGS.chat[parsed.model];
      
      const response = await fetch(`${AIML_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AIML_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelId,
          messages: parsed.messages,
          max_tokens: parsed.max_tokens || 1024,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AIML chat error:', response.status, errorText);
        throw new Error(`AIML API error: ${response.status}`);
      }

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error(`Unknown operation: ${operation}`);

  } catch (error) {
    console.error('Error in aiml-api function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
