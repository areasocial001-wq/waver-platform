import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const requestSchema = z.object({
  imageUrl: z.string().url('URL immagine non valido').max(2000, 'URL troppo lungo'),
  caption: z.string().max(500, 'Didascalia troppo lunga').optional(),
  customContext: z.string().max(1000, 'Contesto troppo lungo').optional(),
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
    
    const { imageUrl, caption, customContext } = parseResult.data;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Analyzing image and generating optimized prompts...');

    const systemPrompt = `You are an expert video production AI assistant specializing in creating optimized prompts for AI video generation.

Analyze the provided image and generate optimized video generation prompts. Your response MUST be valid JSON with this exact structure:
{
  "mainPrompt": "A detailed, cinematic prompt for video generation (2-3 sentences)",
  "cameraMovement": "Recommended camera movement (e.g., 'slow dolly in', 'tracking shot', 'static with subtle zoom')",
  "audioSuggestion": "Suggested audio/music style for the scene",
  "style": "Visual style category (e.g., 'cinematic', 'documentary', 'commercial', 'artistic')",
  "duration": 6,
  "keywords": ["keyword1", "keyword2", "keyword3"]
}

Guidelines:
- mainPrompt should describe motion, lighting, atmosphere, and key visual elements
- Consider the composition, colors, and mood of the image
- Suggest camera movements that enhance the narrative
- Duration should be 4, 6, or 8 seconds based on scene complexity
- Include 4-6 relevant keywords for the scene`;

    const userContent = [
      {
        type: "text",
        text: `Analyze this image and generate optimized video generation prompts.${caption ? ` Caption context: "${caption}"` : ''}${customContext ? ` Additional context: "${customContext}"` : ''}`
      },
      {
        type: "image_url",
        image_url: {
          url: imageUrl
        }
      }
    ];

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from AI');
    }

    console.log('AI response:', content);

    // Parse JSON from response
    let parsedResponse;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      // Return a default response if parsing fails
      parsedResponse = {
        mainPrompt: content.slice(0, 200),
        cameraMovement: 'slow dolly in',
        audioSuggestion: 'ambient atmospheric music',
        style: 'cinematic',
        duration: 6,
        keywords: ['cinematic', 'atmospheric', 'dynamic']
      };
    }

    return new Response(
      JSON.stringify(parsedResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in optimize-video-prompt:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
