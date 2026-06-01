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
      analytics_events: {
        Row: {
          created_at: string
          event_name: string
          id: string
          path: string | null
          properties: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          path?: string | null
          properties?: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          path?: string | null
          properties?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      app_secrets: {
        Row: {
          category: string
          created_at: string
          hint: string | null
          name: string
          updated_at: string
          updated_by: string | null
          value_encrypted: string
        }
        Insert: {
          category?: string
          created_at?: string
          hint?: string | null
          name: string
          updated_at?: string
          updated_by?: string | null
          value_encrypted: string
        }
        Update: {
          category?: string
          created_at?: string
          hint?: string | null
          name?: string
          updated_at?: string
          updated_by?: string | null
          value_encrypted?: string
        }
        Relationships: []
      }
      drone_commands: {
        Row: {
          acked_at: string | null
          command: string
          created_at: string
          drone_id: string
          error: string | null
          id: string
          issued_by: string
          params: Json | null
          response: Json | null
          status: string
        }
        Insert: {
          acked_at?: string | null
          command: string
          created_at?: string
          drone_id: string
          error?: string | null
          id?: string
          issued_by: string
          params?: Json | null
          response?: Json | null
          status?: string
        }
        Update: {
          acked_at?: string | null
          command?: string
          created_at?: string
          drone_id?: string
          error?: string | null
          id?: string
          issued_by?: string
          params?: Json | null
          response?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "drone_commands_drone_id_fkey"
            columns: ["drone_id"]
            isOneToOne: false
            referencedRelation: "drones"
            referencedColumns: ["id"]
          },
        ]
      }
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
          firmware_version: string | null
          flight_mode: string | null
          flight_time_minutes: number | null
          geofence_radius_m: number | null
          gimbal_pitch: number | null
          gimbal_yaw: number | null
          gps_satellites: number | null
          has_lidar: boolean | null
          has_parachute: boolean | null
          has_rtk: boolean | null
          has_speaker: boolean | null
          has_spotlight: boolean | null
          has_thermal: boolean | null
          heading: number | null
          home_latitude: number | null
          home_longitude: number | null
          id: string
          is_armed: boolean | null
          latitude: number | null
          link_quality: number | null
          longitude: number | null
          max_altitude_m: number | null
          model: string
          motor_count: number | null
          name: string
          payload_type: string | null
          rc_battery_level: number | null
          recording: boolean | null
          serial_number: string
          signal_strength: number | null
          speed: number | null
          status: Database["public"]["Enums"]["drone_status"]
          stream_demo_path: string | null
          stream_mode: string
          stream_url: string | null
          temperature_c: number | null
          updated_at: string
          wind_direction: number | null
          wind_speed: number | null
          zoom_level: number | null
        }
        Insert: {
          altitude?: number | null
          assigned_pilot_id?: string | null
          battery_level?: number
          created_at?: string
          firmware_version?: string | null
          flight_mode?: string | null
          flight_time_minutes?: number | null
          geofence_radius_m?: number | null
          gimbal_pitch?: number | null
          gimbal_yaw?: number | null
          gps_satellites?: number | null
          has_lidar?: boolean | null
          has_parachute?: boolean | null
          has_rtk?: boolean | null
          has_speaker?: boolean | null
          has_spotlight?: boolean | null
          has_thermal?: boolean | null
          heading?: number | null
          home_latitude?: number | null
          home_longitude?: number | null
          id?: string
          is_armed?: boolean | null
          latitude?: number | null
          link_quality?: number | null
          longitude?: number | null
          max_altitude_m?: number | null
          model?: string
          motor_count?: number | null
          name: string
          payload_type?: string | null
          rc_battery_level?: number | null
          recording?: boolean | null
          serial_number?: string
          signal_strength?: number | null
          speed?: number | null
          status?: Database["public"]["Enums"]["drone_status"]
          stream_demo_path?: string | null
          stream_mode?: string
          stream_url?: string | null
          temperature_c?: number | null
          updated_at?: string
          wind_direction?: number | null
          wind_speed?: number | null
          zoom_level?: number | null
        }
        Update: {
          altitude?: number | null
          assigned_pilot_id?: string | null
          battery_level?: number
          created_at?: string
          firmware_version?: string | null
          flight_mode?: string | null
          flight_time_minutes?: number | null
          geofence_radius_m?: number | null
          gimbal_pitch?: number | null
          gimbal_yaw?: number | null
          gps_satellites?: number | null
          has_lidar?: boolean | null
          has_parachute?: boolean | null
          has_rtk?: boolean | null
          has_speaker?: boolean | null
          has_spotlight?: boolean | null
          has_thermal?: boolean | null
          heading?: number | null
          home_latitude?: number | null
          home_longitude?: number | null
          id?: string
          is_armed?: boolean | null
          latitude?: number | null
          link_quality?: number | null
          longitude?: number | null
          max_altitude_m?: number | null
          model?: string
          motor_count?: number | null
          name?: string
          payload_type?: string | null
          rc_battery_level?: number | null
          recording?: boolean | null
          serial_number?: string
          signal_strength?: number | null
          speed?: number | null
          status?: Database["public"]["Enums"]["drone_status"]
          stream_demo_path?: string | null
          stream_mode?: string
          stream_url?: string | null
          temperature_c?: number | null
          updated_at?: string
          wind_direction?: number | null
          wind_speed?: number | null
          zoom_level?: number | null
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
      marketplace_payments: {
        Row: {
          amount_pilot_cents: number
          amount_total_cents: number
          client_id: string
          created_at: string
          currency: string
          fee_cents: number
          id: string
          pilot_id: string
          quote_id: string
          request_id: string
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          updated_at: string
        }
        Insert: {
          amount_pilot_cents: number
          amount_total_cents: number
          client_id: string
          created_at?: string
          currency?: string
          fee_cents: number
          id?: string
          pilot_id: string
          quote_id: string
          request_id: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_pilot_cents?: number
          amount_total_cents?: number
          client_id?: string
          created_at?: string
          currency?: string
          fee_cents?: number
          id?: string
          pilot_id?: string
          quote_id?: string
          request_id?: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
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
      mission_schedules: {
        Row: {
          created_at: string
          id: string
          max_precip_pct: number
          max_wind_kph: number
          min_temp_c: number
          min_visibility_km: number
          notes: string | null
          plan_id: string
          scheduled_at: string
          status: string
          updated_at: string
          user_id: string
          weather_checked_at: string | null
          weather_status: string
          weather_summary: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          max_precip_pct?: number
          max_wind_kph?: number
          min_temp_c?: number
          min_visibility_km?: number
          notes?: string | null
          plan_id: string
          scheduled_at: string
          status?: string
          updated_at?: string
          user_id: string
          weather_checked_at?: string | null
          weather_status?: string
          weather_summary?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          max_precip_pct?: number
          max_wind_kph?: number
          min_temp_c?: number
          min_visibility_km?: number
          notes?: string | null
          plan_id?: string
          scheduled_at?: string
          status?: string
          updated_at?: string
          user_id?: string
          weather_checked_at?: string | null
          weather_status?: string
          weather_summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mission_schedules_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "saved_flight_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_versions: {
        Row: {
          created_at: string
          home_position: Json | null
          id: string
          name: string
          params: Json
          plan_id: string
          polygon: Json
          user_id: string
          version_number: number
        }
        Insert: {
          created_at?: string
          home_position?: Json | null
          id?: string
          name: string
          params: Json
          plan_id: string
          polygon: Json
          user_id: string
          version_number: number
        }
        Update: {
          created_at?: string
          home_position?: Json | null
          id?: string
          name?: string
          params?: Json
          plan_id?: string
          polygon?: Json
          user_id?: string
          version_number?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          metadata: Json
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          metadata?: Json
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          metadata?: Json
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      organization_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          org_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          org_id: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          org_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          invited_email: string | null
          org_id: string
          role: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invited_email?: string | null
          org_id: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invited_email?: string | null
          org_id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          bio: string | null
          contact_email: string | null
          created_at: string
          id: string
          name: string
          owner_id: string
          phone: string | null
          updated_at: string
          verified: boolean
          website: string | null
        }
        Insert: {
          bio?: string | null
          contact_email?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id: string
          phone?: string | null
          updated_at?: string
          verified?: boolean
          website?: string | null
        }
        Update: {
          bio?: string | null
          contact_email?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          phone?: string | null
          updated_at?: string
          verified?: boolean
          website?: string | null
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
          recert_confirmed_at: string | null
          recert_required: boolean
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
          recert_confirmed_at?: string | null
          recert_required?: boolean
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
          recert_confirmed_at?: string | null
          recert_required?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pilot_profiles: {
        Row: {
          accepted_terms_at: string | null
          available: boolean
          bio: string | null
          contact_email: string | null
          created_at: string
          display_lat: number | null
          display_lng: number | null
          display_name: string
          equipment: string[]
          hourly_rate_cents: number | null
          id: string
          insured: boolean
          languages: string[]
          location_privacy: boolean
          part_107: boolean
          phone: string | null
          portfolio_url: string | null
          service_area_label: string | null
          service_lat: number | null
          service_lng: number | null
          service_radius_km: number
          show_on_map: boolean
          skills: string[]
          software: string[]
          updated_at: string
          user_id: string
          verification_rejection_reason: string | null
          verification_status: Database["public"]["Enums"]["pilot_verification_status"]
          verified_at: string | null
          verticals: Database["public"]["Enums"]["industry_vertical"][]
          years_experience: number
        }
        Insert: {
          accepted_terms_at?: string | null
          available?: boolean
          bio?: string | null
          contact_email?: string | null
          created_at?: string
          display_lat?: number | null
          display_lng?: number | null
          display_name: string
          equipment?: string[]
          hourly_rate_cents?: number | null
          id?: string
          insured?: boolean
          languages?: string[]
          location_privacy?: boolean
          part_107?: boolean
          phone?: string | null
          portfolio_url?: string | null
          service_area_label?: string | null
          service_lat?: number | null
          service_lng?: number | null
          service_radius_km?: number
          show_on_map?: boolean
          skills?: string[]
          software?: string[]
          updated_at?: string
          user_id: string
          verification_rejection_reason?: string | null
          verification_status?: Database["public"]["Enums"]["pilot_verification_status"]
          verified_at?: string | null
          verticals?: Database["public"]["Enums"]["industry_vertical"][]
          years_experience?: number
        }
        Update: {
          accepted_terms_at?: string | null
          available?: boolean
          bio?: string | null
          contact_email?: string | null
          created_at?: string
          display_lat?: number | null
          display_lng?: number | null
          display_name?: string
          equipment?: string[]
          hourly_rate_cents?: number | null
          id?: string
          insured?: boolean
          languages?: string[]
          location_privacy?: boolean
          part_107?: boolean
          phone?: string | null
          portfolio_url?: string | null
          service_area_label?: string | null
          service_lat?: number | null
          service_lng?: number | null
          service_radius_km?: number
          show_on_map?: boolean
          skills?: string[]
          software?: string[]
          updated_at?: string
          user_id?: string
          verification_rejection_reason?: string | null
          verification_status?: Database["public"]["Enums"]["pilot_verification_status"]
          verified_at?: string | null
          verticals?: Database["public"]["Enums"]["industry_vertical"][]
          years_experience?: number
        }
        Relationships: []
      }
      pilot_stripe_accounts: {
        Row: {
          charges_enabled: boolean
          created_at: string
          details_submitted: boolean
          id: string
          payouts_enabled: boolean
          stripe_account_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          charges_enabled?: boolean
          created_at?: string
          details_submitted?: boolean
          id?: string
          payouts_enabled?: boolean
          stripe_account_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          charges_enabled?: boolean
          created_at?: string
          details_submitted?: boolean
          id?: string
          payouts_enabled?: boolean
          stripe_account_id?: string
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
      pilot_verifications: {
        Row: {
          admin_notes: string | null
          country: string
          created_at: string
          date_of_birth: string | null
          document_urls: string[]
          id: string
          id_last4: string
          id_type: string
          insurance_policy_number: string | null
          insurance_provider: string | null
          legal_first_name: string
          legal_last_name: string
          part_107_cert_number: string | null
          pilot_notes: string | null
          region: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["pilot_verification_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          country: string
          created_at?: string
          date_of_birth?: string | null
          document_urls?: string[]
          id?: string
          id_last4: string
          id_type: string
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          legal_first_name: string
          legal_last_name: string
          part_107_cert_number?: string | null
          pilot_notes?: string | null
          region?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["pilot_verification_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          country?: string
          created_at?: string
          date_of_birth?: string | null
          document_urls?: string[]
          id?: string
          id_last4?: string
          id_type?: string
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          legal_first_name?: string
          legal_last_name?: string
          part_107_cert_number?: string | null
          pilot_notes?: string | null
          region?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["pilot_verification_status"]
          updated_at?: string
          user_id?: string
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
      portfolio_inquiries: {
        Row: {
          budget_cents: number | null
          created_at: string
          id: string
          message: string
          owner_id: string
          project_ref: string | null
          read_at: string | null
          sender_email: string
          sender_name: string
          source_url: string | null
          subject: string | null
          timeline: string | null
        }
        Insert: {
          budget_cents?: number | null
          created_at?: string
          id?: string
          message: string
          owner_id: string
          project_ref?: string | null
          read_at?: string | null
          sender_email: string
          sender_name: string
          source_url?: string | null
          subject?: string | null
          timeline?: string | null
        }
        Update: {
          budget_cents?: number | null
          created_at?: string
          id?: string
          message?: string
          owner_id?: string
          project_ref?: string | null
          read_at?: string | null
          sender_email?: string
          sender_name?: string
          source_url?: string | null
          subject?: string | null
          timeline?: string | null
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
          available_for_hire: boolean
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          contact_email: string | null
          created_at: string
          full_name: string | null
          headline: string | null
          hourly_rate_cents: number | null
          id: string
          instagram: string | null
          linkedin: string | null
          location: string | null
          phone: string | null
          portfolio_published: boolean
          resume_url: string | null
          services: string[]
          theme: Json
          tiktok: string | null
          twitter: string | null
          updated_at: string
          username: string | null
          vimeo: string | null
          visibility_prefs: Json
          website: string | null
          youtube: string | null
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          available_for_hire?: boolean
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          contact_email?: string | null
          created_at?: string
          full_name?: string | null
          headline?: string | null
          hourly_rate_cents?: number | null
          id: string
          instagram?: string | null
          linkedin?: string | null
          location?: string | null
          phone?: string | null
          portfolio_published?: boolean
          resume_url?: string | null
          services?: string[]
          theme?: Json
          tiktok?: string | null
          twitter?: string | null
          updated_at?: string
          username?: string | null
          vimeo?: string | null
          visibility_prefs?: Json
          website?: string | null
          youtube?: string | null
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          available_for_hire?: boolean
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          contact_email?: string | null
          created_at?: string
          full_name?: string | null
          headline?: string | null
          hourly_rate_cents?: number | null
          id?: string
          instagram?: string | null
          linkedin?: string | null
          location?: string | null
          phone?: string | null
          portfolio_published?: boolean
          resume_url?: string | null
          services?: string[]
          theme?: Json
          tiktok?: string | null
          twitter?: string | null
          updated_at?: string
          username?: string | null
          vimeo?: string | null
          visibility_prefs?: Json
          website?: string | null
          youtube?: string | null
        }
        Relationships: []
      }
      project_ai_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          project_id: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_ai_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_ai_reports: {
        Row: {
          created_at: string
          features: Json
          id: string
          model: string
          project_id: string
          raw: Json | null
          recommendations: Json
          risks: Json
          summary: string
          user_id: string
        }
        Insert: {
          created_at?: string
          features?: Json
          id?: string
          model?: string
          project_id: string
          raw?: Json | null
          recommendations?: Json
          risks?: Json
          summary: string
          user_id: string
        }
        Update: {
          created_at?: string
          features?: Json
          id?: string
          model?: string
          project_id?: string
          raw?: Json | null
          recommendations?: Json
          risks?: Json
          summary?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_ai_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          accuracy_report: Json | null
          area_ha: number | null
          canceled_at: string | null
          created_at: string
          current_stage: string | null
          description: string | null
          eta_seconds: number | null
          gps_points: Json | null
          id: string
          image_count: number
          name: string
          outputs: string[] | null
          outputs_urls: Json | null
          processing_priority: number
          processing_settings: Json
          progress: number
          stage_log: Json
          stage_progress: number
          stage_started_at: string | null
          status: string
          updated_at: string
          user_id: string
          webodm_task_id: string | null
        }
        Insert: {
          accuracy_report?: Json | null
          area_ha?: number | null
          canceled_at?: string | null
          created_at?: string
          current_stage?: string | null
          description?: string | null
          eta_seconds?: number | null
          gps_points?: Json | null
          id?: string
          image_count?: number
          name: string
          outputs?: string[] | null
          outputs_urls?: Json | null
          processing_priority?: number
          processing_settings?: Json
          progress?: number
          stage_log?: Json
          stage_progress?: number
          stage_started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
          webodm_task_id?: string | null
        }
        Update: {
          accuracy_report?: Json | null
          area_ha?: number | null
          canceled_at?: string | null
          created_at?: string
          current_stage?: string | null
          description?: string | null
          eta_seconds?: number | null
          gps_points?: Json | null
          id?: string
          image_count?: number
          name?: string
          outputs?: string[] | null
          outputs_urls?: Json | null
          processing_priority?: number
          processing_settings?: Json
          progress?: number
          stage_log?: Json
          stage_progress?: number
          stage_started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          webodm_task_id?: string | null
        }
        Relationships: []
      }
      request_message_reads: {
        Row: {
          last_read_at: string
          pilot_id: string
          request_id: string
          user_id: string
        }
        Insert: {
          last_read_at?: string
          pilot_id: string
          request_id: string
          user_id: string
        }
        Update: {
          last_read_at?: string
          pilot_id?: string
          request_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_message_reads_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          pilot_id: string
          request_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          pilot_id: string
          request_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          pilot_id?: string
          request_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_messages_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
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
          payment_status: string
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
          payment_status?: string
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
          payment_status?: string
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
          released_to_free_at: string
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
          released_to_free_at?: string
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
          released_to_free_at?: string
          status?: Database["public"]["Enums"]["request_status"]
          title?: string
          updated_at?: string
          vertical?: Database["public"]["Enums"]["industry_vertical"]
        }
        Relationships: []
      }
      splat_jobs: {
        Row: {
          capture_flags: Json | null
          created_at: string
          error: string | null
          id: string
          image_count: number | null
          iterations: number
          output_path: string | null
          preset: string
          project_id: string
          psnr: number | null
          sph_degree: number
          status: string
          training_seconds: number | null
          updated_at: string
          use_georef: boolean
          user_id: string
        }
        Insert: {
          capture_flags?: Json | null
          created_at?: string
          error?: string | null
          id?: string
          image_count?: number | null
          iterations?: number
          output_path?: string | null
          preset?: string
          project_id: string
          psnr?: number | null
          sph_degree?: number
          status?: string
          training_seconds?: number | null
          updated_at?: string
          use_georef?: boolean
          user_id: string
        }
        Update: {
          capture_flags?: Json | null
          created_at?: string
          error?: string | null
          id?: string
          image_count?: number | null
          iterations?: number
          output_path?: string | null
          preset?: string
          project_id?: string
          psnr?: number | null
          sph_degree?: number
          status?: string
          training_seconds?: number | null
          updated_at?: string
          use_georef?: boolean
          user_id?: string
        }
        Relationships: []
      }
      splat_shares: {
        Row: {
          asset_name: string | null
          asset_path: string
          created_at: string
          expires_at: string | null
          id: string
          project_id: string
          token: string
          user_id: string
        }
        Insert: {
          asset_name?: string | null
          asset_path: string
          created_at?: string
          expires_at?: string | null
          id?: string
          project_id: string
          token: string
          user_id: string
        }
        Update: {
          asset_name?: string | null
          asset_path?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          project_id?: string
          token?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_request_thread: {
        Args: { _pilot_id: string; _request_id: string; _user_id: string }
        Returns: boolean
      }
      create_notification: {
        Args: {
          _body?: string
          _kind: string
          _link?: string
          _metadata?: Json
          _title: string
          _user_id: string
        }
        Returns: string
      }
      decrypt_app_secret: {
        Args: { _key: string; _name: string }
        Returns: string
      }
      encrypt_app_secret: {
        Args: { _key: string; _value: string }
        Returns: string
      }
      find_matching_pilots: {
        Args: { _request_id: string }
        Returns: {
          display_name: string
          distance_km: number
          hourly_rate_cents: number
          insured: boolean
          part_107: boolean
          pilot_id: string
          portfolio_url: string
          service_area_label: string
          verticals: Database["public"]["Enums"]["industry_vertical"][]
          years_experience: number
        }[]
      }
      get_marketplace_requests: {
        Args: { _is_top_tier?: boolean }
        Returns: {
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
          released_to_free_at: string
          status: Database["public"]["Enums"]["request_status"]
          title: string
          updated_at: string
          vertical: Database["public"]["Enums"]["industry_vertical"]
        }[]
        SetofOptions: {
          from: "*"
          to: "service_requests"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_my_pilot_profile: {
        Args: never
        Returns: {
          accepted_terms_at: string | null
          available: boolean
          bio: string | null
          contact_email: string | null
          created_at: string
          display_lat: number | null
          display_lng: number | null
          display_name: string
          equipment: string[]
          hourly_rate_cents: number | null
          id: string
          insured: boolean
          languages: string[]
          location_privacy: boolean
          part_107: boolean
          phone: string | null
          portfolio_url: string | null
          service_area_label: string | null
          service_lat: number | null
          service_lng: number | null
          service_radius_km: number
          show_on_map: boolean
          skills: string[]
          software: string[]
          updated_at: string
          user_id: string
          verification_rejection_reason: string | null
          verification_status: Database["public"]["Enums"]["pilot_verification_status"]
          verified_at: string | null
          verticals: Database["public"]["Enums"]["industry_vertical"][]
          years_experience: number
        }[]
        SetofOptions: {
          from: "*"
          to: "pilot_profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_public_pilot: {
        Args: { _is_paid?: boolean; _pilot_id: string }
        Returns: {
          avatar_url: string
          bio: string
          contact_email: string
          display_name: string
          equipment: string[]
          hourly_rate_cents: number
          insured: boolean
          is_redacted: boolean
          languages: string[]
          part_107: boolean
          phone: string
          pilot_id: string
          portfolio_published: boolean
          portfolio_url: string
          service_area_label: string
          service_radius_km: number
          skills: string[]
          software: string[]
          username: string
          verification_status: Database["public"]["Enums"]["pilot_verification_status"]
          verticals: Database["public"]["Enums"]["industry_vertical"][]
          years_experience: number
        }[]
      }
      get_public_pilots: {
        Args: never
        Returns: {
          avatar_url: string
          bio: string
          display_lat: number
          display_lng: number
          display_name: string
          equipment: string[]
          hourly_rate_cents: number
          insured: boolean
          part_107: boolean
          pilot_id: string
          portfolio_url: string
          service_area_label: string
          service_radius_km: number
          skills: string[]
          verticals: Database["public"]["Enums"]["industry_vertical"][]
          years_experience: number
        }[]
      }
      get_public_pilots_lite: {
        Args: {
          _is_paid?: boolean
          _limit?: number
          _max_lat?: number
          _max_lng?: number
          _min_lat?: number
          _min_lng?: number
          _offset?: number
          _vertical?: Database["public"]["Enums"]["industry_vertical"]
        }
        Returns: {
          avatar_url: string
          display_lat: number
          display_lng: number
          display_name: string
          hourly_rate_cents: number
          insured: boolean
          is_redacted: boolean
          part_107: boolean
          pilot_id: string
          service_area_label: string
          service_radius_km: number
          total_count: number
          verticals: Database["public"]["Enums"]["industry_vertical"][]
          years_experience: number
        }[]
      }
      get_public_pilots_v2: {
        Args: { _is_paid?: boolean }
        Returns: {
          avatar_url: string
          bio: string
          display_lat: number
          display_lng: number
          display_name: string
          equipment: string[]
          hourly_rate_cents: number
          insured: boolean
          is_redacted: boolean
          languages: string[]
          part_107: boolean
          pilot_id: string
          portfolio_url: string
          service_area_label: string
          service_radius_km: number
          skills: string[]
          software: string[]
          verticals: Database["public"]["Enums"]["industry_vertical"][]
          years_experience: number
        }[]
      }
      get_splat_share_by_token: {
        Args: { _token: string }
        Returns: {
          asset_name: string
          asset_path: string
          expires_at: string
          project_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      haversine_km: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      is_org_manager: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_reserved_username: { Args: { _name: string }; Returns: boolean }
      unread_thread_counts: {
        Args: { _user_id: string }
        Returns: {
          last_message_at: string
          pilot_id: string
          request_id: string
          unread: number
        }[]
      }
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
      pilot_verification_status:
        | "unverified"
        | "pending"
        | "verified"
        | "rejected"
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
      pilot_verification_status: [
        "unverified",
        "pending",
        "verified",
        "rejected",
      ],
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
