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
      activities: {
        Row: {
          business_id: string
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          business_id: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          bounce_alert_rate: number
          created_at: string
          default_compliance_address: string | null
          default_sender_account_id: string | null
          default_sender_company: string | null
          default_sender_name: string | null
          global_daily_cap: number
          id: number
          mock_mode: boolean
          updated_at: string
        }
        Insert: {
          bounce_alert_rate?: number
          created_at?: string
          default_compliance_address?: string | null
          default_sender_account_id?: string | null
          default_sender_company?: string | null
          default_sender_name?: string | null
          global_daily_cap?: number
          id?: number
          mock_mode?: boolean
          updated_at?: string
        }
        Update: {
          bounce_alert_rate?: number
          created_at?: string
          default_compliance_address?: string | null
          default_sender_account_id?: string | null
          default_sender_company?: string | null
          default_sender_name?: string | null
          global_daily_cap?: number
          id?: number
          mock_mode?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_default_sender_account_id_fkey"
            columns: ["default_sender_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address: string | null
          assigned_to: string | null
          business_category: string | null
          category_id: string | null
          city: string | null
          cleanup_status: string
          closing_time: string | null
          created_at: string
          deal_value_estimate: number | null
          do_not_contact: boolean
          email: string | null
          gmaps_url: string | null
          id: string
          image_url: string | null
          import_id: string | null
          imported_date: string
          last_activity_at: string | null
          last_contacted_at: string | null
          last_emailed_at: string | null
          merged_from: Json
          name: string | null
          next_action: string | null
          next_action_date: string | null
          notes: string | null
          opening_status: string | null
          phone: string | null
          pipeline_notes: string | null
          pipeline_stage: string | null
          priority: string
          rating: number | null
          rating_label: string | null
          raw_data: Json | null
          reply_outcome: string | null
          review_count: number | null
          review_snippet: string | null
          source_file: string | null
          state: string | null
          status: string
          unsubscribed_at: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          address?: string | null
          assigned_to?: string | null
          business_category?: string | null
          category_id?: string | null
          city?: string | null
          cleanup_status?: string
          closing_time?: string | null
          created_at?: string
          deal_value_estimate?: number | null
          do_not_contact?: boolean
          email?: string | null
          gmaps_url?: string | null
          id?: string
          image_url?: string | null
          import_id?: string | null
          imported_date?: string
          last_activity_at?: string | null
          last_contacted_at?: string | null
          last_emailed_at?: string | null
          merged_from?: Json
          name?: string | null
          next_action?: string | null
          next_action_date?: string | null
          notes?: string | null
          opening_status?: string | null
          phone?: string | null
          pipeline_notes?: string | null
          pipeline_stage?: string | null
          priority?: string
          rating?: number | null
          rating_label?: string | null
          raw_data?: Json | null
          reply_outcome?: string | null
          review_count?: number | null
          review_snippet?: string | null
          source_file?: string | null
          state?: string | null
          status?: string
          unsubscribed_at?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          address?: string | null
          assigned_to?: string | null
          business_category?: string | null
          category_id?: string | null
          city?: string | null
          cleanup_status?: string
          closing_time?: string | null
          created_at?: string
          deal_value_estimate?: number | null
          do_not_contact?: boolean
          email?: string | null
          gmaps_url?: string | null
          id?: string
          image_url?: string | null
          import_id?: string | null
          imported_date?: string
          last_activity_at?: string | null
          last_contacted_at?: string | null
          last_emailed_at?: string | null
          merged_from?: Json
          name?: string | null
          next_action?: string | null
          next_action_date?: string | null
          notes?: string | null
          opening_status?: string | null
          phone?: string | null
          pipeline_notes?: string | null
          pipeline_stage?: string | null
          priority?: string
          rating?: number | null
          rating_label?: string | null
          raw_data?: Json | null
          reply_outcome?: string | null
          review_count?: number | null
          review_snippet?: string | null
          source_file?: string | null
          state?: string | null
          status?: string
          unsubscribed_at?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "businesses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "businesses_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "imports"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_leads: {
        Row: {
          bounced_at: string | null
          business_id: string
          campaign_id: string
          created_at: string
          current_step: number
          id: string
          last_email_sent_at: string | null
          next_email_scheduled_at: string | null
          readiness_status: string
          replied_at: string | null
          reply_outcome: string | null
          skip_reason: string | null
          skipped_at: string | null
          status: string
          unsubscribe_token: string | null
          unsubscribed_at: string | null
          updated_at: string
        }
        Insert: {
          bounced_at?: string | null
          business_id: string
          campaign_id: string
          created_at?: string
          current_step?: number
          id?: string
          last_email_sent_at?: string | null
          next_email_scheduled_at?: string | null
          readiness_status?: string
          replied_at?: string | null
          reply_outcome?: string | null
          skip_reason?: string | null
          skipped_at?: string | null
          status?: string
          unsubscribe_token?: string | null
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          bounced_at?: string | null
          business_id?: string
          campaign_id?: string
          created_at?: string
          current_step?: number
          id?: string
          last_email_sent_at?: string | null
          next_email_scheduled_at?: string | null
          readiness_status?: string
          replied_at?: string | null
          reply_outcome?: string | null
          skip_reason?: string | null
          skipped_at?: string | null
          status?: string
          unsubscribe_token?: string | null
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_leads_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_sequence_steps: {
        Row: {
          body_html: string | null
          body_text: string
          campaign_id: string
          created_at: string
          delay_days: number
          id: string
          name: string
          send_condition: Json
          step_number: number
          subject: string
          updated_at: string
        }
        Insert: {
          body_html?: string | null
          body_text?: string
          campaign_id: string
          created_at?: string
          delay_days?: number
          id?: string
          name?: string
          send_condition?: Json
          step_number?: number
          subject?: string
          updated_at?: string
        }
        Update: {
          body_html?: string | null
          body_text?: string
          campaign_id?: string
          created_at?: string
          delay_days?: number
          id?: string
          name?: string
          send_condition?: Json
          step_number?: number
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_sequence_steps_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          audience_config: Json
          audience_type: string
          bounced_count: number
          click_count: number
          compliance_address: string | null
          created_at: string
          daily_limit: number
          delay_seconds_max: number
          delay_seconds_min: number
          email_type: string
          excluded_count: number
          failed_count: number
          goal: string | null
          hourly_limit: number
          id: string
          last_activity_at: string | null
          name: string
          open_count: number
          replied_count: number
          reply_to_email: string | null
          scheduled_at: string | null
          send_days: string[]
          send_mode: string
          send_window_end: string
          send_window_start: string
          sendable_count: number
          sender_account_id: string | null
          sender_company: string | null
          sender_name: string | null
          sent_count: number
          skip_suppressed_domains: boolean
          skip_unsubscribed: boolean
          status: string
          stop_after_reply: boolean
          stop_on_bounce_rate: number
          timezone: string
          total_leads: number
          unsubscribe_enabled: boolean
          unsubscribed_count: number
          updated_at: string
        }
        Insert: {
          audience_config?: Json
          audience_type?: string
          bounced_count?: number
          click_count?: number
          compliance_address?: string | null
          created_at?: string
          daily_limit?: number
          delay_seconds_max?: number
          delay_seconds_min?: number
          email_type?: string
          excluded_count?: number
          failed_count?: number
          goal?: string | null
          hourly_limit?: number
          id?: string
          last_activity_at?: string | null
          name: string
          open_count?: number
          replied_count?: number
          reply_to_email?: string | null
          scheduled_at?: string | null
          send_days?: string[]
          send_mode?: string
          send_window_end?: string
          send_window_start?: string
          sendable_count?: number
          sender_account_id?: string | null
          sender_company?: string | null
          sender_name?: string | null
          sent_count?: number
          skip_suppressed_domains?: boolean
          skip_unsubscribed?: boolean
          status?: string
          stop_after_reply?: boolean
          stop_on_bounce_rate?: number
          timezone?: string
          total_leads?: number
          unsubscribe_enabled?: boolean
          unsubscribed_count?: number
          updated_at?: string
        }
        Update: {
          audience_config?: Json
          audience_type?: string
          bounced_count?: number
          click_count?: number
          compliance_address?: string | null
          created_at?: string
          daily_limit?: number
          delay_seconds_max?: number
          delay_seconds_min?: number
          email_type?: string
          excluded_count?: number
          failed_count?: number
          goal?: string | null
          hourly_limit?: number
          id?: string
          last_activity_at?: string | null
          name?: string
          open_count?: number
          replied_count?: number
          reply_to_email?: string | null
          scheduled_at?: string | null
          send_days?: string[]
          send_mode?: string
          send_window_end?: string
          send_window_start?: string
          sendable_count?: number
          sender_account_id?: string | null
          sender_company?: string | null
          sender_name?: string | null
          sent_count?: number
          skip_suppressed_domains?: boolean
          skip_unsubscribed?: boolean
          status?: string
          stop_after_reply?: boolean
          stop_on_bounce_rate?: number
          timezone?: string
          total_leads?: number
          unsubscribe_enabled?: boolean
          unsubscribed_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_sender_account_id_fkey"
            columns: ["sender_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      email_accounts: {
        Row: {
          connection_status: string
          created_at: string
          daily_limit: number
          hourly_limit: number
          id: string
          is_enabled: boolean
          last_tested_at: string | null
          name: string
          provider: string
          reply_to_email: string | null
          sender_email: string
          sender_name: string
          smtp_host: string | null
          smtp_password_secret: string | null
          smtp_port: number | null
          smtp_username: string | null
          updated_at: string
        }
        Insert: {
          connection_status?: string
          created_at?: string
          daily_limit?: number
          hourly_limit?: number
          id?: string
          is_enabled?: boolean
          last_tested_at?: string | null
          name: string
          provider?: string
          reply_to_email?: string | null
          sender_email: string
          sender_name: string
          smtp_host?: string | null
          smtp_password_secret?: string | null
          smtp_port?: number | null
          smtp_username?: string | null
          updated_at?: string
        }
        Update: {
          connection_status?: string
          created_at?: string
          daily_limit?: number
          hourly_limit?: number
          id?: string
          is_enabled?: boolean
          last_tested_at?: string | null
          name?: string
          provider?: string
          reply_to_email?: string | null
          sender_email?: string
          sender_name?: string
          smtp_host?: string | null
          smtp_password_secret?: string | null
          smtp_port?: number | null
          smtp_username?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      email_events: {
        Row: {
          business_id: string | null
          campaign_id: string | null
          created_at: string
          email_job_id: string | null
          event_type: string
          id: string
          metadata: Json
        }
        Insert: {
          business_id?: string | null
          campaign_id?: string | null
          created_at?: string
          email_job_id?: string | null
          event_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          business_id?: string | null
          campaign_id?: string | null
          created_at?: string
          email_job_id?: string | null
          event_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "email_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_events_email_job_id_fkey"
            columns: ["email_job_id"]
            isOneToOne: false
            referencedRelation: "email_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      email_jobs: {
        Row: {
          body_html: string | null
          body_text: string
          bounced_at: string | null
          business_id: string | null
          campaign_id: string | null
          campaign_lead_id: string | null
          clicked_at: string | null
          created_at: string
          failed_at: string | null
          failure_reason: string | null
          id: string
          is_simulated: boolean
          opened_at: string | null
          recipient_email: string
          replied_at: string | null
          scheduled_at: string
          sender_account_id: string | null
          sent_at: string | null
          sequence_step_id: string | null
          status: string
          subject: string
          unsubscribe_token: string | null
          unsubscribed_at: string | null
          updated_at: string
        }
        Insert: {
          body_html?: string | null
          body_text?: string
          bounced_at?: string | null
          business_id?: string | null
          campaign_id?: string | null
          campaign_lead_id?: string | null
          clicked_at?: string | null
          created_at?: string
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          is_simulated?: boolean
          opened_at?: string | null
          recipient_email: string
          replied_at?: string | null
          scheduled_at?: string
          sender_account_id?: string | null
          sent_at?: string | null
          sequence_step_id?: string | null
          status?: string
          subject: string
          unsubscribe_token?: string | null
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          body_html?: string | null
          body_text?: string
          bounced_at?: string | null
          business_id?: string | null
          campaign_id?: string | null
          campaign_lead_id?: string | null
          clicked_at?: string | null
          created_at?: string
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          is_simulated?: boolean
          opened_at?: string | null
          recipient_email?: string
          replied_at?: string | null
          scheduled_at?: string
          sender_account_id?: string | null
          sent_at?: string | null
          sequence_step_id?: string | null
          status?: string
          subject?: string
          unsubscribe_token?: string | null
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_jobs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_jobs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_jobs_campaign_lead_id_fkey"
            columns: ["campaign_lead_id"]
            isOneToOne: false
            referencedRelation: "campaign_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_jobs_sender_account_id_fkey"
            columns: ["sender_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_jobs_sequence_step_id_fkey"
            columns: ["sequence_step_id"]
            isOneToOne: false
            referencedRelation: "campaign_sequence_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_html: string | null
          body_text: string
          channel: string
          created_at: string
          goal: string | null
          id: string
          name: string
          preview_text: string | null
          signature: string | null
          subject: string
          updated_at: string
        }
        Insert: {
          body_html?: string | null
          body_text?: string
          channel?: string
          created_at?: string
          goal?: string | null
          id?: string
          name: string
          preview_text?: string | null
          signature?: string | null
          subject: string
          updated_at?: string
        }
        Update: {
          body_html?: string | null
          body_text?: string
          channel?: string
          created_at?: string
          goal?: string | null
          id?: string
          name?: string
          preview_text?: string | null
          signature?: string | null
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      exports: {
        Row: {
          category_id: string | null
          created_at: string
          fields: Json
          filters_snapshot: Json | null
          format: string
          id: string
          name: string
          options: Json
          record_count: number
          segment_id: string | null
          source_type: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          fields?: Json
          filters_snapshot?: Json | null
          format?: string
          id?: string
          name: string
          options?: Json
          record_count?: number
          segment_id?: string | null
          source_type: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          fields?: Json
          filters_snapshot?: Json | null
          format?: string
          id?: string
          name?: string
          options?: Json
          record_count?: number
          segment_id?: string | null
          source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "exports_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exports_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "saved_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      external_records: {
        Row: {
          business_id: string
          created_at: string
          external_object_type: string
          external_record_id: string
          external_url: string | null
          id: string
          integration_id: string
          last_synced_at: string
          provider: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          external_object_type: string
          external_record_id: string
          external_url?: string | null
          id?: string
          integration_id: string
          last_synced_at?: string
          provider: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          external_object_type?: string
          external_record_id?: string
          external_url?: string | null
          id?: string
          integration_id?: string
          last_synced_at?: string
          provider?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_records_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_records_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      imports: {
        Row: {
          category_id: string | null
          created_at: string
          detected_columns: Json | null
          duplicate_mode: string
          duplicate_rows: number
          filename: string
          headers: Json | null
          id: string
          imported_rows: number
          mapping: Json | null
          mapping_template_id: string | null
          missing_required_rows: number
          row_count: number
          skipped_rows: number
          status: string
          template_match_score: number | null
          updated_at: string
          validation_report: Json | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          detected_columns?: Json | null
          duplicate_mode?: string
          duplicate_rows?: number
          filename: string
          headers?: Json | null
          id?: string
          imported_rows?: number
          mapping?: Json | null
          mapping_template_id?: string | null
          missing_required_rows?: number
          row_count?: number
          skipped_rows?: number
          status?: string
          template_match_score?: number | null
          updated_at?: string
          validation_report?: Json | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          detected_columns?: Json | null
          duplicate_mode?: string
          duplicate_rows?: number
          filename?: string
          headers?: Json | null
          id?: string
          imported_rows?: number
          mapping?: Json | null
          mapping_template_id?: string | null
          missing_required_rows?: number
          row_count?: number
          skipped_rows?: number
          status?: string
          template_match_score?: number | null
          updated_at?: string
          validation_report?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "imports_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_mappings: {
        Row: {
          created_at: string
          id: string
          integration_id: string
          is_required: boolean
          source_field: string
          target_field: string
          target_object: string
          transformation: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          integration_id: string
          is_required?: boolean
          source_field: string
          target_field: string
          target_object?: string
          transformation?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          integration_id?: string
          is_required?: boolean
          source_field?: string
          target_field?: string
          target_object?: string
          transformation?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_mappings_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          auth_type: string
          config: Json
          created_at: string
          id: string
          is_enabled: boolean
          last_error: string | null
          last_sync_at: string | null
          last_tested_at: string | null
          name: string
          provider: string
          secret_reference: string | null
          status: string
          updated_at: string
        }
        Insert: {
          auth_type?: string
          config?: Json
          created_at?: string
          id?: string
          is_enabled?: boolean
          last_error?: string | null
          last_sync_at?: string | null
          last_tested_at?: string | null
          name: string
          provider: string
          secret_reference?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          auth_type?: string
          config?: Json
          created_at?: string
          id?: string
          is_enabled?: boolean
          last_error?: string | null
          last_sync_at?: string | null
          last_tested_at?: string | null
          name?: string
          provider?: string
          secret_reference?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      mapping_templates: {
        Row: {
          confidence_summary: Json
          created_at: string
          fingerprints: Json
          id: string
          last_used_at: string | null
          name: string
          normalized_mapping: Json
          raw_headers: Json
          sample_values: Json | null
          updated_at: string
          use_count: number
        }
        Insert: {
          confidence_summary?: Json
          created_at?: string
          fingerprints?: Json
          id?: string
          last_used_at?: string | null
          name: string
          normalized_mapping?: Json
          raw_headers?: Json
          sample_values?: Json | null
          updated_at?: string
          use_count?: number
        }
        Update: {
          confidence_summary?: Json
          created_at?: string
          fingerprints?: Json
          id?: string
          last_used_at?: string | null
          name?: string
          normalized_mapping?: Json
          raw_headers?: Json
          sample_values?: Json | null
          updated_at?: string
          use_count?: number
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          is_hidden: boolean
          name: string
          order_index: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          is_hidden?: boolean
          name: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          is_hidden?: boolean
          name?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: []
      }
      saved_segments: {
        Row: {
          created_at: string
          filters: Json
          id: string
          last_exported_at: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          last_exported_at?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          last_exported_at?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppression_list: {
        Row: {
          business_id: string | null
          campaign_id: string | null
          created_at: string
          domain: string | null
          email: string | null
          id: string
          notes: string | null
          reason: string
          source: string | null
        }
        Insert: {
          business_id?: string | null
          campaign_id?: string | null
          created_at?: string
          domain?: string | null
          email?: string | null
          id?: string
          notes?: string | null
          reason?: string
          source?: string | null
        }
        Update: {
          business_id?: string | null
          campaign_id?: string | null
          created_at?: string
          domain?: string | null
          email?: string | null
          id?: string
          notes?: string | null
          reason?: string
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppression_list_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppression_list_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_events: {
        Row: {
          business_id: string | null
          created_at: string
          event_type: string
          id: string
          integration_id: string | null
          message: string | null
          metadata: Json
          sync_job_id: string | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          integration_id?: string | null
          message?: string | null
          metadata?: Json
          sync_job_id?: string | null
        }
        Update: {
          business_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          integration_id?: string | null
          message?: string | null
          metadata?: Json
          sync_job_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_events_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_events_sync_job_id_fkey"
            columns: ["sync_job_id"]
            isOneToOne: false
            referencedRelation: "sync_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_jobs: {
        Row: {
          action: string
          business_id: string | null
          campaign_id: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          integration_id: string
          payload: Json
          response: Json | null
          retry_count: number
          scheduled_at: string
          status: string
          status_code: number | null
          target_object: string
          updated_at: string
        }
        Insert: {
          action?: string
          business_id?: string | null
          campaign_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          integration_id: string
          payload?: Json
          response?: Json | null
          retry_count?: number
          scheduled_at?: string
          status?: string
          status_code?: number | null
          target_object?: string
          updated_at?: string
        }
        Update: {
          action?: string
          business_id?: string | null
          campaign_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          integration_id?: string
          payload?: Json
          response?: Json | null
          retry_count?: number
          scheduled_at?: string
          status?: string
          status_code?: number | null
          target_object?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_jobs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_jobs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_jobs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_rules: {
        Row: {
          audience_config: Json
          create_or_update_behavior: string
          created_at: string
          id: string
          integration_id: string
          is_enabled: boolean
          name: string
          sync_direction: string
          trigger_type: string
          updated_at: string
        }
        Insert: {
          audience_config?: Json
          create_or_update_behavior?: string
          created_at?: string
          id?: string
          integration_id: string
          is_enabled?: boolean
          name: string
          sync_direction?: string
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          audience_config?: Json
          create_or_update_behavior?: string
          created_at?: string
          id?: string
          integration_id?: string
          is_enabled?: boolean
          name?: string
          sync_direction?: string
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_rules_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          business_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          business_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
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
