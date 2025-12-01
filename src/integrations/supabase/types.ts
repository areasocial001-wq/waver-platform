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
          share_password: string | null
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
          share_password?: string | null
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
          share_password?: string | null
          tags?: string[] | null
          template_type?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      video_generations: {
        Row: {
          batch_id: string | null
          created_at: string | null
          duration: number
          error_message: string | null
          id: string
          image_name: string | null
          image_url: string | null
          motion_intensity: string | null
          prediction_id: string | null
          prompt: string | null
          resolution: string | null
          sequence_order: number | null
          status: string | null
          type: Database["public"]["Enums"]["generation_type"]
          updated_at: string | null
          user_id: string | null
          video_url: string | null
        }
        Insert: {
          batch_id?: string | null
          created_at?: string | null
          duration: number
          error_message?: string | null
          id?: string
          image_name?: string | null
          image_url?: string | null
          motion_intensity?: string | null
          prediction_id?: string | null
          prompt?: string | null
          resolution?: string | null
          sequence_order?: number | null
          status?: string | null
          type: Database["public"]["Enums"]["generation_type"]
          updated_at?: string | null
          user_id?: string | null
          video_url?: string | null
        }
        Update: {
          batch_id?: string | null
          created_at?: string | null
          duration?: number
          error_message?: string | null
          id?: string
          image_name?: string | null
          image_url?: string | null
          motion_intensity?: string | null
          prediction_id?: string | null
          prompt?: string | null
          resolution?: string | null
          sequence_order?: number | null
          status?: string | null
          type?: Database["public"]["Enums"]["generation_type"]
          updated_at?: string | null
          user_id?: string | null
          video_url?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
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
      generation_type: ["text_to_video", "image_to_video"],
    },
  },
} as const
