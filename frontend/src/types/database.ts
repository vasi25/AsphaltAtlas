export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type Difficulty = 'easy' | 'moderate' | 'hard' | 'extreme'
export type Surface = 'paved' | 'gravel' | 'dirt' | 'mixed'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          full_name: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username: string
          full_name?: string | null
          avatar_url?: string | null
          bio?: string | null
        }
        Update: {
          username?: string
          full_name?: string | null
          avatar_url?: string | null
          bio?: string | null
        }
      }
      countries: {
        Row: {
          id: number
          name: string
          code: string
        }
        Insert: {
          name: string
          code: string
        }
        Update: {
          name?: string
          code?: string
        }
      }
      regions: {
        Row: {
          id: number
          name: string
          country_id: number
        }
        Insert: {
          name: string
          country_id: number
        }
        Update: {
          name?: string
          country_id?: number
        }
      }
      categories: {
        Row: {
          id: number
          name: string
          description: string | null
          icon: string | null
        }
        Insert: {
          name: string
          description?: string | null
          icon?: string | null
        }
        Update: {
          name?: string
          description?: string | null
          icon?: string | null
        }
      }
      routes: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          country_id: number | null
          region_id: number | null
          distance_km: number | null
          duration_minutes: number | null
          difficulty: Difficulty | null
          surface: Surface | null
          tips: string | null
          is_published: boolean
          avg_rating: number
          review_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          title: string
          description?: string | null
          country_id?: number | null
          region_id?: number | null
          distance_km?: number | null
          duration_minutes?: number | null
          difficulty?: Difficulty | null
          surface?: Surface | null
          tips?: string | null
          is_published?: boolean
        }
        Update: {
          title?: string
          description?: string | null
          country_id?: number | null
          region_id?: number | null
          distance_km?: number | null
          duration_minutes?: number | null
          difficulty?: Difficulty | null
          surface?: Surface | null
          tips?: string | null
          is_published?: boolean
        }
      }
      route_geometry: {
        Row: {
          id: string
          route_id: string
          geom: unknown         // PostGIS geometry, handled as GeoJSON on the client
          start_point: unknown
          end_point: unknown
        }
        Insert: {
          route_id: string
          geom: unknown
        }
        Update: {
          geom?: unknown
        }
      }
      photos: {
        Row: {
          id: string
          route_id: string
          user_id: string
          storage_path: string
          url: string
          caption: string | null
          is_cover: boolean
          order_index: number
          created_at: string
        }
        Insert: {
          route_id: string
          user_id: string
          storage_path: string
          url: string
          caption?: string | null
          is_cover?: boolean
          order_index?: number
        }
        Update: {
          caption?: string | null
          is_cover?: boolean
          order_index?: number
        }
      }
      reviews: {
        Row: {
          id: string
          route_id: string
          user_id: string
          rating: number
          comment: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          route_id: string
          user_id: string
          rating: number
          comment?: string | null
        }
        Update: {
          rating?: number
          comment?: string | null
        }
      }
      favourites: {
        Row: {
          user_id: string
          route_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          route_id: string
        }
        Update: Record<string, never>
      }
      route_categories: {
        Row: {
          route_id: string
          category_id: number
        }
        Insert: {
          route_id: string
          category_id: number
        }
        Update: Record<string, never>
      }
    }
  }
}

// Convenience types for use throughout the app
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Country = Database['public']['Tables']['countries']['Row']
export type Region = Database['public']['Tables']['regions']['Row']
export type Category = Database['public']['Tables']['categories']['Row']
export type Route = Database['public']['Tables']['routes']['Row']
export type RouteGeometry = Database['public']['Tables']['route_geometry']['Row']
export type Photo = Database['public']['Tables']['photos']['Row']
export type Review = Database['public']['Tables']['reviews']['Row']
export type Favourite = Database['public']['Tables']['favourites']['Row']
