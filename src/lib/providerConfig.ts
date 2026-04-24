// Provider configuration for AI services

export type ProviderType = 'aiml' | 'piapi' | 'elevenlabs' | 'inworld' | 'auto';

export type OperationType = 
  | 'music_generation'
  | 'sound_effects'
  | 'text_to_speech'
  | 'speech_to_text'
  | 'image_generation'
  | 'video_generation'
  | 'chat_completion';

export interface ProviderInfo {
  id: ProviderType;
  name: string;
  description: string;
  logo: string;
  supportedOperations: OperationType[];
  pricing?: string;
}

export interface ProviderPreferences {
  music_generation: ProviderType;
  sound_effects: ProviderType;
  text_to_speech: ProviderType;
  speech_to_text: ProviderType;
  image_generation: ProviderType;
  video_generation: ProviderType;
  chat_completion: ProviderType;
}

export const PROVIDERS: Record<ProviderType, ProviderInfo> = {
  auto: {
    id: 'auto',
    name: 'Auto',
    description: 'Seleziona automaticamente il provider più adatto',
    logo: '🔄',
    supportedOperations: [
      'music_generation', 
      'sound_effects', 
      'text_to_speech', 
      'speech_to_text',
      'image_generation',
      'video_generation',
      'chat_completion'
    ],
  },
  aiml: {
    id: 'aiml',
    name: 'AI/ML API',
    description: 'Gateway unificato per 400+ modelli AI',
    logo: '🤖',
    supportedOperations: [
      'music_generation',
      'sound_effects',
      'text_to_speech',
      'speech_to_text',
      'image_generation',
      'video_generation',
      'chat_completion'
    ],
    pricing: 'Pay-per-use, prezzi variabili per modello',
  },
  piapi: {
    id: 'piapi',
    name: 'PiAPI',
    description: 'API per generazione video e audio AI',
    logo: '🎬',
    supportedOperations: [
      'music_generation',
      'video_generation',
      'image_generation'
    ],
    pricing: 'Pay-per-task',
  },
  elevenlabs: {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    description: 'Specializzato in voce e audio AI',
    logo: '🎤',
    supportedOperations: [
      'music_generation',
      'sound_effects',
      'text_to_speech'
    ],
    pricing: 'Basato su caratteri/secondi',
  },
  inworld: {
    id: 'inworld',
    name: 'Inworld',
    description: 'TTS #1 per qualità su Artificial Analysis, latenza <120ms',
    logo: '🗣️',
    supportedOperations: [
      'text_to_speech',
    ],
    pricing: 'Pay-per-character, molto competitivo',
  },
};

export const DEFAULT_PREFERENCES: ProviderPreferences = {
  music_generation: 'auto',
  sound_effects: 'elevenlabs',
  text_to_speech: 'elevenlabs',
  speech_to_text: 'aiml',
  image_generation: 'auto',
  video_generation: 'auto',
  chat_completion: 'aiml',
};

// Get available providers for a specific operation
export function getProvidersForOperation(operation: OperationType): ProviderInfo[] {
  return Object.values(PROVIDERS).filter(
    provider => provider.supportedOperations.includes(operation)
  );
}

// Resolve 'auto' to a specific provider based on operation
export function resolveAutoProvider(operation: OperationType): ProviderType {
  const autoMapping: Record<OperationType, ProviderType> = {
    music_generation: 'elevenlabs',
    sound_effects: 'elevenlabs',
    text_to_speech: 'elevenlabs',
    speech_to_text: 'aiml',
    image_generation: 'aiml',
    video_generation: 'piapi',
    chat_completion: 'aiml',
  };
  return autoMapping[operation];
}

// AIML API model mappings
export const AIML_MODELS = {
  music: {
    suno: 'suno/suno-v4',
    udio: 'udio/udio-v1.5',
  },
  tts: {
    elevenlabs: 'elevenlabs/eleven_multilingual_v2',
    openai: 'openai/tts-1-hd',
  },
  stt: {
    whisper: 'openai/whisper-large-v3',
  },
  image: {
    dalle3: 'openai/dall-e-3',
    flux: 'black-forest-labs/flux-1.1-pro',
    sdxl: 'stability-ai/sdxl-1.0',
  },
  video: {
    runway: 'runway/gen-3-alpha-turbo',
    kling: 'kling-ai/kling-v1.6-pro',
    veo: 'google/veo-3.1',
  },
  chat: {
    gpt5: 'openai/gpt-5',
    claude: 'anthropic/claude-4.5-sonnet',
    gemini: 'google/gemini-3-pro',
  }
};
