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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      devices: {
        Row: {
          created_at: string
          id: string
          last_seen_at: string | null
          name: string
          status: string
          token_hash: string
          token_prefix: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_seen_at?: string | null
          name?: string
          status?: string
          token_hash: string
          token_prefix: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_seen_at?: string | null
          name?: string
          status?: string
          token_hash?: string
          token_prefix?: string
          user_id?: string
        }
        Relationships: []
      }
      meal_corrections: {
        Row: {
          corrected_label: string | null
          corrected_weight_grams: number | null
          created_at: string
          id: string
          meal_id: string
          original_label: string | null
          original_weight_grams: number | null
          user_id: string
        }
        Insert: {
          corrected_label?: string | null
          corrected_weight_grams?: number | null
          created_at?: string
          id?: string
          meal_id: string
          original_label?: string | null
          original_weight_grams?: number | null
          user_id: string
        }
        Update: {
          corrected_label?: string | null
          corrected_weight_grams?: number | null
          created_at?: string
          id?: string
          meal_id?: string
          original_label?: string | null
          original_weight_grams?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_corrections_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_items: {
        Row: {
          calories: number | null
          created_at: string
          food_name: string
          id: string
          meal_id: string
          position: number
          user_id: string
          weight_grams: number | null
        }
        Insert: {
          calories?: number | null
          created_at?: string
          food_name: string
          id?: string
          meal_id: string
          position?: number
          user_id: string
          weight_grams?: number | null
        }
        Update: {
          calories?: number | null
          created_at?: string
          food_name?: string
          id?: string
          meal_id?: string
          position?: number
          user_id?: string
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_items_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
        ]
      }
      meals: {
        Row: {
          calories: number | null
          captured_at: string
          corrected_label: string | null
          corrected_weight_grams: number | null
          created_at: string
          depth_mm: number | null
          device_id: string | null
          error: string | null
          id: string
          image_path: string | null
          locked_weight_grams: number | null
          needs_correction: boolean
          nutrients: Json | null
          predictions: Json | null
          status: string
          top_confidence: number | null
          top_label: string | null
          total_weight_grams: number | null
          user_id: string
          weights_grams: Json
        }
        Insert: {
          calories?: number | null
          captured_at?: string
          corrected_label?: string | null
          corrected_weight_grams?: number | null
          created_at?: string
          depth_mm?: number | null
          device_id?: string | null
          error?: string | null
          id?: string
          image_path?: string | null
          locked_weight_grams?: number | null
          needs_correction?: boolean
          nutrients?: Json | null
          predictions?: Json | null
          status?: string
          top_confidence?: number | null
          top_label?: string | null
          total_weight_grams?: number | null
          user_id: string
          weights_grams?: Json
        }
        Update: {
          calories?: number | null
          captured_at?: string
          corrected_label?: string | null
          corrected_weight_grams?: number | null
          created_at?: string
          depth_mm?: number | null
          device_id?: string | null
          error?: string | null
          id?: string
          image_path?: string | null
          locked_weight_grams?: number | null
          needs_correction?: boolean
          nutrients?: Json | null
          predictions?: Json | null
          status?: string
          top_confidence?: number | null
          top_label?: string | null
          total_weight_grams?: number | null
          user_id?: string
          weights_grams?: Json
        }
        Relationships: [
          {
            foreignKeyName: "meals_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrition_db: {
        Row: {
          carbs_g: number
          created_at: string
          density: number | null
          fats_g: number
          food_name: string
          id: string
          kcal_per_100g: number
          protein_g: number
          updated_at: string
        }
        Insert: {
          carbs_g?: number
          created_at?: string
          density?: number | null
          fats_g?: number
          food_name: string
          id?: string
          kcal_per_100g: number
          protein_g?: number
          updated_at?: string
        }
        Update: {
          carbs_g?: number
          created_at?: string
          density?: number | null
          fats_g?: number
          food_name?: string
          id?: string
          kcal_per_100g?: number
          protein_g?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
