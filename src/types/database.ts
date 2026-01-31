export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
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
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          created_at: string
          updated_at: string
          digest_time: string
          timezone: string
          digest_enabled: boolean
          subscription_status: 'trial' | 'active' | 'canceled' | 'past_due'
          subscription_started_at: string | null
          subscription_ends_at: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_digest_sent: boolean
          total_posts_saved: number
          total_digests_sent: number
          instagram_username: string | null
          instagram_user_id: string | null
          onboarding_state: string | null
          last_post_received_at: string | null
          age_range: string | null
          gender: string | null
          city: string | null
          country: string | null
          occupation: string | null
        }
        Insert: {
          id: string
          email: string
          created_at?: string
          updated_at?: string
          digest_time?: string
          timezone?: string
          digest_enabled?: boolean
          subscription_status?: 'trial' | 'active' | 'canceled' | 'past_due'
          subscription_started_at?: string | null
          subscription_ends_at?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_digest_sent?: boolean
          total_posts_saved?: number
          total_digests_sent?: number
          instagram_username?: string | null
          instagram_user_id?: string | null
          onboarding_state?: string | null
          last_post_received_at?: string | null
          age_range?: string | null
          gender?: string | null
          city?: string | null
          country?: string | null
          occupation?: string | null
        }
        Update: {
          id?: string
          email?: string
          created_at?: string
          updated_at?: string
          digest_time?: string
          timezone?: string
          digest_enabled?: boolean
          subscription_status?: 'trial' | 'active' | 'canceled' | 'past_due'
          subscription_started_at?: string | null
          subscription_ends_at?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_digest_sent?: boolean
          total_posts_saved?: number
          total_digests_sent?: number
          instagram_username?: string | null
          instagram_user_id?: string | null
          onboarding_state?: string | null
          last_post_received_at?: string | null
          age_range?: string | null
          gender?: string | null
          city?: string | null
          country?: string | null
          occupation?: string | null
        }
        Relationships: []
      }
      saved_posts: {
        Row: {
          id: string
          user_id: string
          instagram_post_id: string | null
          instagram_url: string
          post_type: string | null
          caption: string | null
          author_username: string | null
          author_profile_url: string | null
          media_urls: Json | null
          thumbnail_url: string | null
          posted_at: string | null
          saved_at: string
          processed: boolean
          processed_at: string | null
          categories: string[]
          tags: string[]
          sentiment: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          instagram_post_id?: string | null
          instagram_url: string
          post_type?: string | null
          caption?: string | null
          author_username?: string | null
          author_profile_url?: string | null
          media_urls?: Json | null
          thumbnail_url?: string | null
          posted_at?: string | null
          saved_at?: string
          processed?: boolean
          processed_at?: string | null
          categories?: string[]
          tags?: string[]
          sentiment?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          instagram_post_id?: string | null
          instagram_url?: string
          post_type?: string | null
          caption?: string | null
          author_username?: string | null
          author_profile_url?: string | null
          media_urls?: Json | null
          thumbnail_url?: string | null
          posted_at?: string | null
          saved_at?: string
          processed?: boolean
          processed_at?: string | null
          categories?: string[]
          tags?: string[]
          sentiment?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'saved_posts_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      digests: {
        Row: {
          id: string
          user_id: string
          subject: string | null
          html_content: string | null
          summary: string | null
          post_ids: string[] | null
          post_count: number
          ai_tokens_used: number | null
          ai_cost_usd: string | null
          sent_at: string
          resend_email_id: string | null
          opened_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          subject?: string | null
          html_content?: string | null
          summary?: string | null
          post_ids?: string[] | null
          post_count?: number
          ai_tokens_used?: number | null
          ai_cost_usd?: string | null
          sent_at?: string
          resend_email_id?: string | null
          opened_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          subject?: string | null
          html_content?: string | null
          summary?: string | null
          post_ids?: string[] | null
          post_count?: number
          ai_tokens_used?: number | null
          ai_cost_usd?: string | null
          sent_at?: string
          resend_email_id?: string | null
          opened_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'digests_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      subscription_events: {
        Row: {
          id: string
          user_id: string
          event_type: string
          stripe_event_id: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          event_type: string
          stripe_event_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          event_type?: string
          stripe_event_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'subscription_events_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      digest_clicks: {
        Row: {
          id: string
          digest_id: string
          user_id: string
          post_id: string | null
          clicked_at: string
        }
        Insert: {
          id?: string
          digest_id: string
          user_id: string
          post_id?: string | null
          clicked_at?: string
        }
        Update: {
          id?: string
          digest_id?: string
          user_id?: string
          post_id?: string | null
          clicked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'digest_clicks_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      user_interest_profiles: {
        Row: {
          id: string
          user_id: string
          interests: Json
          top_tags: string[]
          content_format_preference: string | null
          avg_posts_per_week: string
          email_open_rate: string
          email_click_rate: string
          engagement_score: string
          posts_analyzed: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          interests?: Json
          top_tags?: string[]
          content_format_preference?: string | null
          avg_posts_per_week?: string
          email_open_rate?: string
          email_click_rate?: string
          engagement_score?: string
          posts_analyzed?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          interests?: Json
          top_tags?: string[]
          content_format_preference?: string | null
          avg_posts_per_week?: string
          email_open_rate?: string
          email_click_rate?: string
          engagement_score?: string
          posts_analyzed?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_interest_profiles_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      ad_campaigns: {
        Row: {
          id: string
          advertiser_name: string
          target_categories: string[]
          target_age_ranges: string[]
          target_genders: string[]
          target_countries: string[]
          budget_cents: number
          spent_cents: number
          pricing_model: string
          rate_cents: number
          image_url: string | null
          headline: string | null
          body_text: string | null
          cta_url: string
          active: boolean
          starts_at: string | null
          ends_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          advertiser_name: string
          target_categories?: string[]
          target_age_ranges?: string[]
          target_genders?: string[]
          target_countries?: string[]
          budget_cents: number
          spent_cents?: number
          pricing_model: string
          rate_cents: number
          image_url?: string | null
          headline?: string | null
          body_text?: string | null
          cta_url: string
          active?: boolean
          starts_at?: string | null
          ends_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          advertiser_name?: string
          target_categories?: string[]
          target_age_ranges?: string[]
          target_genders?: string[]
          target_countries?: string[]
          budget_cents?: number
          spent_cents?: number
          pricing_model?: string
          rate_cents?: number
          image_url?: string | null
          headline?: string | null
          body_text?: string | null
          cta_url?: string
          active?: boolean
          starts_at?: string | null
          ends_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      ad_impressions: {
        Row: {
          id: string
          campaign_id: string
          user_id: string
          digest_id: string | null
          shown_at: string
          clicked_at: string | null
        }
        Insert: {
          id?: string
          campaign_id: string
          user_id: string
          digest_id?: string | null
          shown_at?: string
          clicked_at?: string | null
        }
        Update: {
          id?: string
          campaign_id?: string
          user_id?: string
          digest_id?: string | null
          shown_at?: string
          clicked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'ad_impressions_campaign_id_fkey'
            columns: ['campaign_id']
            isOneToOne: false
            referencedRelation: 'ad_campaigns'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ad_impressions_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
    }
  }
}

export type User = Database['public']['Tables']['users']['Row']
export type SavedPost = Database['public']['Tables']['saved_posts']['Row']
export type Digest = Database['public']['Tables']['digests']['Row']
export type SubscriptionEvent = Database['public']['Tables']['subscription_events']['Row']
export type DigestClick = Database['public']['Tables']['digest_clicks']['Row']
export type UserInterestProfile = Database['public']['Tables']['user_interest_profiles']['Row']
export type AdCampaign = Database['public']['Tables']['ad_campaigns']['Row']
export type AdImpression = Database['public']['Tables']['ad_impressions']['Row']
