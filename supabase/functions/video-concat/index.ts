import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const requestSchema = z.object({
  videoUrls: z.array(z.string().url()).min(1, 'Almeno un video richiesto'),
  transition: z.enum(['none', 'fade', 'crossfade', 'wipe']).default('none'),
  transitionDuration: z.number().min(0).max(5).default(0.5),
  audioUrl: z.string().optional(),
  audioVolume: z.number().min(0).max(100).default(100),
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
    
    const { videoUrls, transition, transitionDuration, audioUrl, audioVolume } = parseResult.data;

    console.log('Concatenating videos:', { 
      count: videoUrls.length, 
      transition, 
      transitionDuration,
      hasAudio: !!audioUrl 
    });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Download all videos
    const videoBlobs: Uint8Array[] = [];
    for (let i = 0; i < videoUrls.length; i++) {
      console.log(`Downloading video ${i + 1}/${videoUrls.length}...`);
      try {
        const response = await fetch(videoUrls[i]);
        if (!response.ok) {
          throw new Error(`Failed to download video ${i + 1}: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        videoBlobs.push(new Uint8Array(arrayBuffer));
        console.log(`Video ${i + 1} downloaded: ${arrayBuffer.byteLength} bytes`);
      } catch (err) {
        console.error(`Error downloading video ${i + 1}:`, err);
        throw new Error(`Impossibile scaricare il video ${i + 1}`);
      }
    }

    // For MP4 files, simple concatenation doesn't work properly
    // We need to use a proper video processing approach
    // 
    // Option 1: Return video segments for client-side playback
    // Option 2: Use a third-party video API (Creatomate, Shotstack, etc.)
    // Option 3: Use ffmpeg-wasm (complex in Deno)
    //
    // For now, we'll store videos in a bucket and return their URLs
    // The client can then handle playback or we can integrate with a video API

    const timestamp = Date.now();
    const outputFiles: string[] = [];

    // Upload each video segment to storage
    for (let i = 0; i < videoBlobs.length; i++) {
      const fileName = `concat/${timestamp}/segment-${i.toString().padStart(3, '0')}.mp4`;
      
      const { error: uploadError } = await supabase.storage
        .from('generated-videos')
        .upload(fileName, videoBlobs[i], {
          contentType: 'video/mp4',
          upsert: true,
        });

      if (uploadError) {
        console.error(`Upload error for segment ${i}:`, uploadError);
        throw new Error(`Errore nel caricamento del segmento ${i + 1}`);
      }

      const { data: urlData } = supabase.storage
        .from('generated-videos')
        .getPublicUrl(fileName);

      outputFiles.push(urlData.publicUrl);
      console.log(`Segment ${i + 1} uploaded: ${fileName}`);
    }

    // Upload audio if provided
    let outputAudioUrl: string | undefined;
    if (audioUrl) {
      try {
        // If it's a base64 data URL, decode it
        if (audioUrl.startsWith('data:')) {
          const base64Data = audioUrl.split(',')[1];
          const audioBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          
          const audioFileName = `concat/${timestamp}/audio.mp3`;
          const { error: audioUploadError } = await supabase.storage
            .from('generated-videos')
            .upload(audioFileName, audioBytes, {
              contentType: 'audio/mpeg',
              upsert: true,
            });

          if (!audioUploadError) {
            const { data: audioUrlData } = supabase.storage
              .from('generated-videos')
              .getPublicUrl(audioFileName);
            outputAudioUrl = audioUrlData.publicUrl;
          }
        } else {
          outputAudioUrl = audioUrl;
        }
      } catch (err) {
        console.error('Error processing audio:', err);
      }
    }

    // Create a manifest file for the concatenated video
    const manifest = {
      segments: outputFiles,
      transition,
      transitionDuration,
      audio: outputAudioUrl,
      audioVolume,
      createdAt: new Date().toISOString(),
    };

    const manifestFileName = `concat/${timestamp}/manifest.json`;
    await supabase.storage
      .from('generated-videos')
      .upload(manifestFileName, JSON.stringify(manifest, null, 2), {
        contentType: 'application/json',
        upsert: true,
      });

    console.log('Concatenation complete. Segments:', outputFiles.length);

    // Return the result
    // The first video is used as the primary playback, with info about all segments
    return new Response(
      JSON.stringify({
        success: true,
        videoUrl: outputFiles[0], // Primary video for preview
        segments: outputFiles,
        audioUrl: outputAudioUrl,
        manifest: manifestFileName,
        totalSegments: outputFiles.length,
        message: outputFiles.length > 1 
          ? `${outputFiles.length} video pronti per la riproduzione sequenziale` 
          : 'Video pronto',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in video-concat function:', error);
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
