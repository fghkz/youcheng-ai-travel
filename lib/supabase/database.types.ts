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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      favorite_spots: {
        Row: {
          created_at: string
          external_spot_id: string
          id: number
          provider: string
          spot_name: string
          spot_snapshot: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          external_spot_id: string
          id?: never
          provider: string
          spot_name: string
          spot_snapshot: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          external_spot_id?: string
          id?: never
          provider?: string
          spot_name?: string
          spot_snapshot?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scenic_image_cache: {
        Row: {
          created_at: string
          destination: string
          expires_at: string
          external_spot_id: string
          images: Json
          match_version: string
          matched_poi_id: string | null
          matched_poi_name: string | null
          provider: string
          spot_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          destination: string
          expires_at: string
          external_spot_id: string
          images?: Json
          match_version?: string
          matched_poi_id?: string | null
          matched_poi_name?: string | null
          provider: string
          spot_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          destination?: string
          expires_at?: string
          external_spot_id?: string
          images?: Json
          match_version?: string
          matched_poi_id?: string | null
          matched_poi_name?: string | null
          provider?: string
          spot_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      itinerary_versions: {
        Row: {
          created_at: string
          id: number
          is_current: boolean
          itinerary_result: Json
          model_name: string
          model_provider: string
          preferences_snapshot: Json
          source_meta: Json
          trip_id: number
          user_id: string
          version_no: number
        }
        Insert: {
          created_at?: string
          id?: never
          is_current?: boolean
          itinerary_result: Json
          model_name: string
          model_provider: string
          preferences_snapshot: Json
          source_meta?: Json
          trip_id: number
          user_id: string
          version_no: number
        }
        Update: {
          created_at?: string
          id?: never
          is_current?: boolean
          itinerary_result?: Json
          model_name?: string
          model_provider?: string
          preferences_snapshot?: Json
          source_meta?: Json
          trip_id?: number
          user_id?: string
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_versions_trip_owner_fkey"
            columns: ["trip_id", "user_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          display_name: string | null
          id: string
          locale: string
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          locale?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          locale?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      trip_spots: {
        Row: {
          created_at: string
          external_spot_id: string
          id: number
          latitude: number
          longitude: number
          provider: string
          selected_order: number
          spot_name: string
          spot_snapshot: Json
          trip_id: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          external_spot_id: string
          id?: never
          latitude: number
          longitude: number
          provider: string
          selected_order: number
          spot_name: string
          spot_snapshot: Json
          trip_id: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          external_spot_id?: string
          id?: never
          latitude?: number
          longitude?: number
          provider?: string
          selected_order?: number
          spot_name?: string
          spot_snapshot?: Json
          trip_id?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_spots_trip_owner_fkey"
            columns: ["trip_id", "user_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      travel_journal_entries: {
        Row: {
          author_id: string
          body: Json
          created_at: string
          happened_at: string
          id: string
          is_public: boolean
          journey_id: string
          message: string | null
          mood_key: string | null
          mood_text: string | null
          revision: number
          sort_order: number
          status: string
          stop_id: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          body?: Json
          created_at?: string
          happened_at?: string
          id?: string
          is_public?: boolean
          journey_id: string
          message?: string | null
          mood_key?: string | null
          mood_text?: string | null
          revision?: number
          sort_order?: number
          status?: string
          stop_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: Json
          created_at?: string
          happened_at?: string
          id?: string
          is_public?: boolean
          journey_id?: string
          message?: string | null
          mood_key?: string | null
          mood_text?: string | null
          revision?: number
          sort_order?: number
          status?: string
          stop_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "travel_journal_entries_journey_id_fkey"; columns: ["journey_id"]; isOneToOne: false; referencedRelation: "travel_journeys"; referencedColumns: ["id"] },
          { foreignKeyName: "travel_journal_entries_stop_id_fkey"; columns: ["stop_id"]; isOneToOne: false; referencedRelation: "travel_journey_stops"; referencedColumns: ["id"] },
        ]
      }
      travel_journal_media: {
        Row: {
          alt_text: string | null
          caption: string | null
          created_at: string
          entry_id: string | null
          height: number | null
          id: string
          journey_id: string
          mime_type: string
          owner_id: string
          size_bytes: number
          sort_order: number
          stop_id: string | null
          storage_path: string
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          caption?: string | null
          created_at?: string
          entry_id?: string | null
          height?: number | null
          id?: string
          journey_id: string
          mime_type: string
          owner_id: string
          size_bytes: number
          sort_order?: number
          stop_id?: string | null
          storage_path: string
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          caption?: string | null
          created_at?: string
          entry_id?: string | null
          height?: number | null
          id?: string
          journey_id?: string
          mime_type?: string
          owner_id?: string
          size_bytes?: number
          sort_order?: number
          stop_id?: string | null
          storage_path?: string
          width?: number | null
        }
        Relationships: [
          { foreignKeyName: "travel_journal_media_entry_id_fkey"; columns: ["entry_id"]; isOneToOne: false; referencedRelation: "travel_journal_entries"; referencedColumns: ["id"] },
          { foreignKeyName: "travel_journal_media_journey_id_fkey"; columns: ["journey_id"]; isOneToOne: false; referencedRelation: "travel_journeys"; referencedColumns: ["id"] },
          { foreignKeyName: "travel_journal_media_stop_id_fkey"; columns: ["stop_id"]; isOneToOne: false; referencedRelation: "travel_journey_stops"; referencedColumns: ["id"] },
        ]
      }
      travel_journey_stops: {
        Row: {
          actual_arrived_at: string | null
          address: string | null
          created_at: string
          day_number: number
          id: string
          is_extra_stop: boolean
          is_public: boolean
          journey_id: string
          latitude: number | null
          longitude: number | null
          place_name: string
          planned_content: Json
          planned_date: string
          planned_time: string | null
          sort_order: number
          source_item_key: string | null
          updated_at: string
        }
        Insert: {
          actual_arrived_at?: string | null
          address?: string | null
          created_at?: string
          day_number: number
          id?: string
          is_extra_stop?: boolean
          is_public?: boolean
          journey_id: string
          latitude?: number | null
          longitude?: number | null
          place_name: string
          planned_content?: Json
          planned_date: string
          planned_time?: string | null
          sort_order: number
          source_item_key?: string | null
          updated_at?: string
        }
        Update: {
          actual_arrived_at?: string | null
          address?: string | null
          created_at?: string
          day_number?: number
          id?: string
          is_extra_stop?: boolean
          is_public?: boolean
          journey_id?: string
          latitude?: number | null
          longitude?: number | null
          place_name?: string
          planned_content?: Json
          planned_date?: string
          planned_time?: string | null
          sort_order?: number
          source_item_key?: string | null
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "travel_journey_stops_journey_id_fkey"; columns: ["journey_id"]; isOneToOne: false; referencedRelation: "travel_journeys"; referencedColumns: ["id"] },
        ]
      }
      travel_journeys: {
        Row: {
          closing_message: string
          companion_label: string
          completed_at: string | null
          cover_media_id: string | null
          created_at: string
          id: string
          owner_id: string
          plan_snapshot: Json
          planned_end_date: string
          planned_start_date: string
          published_at: string | null
          revision: number
          slug: string
          source_plan_version: number
          source_trip_id: number
          started_at: string
          status: string
          summary: string
          theme_key: string
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          closing_message?: string
          companion_label?: string
          completed_at?: string | null
          cover_media_id?: string | null
          created_at?: string
          id?: string
          owner_id: string
          plan_snapshot: Json
          planned_end_date: string
          planned_start_date: string
          published_at?: string | null
          revision?: number
          slug: string
          source_plan_version: number
          source_trip_id: number
          started_at?: string
          status?: string
          summary?: string
          theme_key?: string
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          closing_message?: string
          companion_label?: string
          completed_at?: string | null
          cover_media_id?: string | null
          created_at?: string
          id?: string
          owner_id?: string
          plan_snapshot?: Json
          planned_end_date?: string
          planned_start_date?: string
          published_at?: string | null
          revision?: number
          slug?: string
          source_plan_version?: number
          source_trip_id?: number
          started_at?: string
          status?: string
          summary?: string
          theme_key?: string
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          { foreignKeyName: "travel_journeys_source_trip_id_fkey"; columns: ["source_trip_id"]; isOneToOne: false; referencedRelation: "trips"; referencedColumns: ["id"] },
        ]
      }
      travel_page_documents: {
        Row: {
          content: Json
          created_at: string
          generated_at: string | null
          generation_prompt_version: string | null
          journey_id: string
          revision: number
          schema_version: number
          updated_at: string
        }
        Insert: {
          content: Json
          created_at?: string
          generated_at?: string | null
          generation_prompt_version?: string | null
          journey_id: string
          revision?: number
          schema_version?: number
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          generated_at?: string | null
          generation_prompt_version?: string | null
          journey_id?: string
          revision?: number
          schema_version?: number
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "travel_page_documents_journey_id_fkey"; columns: ["journey_id"]; isOneToOne: true; referencedRelation: "travel_journeys"; referencedColumns: ["id"] },
        ]
      }
      trips: {
        Row: {
          created_at: string
          daily_end_time: string
          daily_start_time: string
          destination: string
          end_date: string
          final_content: Json | null
          final_route: Json | null
          finalized_at: string | null
          version: number
          hotel: string
          id: number
          pace: string
          start_date: string
          start_from_hotel: boolean
          status: string
          title: string
          transport_preference: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_end_time: string
          daily_start_time: string
          destination: string
          end_date: string
          final_content?: Json | null
          final_route?: Json | null
          finalized_at?: string | null
          version?: number
          hotel?: string
          id?: never
          pace?: string
          start_date: string
          start_from_hotel?: boolean
          status?: string
          title: string
          transport_preference: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_end_time?: string
          daily_start_time?: string
          destination?: string
          end_date?: string
          final_content?: Json | null
          final_route?: Json | null
          finalized_at?: string | null
          version?: number
          hotel?: string
          id?: never
          pace?: string
          start_date?: string
          start_from_hotel?: boolean
          status?: string
          title?: string
          transport_preference?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_itinerary_version: {
        Args: {
          p_itinerary_result: Json
          p_model_name?: string
          p_model_provider?: string
          p_preferences_snapshot: Json
          p_source_meta?: Json
          p_trip_id: number
        }
        Returns: {
          created_at: string
          id: number
          is_current: boolean
          itinerary_result: Json
          model_name: string
          model_provider: string
          preferences_snapshot: Json
          source_meta: Json
          trip_id: number
          user_id: string
          version_no: number
        }
        SetofOptions: {
          from: "*"
          to: "itinerary_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_travel_journey: {
        Args: { p_slug: string; p_source_trip_id: number; p_theme_key?: string }
        Returns: Database["public"]["Tables"]["travel_journeys"]["Row"]
        SetofOptions: {
          from: "*"
          to: "travel_journeys"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
