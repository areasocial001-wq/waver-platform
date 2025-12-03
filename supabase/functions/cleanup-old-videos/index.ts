import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get retention days from request body or default to 30 days
    let retentionDays = 30;
    try {
      const body = await req.json();
      if (body.retentionDays) {
        retentionDays = parseInt(body.retentionDays);
      }
    } catch {
      // Use default if no body
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    console.log(`Cleaning up videos older than ${retentionDays} days (before ${cutoffDate.toISOString()})`);

    // Get old video generations from database
    const { data: oldVideos, error: queryError } = await supabase
      .from('video_generations')
      .select('id, video_url, created_at')
      .lt('created_at', cutoffDate.toISOString())
      .not('video_url', 'is', null);

    if (queryError) {
      console.error('Error querying old videos:', queryError);
      throw queryError;
    }

    console.log(`Found ${oldVideos?.length || 0} videos to clean up`);

    let deletedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const video of oldVideos || []) {
      try {
        // Extract file path from URL if it's a Supabase storage URL
        if (video.video_url && video.video_url.includes('/generated-videos/')) {
          const urlParts = video.video_url.split('/generated-videos/');
          if (urlParts.length > 1) {
            const filePath = decodeURIComponent(urlParts[1]);
            
            // Delete from storage
            const { error: deleteStorageError } = await supabase
              .storage
              .from('generated-videos')
              .remove([filePath]);

            if (deleteStorageError) {
              console.error(`Failed to delete file ${filePath}:`, deleteStorageError);
              errors.push(`Storage: ${filePath}`);
              errorCount++;
              continue;
            }
          }
        }

        // Delete record from database
        const { error: deleteDbError } = await supabase
          .from('video_generations')
          .delete()
          .eq('id', video.id);

        if (deleteDbError) {
          console.error(`Failed to delete record ${video.id}:`, deleteDbError);
          errors.push(`DB: ${video.id}`);
          errorCount++;
          continue;
        }

        deletedCount++;
        console.log(`Deleted video: ${video.id}`);
      } catch (err) {
        console.error(`Error processing video ${video.id}:`, err);
        errors.push(`Process: ${video.id}`);
        errorCount++;
      }
    }

    const result = {
      success: true,
      message: `Cleanup completed`,
      stats: {
        totalFound: oldVideos?.length || 0,
        deleted: deletedCount,
        errors: errorCount,
        retentionDays,
        cutoffDate: cutoffDate.toISOString(),
      },
      errorDetails: errors.length > 0 ? errors : undefined,
    };

    console.log('Cleanup result:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Cleanup error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
