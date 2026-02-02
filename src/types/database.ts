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
          password_set_at: string | null
          digest_name: string | null
          digest_description: string | null
          follow_slug: string | null
          sharing_enabled: boolean
          follower_count: number
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
          password_set_at?: string | null
          digest_name?: string | null
          digest_description?: string | null
          follow_slug?: string | null
          sharing_enabled?: boolean
          follower_count?: number
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
          password_set_at?: string | null
          digest_name?: string | null
          digest_description?: string | null
          follow_slug?: string | null
          sharing_enabled?: boolean
          follower_count?: number
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
          sent_to_followers_count: number
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
          sent_to_followers_count?: number
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
          sent_to_followers_count?: number
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
      digest_recipients: {
        Row: {
          id: string
          user_id: string
          email: string
          name: string | null
          confirmed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          email: string
          name?: string | null
          confirmed?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          email?: string
          name?: string | null
          confirmed?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'digest_recipients_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      digest_followers: {
        Row: {
          id: string
          user_id: string
          email: string
          source: 'manual' | 'link' | 'forwarded'
          confirmed: boolean
          confirmation_token: string
          unsubscribe_token: string
          note: string | null
          created_at: string
          confirmed_at: string | null
          unsubscribed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          email: string
          source?: 'manual' | 'link' | 'forwarded'
          confirmed?: boolean
          confirmation_token?: string
          unsubscribe_token?: string
          note?: string | null
          created_at?: string
          confirmed_at?: string | null
          unsubscribed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          email?: string
          source?: 'manual' | 'link' | 'forwarded'
          confirmed?: boolean
          confirmation_token?: string
          unsubscribe_token?: string
          note?: string | null
          created_at?: string
          confirmed_at?: string | null
          unsubscribed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'digest_followers_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      digest_sends: {
        Row: {
          id: string
          digest_id: string
          recipient_email: string
          recipient_type: 'owner' | 'follower'
          resend_email_id: string | null
          sent_at: string
          opened_at: string | null
        }
        Insert: {
          id?: string
          digest_id: string
          recipient_email: string
          recipient_type?: 'owner' | 'follower'
          resend_email_id?: string | null
          sent_at?: string
          opened_at?: string | null
        }
        Update: {
          id?: string
          digest_id?: string
          recipient_email?: string
          recipient_type?: 'owner' | 'follower'
          resend_email_id?: string | null
          sent_at?: string
          opened_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'digest_sends_digest_id_fkey'
            columns: ['digest_id']
            isOneToOne: false
            referencedRelation: 'digests'
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
export type DigestRecipient = Database['public']['Tables']['digest_recipients']['Row']
export type DigestFollower = Database['public']['Tables']['digest_followers']['Row']
export type DigestSend = Database['public']['Tables']['digest_sends']['Row']
