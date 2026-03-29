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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ai_learned_patterns: {
        Row: {
          accuracy: number | null
          data_points: number | null
          id: string
          knowledge: string
          learned_at: string
          learning_type: string
          metadata: Json | null
          title: string
          updated_at: string
        }
        Insert: {
          accuracy?: number | null
          data_points?: number | null
          id?: string
          knowledge: string
          learned_at?: string
          learning_type: string
          metadata?: Json | null
          title: string
          updated_at?: string
        }
        Update: {
          accuracy?: number | null
          data_points?: number | null
          id?: string
          knowledge?: string
          learned_at?: string
          learning_type?: string
          metadata?: Json | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      historico_roleta: {
        Row: {
          color: string
          created_at: string
          id: string
          number: number
          table_id: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          number: number
          table_id?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          number?: number
          table_id?: string
        }
        Relationships: []
      }
      pattern_insights: {
        Row: {
          confidence: number | null
          created_at: string
          description: string
          id: string
          numbers_involved: number[] | null
          pattern_type: string
          recommendation: string | null
          source_data: Json | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          description: string
          id?: string
          numbers_involved?: number[] | null
          pattern_type: string
          recommendation?: string | null
          source_data?: Json | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          description?: string
          id?: string
          numbers_involved?: number[] | null
          pattern_type?: string
          recommendation?: string | null
          source_data?: Json | null
        }
        Relationships: []
      }
      prediction_history: {
        Row: {
          actual_number: number | null
          convergence_score: number
          created_at: string
          hit: boolean | null
          hit_type: string | null
          id: string
          justification: string | null
          mesa_mode: string | null
          predicted_main: number | null
          predicted_numbers: number[]
          probability: number
          resolved_at: string | null
          strategy_label: string
          strategy_type: string
        }
        Insert: {
          actual_number?: number | null
          convergence_score?: number
          created_at?: string
          hit?: boolean | null
          hit_type?: string | null
          id?: string
          justification?: string | null
          mesa_mode?: string | null
          predicted_main?: number | null
          predicted_numbers?: number[]
          probability?: number
          resolved_at?: string | null
          strategy_label: string
          strategy_type: string
        }
        Update: {
          actual_number?: number | null
          convergence_score?: number
          created_at?: string
          hit?: boolean | null
          hit_type?: string | null
          id?: string
          justification?: string | null
          mesa_mode?: string | null
          predicted_main?: number | null
          predicted_numbers?: number[]
          probability?: number
          resolved_at?: string | null
          strategy_label?: string
          strategy_type?: string
        }
        Relationships: []
      }
      resultados_roleta: {
        Row: {
          created_at: string
          id: string
          mesa: string | null
          numero: string
          provedor: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          mesa?: string | null
          numero: string
          provedor?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          mesa?: string | null
          numero?: string
          provedor?: string | null
        }
        Relationships: []
      }
      roulette_numbers: {
        Row: {
          color: string
          fetched_at: string
          id: string
          number: number
        }
        Insert: {
          color: string
          fetched_at?: string
          id?: string
          number: number
        }
        Update: {
          color?: string
          fetched_at?: string
          id?: string
          number?: number
        }
        Relationships: []
      }
      strategy_stats: {
        Row: {
          avg_coverage: number
          avg_payout: number
          avg_probability: number
          best_streak: number
          created_at: string
          current_streak: number
          exact_hits: number
          id: string
          last_hit_at: string | null
          last_miss_at: string | null
          neighbor_hits: number
          strategy_label: string
          strategy_type: string
          total_hits: number
          total_predictions: number
          updated_at: string
          win_rate: number
        }
        Insert: {
          avg_coverage?: number
          avg_payout?: number
          avg_probability?: number
          best_streak?: number
          created_at?: string
          current_streak?: number
          exact_hits?: number
          id?: string
          last_hit_at?: string | null
          last_miss_at?: string | null
          neighbor_hits?: number
          strategy_label: string
          strategy_type: string
          total_hits?: number
          total_predictions?: number
          updated_at?: string
          win_rate?: number
        }
        Update: {
          avg_coverage?: number
          avg_payout?: number
          avg_probability?: number
          best_streak?: number
          created_at?: string
          current_streak?: number
          exact_hits?: number
          id?: string
          last_hit_at?: string | null
          last_miss_at?: string | null
          neighbor_hits?: number
          strategy_label?: string
          strategy_type?: string
          total_hits?: number
          total_predictions?: number
          updated_at?: string
          win_rate?: number
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
