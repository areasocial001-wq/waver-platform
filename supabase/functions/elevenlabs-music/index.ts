import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const requestSchema = z.object({
  prompt: z.string().min(1, 'Prompt obbligatorio').max(1000, 'Prompt troppo lungo'),
  category: z.enum(['music', 'sfx', 'ambient']).default('music'),
  duration: z.number().min(1).max(30).default(10),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    // Validate input
    const parseResult = requestSchema.safeParse(body);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: parseResult.error.errors[0].message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { prompt, category, duration } = parseResult.data;
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');

    if (!ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }

    console.log('Generating audio:', { category, prompt: prompt.substring(0, 100), duration });

    let response: Response;
    
    if (category === 'sfx') {
      // Use Sound Effects API
      response = await fetch(
        'https://api.elevenlabs.io/v1/sound-generation',
        {
          method: 'POST',
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: prompt,
            duration_seconds: Math.min(duration, 22), // SFX max is 22 seconds
            prompt_influence: 0.3,
          }),
        }
      );
    } else {
      // Use Music Generation API for music and ambient
      const enhancedPrompt = category === 'ambient' 
        ? `Ambient soundscape: ${prompt}. Seamless, loopable, atmospheric.`
        : `Background music: ${prompt}. Instrumental, suitable for video.`;
      
      response = await fetch(
        'https://api.elevenlabs.io/v1/music',
        {
          method: 'POST',
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: enhancedPrompt,
            duration_seconds: duration,
          }),
        }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', response.status, errorText);
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    console.log('Audio generated successfully, size:', audioBuffer.byteLength);

    // Convert to base64 using Deno's encoding library
    const base64Audio = base64Encode(audioBuffer);

    return new Response(
      JSON.stringify({ 
        audioContent: base64Audio,
        format: 'mp3',
        category,
        duration,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in elevenlabs-music function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
