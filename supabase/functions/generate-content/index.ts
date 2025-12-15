import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const requestSchema = z.object({
  prompt: z.string().min(1, 'Prompt è obbligatorio').max(10000, 'Prompt troppo lungo'),
  contentType: z.enum(['blog', 'social', 'product', 'email', 'general']).optional(),
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
    
    const { prompt, contentType } = parseResult.data;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY non configurata');
    }

    console.log('Generazione contenuto per tipo:', contentType);

    // Crea il system prompt basato sul tipo di contenuto
    let systemPrompt = 'Sei un assistente AI specializzato nella creazione di contenuti.';
    
    switch (contentType) {
      case 'blog':
        systemPrompt = 'Sei un esperto copywriter specializzato in articoli blog. Crea contenuti coinvolgenti, ben strutturati e ottimizzati SEO.';
        break;
      case 'social':
        systemPrompt = 'Sei un social media manager esperto. Crea post accattivanti, brevi e con call-to-action efficaci.';
        break;
      case 'product':
        systemPrompt = 'Sei un esperto di product description. Crea descrizioni persuasive che evidenziano benefici e caratteristiche uniche.';
        break;
      case 'email':
        systemPrompt = 'Sei un esperto di email marketing. Crea email professionali con oggetti accattivanti e contenuti persuasivi.';
        break;
      default:
        systemPrompt = 'Sei un assistente AI versatile specializzato nella creazione di contenuti di qualità.';
    }

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
          { role: 'user', content: prompt }
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite di richieste superato. Riprova più tardi.' }), 
          {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Crediti esauriti. Aggiungi crediti al tuo workspace.' }), 
          {
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      const errorText = await response.text();
      console.error('Errore AI gateway:', response.status, errorText);
      throw new Error('Errore nella generazione del contenuto');
    }

    return new Response(response.body, {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Errore in generate-content:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Errore sconosciuto' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
