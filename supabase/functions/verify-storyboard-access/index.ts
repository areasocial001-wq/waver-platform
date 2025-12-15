import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { storyboardId, password } = await req.json();

    // Input validation
    if (!storyboardId || typeof storyboardId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'storyboardId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // UUID format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(storyboardId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid storyboard ID format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch storyboard with service role (bypasses RLS)
    const { data: storyboard, error } = await supabase
      .from('storyboards')
      .select('id, title, layout, panels, tags, template_type, is_public, share_password')
      .eq('id', storyboardId)
      .single();

    if (error || !storyboard) {
      console.error('Storyboard not found:', error);
      return new Response(
        JSON.stringify({ error: 'Storyboard not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if storyboard is public
    if (!storyboard.is_public) {
      return new Response(
        JSON.stringify({ error: 'Storyboard is not public' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if password is required
    if (storyboard.share_password) {
      if (!password) {
        return new Response(
          JSON.stringify({ 
            requiresPassword: true,
            error: 'Password required' 
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate password (server-side)
      if (password !== storyboard.share_password) {
        console.log('Invalid password attempt for storyboard:', storyboardId);
        return new Response(
          JSON.stringify({ error: 'Invalid password' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Password valid or not required - return storyboard data WITHOUT the password
    const { share_password, ...safeStoryboard } = storyboard;

    console.log('Storyboard access granted:', storyboardId);

    return new Response(
      JSON.stringify({ 
        success: true,
        storyboard: safeStoryboard
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in verify-storyboard-access:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
