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
      buildings: {
        Row: {
          created_at: string
          created_by: string | null
          electrical_water_charges: number
          gst_tax: number
          id: string
          legal_charges: number
          maintenance: number
          minimum_rate_per_sqft: number
          name: string
          other_charges: number
          payment_modes: Json | null
          rate_per_sqft: number
          registration_charges: number
          stamp_duty: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          electrical_water_charges?: number
          gst_tax?: number
          id?: string
          legal_charges?: number
          maintenance?: number
          minimum_rate_per_sqft?: number
          name: string
          other_charges?: number
          payment_modes?: Json | null
          rate_per_sqft: number
          registration_charges?: number
          stamp_duty?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          electrical_water_charges?: number
          gst_tax?: number
          id?: string
          legal_charges?: number
          maintenance?: number
          minimum_rate_per_sqft?: number
          name?: string
          other_charges?: number
          payment_modes?: Json | null
          rate_per_sqft?: number
          registration_charges?: number
          stamp_duty?: number
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          phone_number: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          phone_number: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone_number?: string
          updated_at?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          comments: string | null
          created_at: string
          customer_id: string
          id: string
          rating: number
          staff_id: string | null
        }
        Insert: {
          comments?: string | null
          created_at?: string
          customer_id: string
          id?: string
          rating: number
          staff_id?: string | null
        }
        Update: {
          comments?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          rating?: number
          staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      flats: {
        Row: {
          booked_status: string
          building_id: string
          created_at: string
          created_by: string | null
          flat_experience: string | null
          flat_no: number
          floor: number
          id: string
          square_foot: number
          terrace_area: number | null
          type: string
          updated_at: string
          wing: string | null
        }
        Insert: {
          booked_status: string
          building_id: string
          created_at?: string
          created_by?: string | null
          flat_experience?: string | null
          flat_no: number
          floor: number
          id?: string
          square_foot: number
          terrace_area?: number | null
          type: string
          updated_at?: string
          wing?: string | null
        }
        Update: {
          booked_status?: string
          building_id?: string
          created_at?: string
          created_by?: string | null
          flat_experience?: string | null
          flat_no?: number
          floor?: number
          id?: string
          square_foot?: number
          terrace_area?: number | null
          type?: string
          updated_at?: string
          wing?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flats_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      grievance_tickets: {
        Row: {
          assigned_staff_id: string | null
          created_at: string
          customer_id: string
          description: string
          grievance_type: string
          id: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolved_at: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          ticket_number: string
          updated_at: string
        }
        Insert: {
          assigned_staff_id?: string | null
          created_at?: string
          customer_id: string
          description: string
          grievance_type: string
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          ticket_number: string
          updated_at?: string
        }
        Update: {
          assigned_staff_id?: string | null
          created_at?: string
          customer_id?: string
          description?: string
          grievance_type?: string
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          ticket_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grievance_tickets_assigned_staff_id_fkey"
            columns: ["assigned_staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grievance_tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          name: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      quotes: {
        Row: {
          base_amount: number
          building_id: string
          building_name: string
          created_at: string
          created_by: string
          customer_gender: string
          customer_id: string | null
          customer_name: string
          customer_title: string
          electrical_water_charges: number
          flat_details: Json
          flat_id: string
          gst_tax: number
          id: string
          legal_charges: number
          maintenance: number
          other_charges: number
          payment_schedule: Json | null
          rate_per_sqft: number
          registration_charges: number
          stamp_duty: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          base_amount: number
          building_id: string
          building_name: string
          created_at?: string
          created_by: string
          customer_gender: string
          customer_id?: string | null
          customer_name: string
          customer_title: string
          electrical_water_charges: number
          flat_details: Json
          flat_id: string
          gst_tax: number
          id?: string
          legal_charges: number
          maintenance: number
          other_charges: number
          payment_schedule?: Json | null
          rate_per_sqft: number
          registration_charges: number
          stamp_duty: number
          total_amount: number
          updated_at?: string
        }
        Update: {
          base_amount?: number
          building_id?: string
          building_name?: string
          created_at?: string
          created_by?: string
          customer_gender?: string
          customer_id?: string | null
          customer_name?: string
          customer_title?: string
          electrical_water_charges?: number
          flat_details?: Json
          flat_id?: string
          gst_tax?: number
          id?: string
          legal_charges?: number
          maintenance?: number
          other_charges?: number
          payment_schedule?: Json | null
          rate_per_sqft?: number
          registration_charges?: number
          stamp_duty?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_flat_id_fkey"
            columns: ["flat_id"]
            isOneToOne: false
            referencedRelation: "flats"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_activity_log: {
        Row: {
          activity_type: string
          created_at: string
          description: string
          id: string
          performed_by: string | null
          ticket_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          description: string
          id?: string
          performed_by?: string | null
          ticket_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          description?: string
          id?: string
          performed_by?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_activity_log_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_activity_log_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "grievance_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_ticket_number: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "admin" | "staff"
      ticket_priority: "low" | "medium" | "high"
      ticket_status: "new" | "open" | "in_progress" | "resolved"
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
      app_role: ["admin", "staff"],
      ticket_priority: ["low", "medium", "high"],
      ticket_status: ["new", "open", "in_progress", "resolved"],
    },
  },
} as const
