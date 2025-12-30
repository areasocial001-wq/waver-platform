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
  resolution: z.enum(['sd', 'hd', 'fhd']).default('hd'),
  audioUrl: z.string().optional(),
  audioVolume: z.number().min(0).max(100).default(100),
});

// Map resolution to Shotstack format
const mapResolution = (resolution: string): string => {
  switch (resolution) {
    case 'sd': return 'sd';
    case 'hd': return 'hd';
    case 'fhd': return '1080';
    default: return 'hd';
  }
};

// Map transition types to Shotstack format
const mapTransition = (transition: string): string | null => {
  switch (transition) {
    case 'fade': return 'fade';
    case 'crossfade': return 'fade';
    case 'wipe': return 'wipeRight';
    default: return null;
  }
};

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
    
    const { videoUrls, transition, transitionDuration, resolution, audioUrl, audioVolume } = parseResult.data;
    const SHOTSTACK_API_KEY = Deno.env.get('SHOTSTACK_API_KEY');

    console.log('Concatenating videos:', { 
      count: videoUrls.length, 
      transition, 
      transitionDuration,
      resolution,
      hasAudio: !!audioUrl,
      useShotstack: !!SHOTSTACK_API_KEY
    });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // If Shotstack is configured, use it for real video concatenation
    if (SHOTSTACK_API_KEY && videoUrls.length > 1) {
      console.log('Using Shotstack for video concatenation');
      
      try {
        // Build Shotstack timeline clips
        const clips: any[] = [];
        let currentStart = 0;
        const defaultClipLength = 5; // seconds per clip

        for (let i = 0; i < videoUrls.length; i++) {
          const clip: any = {
            asset: {
              type: 'video',
              src: videoUrls[i],
            },
            start: currentStart,
            length: defaultClipLength,
          };

          // Add transition effect between clips
          const shotstackTransition = mapTransition(transition);
          if (shotstackTransition && i > 0) {
            clip.transition = {
              in: shotstackTransition,
            };
            // Overlap clips for smooth transition
            clip.start = Math.max(0, currentStart - transitionDuration);
          }

          clips.push(clip);
          currentStart += defaultClipLength;
        }

        // Build timeline
        const timeline: any = {
          tracks: [{ clips }],
        };

        // Add audio track if provided
        if (audioUrl) {
          const totalDuration = videoUrls.length * defaultClipLength;
          let audioSrc = audioUrl;
          
          // If audio is base64, we need to upload it first
          if (audioUrl.startsWith('data:')) {
            const base64Data = audioUrl.split(',')[1];
            const audioBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            const audioFileName = `audio/${Date.now()}.mp3`;
            
            await supabase.storage
              .from('generated-videos')
              .upload(audioFileName, audioBytes, {
                contentType: 'audio/mpeg',
                upsert: true,
              });
            
            const { data: audioUrlData } = supabase.storage
              .from('generated-videos')
              .getPublicUrl(audioFileName);
            
            audioSrc = audioUrlData.publicUrl;
          }
          
          timeline.tracks.push({
            clips: [{
              asset: {
                type: 'audio',
                src: audioSrc,
                volume: audioVolume / 100,
              },
              start: 0,
              length: totalDuration,
            }],
          });
        }

        // Build render request
        const renderRequest = {
          timeline,
          output: {
            format: 'mp4',
            resolution: mapResolution(resolution),
          },
        };

        console.log('Shotstack render request:', JSON.stringify(renderRequest, null, 2));

        // Submit render to Shotstack (sandbox for testing, remove 'stage' for production)
        const renderResponse = await fetch('https://api.shotstack.io/edit/stage/render', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': SHOTSTACK_API_KEY,
          },
          body: JSON.stringify(renderRequest),
        });

        if (!renderResponse.ok) {
          const errorText = await renderResponse.text();
          console.error('Shotstack render error:', errorText);
          throw new Error(`Shotstack render failed: ${renderResponse.status}`);
        }

        const renderData = await renderResponse.json();
        console.log('Shotstack render response:', renderData);

        const renderId = renderData.response?.id;
        if (!renderId) {
          throw new Error('No render ID from Shotstack');
        }

        // Poll for render completion (max 3 minutes)
        let attempts = 0;
        const maxAttempts = 36; // 36 * 5s = 3 minutes
        let finalVideoUrl: string | null = null;

        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          const statusResponse = await fetch(
            `https://api.shotstack.io/edit/stage/render/${renderId}`,
            {
              headers: { 'x-api-key': SHOTSTACK_API_KEY },
            }
          );

          if (!statusResponse.ok) {
            attempts++;
            continue;
          }

          const statusData = await statusResponse.json();
          console.log(`Render status (${attempts + 1}):`, statusData.response?.status);

          if (statusData.response?.status === 'done') {
            finalVideoUrl = statusData.response?.url;
            break;
          } else if (statusData.response?.status === 'failed') {
            throw new Error(statusData.response?.error || 'Render failed');
          }

          attempts++;
        }

        if (finalVideoUrl) {
          // Download and upload to Supabase storage for permanent hosting
          try {
            const videoResponse = await fetch(finalVideoUrl);
            const videoBlob = await videoResponse.arrayBuffer();
            const fileName = `concatenated/${Date.now()}.mp4`;

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

              return new Response(
                JSON.stringify({
                  success: true,
                  videoUrl: urlData.publicUrl,
                  segments: videoUrls,
                  audioUrl: audioUrl,
                  message: 'Video concatenato con Shotstack!',
                  method: 'shotstack',
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          } catch (uploadErr) {
            console.error('Upload error:', uploadErr);
          }

          // Return Shotstack URL if upload fails
          return new Response(
            JSON.stringify({
              success: true,
              videoUrl: finalVideoUrl,
              segments: videoUrls,
              audioUrl: audioUrl,
              message: 'Video concatenato con Shotstack!',
              method: 'shotstack',
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // If render timeout, return segments for sequential playback
        console.log('Shotstack render timeout, falling back to segments');
        return new Response(
          JSON.stringify({
            success: true,
            videoUrl: videoUrls[0],
            segments: videoUrls,
            audioUrl: audioUrl,
            renderId,
            status: 'processing',
            message: 'Video in elaborazione su Shotstack. Usa riproduzione sequenziale.',
            method: 'shotstack-pending',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (shotstackError) {
        console.error('Shotstack error:', shotstackError);
        // Fall through to segment-based approach
      }
    }

    // Fallback: Store segments for client-side sequential playback
    console.log('Using segment-based approach');
    
    const timestamp = Date.now();
    const outputFiles: string[] = [];

    // Download and upload each video segment
    for (let i = 0; i < videoUrls.length; i++) {
      console.log(`Processing video ${i + 1}/${videoUrls.length}...`);
      
      try {
        const response = await fetch(videoUrls[i]);
        if (!response.ok) {
          throw new Error(`Failed to download video ${i + 1}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const fileName = `concat/${timestamp}/segment-${i.toString().padStart(3, '0')}.mp4`;
        
        const { error: uploadError } = await supabase.storage
          .from('generated-videos')
          .upload(fileName, new Uint8Array(arrayBuffer), {
            contentType: 'video/mp4',
            upsert: true,
          });

        if (uploadError) {
          console.error(`Upload error for segment ${i}:`, uploadError);
          // Use original URL if upload fails
          outputFiles.push(videoUrls[i]);
        } else {
          const { data: urlData } = supabase.storage
            .from('generated-videos')
            .getPublicUrl(fileName);
          outputFiles.push(urlData.publicUrl);
        }
      } catch (err) {
        console.error(`Error processing video ${i + 1}:`, err);
        outputFiles.push(videoUrls[i]); // Use original URL
      }
    }

    // Process audio if provided
    let outputAudioUrl: string | undefined;
    if (audioUrl) {
      if (audioUrl.startsWith('data:')) {
        try {
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
        } catch (err) {
          console.error('Audio processing error:', err);
          outputAudioUrl = audioUrl;
        }
      } else {
        outputAudioUrl = audioUrl;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        videoUrl: outputFiles[0],
        segments: outputFiles,
        audioUrl: outputAudioUrl,
        totalSegments: outputFiles.length,
        message: outputFiles.length > 1 
          ? `${outputFiles.length} video pronti per riproduzione sequenziale` 
          : 'Video pronto',
        method: 'segments',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in video-concat function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Errore concatenazione video' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
