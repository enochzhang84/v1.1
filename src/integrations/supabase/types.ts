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
      adult_class_checkins: {
        Row: {
          checkin_at: string
          created_at: string
          fellowship: string | null
          id: string
          kind: string
          name: string
          notes: string | null
        }
        Insert: {
          checkin_at?: string
          created_at?: string
          fellowship?: string | null
          id?: string
          kind: string
          name: string
          notes?: string | null
        }
        Update: {
          checkin_at?: string
          created_at?: string
          fellowship?: string | null
          id?: string
          kind?: string
          name?: string
          notes?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      app_versions: {
        Row: {
          created_at: string
          database_version: string | null
          error_log: string | null
          id: string
          installed_at: string
          installed_by: string | null
          is_current: boolean
          notes: string | null
          package_name: string | null
          release_description: string | null
          released_at: string | null
          status: string
          version: string
        }
        Insert: {
          created_at?: string
          database_version?: string | null
          error_log?: string | null
          id?: string
          installed_at?: string
          installed_by?: string | null
          is_current?: boolean
          notes?: string | null
          package_name?: string | null
          release_description?: string | null
          released_at?: string | null
          status?: string
          version: string
        }
        Update: {
          created_at?: string
          database_version?: string | null
          error_log?: string | null
          id?: string
          installed_at?: string
          installed_by?: string | null
          is_current?: boolean
          notes?: string | null
          package_name?: string | null
          release_description?: string | null
          released_at?: string | null
          status?: string
          version?: string
        }
        Relationships: []
      }
      attendance_records: {
        Row: {
          children_students: number
          children_teachers: number
          created_at: string
          id: string
          notes: string | null
          record_date: string
          updated_at: string
          worship_count: number
        }
        Insert: {
          children_students?: number
          children_teachers?: number
          created_at?: string
          id?: string
          notes?: string | null
          record_date: string
          updated_at?: string
          worship_count?: number
        }
        Update: {
          children_students?: number
          children_teachers?: number
          created_at?: string
          id?: string
          notes?: string | null
          record_date?: string
          updated_at?: string
          worship_count?: number
        }
        Relationships: []
      }
      av_broadcasts: {
        Row: {
          body: string
          created_at: string
          duration_seconds: number | null
          expires_at: string | null
          id: string
          is_active: boolean
          level: string
          stopped_at: string | null
          targets: string[]
          title: string
        }
        Insert: {
          body?: string
          created_at?: string
          duration_seconds?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          level?: string
          stopped_at?: string | null
          targets?: string[]
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          duration_seconds?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          level?: string
          stopped_at?: string | null
          targets?: string[]
          title?: string
        }
        Relationships: []
      }
      av_notes: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          images: string[]
          is_favorite: boolean
          is_pinned: boolean
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          images?: string[]
          is_favorite?: boolean
          is_pinned?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          images?: string[]
          is_favorite?: boolean
          is_pinned?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      backup_logs: {
        Row: {
          created_at: string
          created_by: string | null
          creator_name: string | null
          file_size_bytes: number
          id: string
          kind: string
          summary: Json
          total_records: number
          total_tables: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          creator_name?: string | null
          file_size_bytes?: number
          id?: string
          kind?: string
          summary?: Json
          total_records?: number
          total_tables?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          creator_name?: string | null
          file_size_bytes?: number
          id?: string
          kind?: string
          summary?: Json
          total_records?: number
          total_tables?: number
        }
        Relationships: []
      }
      baptisms: {
        Row: {
          baptism_date: string
          baptism_type: string | null
          baptizing_elder: string | null
          created_at: string
          decision_id: string | null
          email: string | null
          fellowship: string | null
          gender: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          baptism_date: string
          baptism_type?: string | null
          baptizing_elder?: string | null
          created_at?: string
          decision_id?: string | null
          email?: string | null
          fellowship?: string | null
          gender?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          baptism_date?: string
          baptism_type?: string | null
          baptizing_elder?: string | null
          created_at?: string
          decision_id?: string | null
          email?: string | null
          fellowship?: string | null
          gender?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "baptisms_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          display_name: string
          id: string
          recipient_id: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          display_name: string
          id?: string
          recipient_id?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          display_name?: string
          id?: string
          recipient_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      communion_service: {
        Row: {
          created_at: string
          service_date: string
          updated_at: string
          worker_1: string | null
          worker_2: string | null
        }
        Insert: {
          created_at?: string
          service_date: string
          updated_at?: string
          worker_1?: string | null
          worker_2?: string | null
        }
        Update: {
          created_at?: string
          service_date?: string
          updated_at?: string
          worker_1?: string | null
          worker_2?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          email: string | null
          fellowship: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
          wechat: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          fellowship?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          wechat?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          fellowship?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          wechat?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      custodial_duty: {
        Row: {
          created_at: string
          service_date: string
          updated_at: string
          workers: string | null
        }
        Insert: {
          created_at?: string
          service_date: string
          updated_at?: string
          workers?: string | null
        }
        Update: {
          created_at?: string
          service_date?: string
          updated_at?: string
          workers?: string | null
        }
        Relationships: []
      }
      decisions: {
        Row: {
          created_at: string
          decision_date: string
          email: string | null
          fellowship: string | null
          follow_up_person: string | null
          follow_up_status: string
          gender: string | null
          id: string
          is_baptized: boolean
          name: string
          notes: string | null
          phone: string | null
          source: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          decision_date: string
          email?: string | null
          fellowship?: string | null
          follow_up_person?: string | null
          follow_up_status?: string
          gender?: string | null
          id?: string
          is_baptized?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          decision_date?: string
          email?: string | null
          fellowship?: string | null
          follow_up_person?: string | null
          follow_up_status?: string
          gender?: string | null
          id?: string
          is_baptized?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      display_playlist_items: {
        Row: {
          content_payload: Json
          content_type: string
          created_at: string
          duration_seconds: number | null
          id: string
          playlist_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          content_payload?: Json
          content_type: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          playlist_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          content_payload?: Json
          content_type?: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          playlist_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "display_playlist_items_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "display_playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      display_playlists: {
        Row: {
          created_at: string
          id: string
          interval_seconds: number
          loop_enabled: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          interval_seconds?: number
          loop_enabled?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          interval_seconds?: number
          loop_enabled?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      display_posters: {
        Row: {
          background: string | null
          body: string | null
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          kind: string
          link_url: string | null
          slug: string | null
          sort_order: number
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          background?: string | null
          body?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          kind?: string
          link_url?: string | null
          slug?: string | null
          sort_order?: number
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          background?: string | null
          body?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          kind?: string
          link_url?: string | null
          slug?: string | null
          sort_order?: number
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      display_screens: {
        Row: {
          created_at: string
          current_content_payload: Json
          current_content_type: string
          id: string
          is_active: boolean
          last_seen_at: string | null
          location: string | null
          name: string
          orientation: string
          playlist_id: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_content_payload?: Json
          current_content_type?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          location?: string | null
          name: string
          orientation?: string
          playlist_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_content_payload?: Json
          current_content_type?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          location?: string | null
          name?: string
          orientation?: string
          playlist_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      duty_personnel: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      duty_schedules: {
        Row: {
          created_at: string
          id: string
          live_person: string | null
          live_person_2: string | null
          ppt_person: string | null
          schedule_type: string
          slot_time: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          live_person?: string | null
          live_person_2?: string | null
          ppt_person?: string | null
          schedule_type: string
          slot_time: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          live_person?: string | null
          live_person_2?: string | null
          ppt_person?: string | null
          schedule_type?: string
          slot_time?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      event_meal_notes: {
        Row: {
          attachments: string[]
          attendees: number
          created_at: string
          event_category: string
          event_date: string
          event_name: string
          event_time: string | null
          id: string
          meal_type: string | null
          notes: string | null
          organizer: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          attachments?: string[]
          attendees?: number
          created_at?: string
          event_category?: string
          event_date: string
          event_name?: string
          event_time?: string | null
          id?: string
          meal_type?: string | null
          notes?: string | null
          organizer?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          attachments?: string[]
          attendees?: number
          created_at?: string
          event_category?: string
          event_date?: string
          event_name?: string
          event_time?: string | null
          id?: string
          meal_type?: string | null
          notes?: string | null
          organizer?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          qr_token: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          qr_token?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          qr_token?: string
        }
        Relationships: []
      }
      feedbacks: {
        Row: {
          contact: string
          created_at: string
          description: string | null
          fellowship: string | null
          id: string
          images: string[]
          name: string
          title: string
        }
        Insert: {
          contact: string
          created_at?: string
          description?: string | null
          fellowship?: string | null
          id?: string
          images?: string[]
          name: string
          title: string
        }
        Update: {
          contact?: string
          created_at?: string
          description?: string | null
          fellowship?: string | null
          id?: string
          images?: string[]
          name?: string
          title?: string
        }
        Relationships: []
      }
      fellowship_checkins: {
        Row: {
          checkin_date: string
          contact: string | null
          created_at: string
          email: string | null
          fellowship: string
          id: string
          name: string
          prayer_request: string | null
        }
        Insert: {
          checkin_date: string
          contact?: string | null
          created_at?: string
          email?: string | null
          fellowship: string
          id?: string
          name: string
          prayer_request?: string | null
        }
        Update: {
          checkin_date?: string
          contact?: string | null
          created_at?: string
          email?: string | null
          fellowship?: string
          id?: string
          name?: string
          prayer_request?: string | null
        }
        Relationships: []
      }
      fellowships: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      flower_duty: {
        Row: {
          created_at: string
          service_date: string
          updated_at: string
          workers: string | null
        }
        Insert: {
          created_at?: string
          service_date: string
          updated_at?: string
          workers?: string | null
        }
        Update: {
          created_at?: string
          service_date?: string
          updated_at?: string
          workers?: string | null
        }
        Relationships: []
      }
      home_page_settings: {
        Row: {
          background_image_url: string | null
          bible_verse: string | null
          church_address: string | null
          church_address_en: string | null
          church_email: string | null
          church_name: string | null
          church_phone: string | null
          church_website: string | null
          footer_text: string | null
          home_qr_updated_at: string | null
          id: string
          logo_subtitle: string | null
          logo_title: string | null
          logo_url: string | null
          primary_button_text: string | null
          primary_button_url: string | null
          qr_description: string | null
          qr_image_url: string | null
          qr_newcomer_url: string | null
          qr_retreat_url: string | null
          qr_title: string | null
          secondary_button_text: string | null
          secondary_button_url: string | null
          site_subtitle: string | null
          site_title: string | null
          theme_text: string | null
          updated_at: string
          welcome_content_html: string | null
          welcome_description: string | null
          welcome_image_url: string | null
          welcome_mode: string
          welcome_subtitle: string | null
          welcome_title: string | null
          worship_schedule: string | null
        }
        Insert: {
          background_image_url?: string | null
          bible_verse?: string | null
          church_address?: string | null
          church_address_en?: string | null
          church_email?: string | null
          church_name?: string | null
          church_phone?: string | null
          church_website?: string | null
          footer_text?: string | null
          home_qr_updated_at?: string | null
          id?: string
          logo_subtitle?: string | null
          logo_title?: string | null
          logo_url?: string | null
          primary_button_text?: string | null
          primary_button_url?: string | null
          qr_description?: string | null
          qr_image_url?: string | null
          qr_newcomer_url?: string | null
          qr_retreat_url?: string | null
          qr_title?: string | null
          secondary_button_text?: string | null
          secondary_button_url?: string | null
          site_subtitle?: string | null
          site_title?: string | null
          theme_text?: string | null
          updated_at?: string
          welcome_content_html?: string | null
          welcome_description?: string | null
          welcome_image_url?: string | null
          welcome_mode?: string
          welcome_subtitle?: string | null
          welcome_title?: string | null
          worship_schedule?: string | null
        }
        Update: {
          background_image_url?: string | null
          bible_verse?: string | null
          church_address?: string | null
          church_address_en?: string | null
          church_email?: string | null
          church_name?: string | null
          church_phone?: string | null
          church_website?: string | null
          footer_text?: string | null
          home_qr_updated_at?: string | null
          id?: string
          logo_subtitle?: string | null
          logo_title?: string | null
          logo_url?: string | null
          primary_button_text?: string | null
          primary_button_url?: string | null
          qr_description?: string | null
          qr_image_url?: string | null
          qr_newcomer_url?: string | null
          qr_retreat_url?: string | null
          qr_title?: string | null
          secondary_button_text?: string | null
          secondary_button_url?: string | null
          site_subtitle?: string | null
          site_title?: string | null
          theme_text?: string | null
          updated_at?: string
          welcome_content_html?: string | null
          welcome_description?: string | null
          welcome_image_url?: string | null
          welcome_mode?: string
          welcome_subtitle?: string | null
          welcome_title?: string | null
          worship_schedule?: string | null
        }
        Relationships: []
      }
      hospitality_ministry_entries: {
        Row: {
          created_at: string
          holy_communion: boolean
          id: string
          location: string | null
          panel_key: string
          service_date: string | null
          service_item: string | null
          sort_order: number
          updated_at: string
          worker: string | null
        }
        Insert: {
          created_at?: string
          holy_communion?: boolean
          id?: string
          location?: string | null
          panel_key: string
          service_date?: string | null
          service_item?: string | null
          sort_order?: number
          updated_at?: string
          worker?: string | null
        }
        Update: {
          created_at?: string
          holy_communion?: boolean
          id?: string
          location?: string | null
          panel_key?: string
          service_date?: string | null
          service_item?: string | null
          sort_order?: number
          updated_at?: string
          worker?: string | null
        }
        Relationships: []
      }
      kids_class_enrollment_snapshots: {
        Row: {
          class_id: string
          class_name: string | null
          created_at: string
          id: string
          snapshot_date: string
          student_count: number
          track: string
        }
        Insert: {
          class_id: string
          class_name?: string | null
          created_at?: string
          id?: string
          snapshot_date?: string
          student_count?: number
          track: string
        }
        Update: {
          class_id?: string
          class_name?: string | null
          created_at?: string
          id?: string
          snapshot_date?: string
          student_count?: number
          track?: string
        }
        Relationships: []
      }
      kids_promotion_records: {
        Row: {
          created_at: string
          from_class: string | null
          id: string
          notes: string | null
          promotion_date: string | null
          season: string
          sort_order: number
          student_name: string
          to_class: string | null
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          from_class?: string | null
          id?: string
          notes?: string | null
          promotion_date?: string | null
          season: string
          sort_order?: number
          student_name: string
          to_class?: string | null
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          from_class?: string | null
          id?: string
          notes?: string | null
          promotion_date?: string | null
          season?: string
          sort_order?: number
          student_name?: string
          to_class?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      kitchen_duty: {
        Row: {
          created_at: string
          service_date: string
          updated_at: string
          workers: string | null
        }
        Insert: {
          created_at?: string
          service_date: string
          updated_at?: string
          workers?: string | null
        }
        Update: {
          created_at?: string
          service_date?: string
          updated_at?: string
          workers?: string | null
        }
        Relationships: []
      }
      meal_plans: {
        Row: {
          attendees: number
          category: string
          created_at: string
          id: string
          meal_type: string | null
          notes: string | null
          plan_date: string
          updated_at: string
        }
        Insert: {
          attendees?: number
          category?: string
          created_at?: string
          id?: string
          meal_type?: string | null
          notes?: string | null
          plan_date: string
          updated_at?: string
        }
        Update: {
          attendees?: number
          category?: string
          created_at?: string
          id?: string
          meal_type?: string | null
          notes?: string | null
          plan_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      meal_types: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          images: string[]
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          images?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          images?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      ministries: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      ministry_service_entries: {
        Row: {
          created_at: string
          entry_date: string
          id: string
          ministry: string | null
          notes: string | null
          service_project: string | null
          updated_at: string
          worker: string | null
        }
        Insert: {
          created_at?: string
          entry_date: string
          id?: string
          ministry?: string | null
          notes?: string | null
          service_project?: string | null
          updated_at?: string
          worker?: string | null
        }
        Update: {
          created_at?: string
          entry_date?: string
          id?: string
          ministry?: string | null
          notes?: string | null
          service_project?: string | null
          updated_at?: string
          worker?: string | null
        }
        Relationships: []
      }
      qr_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      qr_library: {
        Row: {
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          image_url: string | null
          is_default: boolean
          name: string
          target_url: string | null
          updated_at: string
          usage_type: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_default?: boolean
          name: string
          target_url?: string | null
          updated_at?: string
          usage_type?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_default?: boolean
          name?: string
          target_url?: string | null
          updated_at?: string
          usage_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qr_library_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "qr_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      registrations: {
        Row: {
          address: string | null
          age_group: string | null
          city: string | null
          created_at: string
          district: string | null
          email: string | null
          event_id: string | null
          faith: string | null
          faith_growth_note: string | null
          faith_other: string | null
          faith_stage: string
          faith_years: number | null
          follow_up_person: string | null
          follow_up_status: string
          gender: string | null
          id: string
          invited_by: string | null
          is_first_visit: boolean | null
          last_followup_at: string | null
          marital_status: string | null
          name: string
          name_en: string | null
          next_followup_at: string | null
          notes: string | null
          phone: string | null
          referrer_other: string | null
          referrer_type: string | null
          source: string
          source_channel: string | null
          spouse_name: string | null
          wants_followup: boolean | null
          wants_info: boolean | null
          wants_visit: boolean | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          age_group?: string | null
          city?: string | null
          created_at?: string
          district?: string | null
          email?: string | null
          event_id?: string | null
          faith?: string | null
          faith_growth_note?: string | null
          faith_other?: string | null
          faith_stage?: string
          faith_years?: number | null
          follow_up_person?: string | null
          follow_up_status?: string
          gender?: string | null
          id?: string
          invited_by?: string | null
          is_first_visit?: boolean | null
          last_followup_at?: string | null
          marital_status?: string | null
          name: string
          name_en?: string | null
          next_followup_at?: string | null
          notes?: string | null
          phone?: string | null
          referrer_other?: string | null
          referrer_type?: string | null
          source?: string
          source_channel?: string | null
          spouse_name?: string | null
          wants_followup?: boolean | null
          wants_info?: boolean | null
          wants_visit?: boolean | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          age_group?: string | null
          city?: string | null
          created_at?: string
          district?: string | null
          email?: string | null
          event_id?: string | null
          faith?: string | null
          faith_growth_note?: string | null
          faith_other?: string | null
          faith_stage?: string
          faith_years?: number | null
          follow_up_person?: string | null
          follow_up_status?: string
          gender?: string | null
          id?: string
          invited_by?: string | null
          is_first_visit?: boolean | null
          last_followup_at?: string | null
          marital_status?: string | null
          name?: string
          name_en?: string | null
          next_followup_at?: string | null
          notes?: string | null
          phone?: string | null
          referrer_other?: string | null
          referrer_type?: string | null
          source?: string
          source_channel?: string | null
          spouse_name?: string | null
          wants_followup?: boolean | null
          wants_info?: boolean | null
          wants_visit?: boolean | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      retreat_registrations: {
        Row: {
          bed: string | null
          bus: string | null
          can_pickup: number | null
          cell: string | null
          chinese_name: string
          church: string | null
          confirmation_no: string | null
          created_at: string
          email: string | null
          entry_no: number
          first_name: string | null
          gender: string | null
          id: string
          last_name: string | null
          need_pickup: number | null
          paid: boolean
          program: string | null
          serial_no: string | null
          topic: string | null
          updated_at: string
          user_notes: string | null
        }
        Insert: {
          bed?: string | null
          bus?: string | null
          can_pickup?: number | null
          cell?: string | null
          chinese_name: string
          church?: string | null
          confirmation_no?: string | null
          created_at?: string
          email?: string | null
          entry_no?: number
          first_name?: string | null
          gender?: string | null
          id?: string
          last_name?: string | null
          need_pickup?: number | null
          paid?: boolean
          program?: string | null
          serial_no?: string | null
          topic?: string | null
          updated_at?: string
          user_notes?: string | null
        }
        Update: {
          bed?: string | null
          bus?: string | null
          can_pickup?: number | null
          cell?: string | null
          chinese_name?: string
          church?: string | null
          confirmation_no?: string | null
          created_at?: string
          email?: string | null
          entry_no?: number
          first_name?: string | null
          gender?: string | null
          id?: string
          last_name?: string | null
          need_pickup?: number | null
          paid?: boolean
          program?: string | null
          serial_no?: string | null
          topic?: string | null
          updated_at?: string
          user_notes?: string | null
        }
        Relationships: []
      }
      service_applications: {
        Row: {
          created_at: string
          gender: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          service_project: string
          wechat: string | null
        }
        Insert: {
          created_at?: string
          gender?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          service_project: string
          wechat?: string | null
        }
        Update: {
          created_at?: string
          gender?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          service_project?: string
          wechat?: string | null
        }
        Relationships: []
      }
      service_projects: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          ministry_id: string | null
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          ministry_id?: string | null
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          ministry_id?: string | null
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_projects_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
      sunday_class_schedule: {
        Row: {
          class_location: string | null
          class_name: string | null
          course_id: string | null
          course_name: string | null
          created_at: string
          id: string
          notes: string | null
          slot_time: string
          sort_order: number
          student_count: number
          teacher_name: string | null
          track: string | null
          updated_at: string
          weekly_topic: string | null
        }
        Insert: {
          class_location?: string | null
          class_name?: string | null
          course_id?: string | null
          course_name?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          slot_time: string
          sort_order?: number
          student_count?: number
          teacher_name?: string | null
          track?: string | null
          updated_at?: string
          weekly_topic?: string | null
        }
        Update: {
          class_location?: string | null
          class_name?: string | null
          course_id?: string | null
          course_name?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          slot_time?: string
          sort_order?: number
          student_count?: number
          teacher_name?: string | null
          track?: string | null
          updated_at?: string
          weekly_topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sunday_class_schedule_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "sunday_school_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      sunday_school_checkins: {
        Row: {
          checkin_date: string
          contact: string | null
          course_id: string | null
          course_name: string | null
          created_at: string
          email: string | null
          id: string
          name: string
        }
        Insert: {
          checkin_date: string
          contact?: string | null
          course_id?: string | null
          course_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
        }
        Update: {
          checkin_date?: string
          contact?: string | null
          course_id?: string | null
          course_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "sunday_school_checkins_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "sunday_school_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      sunday_school_courses: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      sunday_school_teachers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      system_notifications: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          creator_name: string | null
          id: string
          is_active: boolean
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          created_by?: string | null
          creator_name?: string | null
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          creator_name?: string | null
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_module_analytics: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          service_area: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          service_area: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          service_area?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_notification_reads: {
        Row: {
          notification_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          notification_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          notification_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "system_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          last_messages_seen_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          last_messages_seen_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          last_messages_seen_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_presence: {
        Row: {
          display_name: string | null
          last_seen_at: string
          user_id: string
          worker_name: string | null
        }
        Insert: {
          display_name?: string | null
          last_seen_at?: string
          user_id: string
          worker_name?: string | null
        }
        Update: {
          display_name?: string | null
          last_seen_at?: string
          user_id?: string
          worker_name?: string | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string
          display_name: string | null
          is_disabled: boolean
          service_area: string | null
          service_project: string | null
          service_projects: string[]
          updated_at: string
          user_id: string
          worker_name: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          is_disabled?: boolean
          service_area?: string | null
          service_project?: string | null
          service_projects?: string[]
          updated_at?: string
          user_id: string
          worker_name?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          is_disabled?: boolean
          service_area?: string | null
          service_project?: string | null
          service_projects?: string[]
          updated_at?: string
          user_id?: string
          worker_name?: string | null
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
      worship_service_roles: {
        Row: {
          created_at: string
          host: string | null
          pianist: string | null
          preacher: string | null
          service_date: string
          song_leader: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          host?: string | null
          pianist?: string | null
          preacher?: string | null
          service_date: string
          song_leader?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          host?: string | null
          pianist?: string | null
          preacher?: string | null
          service_date?: string
          song_leader?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_analytics: {
        Args: { _area: string; _uid: string }
        Returns: boolean
      }
      expire_display_screen: { Args: { _slug: string }; Returns: undefined }
      get_service_area: { Args: { _uid: string }; Returns: string }
      get_table_columns_info: {
        Args: { _tables: string[] }
        Returns: {
          column_default: string
          column_name: string
          data_type: string
          is_nullable: string
          is_primary_key: boolean
          ordinal_position: number
          table_name: string
        }[]
      }
      get_table_policies_info: {
        Args: { _tables: string[] }
        Returns: {
          cmd: string
          policy_name: string
          qual: string
          roles: string
          table_name: string
          with_check: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_above: { Args: { _uid: string }; Returns: boolean }
      is_super_admin: { Args: { _uid: string }; Returns: boolean }
      touch_display_screen: { Args: { _slug: string }; Returns: undefined }
      worker_in_area: {
        Args: { _area: string; _uid: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "viewer" | "super_admin" | "worker"
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
      app_role: ["admin", "user", "viewer", "super_admin", "worker"],
    },
  },
} as const
