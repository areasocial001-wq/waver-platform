import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * JSON2Video Webhook Endpoint
 * 
 * This function receives webhook notifications from JSON2Video when a render is complete.
 * It updates the notification record in the database and triggers realtime updates.
 * 
 * Webhook payload format:
 * {
 *   "width": "1920",
 *   "height": "1080",
 *   "duration": "10",
 *   "size": "35870",
 *   "url": "https://assets.json2video.com/...",
 *   "project": "4GpXmec1aEttCLTF",
 *   "id": "notification_uuid"
 * }
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse webhook payload
    const contentType = req.headers.get('content-type') || '';
    let payload: Record<string, string>;

    if (contentType.includes('application/json')) {
      payload = await req.json();
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      payload = Object.fromEntries(formData.entries()) as Record<string, string>;
    } else {
      // Try JSON first, fallback to form
      try {
        payload = await req.json();
      } catch {
        const text = await req.text();
        payload = Object.fromEntries(new URLSearchParams(text).entries());
      }
    }

    console.log('JSON2Video webhook received:', payload);

    const {
      width,
      height,
      duration,
      size,
      url,
      project: renderProjectId,
      id: notificationId,
    } = payload;

    if (!renderProjectId) {
      console.error('Missing project ID in webhook payload');
      return new Response(
        JSON.stringify({ error: 'Missing project ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the notification record by render_project_id or id
    let query = supabase
      .from('json2video_render_notifications')
      .select('*');
    
    if (notificationId) {
      query = query.eq('id', notificationId);
    } else {
      query = query.eq('render_project_id', renderProjectId);
    }

    const { data: notification, error: findError } = await query.maybeSingle();

    if (findError) {
      console.error('Error finding notification:', findError);
      return new Response(
        JSON.stringify({ error: 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!notification) {
      console.warn('Notification not found for project:', renderProjectId);
      // Still return 200 to prevent retries
      return new Response(
        JSON.stringify({ message: 'Notification not found, but acknowledged' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Download video and upload to Supabase storage for persistence
    let supabaseVideoUrl = url;
    
    if (url) {
      try {
        const videoResponse = await fetch(url);
        if (videoResponse.ok) {
          const videoBlob = await videoResponse.arrayBuffer();
          const fileName = `json2video-webhook/${Date.now()}-${renderProjectId}.mp4`;
          
          const { error: uploadError } = await supabase.storage
            .from('generated-videos')
            .upload(fileName, new Uint8Array(videoBlob), {
              contentType: 'video/mp4',
              upsert: true,
            });
          
          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from('generated-videos')
              .getPublicUrl(fileName);
            supabaseVideoUrl = urlData.publicUrl;
            console.log('Video uploaded to Supabase storage:', supabaseVideoUrl);
          }
        }
      } catch (uploadErr) {
        console.error('Failed to upload video to storage:', uploadErr);
        // Continue with original URL
      }
    }

    // Update the notification record
    const { error: updateError } = await supabase
      .from('json2video_render_notifications')
      .update({
        status: 'completed',
        video_url: supabaseVideoUrl,
        video_duration: duration ? parseFloat(duration) : null,
        video_size: size ? parseInt(size) : null,
        completed_at: new Date().toISOString(),
        notified_at: new Date().toISOString(),
      })
      .eq('id', notification.id);

    if (updateError) {
      console.error('Error updating notification:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update notification' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Notification updated successfully:', notification.id);

    // Optionally update the json2video_projects table if project_id is set
    if (notification.project_id && supabaseVideoUrl) {
      await supabase
        .from('json2video_projects')
        .update({
          rendered_url: supabaseVideoUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', notification.project_id);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Webhook processed successfully',
        notificationId: notification.id,
        videoUrl: supabaseVideoUrl,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Webhook processing error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
