export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id:           string
          full_name:    string | null
          display_name: string | null   // editable public name (profile page)
          email:        string
          avatar_url:   string | null
          plan:         'free' | 'pro'
          created_at:   string
          updated_at:   string
        }
        Insert: {
          id:            string
          full_name?:    string | null
          display_name?: string | null
          email:         string
          avatar_url?:   string | null
          plan?:         'free' | 'pro'
        }
        Update: {
          full_name?:    string | null
          display_name?: string | null
          avatar_url?:   string | null
          plan?:         'free' | 'pro'
          updated_at?:   string
        }
      }

      emergency_contacts: {
        Row: {
          id:         string
          user_id:    string
          name:       string
          phone:      string
          relation:   string
          created_at: string
        }
        Insert: {
          user_id:  string
          name:     string
          phone:    string
          relation: string
        }
        Update: {
          name?:     string
          phone?:    string
          relation?: string
        }
      }

      user_preferences: {
        Row: {
          id:               string
          user_id:          string
          primary_language: 'en' | 'lg'
          voice_gender:     'male' | 'female' | 'robot'
          pitch:            number
          reading_rate:     number
          sign_language:    boolean
          speech_assist:    boolean
          tts_enabled:      boolean
          output_mode:      'audio' | 'visual' | 'both'
          created_at:       string
        }
        Insert: {
          user_id:           string
          primary_language?: 'en' | 'lg'
          voice_gender?:     'male' | 'female' | 'robot'
          pitch?:            number
          reading_rate?:     number
          sign_language?:    boolean
          speech_assist?:    boolean
          tts_enabled?:      boolean
          output_mode?:      'audio' | 'visual' | 'both'
        }
        Update: {
          primary_language?: 'en' | 'lg'
          voice_gender?:     'male' | 'female' | 'robot'
          pitch?:            number
          reading_rate?:     number
          sign_language?:    boolean
          speech_assist?:    boolean
          tts_enabled?:      boolean
          output_mode?:      'audio' | 'visual' | 'both'
        }
      }

      saved_phrases: {
        Row: {
          id:         string
          user_id:    string
          phrase:     string
          language:   string
          category:   'navigation' | 'emergency' | 'custom' | null
          created_at: string
        }
        Insert: {
          user_id:   string
          phrase:    string
          language?: string
          category?: 'navigation' | 'emergency' | 'custom' | null
        }
        Update: {
          phrase?:   string
          language?: string
          category?: 'navigation' | 'emergency' | 'custom' | null
        }
      }

      transcription_history: {
        Row: {
          id:         string
          user_id:    string
          transcript: string
          language:   string
          confidence: number | null
          audio_url:  string | null
          model_used: 'whisper' | 'wav2vec2' | 'mms' | null
          created_at: string
        }
        Insert: {
          user_id:     string
          transcript:  string
          language:    string
          confidence?: number | null
          audio_url?:  string | null
          model_used?: 'whisper' | 'wav2vec2' | 'mms' | null
        }
        Update: {
          transcript?: string
        }
      }
    }

    Views:     { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums:     { [_ in never]: never }
  }
}

// Convenience type aliases
export type Profile            = Database['public']['Tables']['profiles']['Row']
export type EmergencyContact   = Database['public']['Tables']['emergency_contacts']['Row']
export type UserPreferences    = Database['public']['Tables']['user_preferences']['Row']
export type SavedPhrase        = Database['public']['Tables']['saved_phrases']['Row']
export type TranscriptionEntry = Database['public']['Tables']['transcription_history']['Row']