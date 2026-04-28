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
      drone_maintenance: {
        Row: {
          created_at: string
          cycles_left: number
          drone_id: string
          due_date: string
          health_pct: number
          id: string
          status: string
          task: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cycles_left?: number
          drone_id: string
          due_date: string
          health_pct?: number
          id?: string
          status?: string
          task: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cycles_left?: number
          drone_id?: string
          due_date?: string
          health_pct?: number
          id?: string
          status?: string
          task?: string
          updated_at?: string
        }
        Relationships: []
      }
      drone_signals: {
        Row: {
          created_at: string
          drone_id: string
          from_peer: string
          id: string
          kind: string
          payload: Json
          to_peer: string | null
        }
        Insert: {
          created_at?: string
          drone_id: string
          from_peer: string
          id?: string
          kind: string
          payload: Json
          to_peer?: string | null
        }
        Update: {
          created_at?: string
          drone_id?: string
          from_peer?: string
          id?: string
          kind?: string
          payload?: Json
          to_peer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drone_signals_drone_id_fkey"
            columns: ["drone_id"]
            isOneToOne: false
            referencedRelation: "drones"
            referencedColumns: ["id"]
          },
        ]
      }
      drones: {
        Row: {
          altitude: number | null
          assigned_pilot_id: string | null
          battery_level: number
          created_at: string
          flight_time_minutes: number | null
          heading: number | null
          id: string
          latitude: number | null
          longitude: number | null
          model: string
          name: string
          serial_number: string
          speed: number | null
          status: Database["public"]["Enums"]["drone_status"]
          stream_demo_path: string | null
          stream_mode: string
          stream_url: string | null
          updated_at: string
        }
        Insert: {
          altitude?: number | null
          assigned_pilot_id?: string | null
          battery_level?: number
          created_at?: string
          flight_time_minutes?: number | null
          heading?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          model?: string
          name: string
          serial_number?: string
          speed?: number | null
          status?: Database["public"]["Enums"]["drone_status"]
          stream_demo_path?: string | null
          stream_mode?: string
          stream_url?: string | null
          updated_at?: string
        }
        Update: {
          altitude?: number | null
          assigned_pilot_id?: string | null
          battery_level?: number
          created_at?: string
          flight_time_minutes?: number | null
          heading?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          model?: string
          name?: string
          serial_number?: string
          speed?: number | null
          status?: Database["public"]["Enums"]["drone_status"]
          stream_demo_path?: string | null
          stream_mode?: string
          stream_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      flight_plans: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number
          file_type?: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flight_plans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ground_control_points: {
        Row: {
          created_at: string
          elevation: number | null
          id: string
          latitude: number
          longitude: number
          name: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          elevation?: number | null
          id?: string
          latitude: number
          longitude: number
          name: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          elevation?: number | null
          id?: string
          latitude?: number
          longitude?: number
          name?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ground_control_points_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          created_at: string
          drone_id: string
          ended_at: string | null
          id: string
          mission_type: string
          notes: string | null
          pilot_id: string
          project_id: string | null
          started_at: string
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          drone_id: string
          ended_at?: string | null
          id?: string
          mission_type?: string
          notes?: string | null
          pilot_id: string
          project_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          drone_id?: string
          ended_at?: string | null
          id?: string
          mission_type?: string
          notes?: string | null
          pilot_id?: string
          project_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_drone_id_fkey"
            columns: ["drone_id"]
            isOneToOne: false
            referencedRelation: "drones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      map_bookmarks: {
        Row: {
          color: string | null
          created_at: string
          id: string
          latitude: number
          longitude: number
          name: string
          project_id: string | null
          user_id: string
          zoom: number
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          latitude: number
          longitude: number
          name: string
          project_id?: string | null
          user_id: string
          zoom?: number
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          latitude?: number
          longitude?: number
          name?: string
          project_id?: string | null
          user_id?: string
          zoom?: number
        }
        Relationships: []
      }
      mission_logs: {
        Row: {
          altitude: number | null
          created_at: string
          event_type: string
          id: string
          job_id: string
          latitude: number | null
          longitude: number | null
          payload: Json
          pilot_id: string
          recorded_at: string
        }
        Insert: {
          altitude?: number | null
          created_at?: string
          event_type: string
          id?: string
          job_id: string
          latitude?: number | null
          longitude?: number | null
          payload?: Json
          pilot_id: string
          recorded_at?: string
        }
        Update: {
          altitude?: number | null
          created_at?: string
          event_type?: string
          id?: string
          job_id?: string
          latitude?: number | null
          longitude?: number | null
          payload?: Json
          pilot_id?: string
          recorded_at?: string
        }
        Relationships: []
      }
      pilot_certifications: {
        Row: {
          cert_type: string
          created_at: string
          expires_at: string
          id: string
          issued_at: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cert_type: string
          created_at?: string
          expires_at: string
          id?: string
          issued_at: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cert_type?: string
          created_at?: string
          expires_at?: string
          id?: string
          issued_at?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pilot_tracks: {
        Row: {
          accuracy: number | null
          altitude: number | null
          heading: number | null
          id: string
          job_id: string
          latitude: number
          longitude: number
          pilot_id: string
          recorded_at: string
          speed: number | null
        }
        Insert: {
          accuracy?: number | null
          altitude?: number | null
          heading?: number | null
          id?: string
          job_id: string
          latitude: number
          longitude: number
          pilot_id: string
          recorded_at?: string
          speed?: number | null
        }
        Update: {
          accuracy?: number | null
          altitude?: number | null
          heading?: number | null
          id?: string
          job_id?: string
          latitude?: number
          longitude?: number
          pilot_id?: string
          recorded_at?: string
          speed?: number | null
        }
        Relationships: []
      }
      portfolio_albums: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          slug: string
          sort_order: number
          title: string
          updated_at: string
          user_id: string
          visibility: Database["public"]["Enums"]["portfolio_visibility"]
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
          user_id: string
          visibility?: Database["public"]["Enums"]["portfolio_visibility"]
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
          user_id?: string
          visibility?: Database["public"]["Enums"]["portfolio_visibility"]
        }
        Relationships: []
      }
      portfolio_items: {
        Row: {
          album_id: string | null
          caption: string | null
          captured_at: string | null
          created_at: string
          duration_s: number | null
          height: number | null
          id: string
          kind: string
          media_url: string | null
          project_id: string | null
          sort_order: number
          storage_path: string | null
          thumb_url: string | null
          title: string | null
          updated_at: string
          user_id: string
          visibility: Database["public"]["Enums"]["portfolio_visibility"]
          width: number | null
        }
        Insert: {
          album_id?: string | null
          caption?: string | null
          captured_at?: string | null
          created_at?: string
          duration_s?: number | null
          height?: number | null
          id?: string
          kind: string
          media_url?: string | null
          project_id?: string | null
          sort_order?: number
          storage_path?: string | null
          thumb_url?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
          visibility?: Database["public"]["Enums"]["portfolio_visibility"]
          width?: number | null
        }
        Update: {
          album_id?: string | null
          caption?: string | null
          captured_at?: string | null
          created_at?: string
          duration_s?: number | null
          height?: number | null
          id?: string
          kind?: string
          media_url?: string | null
          project_id?: string | null
          sort_order?: number
          storage_path?: string | null
          thumb_url?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
          visibility?: Database["public"]["Enums"]["portfolio_visibility"]
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_items_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "portfolio_albums"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          avatar_url: string | null
          bio: string | null
          created_at: string
          full_name: string | null
          headline: string | null
          id: string
          instagram: string | null
          location: string | null
          portfolio_published: boolean
          updated_at: string
          username: string | null
          website: string | null
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          headline?: string | null
          id: string
          instagram?: string | null
          location?: string | null
          portfolio_published?: boolean
          updated_at?: string
          username?: string | null
          website?: string | null
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          headline?: string | null
          id?: string
          instagram?: string | null
          location?: string | null
          portfolio_published?: boolean
          updated_at?: string
          username?: string | null
          website?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          area_ha: number | null
          created_at: string
          description: string | null
          gps_points: Json | null
          id: string
          image_count: number
          name: string
          outputs: string[] | null
          outputs_urls: Json | null
          processing_priority: number
          progress: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          area_ha?: number | null
          created_at?: string
          description?: string | null
          gps_points?: Json | null
          id?: string
          image_count?: number
          name: string
          outputs?: string[] | null
          outputs_urls?: Json | null
          processing_priority?: number
          progress?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          area_ha?: number | null
          created_at?: string
          description?: string | null
          gps_points?: Json | null
          id?: string
          image_count?: number
          name?: string
          outputs?: string[] | null
          outputs_urls?: Json | null
          processing_priority?: number
          progress?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_flight_plans: {
        Row: {
          created_at: string
          home_position: Json | null
          id: string
          name: string
          params: Json
          polygon: Json
          project_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          home_position?: Json | null
          id?: string
          name: string
          params: Json
          polygon: Json
          project_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          home_position?: Json | null
          id?: string
          name?: string
          params?: Json
          polygon?: Json
          project_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_flight_plans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      service_quotes: {
        Row: {
          created_at: string
          eta_days: number | null
          id: string
          message: string | null
          pilot_id: string
          price_cents: number
          request_id: string
          status: Database["public"]["Enums"]["quote_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          eta_days?: number | null
          id?: string
          message?: string | null
          pilot_id: string
          price_cents: number
          request_id: string
          status?: Database["public"]["Enums"]["quote_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          eta_days?: number | null
          id?: string
          message?: string | null
          pilot_id?: string
          price_cents?: number
          request_id?: string
          status?: Database["public"]["Enums"]["quote_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_quotes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      service_requests: {
        Row: {
          assigned_pilot_id: string | null
          budget_cents: number | null
          client_id: string
          created_at: string
          deadline: string | null
          deliverables: string[]
          description: string | null
          id: string
          latitude: number | null
          location_label: string | null
          longitude: number | null
          project_id: string | null
          status: Database["public"]["Enums"]["request_status"]
          title: string
          updated_at: string
          vertical: Database["public"]["Enums"]["industry_vertical"]
        }
        Insert: {
          assigned_pilot_id?: string | null
          budget_cents?: number | null
          client_id: string
          created_at?: string
          deadline?: string | null
          deliverables?: string[]
          description?: string | null
          id?: string
          latitude?: number | null
          location_label?: string | null
          longitude?: number | null
          project_id?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          title: string
          updated_at?: string
          vertical?: Database["public"]["Enums"]["industry_vertical"]
        }
        Update: {
          assigned_pilot_id?: string | null
          budget_cents?: number | null
          client_id?: string
          created_at?: string
          deadline?: string | null
          deliverables?: string[]
          description?: string | null
          id?: string
          latitude?: number | null
          location_label?: string | null
          longitude?: number | null
          project_id?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          title?: string
          updated_at?: string
          vertical?: Database["public"]["Enums"]["industry_vertical"]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_reserved_username: { Args: { _name: string }; Returns: boolean }
    }
    Enums: {
      account_type: "pilot" | "client" | "both"
      app_role: "admin" | "pilot" | "viewer"
      drone_status: "idle" | "active" | "maintenance" | "offline"
      industry_vertical:
        | "construction"
        | "real_estate"
        | "agriculture"
        | "energy"
        | "mining"
        | "insurance"
        | "government"
        | "other"
      job_status: "active" | "completed" | "aborted"
      portfolio_visibility: "public" | "unlisted" | "private"
      quote_status: "pending" | "accepted" | "rejected" | "withdrawn"
      request_status:
        | "open"
        | "quoted"
        | "assigned"
        | "in_progress"
        | "delivered"
        | "closed"
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
      account_type: ["pilot", "client", "both"],
      app_role: ["admin", "pilot", "viewer"],
      drone_status: ["idle", "active", "maintenance", "offline"],
      industry_vertical: [
        "construction",
        "real_estate",
        "agriculture",
        "energy",
        "mining",
        "insurance",
        "government",
        "other",
      ],
      job_status: ["active", "completed", "aborted"],
      portfolio_visibility: ["public", "unlisted", "private"],
      quote_status: ["pending", "accepted", "rejected", "withdrawn"],
      request_status: [
        "open",
        "quoted",
        "assigned",
        "in_progress",
        "delivered",
        "closed",
      ],
    },
  },
} as const
