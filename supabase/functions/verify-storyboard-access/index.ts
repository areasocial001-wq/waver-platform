import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting: track failed attempts per storyboard
const failedAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function isRateLimited(storyboardId: string): boolean {
  const attempts = failedAttempts.get(storyboardId);
  if (!attempts) return false;
  
  // Reset if lockout period has passed
  if (Date.now() - attempts.lastAttempt > LOCKOUT_DURATION_MS) {
    failedAttempts.delete(storyboardId);
    return false;
  }
  
  return attempts.count >= MAX_ATTEMPTS;
}

function recordFailedAttempt(storyboardId: string): void {
  const attempts = failedAttempts.get(storyboardId);
  if (attempts) {
    attempts.count++;
    attempts.lastAttempt = Date.now();
  } else {
    failedAttempts.set(storyboardId, { count: 1, lastAttempt: Date.now() });
  }
}

function resetAttempts(storyboardId: string): void {
  failedAttempts.delete(storyboardId);
}

// Check if password is already hashed (bcrypt hashes start with $2a$, $2b$, or $2y$)
function isHashedPassword(password: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(password);
}

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

    // Check rate limiting
    if (isRateLimited(storyboardId)) {
      console.log('Rate limited access attempt for storyboard:', storyboardId);
      return new Response(
        JSON.stringify({ error: 'Too many failed attempts. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch storyboard with service role (bypasses RLS)
    const { data: storyboard, error } = await supabase
      .from('storyboards')
      .select('id, title, layout, panels, tags, template_type, is_public')
      .eq('id', storyboardId)
      .single();

    if (error || !storyboard) {
      console.error('Storyboard not found:', error);
      return new Response(
        JSON.stringify({ error: 'Storyboard not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch share password from separate table
    const { data: pwData } = await supabase
      .from('storyboard_share_passwords')
      .select('share_password')
      .eq('storyboard_id', storyboardId)
      .maybeSingle();
    
    const sharePassword = pwData?.share_password || null;

    // Check if storyboard is public
    if (!storyboard.is_public) {
      return new Response(
        JSON.stringify({ error: 'Storyboard is not public' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if password is required
    if (sharePassword) {
      if (!password) {
        return new Response(
          JSON.stringify({ 
            requiresPassword: true,
            error: 'Password required' 
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate password using bcrypt if hashed, otherwise plain comparison for legacy passwords
      let isValidPassword = false;
      
      if (isHashedPassword(sharePassword)) {
        isValidPassword = await bcrypt.compare(password, sharePassword);
      } else {
        isValidPassword = password === sharePassword;
      }

      if (!isValidPassword) {
        recordFailedAttempt(storyboardId);
        console.log('Invalid password attempt for storyboard:', storyboardId);
        return new Response(
          JSON.stringify({ error: 'Invalid password' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Reset failed attempts on successful login
      resetAttempts(storyboardId);
    }

    // Password valid or not required - return storyboard data
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
