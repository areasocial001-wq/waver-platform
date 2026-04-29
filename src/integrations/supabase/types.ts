export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agent_projects: {
        Row: {
          aspect_ratio: string
          brief: string
          broll_mix: Json
          color_palette: Json
          created_at: string
          error_message: string | null
          execution_status: string
          execution_step: string | null
          final_video_url: string | null
          id: string
          intro_title: Json | null
          json2video_project_id: string | null
          language: string
          narration_url: string | null
          outro_cta: Json | null
          pdf_text: string | null
          pdf_url: string | null
          plan: Json | null
          plan_status: string
          progress_log: Json
          progress_pct: number
          scene_overrides: Json
          selected_assets: Json
          storyboard: Json | null
          style_preset: string
          subtitle_config: Json
          target_duration: number
          title: string
          transition_level: string
          typography: string
          updated_at: string
          use_vidnoz_for_talking_head: boolean
          user_id: string
          vidnoz_avatar_id: string | null
          vidnoz_avatar_url: string | null
          vidnoz_voice_id: string | null
          voice_id: string | null
        }
        Insert: {
          aspect_ratio?: string
          brief: string
          broll_mix?: Json
          color_palette?: Json
          created_at?: string
          error_message?: string | null
          execution_status?: string
          execution_step?: string | null
          final_video_url?: string | null
          id?: string
          intro_title?: Json | null
          json2video_project_id?: string | null
          language?: string
          narration_url?: string | null
          outro_cta?: Json | null
          pdf_text?: string | null
          pdf_url?: string | null
          plan?: Json | null
          plan_status?: string
          progress_log?: Json
          progress_pct?: number
          scene_overrides?: Json
          selected_assets?: Json
          storyboard?: Json | null
          style_preset?: string
          subtitle_config?: Json
          target_duration?: number
          title?: string
          transition_level?: string
          typography?: string
          updated_at?: string
          use_vidnoz_for_talking_head?: boolean
          user_id: string
          vidnoz_avatar_id?: string | null
          vidnoz_avatar_url?: string | null
          vidnoz_voice_id?: string | null
          voice_id?: string | null
        }
        Update: {
          aspect_ratio?: string
          brief?: string
          broll_mix?: Json
          color_palette?: Json
          created_at?: string
          error_message?: string | null
          execution_status?: string
          execution_step?: string | null
          final_video_url?: string | null
          id?: string
          intro_title?: Json | null
          json2video_project_id?: string | null
          language?: string
          narration_url?: string | null
          outro_cta?: Json | null
          pdf_text?: string | null
          pdf_url?: string | null
          plan?: Json | null
          plan_status?: string
          progress_log?: Json
          progress_pct?: number
          scene_overrides?: Json
          selected_assets?: Json
          storyboard?: Json | null
          style_preset?: string
          subtitle_config?: Json
          target_duration?: number
          title?: string
          transition_level?: string
          typography?: string
          updated_at?: string
          use_vidnoz_for_talking_head?: boolean
          user_id?: string
          vidnoz_avatar_id?: string | null
          vidnoz_avatar_url?: string | null
          vidnoz_voice_id?: string | null
          voice_id?: string | null
        }
        Relationships: []
      }
      agent_user_presets: {
        Row: {
          aspect_ratio: string
          base_preset: string
          broll_mix: Json
          color_palette: Json
          created_at: string
          id: string
          intro_title: Json | null
          name: string
          outro_cta: Json | null
          scene_duration_sec: number
          subtitle_config: Json
          transition_level: string
          typography: string
          updated_at: string
          user_id: string
        }
        Insert: {
          aspect_ratio?: string
          base_preset?: string
          broll_mix?: Json
          color_palette?: Json
          created_at?: string
          id?: string
          intro_title?: Json | null
          name: string
          outro_cta?: Json | null
          scene_duration_sec?: number
          subtitle_config?: Json
          transition_level?: string
          typography?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          aspect_ratio?: string
          base_preset?: string
          broll_mix?: Json
          color_palette?: Json
          created_at?: string
          id?: string
          intro_title?: Json | null
          name?: string
          outro_cta?: Json | null
          scene_duration_sec?: number
          subtitle_config?: Json
          transition_level?: string
          typography?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_workflows: {
        Row: {
          created_at: string
          description: string | null
          edges: Json
          id: string
          is_public: boolean
          is_template: boolean
          name: string
          nodes: Json
          share_code: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          edges?: Json
          id?: string
          is_public?: boolean
          is_template?: boolean
          name: string
          nodes?: Json
          share_code?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          edges?: Json
          id?: string
          is_public?: boolean
          is_template?: boolean
          name?: string
          nodes?: Json
          share_code?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      api_logs: {
        Row: {
          api_name: string
          created_at: string
          details: Json | null
          duration_ms: number | null
          id: string
          message: string
          operation: string
          status: string
          user_id: string
        }
        Insert: {
          api_name: string
          created_at?: string
          details?: Json | null
          duration_ms?: number | null
          id?: string
          message: string
          operation: string
          status?: string
          user_id: string
        }
        Update: {
          api_name?: string
          created_at?: string
          details?: Json | null
          duration_ms?: number | null
          id?: string
          message?: string
          operation?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      api_status_history: {
        Row: {
          api_name: string
          checked_at: string
          id: string
          response_time: number | null
          status: string
          user_id: string
        }
        Insert: {
          api_name: string
          checked_at?: string
          id?: string
          response_time?: number | null
          status: string
          user_id: string
        }
        Update: {
          api_name?: string
          checked_at?: string
          id?: string
          response_time?: number | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      api_threshold_settings: {
        Row: {
          created_at: string
          id: string
          notify_on_status_change: boolean
          thresholds: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notify_on_status_change?: boolean
          thresholds?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notify_on_status_change?: boolean
          thresholds?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audio_effect_presets: {
        Row: {
          created_at: string
          id: string
          name: string
          settings: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          settings?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          settings?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      db_health_snapshots: {
        Row: {
          db_size_bytes: number
          id: string
          recorded_at: string
          table_stats: Json
          total_rows: number
        }
        Insert: {
          db_size_bytes: number
          id?: string
          recorded_at?: string
          table_stats?: Json
          total_rows?: number
        }
        Update: {
          db_size_bytes?: number
          id?: string
          recorded_at?: string
          table_stats?: Json
          total_rows?: number
        }
        Relationships: []
      }
      json2video_projects: {
        Row: {
          audio_track: Json | null
          clips: Json
          created_at: string
          description: string | null
          id: string
          intro: Json | null
          name: string
          outro: Json | null
          rendered_url: string | null
          resolution: string | null
          sound_effects: Json | null
          subtitles: Json | null
          thumbnail_url: string | null
          transition: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          audio_track?: Json | null
          clips?: Json
          created_at?: string
          description?: string | null
          id?: string
          intro?: Json | null
          name: string
          outro?: Json | null
          rendered_url?: string | null
          resolution?: string | null
          sound_effects?: Json | null
          subtitles?: Json | null
          thumbnail_url?: string | null
          transition?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          audio_track?: Json | null
          clips?: Json
          created_at?: string
          description?: string | null
          id?: string
          intro?: Json | null
          name?: string
          outro?: Json | null
          rendered_url?: string | null
          resolution?: string | null
          sound_effects?: Json | null
          subtitles?: Json | null
          thumbnail_url?: string | null
          transition?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      json2video_render_notifications: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          notified_at: string | null
          project_id: string
          render_project_id: string
          started_at: string
          status: string
          user_id: string
          video_duration: number | null
          video_size: number | null
          video_url: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          notified_at?: string | null
          project_id: string
          render_project_id: string
          started_at?: string
          status?: string
          user_id: string
          video_duration?: number | null
          video_size?: number | null
          video_url?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          notified_at?: string | null
          project_id?: string
          render_project_id?: string
          started_at?: string
          status?: string
          user_id?: string
          video_duration?: number | null
          video_size?: number | null
          video_url?: string | null
        }
        Relationships: []
      }
      json2video_templates: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          name: string
          tags: string[] | null
          template_json: Json
          thumbnail_url: string | null
          updated_at: string
          user_id: string
          variables: Json
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name: string
          tags?: string[] | null
          template_json?: Json
          thumbnail_url?: string | null
          updated_at?: string
          user_id: string
          variables?: Json
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name?: string
          tags?: string[] | null
          template_json?: Json
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string
          variables?: Json
        }
        Relationships: []
      }
      maintenance_log: {
        Row: {
          created_at: string
          details: Json
          duration_ms: number
          error_message: string | null
          id: string
          operation: string
          status: string
          tables_processed: number
          total_freed_bytes: number
          triggered_by: string
        }
        Insert: {
          created_at?: string
          details?: Json
          duration_ms?: number
          error_message?: string | null
          id?: string
          operation: string
          status?: string
          tables_processed?: number
          total_freed_bytes?: number
          triggered_by?: string
        }
        Update: {
          created_at?: string
          details?: Json
          duration_ms?: number
          error_message?: string | null
          id?: string
          operation?: string
          status?: string
          tables_processed?: number
          total_freed_bytes?: number
          triggered_by?: string
        }
        Relationships: []
      }
      motion_presets: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          name: string
          tags: string[] | null
          thumbnail_url: string | null
          updated_at: string
          user_id: string
          video_url: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name: string
          tags?: string[] | null
          thumbnail_url?: string | null
          updated_at?: string
          user_id: string
          video_url: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name?: string
          tags?: string[] | null
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string
          video_url?: string
        }
        Relationships: []
      }
      plan_quotas: {
        Row: {
          can_clone_voice: boolean
          can_use_api_access: boolean
          can_use_multi_provider: boolean
          can_use_timeline: boolean
          created_at: string
          id: string
          max_resolution: string
          max_story_mode_monthly: number
          max_storyboards: number
          max_video_generations_monthly: number
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          can_clone_voice?: boolean
          can_use_api_access?: boolean
          can_use_multi_provider?: boolean
          can_use_timeline?: boolean
          created_at?: string
          id?: string
          max_resolution?: string
          max_story_mode_monthly?: number
          max_storyboards?: number
          max_video_generations_monthly?: number
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          can_clone_voice?: boolean
          can_use_api_access?: boolean
          can_use_multi_provider?: boolean
          can_use_timeline?: boolean
          created_at?: string
          id?: string
          max_resolution?: string
          max_story_mode_monthly?: number
          max_storyboards?: number
          max_video_generations_monthly?: number
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_blocked: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_blocked?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_blocked?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      prompt_templates: {
        Row: {
          audio_suggestion: string | null
          camera_movement: string | null
          category: string
          created_at: string
          duration: number | null
          id: string
          keywords: string[] | null
          main_prompt: string
          name: string
          style: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          audio_suggestion?: string | null
          camera_movement?: string | null
          category?: string
          created_at?: string
          duration?: number | null
          id?: string
          keywords?: string[] | null
          main_prompt: string
          name: string
          style?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          audio_suggestion?: string | null
          camera_movement?: string | null
          category?: string
          created_at?: string
          duration?: number | null
          id?: string
          keywords?: string[] | null
          main_prompt?: string
          name?: string
          style?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      story_mode_projects: {
        Row: {
          background_music_url: string | null
          created_at: string
          final_video_url: string | null
          id: string
          input_config: Json
          pending_render_id: string | null
          recovery_history: Json
          render_started_at: string | null
          scenes: Json
          status: string
          suggested_music: string | null
          synopsis: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          background_music_url?: string | null
          created_at?: string
          final_video_url?: string | null
          id?: string
          input_config?: Json
          pending_render_id?: string | null
          recovery_history?: Json
          render_started_at?: string | null
          scenes?: Json
          status?: string
          suggested_music?: string | null
          synopsis?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          background_music_url?: string | null
          created_at?: string
          final_video_url?: string | null
          id?: string
          input_config?: Json
          pending_render_id?: string | null
          recovery_history?: Json
          render_started_at?: string | null
          scenes?: Json
          status?: string
          suggested_music?: string | null
          synopsis?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      storyboard_characters: {
        Row: {
          color: string
          created_at: string
          description: string | null
          id: string
          name: string
          reference_images: Json
          storyboard_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          reference_images?: Json
          storyboard_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          reference_images?: Json
          storyboard_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "storyboard_characters_storyboard_id_fkey"
            columns: ["storyboard_id"]
            isOneToOne: false
            referencedRelation: "storyboards"
            referencedColumns: ["id"]
          },
        ]
      }
      storyboard_share_passwords: {
        Row: {
          created_at: string
          share_password: string
          storyboard_id: string
        }
        Insert: {
          created_at?: string
          share_password: string
          storyboard_id: string
        }
        Update: {
          created_at?: string
          share_password?: string
          storyboard_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "storyboard_share_passwords_storyboard_id_fkey"
            columns: ["storyboard_id"]
            isOneToOne: true
            referencedRelation: "storyboards"
            referencedColumns: ["id"]
          },
        ]
      }
      storyboard_video_batches: {
        Row: {
          audio_prompt: string | null
          audio_type: string | null
          camera_movement: string | null
          completed_videos: number
          created_at: string
          duration: number
          id: string
          status: string
          storyboard_id: string
          total_videos: number
          transition_prompt: string | null
          transition_speed: string | null
          transition_style: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          audio_prompt?: string | null
          audio_type?: string | null
          camera_movement?: string | null
          completed_videos?: number
          created_at?: string
          duration: number
          id?: string
          status?: string
          storyboard_id: string
          total_videos: number
          transition_prompt?: string | null
          transition_speed?: string | null
          transition_style?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          audio_prompt?: string | null
          audio_type?: string | null
          camera_movement?: string | null
          completed_videos?: number
          created_at?: string
          duration?: number
          id?: string
          status?: string
          storyboard_id?: string
          total_videos?: number
          transition_prompt?: string | null
          transition_speed?: string | null
          transition_style?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "storyboard_video_batches_storyboard_id_fkey"
            columns: ["storyboard_id"]
            isOneToOne: false
            referencedRelation: "storyboards"
            referencedColumns: ["id"]
          },
        ]
      }
      storyboards: {
        Row: {
          created_at: string
          id: string
          is_public: boolean
          layout: string
          panels: Json
          tags: string[] | null
          template_type: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_public?: boolean
          layout: string
          panels?: Json
          tags?: string[] | null
          template_type: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_public?: boolean
          layout?: string
          panels?: Json
          tags?: string[] | null
          template_type?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      talking_avatar_projects: {
        Row: {
          background_music_emotion: string | null
          background_music_url: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          reference_images: Json
          scenes: Json
          settings: Json
          timeline_clips: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          background_music_emotion?: string | null
          background_music_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          reference_images?: Json
          scenes?: Json
          settings?: Json
          timeline_clips?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          background_music_emotion?: string | null
          background_music_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          reference_images?: Json
          scenes?: Json
          settings?: Json
          timeline_clips?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          preferences: Json
          story_mode_audio_mix: Json
          story_mode_auto_recovery: boolean
          story_mode_lock_character_default: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          preferences?: Json
          story_mode_audio_mix?: Json
          story_mode_auto_recovery?: boolean
          story_mode_lock_character_default?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          preferences?: Json
          story_mode_audio_mix?: Json
          story_mode_auto_recovery?: boolean
          story_mode_lock_character_default?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_story_templates: {
        Row: {
          category: string
          created_at: string
          description: string | null
          estimated_duration: number | null
          id: string
          is_public: boolean | null
          name: string
          scenes: Json
          suggested_music_emotion: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          estimated_duration?: number | null
          id?: string
          is_public?: boolean | null
          name: string
          scenes?: Json
          suggested_music_emotion?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          estimated_duration?: number | null
          id?: string
          is_public?: boolean | null
          name?: string
          scenes?: Json
          suggested_music_emotion?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      video_cost_log: {
        Row: {
          cost_eur: number
          created_at: string
          id: string
          metadata: Json
          provider: string
          scene_index: number | null
          seconds_billed: number
          status: string
          story_project_id: string | null
          user_id: string
        }
        Insert: {
          cost_eur?: number
          created_at?: string
          id?: string
          metadata?: Json
          provider: string
          scene_index?: number | null
          seconds_billed?: number
          status?: string
          story_project_id?: string | null
          user_id: string
        }
        Update: {
          cost_eur?: number
          created_at?: string
          id?: string
          metadata?: Json
          provider?: string
          scene_index?: number | null
          seconds_billed?: number
          status?: string
          story_project_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      video_generations: {
        Row: {
          audio_url: string | null
          batch_id: string | null
          category: string | null
          created_at: string | null
          dialogue_text: string | null
          duration: number
          error_message: string | null
          id: string
          image_name: string | null
          image_url: string | null
          max_retries: number | null
          motion_intensity: string | null
          next_retry_at: string | null
          original_prompt: string | null
          prediction_id: string | null
          priority: number | null
          prompt: string | null
          provider: string | null
          queue_position: number | null
          resolution: string | null
          retry_count: number | null
          sequence_order: number | null
          status: string | null
          tags: string[] | null
          type: Database["public"]["Enums"]["generation_type"]
          updated_at: string | null
          user_id: string
          video_url: string | null
          voice_settings: Json | null
        }
        Insert: {
          audio_url?: string | null
          batch_id?: string | null
          category?: string | null
          created_at?: string | null
          dialogue_text?: string | null
          duration: number
          error_message?: string | null
          id?: string
          image_name?: string | null
          image_url?: string | null
          max_retries?: number | null
          motion_intensity?: string | null
          next_retry_at?: string | null
          original_prompt?: string | null
          prediction_id?: string | null
          priority?: number | null
          prompt?: string | null
          provider?: string | null
          queue_position?: number | null
          resolution?: string | null
          retry_count?: number | null
          sequence_order?: number | null
          status?: string | null
          tags?: string[] | null
          type: Database["public"]["Enums"]["generation_type"]
          updated_at?: string | null
          user_id: string
          video_url?: string | null
          voice_settings?: Json | null
        }
        Update: {
          audio_url?: string | null
          batch_id?: string | null
          category?: string | null
          created_at?: string | null
          dialogue_text?: string | null
          duration?: number
          error_message?: string | null
          id?: string
          image_name?: string | null
          image_url?: string | null
          max_retries?: number | null
          motion_intensity?: string | null
          next_retry_at?: string | null
          original_prompt?: string | null
          prediction_id?: string | null
          priority?: number | null
          prompt?: string | null
          provider?: string | null
          queue_position?: number | null
          resolution?: string | null
          retry_count?: number | null
          sequence_order?: number | null
          status?: string | null
          tags?: string[] | null
          type?: Database["public"]["Enums"]["generation_type"]
          updated_at?: string | null
          user_id?: string
          video_url?: string | null
          voice_settings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "video_generations_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "storyboard_video_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_mappings: {
        Row: {
          created_at: string
          elevenlabs_voice_id: string
          elevenlabs_voice_name: string
          id: string
          inworld_voice_name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          elevenlabs_voice_id: string
          elevenlabs_voice_name: string
          id?: string
          inworld_voice_name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          elevenlabs_voice_id?: string
          elevenlabs_voice_name?: string
          id?: string
          inworld_voice_name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string | null
          name: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message?: string | null
          name?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          name?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_jsonb_no_large_base64: {
        Args: { _column_label: string; _data: Json; _table_label: string }
        Returns: undefined
      }
      get_db_health_stats: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      record_db_health_snapshot: { Args: never; Returns: undefined }
      run_db_maintenance: { Args: never; Returns: Json }
      run_db_reindex: { Args: never; Returns: Json }
      run_scheduled_maintenance: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role:
        | "admin"
        | "moderator"
        | "user"
        | "premium"
        | "creator"
        | "business"
      generation_type: "text_to_video" | "image_to_video"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "moderator",
        "user",
        "premium",
        "creator",
        "business",
      ],
      generation_type: ["text_to_video", "image_to_video"],
    },
  },
} as const
