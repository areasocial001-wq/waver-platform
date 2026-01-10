import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Subtitle settings schema
const subtitleSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  style: z.enum(['classic', 'classic-progressive', 'classic-one-word', 'boxed-line', 'boxed-word']).default('classic'),
  position: z.enum(['top-center', 'center-center', 'bottom-center', 'mid-bottom-center']).default('bottom-center'),
  fontFamily: z.string().default('Arial Bold'),
  fontSize: z.number().min(30).max(200).default(90),
  wordColor: z.string().default('#FFFF00'),
  lineColor: z.string().default('#FFFFFF'),
  boxColor: z.string().default('#000000'),
  outlineColor: z.string().default('#000000'),
  outlineWidth: z.number().min(0).max(10).default(2),
  maxWordsPerLine: z.number().min(1).max(10).default(4),
  allCaps: z.boolean().default(false),
  language: z.string().default('auto'),
});

// Text overlay schema
const textOverlaySchema = z.object({
  text: z.string(),
  position: z.enum(['top-left', 'top-center', 'top-right', 'center-center', 'bottom-left', 'bottom-center', 'bottom-right']).default('center-center'),
  start: z.number().default(0),
  duration: z.number().default(-2), // -2 = scene duration
  fontSize: z.number().default(48),
  fontFamily: z.string().default('Arial Bold'),
  color: z.string().default('#FFFFFF'),
  backgroundColor: z.string().optional(),
  fadeIn: z.number().default(0.5),
  fadeOut: z.number().default(0.5),
  animation: z.enum(['none', 'fade', 'slide', 'zoom', 'typewriter']).default('fade'),
});

// Transition schema
const transitionSchema = z.object({
  type: z.enum(['none', 'fade', 'crossfade', 'wipe-left', 'wipe-right', 'wipe-up', 'wipe-down', 'slide', 'zoom', 'circle']).default('fade'),
  duration: z.number().min(0).max(3).default(0.5),
});

// Audio track schema
const audioTrackSchema = z.object({
  src: z.string(), // URL or base64
  volume: z.number().min(0).max(10).default(1),
  loop: z.number().default(-1), // -1 = infinite loop
  fadeIn: z.number().default(0),
  fadeOut: z.number().default(2),
});

// Video clip schema
const videoClipSchema = z.object({
  src: z.string().url(),
  duration: z.number().optional(), // -1 = auto
  seek: z.number().default(0),
  muted: z.boolean().default(true), // Mute original audio by default
  volume: z.number().min(0).max(10).default(1),
  resize: z.enum(['cover', 'fit', 'contain']).default('cover'),
  pan: z.enum(['none', 'left', 'right', 'top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right']).default('none'),
  zoom: z.number().min(-10).max(10).default(0),
  fadeIn: z.number().default(0),
  fadeOut: z.number().default(0),
  correction: z.object({
    brightness: z.number().min(-1).max(1).default(0),
    contrast: z.number().min(-1000).max(1000).default(1),
    saturation: z.number().min(0).max(3).default(1),
  }).optional(),
  textOverlays: z.array(textOverlaySchema).optional(),
});

// Intro/Outro schema
const introOutroSchema = z.object({
  enabled: z.boolean().default(false),
  text: z.string().default(''),
  duration: z.number().min(1).max(10).default(3),
  backgroundColor: z.string().default('#000000'),
  textColor: z.string().default('#FFFFFF'),
  animation: z.enum(['fade', 'slide', 'zoom', 'typewriter']).default('fade'),
  fontSize: z.number().default(72),
  fontFamily: z.string().default('Oswald Bold'),
  logoUrl: z.string().optional(),
});

// Voice TTS schema
const voiceSchema = z.object({
  enabled: z.boolean().default(false),
  text: z.string().optional(),
  voice: z.string().default('en-US-JennyNeural'), // Azure voice
  volume: z.number().min(0).max(10).default(1),
});

// Main request schema
const requestSchema = z.object({
  action: z.enum(['render', 'status']).default('render'),
  projectId: z.string().optional(), // For status check
  
  // Video settings
  videoClips: z.array(videoClipSchema).min(1).optional(),
  resolution: z.enum(['sd', 'hd', 'full-hd', 'custom']).default('full-hd'),
  width: z.number().min(50).max(3840).optional(),
  height: z.number().min(50).max(3840).optional(),
  quality: z.enum(['low', 'medium', 'high']).default('high'),
  draft: z.boolean().default(false), // true = watermark
  
  // Transitions
  transition: transitionSchema.optional(),
  
  // Audio
  audioTrack: audioTrackSchema.optional(),
  voice: voiceSchema.optional(),
  
  // Subtitles
  subtitles: subtitleSettingsSchema.optional(),
  
  // Intro/Outro
  intro: introOutroSchema.optional(),
  outro: introOutroSchema.optional(),
});

// Map resolution to JSON2Video format
const getResolutionConfig = (resolution: string, width?: number, height?: number) => {
  if (resolution === 'custom' && width && height) {
    return { resolution: 'custom', width, height };
  }
  return { resolution };
};

// Create text element for intro/outro
const createTitleScene = (config: z.infer<typeof introOutroSchema>, resolution: string, width?: number, height?: number): any => {
  const elements: any[] = [];
  
  // Text element with animation
  const textElement: any = {
    type: 'text',
    text: config.text,
    position: 'center-center',
    duration: config.duration,
    'font-family': config.fontFamily,
    'font-size': config.fontSize,
    color: config.textColor,
    'text-align': 'center',
    'vertical-align': 'middle',
    'fade-in': config.animation === 'fade' ? 0.5 : 0,
    'fade-out': config.animation === 'fade' ? 0.5 : 0,
  };
  
  elements.push(textElement);
  
  // Add logo if provided
  if (config.logoUrl) {
    elements.push({
      type: 'image',
      src: config.logoUrl,
      position: 'center-center',
      y: -100,
      duration: config.duration,
      'fade-in': 0.5,
      'fade-out': 0.5,
    });
  }
  
  return {
    duration: config.duration,
    'background-color': config.backgroundColor,
    elements,
  };
};

// Create video scene with effects
const createVideoScene = (
  clip: z.infer<typeof videoClipSchema>, 
  transition?: z.infer<typeof transitionSchema>,
  subtitles?: z.infer<typeof subtitleSettingsSchema>,
  voice?: z.infer<typeof voiceSchema>
): any => {
  const elements: any[] = [];
  
  // Main video element
  const videoElement: any = {
    type: 'video',
    src: clip.src,
    resize: clip.resize,
    muted: clip.muted,
    volume: clip.volume,
    seek: clip.seek,
  };
  
  // Duration handling
  if (clip.duration && clip.duration > 0) {
    videoElement.duration = clip.duration;
  }
  
  // Pan & Zoom (Ken Burns effect)
  if (clip.pan !== 'none') {
    videoElement.pan = clip.pan;
  }
  if (clip.zoom !== 0) {
    videoElement.zoom = clip.zoom;
  }
  
  // Fade effects
  if (clip.fadeIn > 0) {
    videoElement['fade-in'] = clip.fadeIn;
  }
  if (clip.fadeOut > 0) {
    videoElement['fade-out'] = clip.fadeOut;
  }
  
  // Color correction
  if (clip.correction) {
    videoElement.correction = {
      brightness: clip.correction.brightness,
      contrast: clip.correction.contrast,
      saturation: clip.correction.saturation,
    };
  }
  
  elements.push(videoElement);
  
  // Add text overlays
  if (clip.textOverlays && clip.textOverlays.length > 0) {
    for (const overlay of clip.textOverlays) {
      const textEl: any = {
        type: 'text',
        text: overlay.text,
        position: overlay.position,
        start: overlay.start,
        duration: overlay.duration,
        'font-family': overlay.fontFamily,
        'font-size': overlay.fontSize,
        color: overlay.color,
        'fade-in': overlay.fadeIn,
        'fade-out': overlay.fadeOut,
        'z-index': 10,
      };
      
      if (overlay.backgroundColor) {
        textEl['background-color'] = overlay.backgroundColor;
        textEl.padding = 10;
      }
      
      elements.push(textEl);
    }
  }
  
  // Add voice narration if enabled
  if (voice?.enabled && voice.text) {
    elements.push({
      type: 'voice',
      text: voice.text,
      voice: voice.voice,
      volume: voice.volume,
    });
  }
  
  // Build scene object
  const scene: any = {
    elements,
  };
  
  // Set scene duration if specified
  if (clip.duration && clip.duration > 0) {
    scene.duration = clip.duration;
  }
  
  return scene;
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
      console.error('Validation error:', parseResult.error.errors);
      return new Response(
        JSON.stringify({ error: parseResult.error.errors[0].message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const data = parseResult.data;
    const JSON2VIDEO_API_KEY = Deno.env.get('JSON2VIDEO_API_KEY');
    
    if (!JSON2VIDEO_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'JSON2VIDEO_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle status check
    if (data.action === 'status' && data.projectId) {
      console.log('Checking status for project:', data.projectId);
      
      const statusResponse = await fetch(
        `https://api.json2video.com/v2/movies?project=${data.projectId}`,
        {
          method: 'GET',
          headers: {
            'x-api-key': JSON2VIDEO_API_KEY,
          },
        }
      );
      
      if (!statusResponse.ok) {
        const errorText = await statusResponse.text();
        console.error('Status check error:', errorText);
        return new Response(
          JSON.stringify({ error: 'Failed to check status', details: errorText }),
          { status: statusResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const statusData = await statusResponse.json();
      console.log('Status response:', statusData);
      
      // If completed, upload to Supabase storage
      if (statusData.movie?.status === 'done' && statusData.movie?.url) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        try {
          const videoResponse = await fetch(statusData.movie.url);
          const videoBlob = await videoResponse.arrayBuffer();
          const fileName = `json2video/${Date.now()}-${data.projectId}.mp4`;
          
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
            
            statusData.movie.supabaseUrl = urlData.publicUrl;
          }
        } catch (uploadErr) {
          console.error('Failed to upload to Supabase:', uploadErr);
        }
      }
      
      return new Response(
        JSON.stringify(statusData),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build movie render request
    if (!data.videoClips || data.videoClips.length === 0) {
      return new Response(
        JSON.stringify({ error: 'At least one video clip is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Building JSON2Video render request:', {
      clips: data.videoClips.length,
      resolution: data.resolution,
      hasSubtitles: data.subtitles?.enabled,
      hasAudio: !!data.audioTrack,
      hasIntro: data.intro?.enabled,
      hasOutro: data.outro?.enabled,
    });

    const scenes: any[] = [];
    
    // Add intro scene
    if (data.intro?.enabled && data.intro.text) {
      scenes.push(createTitleScene(data.intro, data.resolution, data.width, data.height));
    }
    
    // Add video scenes
    for (let i = 0; i < data.videoClips.length; i++) {
      const clip = data.videoClips[i];
      const scene = createVideoScene(clip, data.transition, data.subtitles, data.voice);
      scenes.push(scene);
    }
    
    // Add outro scene
    if (data.outro?.enabled && data.outro.text) {
      scenes.push(createTitleScene(data.outro, data.resolution, data.width, data.height));
    }

    // Build movie object
    const movie: any = {
      ...getResolutionConfig(data.resolution, data.width, data.height),
      quality: data.quality,
      draft: data.draft,
      scenes,
    };
    
    // Add movie-level elements (audio, subtitles)
    const movieElements: any[] = [];
    
    // Background audio track
    if (data.audioTrack) {
      const audioElement: any = {
        type: 'audio',
        src: data.audioTrack.src,
        volume: data.audioTrack.volume,
        loop: data.audioTrack.loop,
      };
      
      if (data.audioTrack.fadeIn > 0) {
        audioElement['fade-in'] = data.audioTrack.fadeIn;
      }
      if (data.audioTrack.fadeOut > 0) {
        audioElement['fade-out'] = data.audioTrack.fadeOut;
      }
      
      movieElements.push(audioElement);
    }
    
    // Automatic subtitles
    if (data.subtitles?.enabled) {
      movieElements.push({
        type: 'subtitles',
        language: data.subtitles.language,
        settings: {
          style: data.subtitles.style,
          position: data.subtitles.position,
          'font-family': data.subtitles.fontFamily,
          'font-size': data.subtitles.fontSize,
          'word-color': data.subtitles.wordColor,
          'line-color': data.subtitles.lineColor,
          'box-color': data.subtitles.boxColor,
          'outline-color': data.subtitles.outlineColor,
          'outline-width': data.subtitles.outlineWidth,
          'max-words-per-line': data.subtitles.maxWordsPerLine,
          'all-caps': data.subtitles.allCaps,
        },
      });
    }
    
    if (movieElements.length > 0) {
      movie.elements = movieElements;
    }

    console.log('Movie payload:', JSON.stringify(movie, null, 2));

    // Submit render job
    const renderResponse = await fetch('https://api.json2video.com/v2/movies', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': JSON2VIDEO_API_KEY,
      },
      body: JSON.stringify(movie),
    });

    if (!renderResponse.ok) {
      const errorText = await renderResponse.text();
      console.error('JSON2Video render error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Render failed', details: errorText }),
        { status: renderResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const renderData = await renderResponse.json();
    console.log('JSON2Video render response:', renderData);

    // Return project info for polling
    return new Response(
      JSON.stringify({
        success: true,
        projectId: renderData.project,
        movieId: renderData.movie?.id,
        status: 'processing',
        message: 'Video rendering started. Poll status endpoint for updates.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('JSON2Video error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
