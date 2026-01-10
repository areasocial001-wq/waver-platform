// Centralizzata configurazione di tutti i provider video

export type VideoProviderType = 
  | 'auto'
  | 'google-veo'
  // AI/ML API providers
  | 'aiml-runway'
  | 'aiml-kling'
  | 'aiml-veo'
  // PiAPI providers
  | 'piapi-kling-2.1'
  | 'piapi-kling-2.5'
  | 'piapi-kling-2.6'
  | 'piapi-hailuo'
  | 'piapi-luma'
  | 'piapi-wan'
  | 'piapi-hunyuan'
  | 'piapi-skyreels'
  | 'piapi-framepack'
  | 'piapi-veo3'
  | 'piapi-sora2'
  // Freepik
  | 'freepik';

export type ProviderGroup = 'google' | 'aiml' | 'piapi' | 'freepik' | 'auto';

export interface VideoProviderInfo {
  id: VideoProviderType;
  name: string;
  shortName: string;
  group: ProviderGroup;
  description: string;
  color: string; // Tailwind class
  badgeColor: string; // Tailwind bg class for badge
  textColor: string; // Tailwind text class for badge
  speed: 1 | 2 | 3; // 1=lento, 2=medio, 3=veloce
  quality: 1 | 2 | 3; // 1=base, 2=buona, 3=eccellente
  cost: 1 | 2 | 3; // 1=economico, 2=medio, 3=costoso
  features: string[];
  estimatedTime: string;
  fallbackOrder: VideoProviderType[];
  durations: { value: string; label: string }[];
  resolutions: { value: string; label: string }[];
  aspectRatios?: { value: string; label: string }[];
  supportsAudio?: boolean;
  supportsImageToVideo?: boolean;
  supportsTextToVideo?: boolean;
  requiresApiKey?: string; // Nome del secret richiesto
}

export const VIDEO_PROVIDERS: Record<VideoProviderType, VideoProviderInfo> = {
  auto: {
    id: 'auto',
    name: 'Automatico',
    shortName: 'Auto',
    group: 'auto',
    description: 'Selezione automatica del provider migliore',
    color: 'bg-accent',
    badgeColor: 'bg-accent/20',
    textColor: 'text-accent',
    speed: 2,
    quality: 3,
    cost: 2,
    features: ['Selezione automatica', 'Fallback auto'],
    estimatedTime: '2-5 min',
    fallbackOrder: ['google-veo', 'piapi-kling-2.5', 'piapi-hailuo'],
    durations: [
      { value: '5', label: '5 secondi' },
      { value: '10', label: '10 secondi' },
    ],
    resolutions: [
      { value: '720p', label: '720p (HD)' },
      { value: '1080p', label: '1080p (Full HD)' },
    ],
    supportsImageToVideo: true,
    supportsTextToVideo: true,
  },
  'google-veo': {
    id: 'google-veo',
    name: 'Google Veo 3.1',
    shortName: 'Veo',
    group: 'google',
    description: 'API Diretta Google, audio nativo integrato',
    color: 'bg-blue-500',
    badgeColor: 'bg-blue-500/20',
    textColor: 'text-blue-500',
    speed: 2,
    quality: 3,
    cost: 2,
    features: ['API Diretta', 'Audio nativo', 'Alta qualità'],
    estimatedTime: '2-4 min',
    fallbackOrder: ['piapi-kling-2.5', 'piapi-hailuo'],
    durations: [
      { value: '4', label: '4 secondi' },
      { value: '6', label: '6 secondi' },
      { value: '8', label: '8 secondi' },
    ],
    resolutions: [
      { value: '720p', label: '720p (HD)' },
      { value: '1080p', label: '1080p (Full HD)' },
    ],
    aspectRatios: [
      { value: '16:9', label: '16:9 (Orizzontale)' },
      { value: '9:16', label: '9:16 (Verticale)' },
    ],
    supportsAudio: true,
    supportsImageToVideo: true,
    supportsTextToVideo: true,
    requiresApiKey: 'GOOGLE_AI_API_KEY',
  },
  // AI/ML API providers
  'aiml-runway': {
    id: 'aiml-runway',
    name: 'AI/ML: Runway Gen-3',
    shortName: 'Runway',
    group: 'aiml',
    description: 'Gen-3 Alpha Turbo via gateway AI/ML',
    color: 'bg-purple-500',
    badgeColor: 'bg-purple-500/20',
    textColor: 'text-purple-500',
    speed: 2,
    quality: 3,
    cost: 2,
    features: ['Runway Gen-3', 'Alta qualità', 'Gateway AI/ML'],
    estimatedTime: '2-4 min',
    fallbackOrder: ['aiml-kling', 'piapi-kling-2.5'],
    durations: [
      { value: '5', label: '5 secondi' },
      { value: '10', label: '10 secondi' },
    ],
    resolutions: [
      { value: '720p', label: '720p (HD)' },
      { value: '1080p', label: '1080p (Full HD)' },
    ],
    supportsImageToVideo: true,
    supportsTextToVideo: true,
    requiresApiKey: 'AIML_API_KEY',
  },
  'aiml-kling': {
    id: 'aiml-kling',
    name: 'AI/ML: Kling v1.6 Pro',
    shortName: 'Kling Pro',
    group: 'aiml',
    description: 'Kling premium via gateway AI/ML',
    color: 'bg-purple-600',
    badgeColor: 'bg-purple-600/20',
    textColor: 'text-purple-600',
    speed: 2,
    quality: 3,
    cost: 2,
    features: ['Kling v1.6', 'Premium', 'Gateway AI/ML'],
    estimatedTime: '3-5 min',
    fallbackOrder: ['aiml-runway', 'piapi-kling-2.5'],
    durations: [
      { value: '5', label: '5 secondi' },
      { value: '10', label: '10 secondi' },
    ],
    resolutions: [
      { value: '720p', label: '720p (HD)' },
      { value: '1080p', label: '1080p (Full HD)' },
    ],
    supportsImageToVideo: true,
    supportsTextToVideo: true,
    requiresApiKey: 'AIML_API_KEY',
  },
  'aiml-veo': {
    id: 'aiml-veo',
    name: 'AI/ML: Google Veo 3.1',
    shortName: 'Veo AI/ML',
    group: 'aiml',
    description: 'Veo 3.1 via gateway AI/ML',
    color: 'bg-purple-400',
    badgeColor: 'bg-purple-400/20',
    textColor: 'text-purple-400',
    speed: 2,
    quality: 3,
    cost: 2,
    features: ['Veo 3.1', 'Audio nativo', 'Gateway AI/ML'],
    estimatedTime: '2-4 min',
    fallbackOrder: ['aiml-runway', 'aiml-kling'],
    durations: [
      { value: '4', label: '4 secondi' },
      { value: '6', label: '6 secondi' },
      { value: '8', label: '8 secondi' },
    ],
    resolutions: [
      { value: '720p', label: '720p (HD)' },
      { value: '1080p', label: '1080p (Full HD)' },
    ],
    aspectRatios: [
      { value: '16:9', label: '16:9 (Orizzontale)' },
      { value: '9:16', label: '9:16 (Verticale)' },
    ],
    supportsAudio: true,
    supportsImageToVideo: true,
    supportsTextToVideo: true,
    requiresApiKey: 'AIML_API_KEY',
  },
  // PiAPI providers
  'piapi-kling-2.1': {
    id: 'piapi-kling-2.1',
    name: 'PiAPI: Kling 2.1',
    shortName: 'Kling 2.1',
    group: 'piapi',
    description: 'Economico, buona qualità base',
    color: 'bg-orange-400',
    badgeColor: 'bg-orange-400/20',
    textColor: 'text-orange-400',
    speed: 2,
    quality: 2,
    cost: 1,
    features: ['Economico'],
    estimatedTime: '2-3 min',
    fallbackOrder: ['piapi-kling-2.5', 'piapi-hailuo'],
    durations: [
      { value: '5', label: '5 secondi' },
      { value: '10', label: '10 secondi' },
    ],
    resolutions: [
      { value: '720p', label: '720p (HD)' },
      { value: '1080p', label: '1080p (Full HD)' },
    ],
    supportsImageToVideo: true,
    supportsTextToVideo: true,
    requiresApiKey: 'PIAPI_API_KEY',
  },
  'piapi-kling-2.5': {
    id: 'piapi-kling-2.5',
    name: 'PiAPI: Kling 2.5',
    shortName: 'Kling 2.5',
    group: 'piapi',
    description: 'Ottimo rapporto qualità/prezzo',
    color: 'bg-orange-500',
    badgeColor: 'bg-orange-500/20',
    textColor: 'text-orange-500',
    speed: 2,
    quality: 3,
    cost: 2,
    features: ['Ottimo Q/P', 'Transizioni fluide'],
    estimatedTime: '2-4 min',
    fallbackOrder: ['piapi-kling-2.6', 'piapi-hailuo'],
    durations: [
      { value: '5', label: '5 secondi' },
      { value: '10', label: '10 secondi' },
    ],
    resolutions: [
      { value: '720p', label: '720p (HD)' },
      { value: '1080p', label: '1080p (Full HD)' },
    ],
    supportsImageToVideo: true,
    supportsTextToVideo: true,
    requiresApiKey: 'PIAPI_API_KEY',
  },
  'piapi-kling-2.6': {
    id: 'piapi-kling-2.6',
    name: 'PiAPI: Kling 2.6',
    shortName: 'Kling 2.6',
    group: 'piapi',
    description: 'Ultimo modello con motion control',
    color: 'bg-orange-600',
    badgeColor: 'bg-orange-600/20',
    textColor: 'text-orange-600',
    speed: 2,
    quality: 3,
    cost: 2,
    features: ['Motion control', 'Nuovo modello'],
    estimatedTime: '2-4 min',
    fallbackOrder: ['piapi-kling-2.5', 'piapi-hailuo'],
    durations: [
      { value: '5', label: '5 secondi' },
      { value: '10', label: '10 secondi' },
    ],
    resolutions: [
      { value: '720p', label: '720p (HD)' },
      { value: '1080p', label: '1080p (Full HD)' },
    ],
    supportsImageToVideo: true,
    supportsTextToVideo: true,
    requiresApiKey: 'PIAPI_API_KEY',
  },
  'piapi-hailuo': {
    id: 'piapi-hailuo',
    name: 'PiAPI: Hailuo',
    shortName: 'Hailuo',
    group: 'piapi',
    description: 'Veloce ed economico',
    color: 'bg-pink-500',
    badgeColor: 'bg-pink-500/20',
    textColor: 'text-pink-500',
    speed: 3,
    quality: 2,
    cost: 1,
    features: ['Veloce', 'Economico'],
    estimatedTime: '1-2 min',
    fallbackOrder: ['piapi-wan', 'piapi-kling-2.5'],
    durations: [
      { value: '4', label: '4 secondi' },
      { value: '6', label: '6 secondi' },
    ],
    resolutions: [
      { value: '720p', label: '720p (HD)' },
      { value: '1080p', label: '1080p (Full HD)' },
    ],
    supportsImageToVideo: true,
    supportsTextToVideo: true,
    requiresApiKey: 'PIAPI_API_KEY',
  },
  'piapi-luma': {
    id: 'piapi-luma',
    name: 'PiAPI: Luma',
    shortName: 'Luma',
    group: 'piapi',
    description: 'Stile cinematico unico',
    color: 'bg-cyan-500',
    badgeColor: 'bg-cyan-500/20',
    textColor: 'text-cyan-500',
    speed: 2,
    quality: 3,
    cost: 2,
    features: ['Cinematico', 'Stile unico'],
    estimatedTime: '2-4 min',
    fallbackOrder: ['piapi-kling-2.5', 'piapi-hailuo'],
    durations: [
      { value: '5', label: '5 secondi' },
    ],
    resolutions: [
      { value: '720p', label: '720p (HD)' },
    ],
    supportsImageToVideo: true,
    supportsTextToVideo: true,
    requiresApiKey: 'PIAPI_API_KEY',
  },
  'piapi-wan': {
    id: 'piapi-wan',
    name: 'PiAPI: Wan',
    shortName: 'Wan',
    group: 'piapi',
    description: 'Ottimo per scene naturali',
    color: 'bg-violet-500',
    badgeColor: 'bg-violet-500/20',
    textColor: 'text-violet-500',
    speed: 2,
    quality: 2,
    cost: 1,
    features: ['Scene naturali', 'Economico'],
    estimatedTime: '2-3 min',
    fallbackOrder: ['piapi-hailuo', 'piapi-kling-2.5'],
    durations: [
      { value: '5', label: '5 secondi' },
    ],
    resolutions: [
      { value: '480p', label: '480p (Standard)' },
      { value: '720p', label: '720p (HD)' },
    ],
    supportsImageToVideo: true,
    supportsTextToVideo: true,
    requiresApiKey: 'PIAPI_API_KEY',
  },
  'piapi-hunyuan': {
    id: 'piapi-hunyuan',
    name: 'PiAPI: Hunyuan',
    shortName: 'Hunyuan',
    group: 'piapi',
    description: 'Volti realistici e dettagliati',
    color: 'bg-amber-500',
    badgeColor: 'bg-amber-500/20',
    textColor: 'text-amber-500',
    speed: 2,
    quality: 3,
    cost: 2,
    features: ['Volti realistici', 'Dettagli'],
    estimatedTime: '2-4 min',
    fallbackOrder: ['piapi-kling-2.5', 'piapi-hailuo'],
    durations: [
      { value: '5', label: '5 secondi' },
    ],
    resolutions: [
      { value: '720p', label: '720p (HD)' },
      { value: '1080p', label: '1080p (Full HD)' },
    ],
    supportsImageToVideo: true,
    supportsTextToVideo: true,
    requiresApiKey: 'PIAPI_API_KEY',
  },
  'piapi-skyreels': {
    id: 'piapi-skyreels',
    name: 'PiAPI: Skyreels',
    shortName: 'Skyreels',
    group: 'piapi',
    description: 'Effetti speciali cinematografici',
    color: 'bg-indigo-500',
    badgeColor: 'bg-indigo-500/20',
    textColor: 'text-indigo-500',
    speed: 2,
    quality: 2,
    cost: 1,
    features: ['Effetti speciali', 'Cinematografico'],
    estimatedTime: '2-3 min',
    fallbackOrder: ['piapi-hailuo', 'piapi-wan'],
    durations: [
      { value: '5', label: '5 secondi' },
    ],
    resolutions: [
      { value: '720p', label: '720p (HD)' },
    ],
    supportsImageToVideo: true,
    supportsTextToVideo: true,
    requiresApiKey: 'PIAPI_API_KEY',
  },
  'piapi-framepack': {
    id: 'piapi-framepack',
    name: 'PiAPI: Framepack',
    shortName: 'Framepack',
    group: 'piapi',
    description: 'Interpolazione frame fluida',
    color: 'bg-teal-500',
    badgeColor: 'bg-teal-500/20',
    textColor: 'text-teal-500',
    speed: 3,
    quality: 2,
    cost: 1,
    features: ['Interpolazione', 'Veloce'],
    estimatedTime: '1-2 min',
    fallbackOrder: ['piapi-hailuo', 'piapi-wan'],
    durations: [
      { value: '5', label: '5 secondi' },
    ],
    resolutions: [
      { value: '720p', label: '720p (HD)' },
    ],
    supportsImageToVideo: true,
    supportsTextToVideo: false,
    requiresApiKey: 'PIAPI_API_KEY',
  },
  'piapi-veo3': {
    id: 'piapi-veo3',
    name: 'PiAPI: Veo 3',
    shortName: 'Veo 3',
    group: 'piapi',
    description: 'Audio sync via PiAPI',
    color: 'bg-emerald-500',
    badgeColor: 'bg-emerald-500/20',
    textColor: 'text-emerald-500',
    speed: 2,
    quality: 3,
    cost: 2,
    features: ['Audio sync', 'Via PiAPI'],
    estimatedTime: '3-5 min',
    fallbackOrder: ['piapi-kling-2.5', 'piapi-hailuo'],
    durations: [
      { value: '4', label: '4 secondi' },
      { value: '6', label: '6 secondi' },
      { value: '8', label: '8 secondi' },
    ],
    resolutions: [
      { value: '720p', label: '720p (HD)' },
      { value: '1080p', label: '1080p (Full HD)' },
    ],
    aspectRatios: [
      { value: '16:9', label: '16:9 (Orizzontale)' },
      { value: '9:16', label: '9:16 (Verticale)' },
    ],
    supportsAudio: true,
    supportsImageToVideo: true,
    supportsTextToVideo: true,
    requiresApiKey: 'PIAPI_API_KEY',
  },
  'piapi-sora2': {
    id: 'piapi-sora2',
    name: 'PiAPI: Sora 2',
    shortName: 'Sora 2',
    group: 'piapi',
    description: 'OpenAI Sora, fino a 20 secondi',
    color: 'bg-red-500',
    badgeColor: 'bg-red-500/20',
    textColor: 'text-red-500',
    speed: 1,
    quality: 3,
    cost: 3,
    features: ['OpenAI', 'Fino a 20s', 'Alta qualità'],
    estimatedTime: '5-10 min',
    fallbackOrder: ['piapi-kling-2.5', 'piapi-veo3'],
    durations: [
      { value: '5', label: '5 secondi' },
      { value: '10', label: '10 secondi' },
      { value: '15', label: '15 secondi' },
      { value: '20', label: '20 secondi' },
    ],
    resolutions: [
      { value: '720p', label: '720p (HD)' },
      { value: '1080p', label: '1080p (Full HD)' },
      { value: '4k', label: '4K (Ultra HD)' },
    ],
    aspectRatios: [
      { value: '16:9', label: '16:9 (Orizzontale)' },
      { value: '9:16', label: '9:16 (Verticale)' },
    ],
    supportsImageToVideo: true,
    supportsTextToVideo: true,
    requiresApiKey: 'PIAPI_API_KEY',
  },
  freepik: {
    id: 'freepik',
    name: 'Freepik MiniMax',
    shortName: 'Freepik',
    group: 'freepik',
    description: 'Veloce con transizioni fluide',
    color: 'bg-fuchsia-500',
    badgeColor: 'bg-fuchsia-500/20',
    textColor: 'text-fuchsia-500',
    speed: 3,
    quality: 2,
    cost: 1,
    features: ['Veloce', 'Transizioni'],
    estimatedTime: '1-2 min',
    fallbackOrder: ['piapi-hailuo', 'piapi-kling-2.5'],
    durations: [
      { value: '5', label: '5 secondi' },
    ],
    resolutions: [
      { value: '720p', label: '720p (HD)' },
    ],
    supportsImageToVideo: true,
    supportsTextToVideo: true,
    requiresApiKey: 'FREEPIK_API_KEY',
  },
};

// Helper per ottenere provider per gruppo
export function getProvidersByGroup(group: ProviderGroup): VideoProviderInfo[] {
  return Object.values(VIDEO_PROVIDERS).filter(p => p.group === group);
}

// Helper per ottenere provider che supportano un tipo specifico
export function getProvidersForType(type: 'text_to_video' | 'image_to_video'): VideoProviderInfo[] {
  return Object.values(VIDEO_PROVIDERS).filter(p => 
    type === 'text_to_video' ? p.supportsTextToVideo : p.supportsImageToVideo
  );
}

// Helper per ottenere l'etichetta del gruppo
export function getGroupLabel(group: ProviderGroup): string {
  const labels: Record<ProviderGroup, string> = {
    auto: 'Automatico',
    google: 'Google',
    aiml: 'AI/ML API',
    piapi: 'PiAPI',
    freepik: 'Freepik',
  };
  return labels[group];
}

// Helper per ottenere il colore del gruppo per badge
export function getGroupBadgeStyles(group: ProviderGroup): { bg: string; text: string } {
  const styles: Record<ProviderGroup, { bg: string; text: string }> = {
    auto: { bg: 'bg-accent/20', text: 'text-accent' },
    google: { bg: 'bg-blue-500/20', text: 'text-blue-500' },
    aiml: { bg: 'bg-purple-500/20', text: 'text-purple-500' },
    piapi: { bg: 'bg-orange-500/20', text: 'text-orange-500' },
    freepik: { bg: 'bg-fuchsia-500/20', text: 'text-fuchsia-500' },
  };
  return styles[group];
}

// Helper per identificare il gruppo da un provider ID
export function getProviderGroup(providerId: string): ProviderGroup {
  const provider = VIDEO_PROVIDERS[providerId as VideoProviderType];
  if (provider) return provider.group;
  
  // Fallback per provider ID non standard
  if (providerId.startsWith('aiml-')) return 'aiml';
  if (providerId.startsWith('piapi-')) return 'piapi';
  if (providerId === 'google-veo' || providerId === 'veo') return 'google';
  if (providerId === 'freepik') return 'freepik';
  return 'auto';
}

// Helper per ottenere info provider da ID (anche con alias)
export function getProviderInfo(providerId: string): VideoProviderInfo | null {
  // Diretto match
  if (VIDEO_PROVIDERS[providerId as VideoProviderType]) {
    return VIDEO_PROVIDERS[providerId as VideoProviderType];
  }
  
  // Alias comuni
  const aliases: Record<string, VideoProviderType> = {
    'veo': 'google-veo',
    'kling': 'piapi-kling-2.5',
    'runway': 'aiml-runway',
    'sora': 'piapi-sora2',
    'hailuo': 'piapi-hailuo',
    'luma': 'piapi-luma',
  };
  
  if (aliases[providerId]) {
    return VIDEO_PROVIDERS[aliases[providerId]];
  }
  
  return null;
}

// Costi stimati per provider (in USD)
export const PROVIDER_COSTS: Record<VideoProviderType, { perSecond: number; perGeneration: number }> = {
  auto: { perSecond: 0.05, perGeneration: 0.25 },
  'google-veo': { perSecond: 0.08, perGeneration: 0.40 },
  'aiml-runway': { perSecond: 0.10, perGeneration: 0.50 },
  'aiml-kling': { perSecond: 0.08, perGeneration: 0.40 },
  'aiml-veo': { perSecond: 0.08, perGeneration: 0.40 },
  'piapi-kling-2.1': { perSecond: 0.03, perGeneration: 0.15 },
  'piapi-kling-2.5': { perSecond: 0.05, perGeneration: 0.25 },
  'piapi-kling-2.6': { perSecond: 0.05, perGeneration: 0.25 },
  'piapi-hailuo': { perSecond: 0.02, perGeneration: 0.10 },
  'piapi-luma': { perSecond: 0.06, perGeneration: 0.30 },
  'piapi-wan': { perSecond: 0.02, perGeneration: 0.10 },
  'piapi-hunyuan': { perSecond: 0.05, perGeneration: 0.25 },
  'piapi-skyreels': { perSecond: 0.03, perGeneration: 0.15 },
  'piapi-framepack': { perSecond: 0.02, perGeneration: 0.10 },
  'piapi-veo3': { perSecond: 0.08, perGeneration: 0.40 },
  'piapi-sora2': { perSecond: 0.15, perGeneration: 0.75 },
  freepik: { perSecond: 0.02, perGeneration: 0.10 },
};

// Ordine di visualizzazione per provider (raggruppati)
export const PROVIDER_DISPLAY_ORDER: VideoProviderType[] = [
  'auto',
  // Google
  'google-veo',
  // AI/ML
  'aiml-runway',
  'aiml-kling',
  'aiml-veo',
  // PiAPI
  'piapi-kling-2.6',
  'piapi-kling-2.5',
  'piapi-kling-2.1',
  'piapi-hailuo',
  'piapi-luma',
  'piapi-wan',
  'piapi-hunyuan',
  'piapi-skyreels',
  'piapi-framepack',
  'piapi-veo3',
  'piapi-sora2',
  // Freepik
  'freepik',
];
