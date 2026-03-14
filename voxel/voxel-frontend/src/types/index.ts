// ─── API Response types ───────────────────────────────────────────────────────

export interface ASRResponse {
  transcript:     string   // raw ASR output
  clean_text:     string   // LLM-reconstructed text
  language:       string   // detected language: 'en' | 'lg'
  confidence:     number   // 0.0 – 1.0
  model_used:     'wav2vec2' | 'mms'
  processing_ms:  number
}

export interface TTSResponse {
  audio_base64:   string   // base64-encoded WAV
  duration_ms:    number
  voice:          string
  text:           string
}

export interface TranslationResponse {
  source_text:    string
  translated:     string
  source_lang:    string
  target_lang:    string
  model_used:     string
}

export interface PipelineResponse {
  raw_transcript: string
  clean_text:     string
  language:       string
  confidence:     number
  audio_base64?:  string   // present if output_mode includes audio
  duration_ms?:   number
  pipeline_ms:    number
}

// ─── App state types ──────────────────────────────────────────────────────────

export type Language   = 'en' | 'lg'
export type VoiceGender = 'male' | 'female' | 'robot'
export type OutputMode = 'audio' | 'visual' | 'both'

export type RecordingState =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'done'
  | 'error'

export type PipelineStep =
  | 'audio_cleanup'
  | 'asr'
  | 'text_reconstruction'
  | 'translation'
  | 'tts'

export interface PipelineStepStatus {
  id:     PipelineStep
  label:  string
  state:  'pending' | 'active' | 'done' | 'error'
}

// ─── User / preferences ───────────────────────────────────────────────────────

export interface AppUser {
  id:        string
  email:     string
  fullName:  string
  avatarUrl: string | null
  plan:      'free' | 'pro'
}

export interface AppPreferences {
  primaryLanguage: Language
  voiceGender:     VoiceGender
  pitch:           number   // 0–100
  readingRate:     number   // 0–100
  signLanguage:    boolean
  speechAssist:    boolean
  ttsEnabled:      boolean
  outputMode:      OutputMode
}

// ─── Saved phrases ────────────────────────────────────────────────────────────

export interface SavedPhraseItem {
  id:       string
  phrase:   string
  language: Language
  category: 'navigation' | 'emergency' | 'custom'
}

// ─── API error ────────────────────────────────────────────────────────────────

export interface ApiError {
  detail:   string
  status:   number
}
