export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          username: string
          full_name: string
          bio: string | null
          avatar_url: string | null
          banner_url: string | null
          created_at: string
          updated_at: string
          followers_count: number
          following_count: number
          posts_count: number
          is_private: boolean
        }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'created_at' | 'updated_at' | 'followers_count' | 'following_count' | 'posts_count'>
        Update: Partial<Database['public']['Tables']['users']['Insert']>
      }
      posts: {
        Row: {
          id: string
          user_id: string
          caption: string | null
          media_url: string | null
          media_type: 'image' | 'video' | null
          post_type: 'workout' | 'nutrition' | 'wellness' | 'achievement' | 'general'
          location: string | null
          likes_count: number
          comments_count: number
          is_public: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['posts']['Row'], 'id' | 'likes_count' | 'comments_count' | 'created_at'>
        Update: Partial<Database['public']['Tables']['posts']['Insert']>
      }
      activity_logs: {
        Row: {
          id: string
          user_id: string
          log_type: 'workout' | 'nutrition' | 'wellness'
          is_public: boolean
          logged_at: string
          created_at: string
          // Workout fields
          workout_type: string | null
          workout_duration_min: number | null
          workout_calories: number | null
          exercises: Json | null
          cardio: Json | null
          // Nutrition fields
          meal_type: string | null
          food_items: Json | null
          calories_total: number | null
          protein_g: number | null
          carbs_g: number | null
          fat_g: number | null
          water_oz: number | null
          // Wellness fields
          wellness_type: string | null
          wellness_duration_min: number | null
          mood: string | null
          // Shared
          notes: string | null
          photo_url: string | null
        }
        Insert: Omit<Database['public']['Tables']['activity_logs']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['activity_logs']['Insert']>
      }
      follows: {
        Row: {
          follower_id: string
          following_id: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['follows']['Row'], 'created_at'>
        Update: never
      }
      likes: {
        Row: {
          id: string
          user_id: string
          post_id: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['likes']['Row'], 'id' | 'created_at'>
        Update: never
      }
      comments: {
        Row: {
          id: string
          user_id: string
          post_id: string
          content: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['comments']['Row'], 'id' | 'created_at'>
        Update: Partial<Pick<Database['public']['Tables']['comments']['Row'], 'content'>>
      }
      badges: {
        Row: {
          id: string
          user_id: string
          badge_id: string
          earned_at: string
          note: string | null
        }
        Insert: Omit<Database['public']['Tables']['badges']['Row'], 'id' | 'earned_at'>
        Update: never
      }
      groups: {
        Row: {
          id: string
          name: string
          description: string | null
          category: string
          is_local: boolean
          city: string | null
          creator_id: string
          members_count: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['groups']['Row'], 'id' | 'members_count' | 'created_at'>
        Update: Partial<Database['public']['Tables']['groups']['Insert']>
      }
      group_members: {
        Row: {
          group_id: string
          user_id: string
          role: 'member' | 'moderator' | 'owner'
          joined_at: string
        }
        Insert: Omit<Database['public']['Tables']['group_members']['Row'], 'joined_at'>
        Update: Partial<Pick<Database['public']['Tables']['group_members']['Row'], 'role'>>
      }
      // Analytics tables
      analytics_events: {
        Row: {
          id: string
          user_id: string | null
          event_type: string
          event_data: Json | null
          session_id: string | null
          platform: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['analytics_events']['Row'], 'id' | 'created_at'>
        Update: never
      }
      analytics_sessions: {
        Row: {
          id: string
          user_id: string
          started_at: string
          ended_at: string | null
          duration_sec: number | null
          platform: string | null
          pages_visited: number
        }
        Insert: Omit<Database['public']['Tables']['analytics_sessions']['Row'], 'started_at'>
        Update: Partial<Pick<Database['public']['Tables']['analytics_sessions']['Row'], 'ended_at' | 'duration_sec' | 'pages_visited'>>
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}
