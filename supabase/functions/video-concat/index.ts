import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Clip effects schema (extended for zoom, pan, filters)
const clipEffectsSchema = z.object({
  blur: z.number().min(0).max(10).default(0),
  saturation: z.number().min(0).max(200).default(100),
  contrast: z.number().min(0).max(200).default(100),
  brightness: z.number().min(0).max(200).default(100),
  // New properties for zoom, pan, filters
  zoom: z.number().min(0.5).max(2).default(1),
  panX: z.number().min(-100).max(100).default(0),
  panY: z.number().min(-100).max(100).default(0),
  zoomAnimation: z.enum(['none', 'zoom-in', 'zoom-out', 'ken-burns']).default('none'),
  filter: z.enum(['none', 'vintage', 'cinematic', 'warm', 'cool', 'bw', 'sepia', 'dramatic']).default('none'),
  motionBlur: z.number().min(0).max(10).default(0),
});

// Intro/outro schema
const introOutroSchema = z.object({
  enabled: z.boolean().default(false),
  text: z.string().default(''),
  duration: z.number().min(1).max(10).default(3),
  backgroundColor: z.string().default('#000000'),
  textColor: z.string().default('#ffffff'),
  animation: z.enum(['fade', 'slide', 'zoom', 'typewriter']).default('fade'),
  fontSize: z.enum(['small', 'medium', 'large']).default('medium'),
});

// Per-scene transition schema
const perSceneTransitionSchema = z.object({
  type: z.enum(['none', 'fade', 'crossfade', 'fade_black', 'dissolve', 'wipe_left', 'wipe_right']).default('crossfade'),
  duration: z.number().min(0).max(3).default(0.5),
});

// Input validation schema
const requestSchema = z.object({
  videoUrls: z.array(z.string().url()).min(1, 'Almeno un video richiesto'),
  clipDurations: z.array(z.number().min(1).max(30)).optional(),
  clipEffects: z.array(clipEffectsSchema).optional(),
  transition: z.enum(['none', 'fade', 'crossfade', 'wipe']).default('none'),
  transitionDuration: z.number().min(0).max(5).default(0.5),
  transitions: z.array(perSceneTransitionSchema).optional(), // per-scene transitions
  resolution: z.enum(['sd', 'hd', 'fhd']).default('hd'),
  aspectRatio: z.enum(['16:9', '9:16', '1:1']).default('16:9'),
  fps: z.enum(['24', '30', '60']).default('24'),
  audioUrl: z.string().optional(),
  audioVolume: z.number().min(0).max(100).default(100),
  audioUrls: z.array(z.string()).optional(), // per-scene narration audio
  backgroundMusicUrl: z.string().optional(), // background music track
  musicVolume: z.number().min(0).max(1).default(0.25), // music volume (0-1)
  intro: introOutroSchema.optional(),
  outro: introOutroSchema.optional(),
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

// Map aspect ratio to Shotstack size
const getAspectRatioSize = (aspectRatio: string, resolution: string): { width: number; height: number } | null => {
  const resMultiplier = resolution === 'fhd' ? 1 : resolution === 'hd' ? 0.67 : 0.45;
  
  switch (aspectRatio) {
    case '16:9':
      return null; // Use default
    case '9:16':
      return { 
        width: Math.round(1080 * resMultiplier), 
        height: Math.round(1920 * resMultiplier) 
      };
    case '1:1':
      return { 
        width: Math.round(1080 * resMultiplier), 
        height: Math.round(1080 * resMultiplier) 
      };
    default:
      return null;
  }
};

// Map transition types to Shotstack format
const mapTransition = (transition: string): string | null => {
  switch (transition) {
    case 'fade': return 'fade';
    case 'crossfade': return 'fade';
    case 'fade_black': return 'fade';
    case 'dissolve': return 'fade'; // Shotstack maps dissolve to fade
    case 'wipe': return 'wipeRight';
    case 'wipe_left': return 'wipeLeft';
    case 'wipe_right': return 'wipeRight';
    default: return null;
  }
};

// Map filter presets to Shotstack filters
const FILTER_PRESETS: Record<string, any[]> = {
  none: [],
  vintage: [{ type: 'sepia', value: 0.3 }, { type: 'contrast', value: 1.1 }],
  cinematic: [{ type: 'contrast', value: 1.2 }, { type: 'saturation', value: 0.85 }],
  warm: [{ type: 'sepia', value: 0.2 }, { type: 'saturation', value: 1.3 }],
  cool: [{ type: 'saturation', value: 0.9 }],
  bw: [{ type: 'saturation', value: 0 }],
  sepia: [{ type: 'sepia', value: 0.8 }],
  dramatic: [{ type: 'contrast', value: 1.4 }, { type: 'saturation', value: 1.2 }],
};

// Map effects to Shotstack filter and transform
const mapEffects = (effects?: z.infer<typeof clipEffectsSchema>): { filters: any[]; transform?: any; transition?: any } => {
  const filters: any[] = [];
  let transform: any = undefined;
  let transition: any = undefined;
  
  if (!effects) return { filters };
  
  // Apply filter preset
  if (effects.filter && effects.filter !== 'none') {
    filters.push(...(FILTER_PRESETS[effects.filter] || []));
  }
  
  // Apply custom adjustments
  if (effects.blur > 0) {
    filters.push({ type: 'blur', value: effects.blur / 10 });
  }
  
  if (effects.saturation !== 100) {
    filters.push({ type: 'saturation', value: effects.saturation / 100 });
  }
  
  if (effects.contrast !== 100) {
    filters.push({ type: 'contrast', value: effects.contrast / 100 });
  }
  
  if (effects.brightness !== 100) {
    filters.push({ type: 'brightness', value: effects.brightness / 100 });
  }
  
  // Apply zoom and pan as scale and offset
  if (effects.zoom !== 1 || effects.panX !== 0 || effects.panY !== 0) {
    transform = {
      scale: {
        x: effects.zoom,
        y: effects.zoom,
      },
      ...(effects.panX !== 0 || effects.panY !== 0 ? {
        offset: {
          x: effects.panX / 100,
          y: effects.panY / 100,
        },
      } : {}),
    };
  }
  
  // Apply zoom animation as motion effect
  if (effects.zoomAnimation !== 'none') {
    switch (effects.zoomAnimation) {
      case 'zoom-in':
        // Slow zoom in effect
        transition = { in: 'zoom' };
        break;
      case 'zoom-out':
        transition = { out: 'zoom' };
        break;
      case 'ken-burns':
        // Ken Burns uses slow pan/zoom, Shotstack's 'zoom' is similar
        transition = { in: 'slideRight', out: 'zoom' };
        break;
    }
  }
  
  return { filters, transform, transition };
};

// Get font size in pixels
const getFontSize = (size: string): number => {
  switch (size) {
    case 'small': return 32;
    case 'large': return 72;
    default: return 48;
  }
};

// Create intro/outro title clip
const createTitleClip = (
  config: { text: string; duration: number; backgroundColor: string; textColor: string; animation: string; fontSize: string },
  start: number,
  aspectRatio: string,
  resolution: string
): any[] => {
  const clips: any[] = [];
  const fontSize = getFontSize(config.fontSize);
  
  // Background clip
  const bgClip: any = {
    asset: {
      type: 'html',
      html: `<div style="width: 100%; height: 100%; background-color: ${config.backgroundColor};"></div>`,
      width: aspectRatio === '9:16' ? 1080 : 1920,
      height: aspectRatio === '9:16' ? 1920 : aspectRatio === '1:1' ? 1080 : 1080,
    },
    start,
    length: config.duration,
    fit: 'cover',
  };
  
  // Text clip
  const textClip: any = {
    asset: {
      type: 'html',
      html: `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; text-align: center; padding: 40px;">
        <p style="color: ${config.textColor}; font-size: ${fontSize}px; font-family: Arial, sans-serif; font-weight: bold; margin: 0;">${config.text}</p>
      </div>`,
      width: aspectRatio === '9:16' ? 1080 : 1920,
      height: aspectRatio === '9:16' ? 1920 : aspectRatio === '1:1' ? 1080 : 1080,
    },
    start,
    length: config.duration,
    position: 'center',
  };
  
  // Add animation
  switch (config.animation) {
    case 'fade':
      textClip.transition = { in: 'fade', out: 'fade' };
      break;
    case 'slide':
      textClip.transition = { in: 'slideRight', out: 'slideLeft' };
      break;
    case 'zoom':
      textClip.transition = { in: 'zoom', out: 'zoom' };
      break;
    case 'typewriter':
      // Typewriter effect - fade in character by character isn't native, use fade
      textClip.transition = { in: 'fade' };
      break;
  }
  
  clips.push(bgClip);
  clips.push(textClip);
  
  return clips;
};

const SIGNED_URL_TTL_SECONDS = 60 * 60;

const getStoragePathFromUrl = (url: string, supabaseUrl: string): { bucket: string; path: string } | null => {
  try {
    if (url.startsWith('storage://')) {
      const storagePath = url.replace('storage://', '');
      const [bucket, ...pathParts] = storagePath.split('/');
      if (!bucket || pathParts.length === 0) return null;
      return { bucket, path: pathParts.join('/') };
    }

    const parsed = new URL(url);
    if (!parsed.origin.startsWith(supabaseUrl)) return null;
    const marker = '/storage/v1/object/';
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex === -1) return null;

    const objectPath = parsed.pathname.slice(markerIndex + marker.length);
    const normalized = objectPath.startsWith('public/')
      ? objectPath.slice('public/'.length)
      : objectPath.startsWith('sign/')
        ? objectPath.slice('sign/'.length)
        : objectPath;

    const [bucket, ...pathParts] = normalized.split('/');
    if (!bucket || pathParts.length === 0) return null;
    return { bucket, path: decodeURIComponent(pathParts.join('/')) };
  } catch {
    return null;
  }
};

const normalizeAssetUrl = async (
  url: string,
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string
): Promise<string> => {
  if (!url) return url;

  const storageTarget = getStoragePathFromUrl(url, supabaseUrl);
  if (storageTarget) {
    const { data, error } = await supabase.storage
      .from(storageTarget.bucket)
      .createSignedUrl(storageTarget.path, SIGNED_URL_TTL_SECONDS);

    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }
  }

  return url;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    // Handle health check requests
    if (body.healthCheck) {
      return new Response(
        JSON.stringify({ status: 'ok', service: 'video-concat' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate input
    const parseResult = requestSchema.safeParse(body);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: parseResult.error.errors[0].message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { 
      videoUrls, clipDurations, clipEffects, transition, transitionDuration, transitions,
      resolution, aspectRatio, fps, audioUrl, audioVolume, audioUrls, backgroundMusicUrl, musicVolume,
      intro, outro 
    } = parseResult.data;
    const SHOTSTACK_API_KEY = Deno.env.get('SHOTSTACK_API_KEY');

    console.log('Concatenating videos:', { 
      count: videoUrls.length, 
      clipDurations,
      clipEffects: clipEffects?.length,
      transition, 
      transitionDuration,
      resolution,
      aspectRatio,
      hasAudio: !!audioUrl,
      hasIntro: intro?.enabled,
      hasOutro: outro?.enabled,
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
        const videoClips: any[] = [];
        let currentStart = 0;
        
        // Add intro if enabled
        const introDuration = intro?.enabled ? intro.duration : 0;
        if (intro?.enabled && intro.text) {
          const introClips = createTitleClip(intro, 0, aspectRatio, resolution);
          videoClips.push(...introClips);
          currentStart = introDuration;
        }

        // Add video clips
        for (let i = 0; i < videoUrls.length; i++) {
          // Use custom duration or default to 5 seconds
          const clipLength = clipDurations?.[i] || 5;
          const effects = clipEffects?.[i];
          
          const clip: any = {
            asset: {
              type: 'video',
              src: videoUrls[i],
            },
            start: currentStart,
            length: clipLength,
          };
          
          // Add filters, transform, and transitions for effects
          const effectsResult = mapEffects(effects);
          if (effectsResult.filters.length > 0) {
            clip.filter = effectsResult.filters;
          }
          
          // Add transform for zoom/pan
          if (effectsResult.transform) {
            clip.transform = effectsResult.transform;
          }
          
          // Add animation transition from effects
          if (effectsResult.transition) {
            clip.transition = effectsResult.transition;
          }

          // Add transition effect between clips (per-scene or global)
          const sceneTransition = transitions?.[i];
          const transType = sceneTransition?.type || transition;
          const transDur = sceneTransition?.duration || transitionDuration;
          const shotstackTransition = mapTransition(transType);
          if (shotstackTransition && i > 0) {
            clip.transition = {
              ...clip.transition,
              in: shotstackTransition,
            };
            // Overlap clips for smooth transition
            clip.start = Math.max(0, currentStart - transDur);
          }

          videoClips.push(clip);
          currentStart += clipLength;
        }
        
        // Add outro if enabled
        if (outro?.enabled && outro.text) {
          const outroClips = createTitleClip(outro, currentStart, aspectRatio, resolution);
          videoClips.push(...outroClips);
          currentStart += outro.duration;
        }

        // Build timeline
        const timeline: any = {
          tracks: [{ clips: videoClips }],
        };

        // Add audio track if provided
        if (audioUrl) {
          // Calculate total duration including intro/outro
          const videoDuration = clipDurations?.reduce((sum, d) => sum + d, 0) || videoUrls.length * 5;
          const totalDuration = introDuration + videoDuration + (outro?.enabled ? outro.duration : 0);
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

        // Add per-scene narration audio tracks
        if (audioUrls && audioUrls.length > 0) {
          const narrationClips: any[] = [];
          let narrationStart = introDuration;
          for (let i = 0; i < audioUrls.length; i++) {
            if (!audioUrls[i]) continue;
            let narrationSrc = audioUrls[i];
            // Upload blob URLs won't work with Shotstack - skip blob: URLs
            if (narrationSrc.startsWith('blob:')) continue;
            const clipLen = clipDurations?.[i] || 5;
            narrationClips.push({
              asset: {
                type: 'audio',
                src: narrationSrc,
                volume: 1,
              },
              start: narrationStart,
              length: clipLen,
            });
            narrationStart += clipLen;
          }
          if (narrationClips.length > 0) {
            timeline.tracks.push({ clips: narrationClips });
          }
        }

        // Add background music track
        if (backgroundMusicUrl && !backgroundMusicUrl.startsWith('blob:')) {
          const videoDuration = clipDurations?.reduce((sum, d) => sum + d, 0) || videoUrls.length * 5;
          const totalDur = introDuration + videoDuration + (outro?.enabled ? outro.duration : 0);
          timeline.tracks.push({
            clips: [{
              asset: {
                type: 'audio',
                src: backgroundMusicUrl,
                volume: musicVolume,
              },
              start: 0,
              length: totalDur,
            }],
          });
        }

        // Build render request with aspect ratio
        const aspectSize = getAspectRatioSize(aspectRatio, resolution);
        const output: any = {
          format: 'mp4',
          resolution: mapResolution(resolution),
          fps: parseInt(fps), // Use user-selected framerate
        };
        
        if (aspectSize) {
          output.size = aspectSize;
        }

        const renderRequest = {
          timeline,
          output,
        };

        console.log('Shotstack render request:', JSON.stringify(renderRequest, null, 2));

        // Submit render to Shotstack (v1 production endpoint)
        const renderResponse = await fetch('https://api.shotstack.io/edit/v1/render', {
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
            `https://api.shotstack.io/edit/v1/render/${renderId}`,
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
