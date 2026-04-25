import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProviderPreferences } from "./useProviderPreferences";
import { OperationType, ProviderType } from "@/lib/providerConfig";

interface MusicGenerationParams {
  prompt: string;
  duration?: number;
  model?: string;
}

interface SoundEffectParams {
  prompt: string;
  duration?: number;
}

interface TTSParams {
  text: string;
  voice?: string;
  languageCode?: string;
}

interface ImageGenerationParams {
  prompt: string;
  size?: string;
  model?: string;
}

interface VideoGenerationParams {
  prompt: string;
  imageUrl?: string;
  duration?: number;
  model?: string;
}

interface AIServiceResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  taskId?: string;
  audioUrl?: string;
  audioContent?: string;
  imageUrl?: string;
  videoUrl?: string;
}

export function useAIService() {
  const { getEffectiveProvider } = useProviderPreferences();

  // Generate music using AIML stable-audio (ElevenLabs removed).
  const generateMusic = useCallback(async (
    params: MusicGenerationParams
  ): Promise<AIServiceResult> => {
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-music', {
        body: {
          prompt: params.prompt,
          duration_seconds: params.duration || 30,
        },
      });
      if (error) throw error;
      return { success: true, audioContent: data?.audioContent, data };
    } catch (error) {
      console.error('Music generation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }, []);

  // Generate sound effects via AIML stable-audio.
  const generateSoundEffect = useCallback(async (
    params: SoundEffectParams
  ): Promise<AIServiceResult> => {
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-sfx', {
        body: {
          text: params.prompt,
          duration_seconds: params.duration || 5,
        },
      });
      if (error) throw error;
      return { success: true, audioContent: data?.audioContent, data };
    } catch (error) {
      console.error('Sound effect generation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }, []);

  // Text to Speech via Inworld (ElevenLabs removed).
  const textToSpeech = useCallback(async (
    params: TTSParams
  ): Promise<AIServiceResult> => {
    try {
      const { data, error } = await supabase.functions.invoke('inworld-tts', {
        body: {
          text: params.text,
          voiceId: params.voice,
          languageCode: params.languageCode || 'it',
        },
      });
      if (error) throw error;
      return { success: true, audioContent: data?.audioContent, data };
    } catch (error) {
      console.error('TTS error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }, []);

  const generateImage = useCallback(async (
    params: ImageGenerationParams
  ): Promise<AIServiceResult> => {
    const provider = getEffectiveProvider('image_generation');
    
    try {
      if (provider === 'piapi') {
        const { data, error } = await supabase.functions.invoke('piapi-image', {
          body: {
            prompt: params.prompt,
            model: params.model || 'flux',
          },
        });
        
        if (error) throw error;
        return {
          success: true,
          taskId: data.taskId,
          imageUrl: data.imageUrl,
          data,
        };
      }
      
      if (provider === 'aiml') {
        const { data, error } = await supabase.functions.invoke('aiml-api', {
          body: {
            operation: 'image',
            prompt: params.prompt,
            model: params.model || 'flux',
            size: params.size || '1024x1024',
          },
        });
        
        if (error) throw error;
        return {
          success: true,
          taskId: data.task_id,
          imageUrl: data.image_url,
          data,
        };
      }
      
      // Default to generate-image function
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: {
          prompt: params.prompt,
        },
      });
      
      if (error) throw error;
      return {
        success: true,
        imageUrl: data.imageUrl,
        data,
      };
    } catch (error) {
      console.error('Image generation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }, [getEffectiveProvider]);

  // Generate video
  const generateVideo = useCallback(async (
    params: VideoGenerationParams
  ): Promise<AIServiceResult> => {
    const provider = getEffectiveProvider('video_generation');
    
    try {
      if (provider === 'piapi') {
        const { data, error } = await supabase.functions.invoke('generate-video', {
          body: {
            prompt: params.prompt,
            imageUrl: params.imageUrl,
            duration: params.duration,
            provider: 'piapi',
          },
        });
        
        if (error) throw error;
        return {
          success: true,
          taskId: data.taskId || data.predictionId,
          videoUrl: data.videoUrl,
          data,
        };
      }
      
      if (provider === 'aiml') {
        const { data, error } = await supabase.functions.invoke('aiml-api', {
          body: {
            operation: 'video',
            prompt: params.prompt,
            image_url: params.imageUrl,
            model: params.model || 'kling',
            duration: params.duration || 5,
          },
        });
        
        if (error) throw error;
        return {
          success: true,
          taskId: data.task_id,
          videoUrl: data.video_url,
          data,
        };
      }
      
      // Default to generate-video function
      const { data, error } = await supabase.functions.invoke('generate-video', {
        body: {
          prompt: params.prompt,
          imageUrl: params.imageUrl,
          duration: params.duration,
        },
      });
      
      if (error) throw error;
      return {
        success: true,
        taskId: data.taskId || data.predictionId,
        videoUrl: data.videoUrl,
        data,
      };
    } catch (error) {
      console.error('Video generation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }, [getEffectiveProvider]);

  // Check task status (for async operations)
  const checkTaskStatus = useCallback(async (
    taskId: string,
    provider: ProviderType,
    operation: OperationType
  ): Promise<AIServiceResult> => {
    try {
      if (provider === 'piapi') {
        const functionName = operation === 'music_generation' ? 'piapi-audio' : 'generate-video';
        const { data, error } = await supabase.functions.invoke(functionName, {
          body: { action: 'status', taskId },
        });
        
        if (error) throw error;
        return { success: true, data };
      }
      
      if (provider === 'aiml') {
        const { data, error } = await supabase.functions.invoke('aiml-api', {
          body: { operation: 'status', task_id: taskId },
        });
        
        if (error) throw error;
        return { success: true, data };
      }
      
      throw new Error(`Unsupported status check for provider: ${provider}`);
    } catch (error) {
      console.error('Status check error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }, []);

  return {
    generateMusic,
    generateSoundEffect,
    textToSpeech,
    generateImage,
    generateVideo,
    checkTaskStatus,
    getEffectiveProvider,
  };
}
