export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  graphql_public: {
    Tables: Record<never, never>;
    Views: Record<never, never>;
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
  public: {
    Tables: {
      acceptance_metrics: {
        Row: {
          generated_activated_total: number;
          generated_rejected_total: number;
          generated_total: number;
          id: number;
          last_recalculated_at: string;
        };
        Insert: {
          generated_activated_total?: number;
          generated_rejected_total?: number;
          generated_total?: number;
          id?: number;
          last_recalculated_at?: string;
        };
        Update: {
          generated_activated_total?: number;
          generated_rejected_total?: number;
          generated_total?: number;
          id?: number;
          last_recalculated_at?: string;
        };
        Relationships: [];
      };
      ai_generation_sessions: {
        Row: {
          completed_at: string | null;
          created_at: string;
          error_message: string | null;
          generated_card_count: number | null;
          id: string;
          requested_card_count: number | null;
          source_text: string;
          source_text_chars: number | null;
          status: Database["public"]["Enums"]["ai_generation_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          error_message?: string | null;
          generated_card_count?: number | null;
          id?: string;
          requested_card_count?: number | null;
          source_text: string;
          source_text_chars?: number | null;
          status?: Database["public"]["Enums"]["ai_generation_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          error_message?: string | null;
          generated_card_count?: number | null;
          id?: string;
          requested_card_count?: number | null;
          source_text?: string;
          source_text_chars?: number | null;
          status?: Database["public"]["Enums"]["ai_generation_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_generation_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      flashcard_tags: {
        Row: {
          created_at: string;
          flashcard_id: string;
          tag_id: string;
        };
        Insert: {
          created_at?: string;
          flashcard_id: string;
          tag_id: string;
        };
        Update: {
          created_at?: string;
          flashcard_id?: string;
          tag_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "flashcard_tags_flashcard_id_fkey";
            columns: ["flashcard_id"];
            isOneToOne: false;
            referencedRelation: "flashcards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "flashcard_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
        ];
      };
      flashcards: {
        Row: {
          answer: string;
          counted_in_metrics: boolean;
          created_at: string;
          first_activated_at: string | null;
          generation_session_id: string | null;
          id: string;
          question: string;
          source: Database["public"]["Enums"]["flashcard_source"];
          status: Database["public"]["Enums"]["flashcard_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          answer: string;
          counted_in_metrics?: boolean;
          created_at?: string;
          first_activated_at?: string | null;
          generation_session_id?: string | null;
          id?: string;
          question: string;
          source?: Database["public"]["Enums"]["flashcard_source"];
          status?: Database["public"]["Enums"]["flashcard_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          answer?: string;
          counted_in_metrics?: boolean;
          created_at?: string;
          first_activated_at?: string | null;
          generation_session_id?: string | null;
          id?: string;
          question?: string;
          source?: Database["public"]["Enums"]["flashcard_source"];
          status?: Database["public"]["Enums"]["flashcard_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "flashcards_generation_session_id_fkey";
            columns: ["generation_session_id"];
            isOneToOne: false;
            referencedRelation: "ai_generation_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "flashcards_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      srs_reviews: {
        Row: {
          created_at: string;
          due_after_review: string | null;
          due_before_review: string | null;
          flashcard_id: string;
          grade: number;
          id: number;
          reviewed_at: string;
        };
        Insert: {
          created_at?: string;
          due_after_review?: string | null;
          due_before_review?: string | null;
          flashcard_id: string;
          grade: number;
          id?: never;
          reviewed_at?: string;
        };
        Update: {
          created_at?: string;
          due_after_review?: string | null;
          due_before_review?: string | null;
          flashcard_id?: string;
          grade?: number;
          id?: never;
          reviewed_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "srs_reviews_flashcard_id_fkey";
            columns: ["flashcard_id"];
            isOneToOne: false;
            referencedRelation: "flashcards";
            referencedColumns: ["id"];
          },
        ];
      };
      srs_state: {
        Row: {
          created_at: string;
          due_at: string;
          ease_factor: number;
          flashcard_id: string;
          interval_days: number;
          lapses: number;
          last_reviewed_at: string | null;
          repetitions: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          due_at: string;
          ease_factor?: number;
          flashcard_id: string;
          interval_days?: number;
          lapses?: number;
          last_reviewed_at?: string | null;
          repetitions?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          due_at?: string;
          ease_factor?: number;
          flashcard_id?: string;
          interval_days?: number;
          lapses?: number;
          last_reviewed_at?: string | null;
          repetitions?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "srs_state_flashcard_id_fkey";
            columns: ["flashcard_id"];
            isOneToOne: true;
            referencedRelation: "flashcards";
            referencedColumns: ["id"];
          },
        ];
      };
      starter_tags: {
        Row: {
          created_at: string;
          id: number;
          name: string;
          name_normalized: string | null;
          sort_order: number;
        };
        Insert: {
          created_at?: string;
          id?: never;
          name: string;
          name_normalized?: string | null;
          sort_order?: number;
        };
        Update: {
          created_at?: string;
          id?: never;
          name?: string;
          name_normalized?: string | null;
          sort_order?: number;
        };
        Relationships: [];
      };
      tags: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          name_normalized: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          name_normalized?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          name_normalized?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tags_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: {
      ai_generation_status: "created" | "processing" | "completed" | "failed";
      flashcard_source: "generated" | "manual";
      flashcard_status: "draft" | "active" | "rejected";
    };
    CompositeTypes: Record<never, never>;
  };
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      ai_generation_status: ["created", "processing", "completed", "failed"],
      flashcard_source: ["generated", "manual"],
      flashcard_status: ["draft", "active", "rejected"],
    },
  },
} as const;
