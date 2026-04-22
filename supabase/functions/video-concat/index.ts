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
  transitions: z.array(perSceneTransitionSchema).optional(),
  resolution: z.enum(['sd', 'hd', 'fhd']).default('hd'),
  aspectRatio: z.enum(['16:9', '9:16', '1:1']).default('16:9'),
  fps: z.enum(['24', '30', '60']).default('24'),
  audioUrl: z.string().optional(),
  audioVolume: z.number().min(0).max(100).default(100),
  audioUrls: z.array(z.string()).optional(), // per-scene narration audio
  sfxUrls: z.array(z.string()).optional(), // per-scene punctual sound effects
  sfxVolume: z.number().min(0).max(1).default(0.22),
  // NEW: separate ambience track (continuous wind/sea/forest beds)
  ambienceUrls: z.array(z.string()).optional(),
  ambienceVolume: z.number().min(0).max(1).default(0.18),
  backgroundMusicUrl: z.string().optional(),
  musicVolume: z.number().min(0).max(1).default(0.25),
  narrationVolume: z.number().min(0).max(1).default(1),
  // NEW: server-side auto-mix that ducks music+ambience under voice and
  //      normalises overall loudness towards lufsTarget.
  autoMix: z.boolean().default(false),
  lufsTarget: z.number().min(-30).max(-6).default(-14),
  intro: introOutroSchema.optional(),
  outro: introOutroSchema.optional(),
  dryRun: z.boolean().optional(), // preview mode: returns timeline summary without rendering
  // NEW: when true, just probe the most recent rendered file in storage and
  //      return whether the music track was actually included.
  verifyMusic: z.object({
    renderedVideoUrl: z.string(),
  }).optional(),
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

// Map aspect ratio to Shotstack size (full-frame, no letterbox)
const getAspectRatioSize = (aspectRatio: string, resolution: string): { width: number; height: number } | null => {
  // Use full pixel dimensions per resolution tier — Shotstack will render at exactly this size
  // This avoids the "postage stamp" effect caused by passing resolution:'hd' (which forces 1280x720 canvas) together with aspectRatio:'9:16'
  const tier = resolution === 'fhd' ? 'fhd' : resolution === 'hd' ? 'hd' : 'sd';

  switch (aspectRatio) {
    case '16:9':
      if (tier === 'fhd') return { width: 1920, height: 1080 };
      if (tier === 'hd')  return { width: 1280, height: 720 };
      return { width: 854, height: 480 };
    case '9:16':
      if (tier === 'fhd') return { width: 1080, height: 1920 };
      if (tier === 'hd')  return { width: 720,  height: 1280 };
      return { width: 480, height: 854 };
    case '1:1':
      if (tier === 'fhd') return { width: 1080, height: 1080 };
      if (tier === 'hd')  return { width: 720,  height: 720 };
      return { width: 480, height: 480 };
    default:
      return null;
  }
};

// Map transition types to Shotstack format.
// True cross-dissolve = overlap + fade-out prev + fade-in next.
// Fade-to-black = no overlap, only fade-in on the next clip.
const mapTransition = (transition: string): { in?: string; out?: string } | null => {
  switch (transition) {
    case 'fade':
    case 'fade_black':
    case 'crossfade':
    case 'dissolve':
      return { in: 'fade', out: 'fade' };
    case 'wipe':
    case 'wipe_right':
      return { in: 'wipeRight' };
    case 'wipe_left':
      return { in: 'wipeLeft' };
    default:
      return null;
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

// Sign a video-proxy URL with HMAC-SHA256 so external services (Shotstack)
// can fetch it without a JWT. Token expires in 2 hours.
const PROXY_SIGNING_SECRET = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
async function signVideoProxyUrl(proxyUrl: string): Promise<string> {
  if (!PROXY_SIGNING_SECRET) return proxyUrl;
  try {
    const u = new URL(proxyUrl);
    if (!u.pathname.endsWith("/video-proxy")) return proxyUrl;
    const uri = u.searchParams.get("uri");
    if (!uri) return proxyUrl;
    const exp = Math.floor(Date.now() / 1000) + 2 * 60 * 60; // 2h validity
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(PROXY_SIGNING_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${uri}|${exp}`));
    const token = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    u.searchParams.set("exp", String(exp));
    u.searchParams.set("token", token);
    return u.toString();
  } catch (e) {
    console.error("Failed to sign proxy URL:", e);
    return proxyUrl;
  }
}

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

  // If this is a video-proxy URL, sign it so Shotstack can fetch without JWT
  if (url.includes("/functions/v1/video-proxy?")) {
    return await signVideoProxyUrl(url);
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

    // Handle render status polling
    if (body.pollRenderId) {
      const SHOTSTACK_API_KEY = Deno.env.get('SHOTSTACK_API_KEY');
      if (!SHOTSTACK_API_KEY) {
        return new Response(
          JSON.stringify({ error: 'Shotstack not configured' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const statusResponse = await fetch(
        `https://api.shotstack.io/edit/v1/render/${body.pollRenderId}`,
        { headers: { 'x-api-key': SHOTSTACK_API_KEY } }
      );

      if (!statusResponse.ok) {
        return new Response(
          JSON.stringify({ status: 'unknown', error: `Status check failed: ${statusResponse.status}` }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const statusData = await statusResponse.json();
      const renderStatus = statusData.response?.status;
      const renderUrl = statusData.response?.url;

      if (renderStatus === 'done' && renderUrl) {
        // Download and upload to storage
        let finalUrl = renderUrl;
        try {
          const videoResponse = await fetch(renderUrl);
          const videoBlob = await videoResponse.arrayBuffer();
          const fileName = `concatenated/${Date.now()}.mp4`;
          const { error: uploadError } = await supabase.storage
            .from('generated-videos')
            .upload(fileName, new Uint8Array(videoBlob), { contentType: 'video/mp4', upsert: true });
          if (!uploadError) {
            finalUrl = await normalizeAssetUrl(`storage://generated-videos/${fileName}`, supabase, supabaseUrl);
          }
        } catch (e) {
          console.error('Poll: upload error', e);
        }
        return new Response(
          JSON.stringify({ status: 'completed', videoUrl: finalUrl }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else if (renderStatus === 'failed') {
        return new Response(
          JSON.stringify({ status: 'failed', error: statusData.response?.error || 'Render failed' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        return new Response(
          JSON.stringify({ status: 'processing', renderStatus }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Music-presence verification: probe the rendered MP4 over a Range request and
    // look for the AAC audio track marker. Cheap heuristic — true ffprobe would be
    // overkill for an edge function. Returns { audible: boolean, sizeBytes, contentType }.
    if (body.verifyMusic?.renderedVideoUrl) {
      const url = body.verifyMusic.renderedVideoUrl;
      try {
        const head = await fetch(url, { method: 'HEAD' });
        const contentType = head.headers.get('content-type');
        const sizeBytes = parseInt(head.headers.get('content-length') || '0', 10);
        // Range fetch first 256KB — enough to inspect MP4 'moov' box for soun track.
        const range = await fetch(url, { headers: { Range: 'bytes=0-262143' } });
        const buf = new Uint8Array(await range.arrayBuffer());
        // Crude audio-track detector: look for 'soun' (audio handler) or 'mp4a' (AAC) markers.
        // MP4 files always include these in the 'moov' atom when audio is present.
        const text = new TextDecoder('latin1').decode(buf);
        const audible = text.includes('soun') || text.includes('mp4a');
        return new Response(
          JSON.stringify({
            ok: true,
            audible,
            contentType,
            sizeBytes,
            inspectedBytes: buf.length,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (err) {
        return new Response(
          JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
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
      resolution, aspectRatio, fps, audioUrl, audioVolume, audioUrls, sfxUrls, sfxVolume,
      ambienceUrls, ambienceVolume,
      backgroundMusicUrl, musicVolume, narrationVolume, autoMix, lufsTarget,
      intro, outro, dryRun,
    } = parseResult.data;
    const SHOTSTACK_API_KEY = Deno.env.get('SHOTSTACK_API_KEY');

    // ─── Auto-mix: keep narration dominant. Approach (Shotstack-friendly, no native loudnorm):
    //   • voice                     → 1.0× user value (reference)
    //   • music & ambience          → ducked to ~30% / 35% of their nominal value when voice exists
    //   • global gain trim          → small offset towards lufsTarget (rough heuristic, ±2 dB)
    // The numbers below intentionally keep music+ambience BELOW voice but never zero them out.
    const hasVoiceTrack = !!(audioUrls && audioUrls.some((u) => !!u && !u.startsWith('blob:')));
    const lufsOffsetDb = Math.max(-3, Math.min(3, (-14 - lufsTarget))); // pull louder targets up
    const lufsGain = Math.pow(10, lufsOffsetDb / 20);

    const effectiveNarrationVolume = autoMix
      ? Math.min(1, narrationVolume * 1.0 * lufsGain)
      : narrationVolume;
    const effectiveSfxVolume = autoMix
      ? Math.min(1, sfxVolume * (hasVoiceTrack ? 0.55 : 1.0) * lufsGain)
      : sfxVolume;
    const effectiveAmbienceVolume = autoMix
      ? Math.min(1, (ambienceVolume ?? 0) * (hasVoiceTrack ? 0.4 : 0.85) * lufsGain)
      : (ambienceVolume ?? 0);
    const effectiveMusicVolume = autoMix
      ? Math.min(1, musicVolume * (hasVoiceTrack ? 0.32 : 0.7) * lufsGain)
      : musicVolume;

    if (autoMix) {
      console.log('[auto-mix] applied', {
        hasVoiceTrack, lufsTarget, lufsOffsetDb,
        in: { narrationVolume, sfxVolume, ambienceVolume, musicVolume },
        out: { effectiveNarrationVolume, effectiveSfxVolume, effectiveAmbienceVolume, effectiveMusicVolume },
      });
    }

    // Track skipped audio assets (blob URLs that can't be reached server-side)
    const skippedAssets: { type: string; index?: number; url: string; reason: string }[] = [];
    if (audioUrls) {
      audioUrls.forEach((u, i) => {
        if (u && u.startsWith('blob:')) skippedAssets.push({ type: 'narration', index: i, url: u, reason: 'blob URL non raggiungibile dal server' });
      });
    }
    if (sfxUrls) {
      sfxUrls.forEach((u, i) => {
        if (u && u.startsWith('blob:')) skippedAssets.push({ type: 'sfx', index: i, url: u, reason: 'blob URL non raggiungibile dal server' });
      });
    }
    if (ambienceUrls) {
      ambienceUrls.forEach((u, i) => {
        if (u && u.startsWith('blob:')) skippedAssets.push({ type: 'ambience', index: i, url: u, reason: 'blob URL non raggiungibile dal server' });
      });
    }
    if (backgroundMusicUrl && backgroundMusicUrl.startsWith('blob:')) {
      skippedAssets.push({ type: 'music', url: backgroundMusicUrl, reason: 'blob URL non raggiungibile dal server' });
    }
    if (skippedAssets.length > 0) {
      console.warn(`⚠️ Skipping ${skippedAssets.length} unreachable audio assets:`, skippedAssets);
    }

    console.log('Concatenating videos:', { 
      count: videoUrls.length, 
      clipDurations,
      transition, 
      transitionDuration,
      resolution,
      aspectRatio,
      hasAudio: !!audioUrl,
      hasNarration: audioUrls?.filter(u => !!u).length || 0,
      hasSfx: sfxUrls?.filter(u => !!u).length || 0,
      hasMusic: !!backgroundMusicUrl,
      hasIntro: intro?.enabled,
      hasOutro: outro?.enabled,
      useShotstack: !!SHOTSTACK_API_KEY,
      dryRun: !!dryRun,
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

        // Determine if we have dedicated audio tracks (narration/music)
        const hasDedicatedAudio = (audioUrls && audioUrls.some(u => !!u)) || !!backgroundMusicUrl || !!audioUrl;

        // Track the REAL on-timeline start for each scene clip (after transition overlaps).
        // Audio tracks (narration, SFX) MUST use these values — otherwise raw cumulative
        // sums drift forward by ~transitionDuration per scene, causing "missing voice" or
        // SFX firing on the wrong scene.
        const sceneStarts: number[] = [];

        // Add video clips
        for (let i = 0; i < videoUrls.length; i++) {
          // Use custom duration or default to 5 seconds
          const clipLength = clipDurations?.[i] || 5;
          const effects = clipEffects?.[i];
          const normalizedVideoUrl = await normalizeAssetUrl(videoUrls[i], supabase, supabaseUrl);

          const clip: any = {
            asset: {
              type: 'video',
              src: normalizedVideoUrl,
              // Mute embedded video audio when we have dedicated audio tracks
              ...(hasDedicatedAudio ? { volume: 0 } : {}),
            },
            start: currentStart,
            length: clipLength,
            fit: 'crop', // Scale to fill the output frame maintaining aspect ratio
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

          // Add transition effect between clips (per-scene or global).
          // Default to crossfade when no per-scene transition is provided so all
          // scenes get a consistent blend (instead of a hard cut / frozen frame).
          const sceneTransition = transitions?.[i];
          const rawTransType = sceneTransition?.type || transition;
          const transType = (!rawTransType || rawTransType === 'none') ? 'crossfade' : rawTransType;
          const transDur = sceneTransition?.duration ?? transitionDuration ?? 0.5;
          const shotstackTransition = mapTransition(transType);
          
          if (shotstackTransition && i > 0) {
            const isCrossBlend = transType === 'crossfade' || transType === 'dissolve';
            const isFadeToBlack = transType === 'fade' || transType === 'fade_black';

            // Crossfade/dissolve: fade OUT previous and fade IN current over an overlap window.
            // Fade-to-black: avoid overlap, otherwise Shotstack blends clips instead of dipping to black.
            if (shotstackTransition.out) {
              const prevClip = videoClips[videoClips.length - 1];
              if (prevClip && !prevClip.transition?.out && isCrossBlend) {
                prevClip.transition = {
                  ...prevClip.transition,
                  out: shotstackTransition.out,
                };
              }
            }
            if (shotstackTransition.in) {
              clip.transition = {
                ...effectsResult.transition,
                in: shotstackTransition.in,
              };
            }

            if (isCrossBlend) {
              clip.start = Math.max(0, currentStart - transDur);
            } else if (isFadeToBlack) {
              clip.start = currentStart;
            }
          } else if (effectsResult.transition) {
            clip.transition = effectsResult.transition;
          }

          // Record the actual start (post-overlap) before pushing
          sceneStarts.push(clip.start);
          videoClips.push(clip);
          // Advance master clock by the EFFECTIVE duration of this clip on the timeline.
          // For overlapped clips, currentStart should sit at clip.start + clipLength so the
          // NEXT iteration computes its overlap from the correct anchor.
          currentStart = clip.start + clipLength;
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

            audioSrc = await normalizeAssetUrl(`storage://generated-videos/${audioFileName}`, supabase, supabaseUrl);
          } else {
            audioSrc = await normalizeAssetUrl(audioUrl, supabase, supabaseUrl);
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

        // Compute REAL effective video duration on the timeline (post-overlap).
        // This is what the master clock landed on after the loop, minus the intro offset.
        const effectiveVideoDuration = currentStart - introDuration;
        const effectiveTotalDuration = introDuration + effectiveVideoDuration + (outro?.enabled ? outro.duration : 0);

        // Add per-scene narration audio tracks — anchored to sceneStarts[i] so voice
        // never drifts past its scene when transitions overlap.
        if (audioUrls && audioUrls.length > 0) {
          const narrationClips: any[] = [];
          for (let i = 0; i < audioUrls.length; i++) {
            const clipLen = clipDurations?.[i] || 5;
            const rawUrl = audioUrls[i];
            const sceneStart = sceneStarts[i] ?? (introDuration + i * clipLen);
            if (rawUrl && !rawUrl.startsWith('blob:')) {
              const narrationSrc = await normalizeAssetUrl(rawUrl, supabase, supabaseUrl);
              narrationClips.push({
                asset: {
                  type: 'audio',
                  src: narrationSrc,
                  volume: effectiveNarrationVolume,
                },
                start: sceneStart,
                length: clipLen,
              });
            }
          }
          if (narrationClips.length > 0) {
            timeline.tracks.push({ clips: narrationClips });
          }
        }

        // Add per-scene SFX audio tracks (punctual effects) — ducked under voice when autoMix=true.
        if (sfxUrls && sfxUrls.length > 0) {
          const sfxClips: any[] = [];
          for (let i = 0; i < sfxUrls.length; i++) {
            const clipLen = clipDurations?.[i] || 5;
            const rawUrl = sfxUrls[i];
            const sceneStart = sceneStarts[i] ?? (introDuration + i * clipLen);
            if (rawUrl && !rawUrl.startsWith('blob:')) {
              const sfxSrc = await normalizeAssetUrl(rawUrl, supabase, supabaseUrl);
              sfxClips.push({
                asset: {
                  type: 'audio',
                  src: sfxSrc,
                  volume: effectiveSfxVolume,
                },
                start: sceneStart,
                length: clipLen,
              });
            }
          }
          if (sfxClips.length > 0) {
            timeline.tracks.push({ clips: sfxClips });
          }
        }

        // Add per-scene AMBIENCE audio tracks (continuous wind/sea/forest beds) —
        // separate from SFX so the user can keep ambience audible while taming punctual hits.
        if (ambienceUrls && ambienceUrls.length > 0 && effectiveAmbienceVolume > 0) {
          const ambClips: any[] = [];
          for (let i = 0; i < ambienceUrls.length; i++) {
            const clipLen = clipDurations?.[i] || 5;
            const rawUrl = ambienceUrls[i];
            const sceneStart = sceneStarts[i] ?? (introDuration + i * clipLen);
            if (rawUrl && !rawUrl.startsWith('blob:')) {
              const ambSrc = await normalizeAssetUrl(rawUrl, supabase, supabaseUrl);
              ambClips.push({
                asset: {
                  type: 'audio',
                  src: ambSrc,
                  volume: effectiveAmbienceVolume,
                  // soft fade-in/out so ambience doesn't pop between scenes
                  effect: 'fadeInFadeOut',
                },
                start: sceneStart,
                length: clipLen,
              });
            }
          }
          if (ambClips.length > 0) {
            timeline.tracks.push({ clips: ambClips });
          }
        }

        // Add background music track — uses EFFECTIVE total duration, not raw sum,
        // so music length matches the actual final video.
        // CRITICAL: Shotstack will not auto-extend a clip beyond its source duration,
        // so when the music file is shorter than the video we need to LOOP it by adding
        // multiple back-to-back clips with a tiny crossfade overlap to avoid audible cuts.
        if (backgroundMusicUrl && !backgroundMusicUrl.startsWith('blob:')) {
          const normalizedMusicUrl = await normalizeAssetUrl(backgroundMusicUrl, supabase, supabaseUrl);

          // Probe music duration via HEAD/Range request — best-effort, falls back to assuming
          // music is long enough if probe fails.
          let musicDuration = effectiveTotalDuration;
          try {
            const probe = await fetch(normalizedMusicUrl, { method: 'HEAD' });
            const contentLength = parseInt(probe.headers.get('content-length') || '0', 10);
            // Rough estimate: 128kbps mp3 ≈ 16KB/s. Used only as a sanity check; if music is
            // clearly shorter than video, we loop. Otherwise we trust a single clip.
            if (contentLength > 0) {
              const estimatedSeconds = contentLength / 16000;
              if (estimatedSeconds < effectiveTotalDuration - 1) {
                musicDuration = estimatedSeconds;
              }
            }
          } catch (probeErr) {
            console.warn('Music duration probe failed, assuming single clip is enough:', probeErr);
          }

          const musicClips: any[] = [];
          if (musicDuration >= effectiveTotalDuration - 0.5) {
            // Single clip covers the whole video.
            musicClips.push({
              asset: { type: 'audio', src: normalizedMusicUrl, volume: effectiveMusicVolume },
              start: 0,
              length: effectiveTotalDuration,
            });
          } else {
            // Loop music with 0.5s overlap between repetitions to mask the seam.
            const SEAM_OVERLAP = 0.5;
            const safeChunkLen = Math.max(musicDuration - SEAM_OVERLAP, 1);
            let cursor = 0;
            let loopIdx = 0;
            while (cursor < effectiveTotalDuration - 0.05 && loopIdx < 30) {
              const remaining = effectiveTotalDuration - cursor;
              const clipLen = Math.min(musicDuration, remaining);
              musicClips.push({
                asset: {
                  type: 'audio',
                  src: normalizedMusicUrl,
                  volume: effectiveMusicVolume,
                  // Fade in/out on each loop seam so repetitions blend instead of clicking.
                  effect: loopIdx === 0 ? 'fadeOut' : (clipLen >= remaining - 0.05 ? 'fadeIn' : 'fadeInFadeOut'),
                },
                start: cursor,
                length: clipLen,
              });
              cursor += safeChunkLen;
              loopIdx++;
            }
            console.log(`Music looped ${loopIdx}x to cover ${effectiveTotalDuration}s (source ${musicDuration}s)`);
          }

          timeline.tracks.push({ clips: musicClips });
        }

        // Build render request — use explicit size for vertical/square to avoid Shotstack
        // letterboxing (the "francobollo" effect) caused by mixing resolution:'hd' with aspectRatio:'9:16'.
        const aspectSize = getAspectRatioSize(aspectRatio, resolution);
        const output: any = {
          format: 'mp4',
          fps: parseInt(fps),
        };

        if (aspectSize) {
          // Explicit size = exact pixel canvas, no letterbox
          output.size = aspectSize;
        } else {
          // Fallback (shouldn't happen — all 3 ratios return a size now)
          output.resolution = mapResolution(resolution);
          output.aspectRatio = aspectRatio;
        }

        const renderRequest = {
          timeline,
          output,
        };

        console.log('Shotstack render request:', JSON.stringify(renderRequest, null, 2));

        // Dry-run mode: return timeline summary without actually rendering
        if (dryRun) {
          // Count actual clips placed (after filtering blob: URLs out)
          const placedNarrationClips = (audioUrls || []).filter(u => !!u && !u.startsWith('blob:')).length;
          const placedSfxClips = (sfxUrls || []).filter(u => !!u && !u.startsWith('blob:')).length;
          const placedAmbienceClips = (ambienceUrls || []).filter(u => !!u && !u.startsWith('blob:')).length;
          const requestedNarration = (audioUrls || []).filter(u => !!u).length;
          const requestedSfx = (sfxUrls || []).filter(u => !!u).length;
          const requestedAmbience = (ambienceUrls || []).filter(u => !!u).length;
          const placedMusic = !!backgroundMusicUrl && !backgroundMusicUrl.startsWith('blob:');
          const tracksSummary = timeline.tracks.map((t: any, idx: number) => ({
            track: idx + 1,
            clips: t.clips.length,
            type: t.clips[0]?.asset?.type || 'unknown',
          }));
          return new Response(
            JSON.stringify({
              dryRun: true,
              summary: {
                totalScenes: videoUrls.length,
                // Use EFFECTIVE duration (post-overlap), not raw sum
                totalDuration: Math.round(effectiveTotalDuration * 10) / 10,
                rawDuration: Math.round(((clipDurations?.reduce((s, d) => s + d, 0) || videoUrls.length * 5) + introDuration + (outro?.enabled ? outro.duration : 0)) * 10) / 10,
                aspectRatio,
                resolution,
                fps,
                // Backwards-compat fields
                narrationScenes: placedNarrationClips,
                sfxScenes: placedSfxClips,
                ambienceScenes: placedAmbienceClips,
                // Detailed breakdown — surfaced in RenderPreviewDialog
                placedClips: {
                  video: videoClips.filter((c: any) => c.asset?.type === 'video').length,
                  narration: placedNarrationClips,
                  sfx: placedSfxClips,
                  ambience: placedAmbienceClips,
                  music: placedMusic ? 1 : 0,
                },
                requestedClips: {
                  narration: requestedNarration,
                  sfx: requestedSfx,
                  ambience: requestedAmbience,
                  music: backgroundMusicUrl ? 1 : 0,
                },
                skippedAssets: skippedAssets.length > 0 ? skippedAssets : [],
                sceneStarts: sceneStarts.map(s => Math.round(s * 100) / 100),
                hasBackgroundMusic: placedMusic,
                hasIntro: intro?.enabled || false,
                hasOutro: outro?.enabled || false,
                transitionType: transitions?.[0]?.type || transition,
                tracks: tracksSummary,
                // Volumes the user requested
                narrationVolume,
                sfxVolume,
                ambienceVolume,
                musicVolume,
                // Effective volumes after auto-mix (so the UI can show what actually got applied)
                autoMix,
                lufsTarget,
                effectiveVolumes: {
                  narration: effectiveNarrationVolume,
                  sfx: effectiveSfxVolume,
                  ambience: effectiveAmbienceVolume,
                  music: effectiveMusicVolume,
                },
              },
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

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
              const signedFinalUrl = await normalizeAssetUrl(`storage://generated-videos/${fileName}`, supabase, supabaseUrl);

              return new Response(
                JSON.stringify({
                  success: true,
                  videoUrl: signedFinalUrl,
                  segments: videoUrls,
                  audioUrl: audioUrl,
                  message: 'Video concatenato con Shotstack!',
                  method: 'shotstack',
                  skippedAssets: skippedAssets.length > 0 ? skippedAssets : undefined,
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
              skippedAssets: skippedAssets.length > 0 ? skippedAssets : undefined,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // If render timeout, DO NOT return videoUrls[0] as videoUrl — that misleads the UI
        // into thinking the final video is ready. Force the client to poll renderId.
        console.log('Shotstack render still processing after sync window — returning renderId for client polling');
        return new Response(
          JSON.stringify({
            success: true,
            videoUrl: null, // intentionally null so UI doesn't enable download
            segments: videoUrls,
            audioUrl: audioUrl,
            renderId,
            status: 'processing',
            message: 'Video in elaborazione su Shotstack. Continua a controllare lo stato.',
            method: 'shotstack-pending',
            skippedAssets: skippedAssets.length > 0 ? skippedAssets : undefined,
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
          const signedSegmentUrl = await normalizeAssetUrl(`storage://generated-videos/${fileName}`, supabase, supabaseUrl);
          outputFiles.push(signedSegmentUrl);
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
            outputAudioUrl = await normalizeAssetUrl(`storage://generated-videos/${audioFileName}`, supabase, supabaseUrl);
          }
        } catch (err) {
          console.error('Audio processing error:', err);
          outputAudioUrl = audioUrl;
        }
      } else {
        outputAudioUrl = await normalizeAssetUrl(audioUrl, supabase, supabaseUrl);
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
