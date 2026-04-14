import { createClient } from '@/lib/supabase'
import type { VoxelUser, initials as _initials } from '@/lib/store/authStore'
import type { AppPreferences } from '@/types'
import type { Profile, UserPreferences } from '@/types/database'

function getClient() {
  return createClient()
}

function makeInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function signIn(email: string, password: string) {
  const supabase = getClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
}

export async function signUp(email: string, password: string, fullName: string) {
  const supabase = getClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  })
  if (error) throw new Error(error.message)
}

export async function signOut() {
  const supabase = getClient()
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error(error.message)
}

// ── Profile ───────────────────────────────────────────────────────────────────

export async function getProfile(userId: string): Promise<VoxelUser | null> {
  const supabase = getClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error || !data) return null

  const profile  = data as Profile
  const fullName = profile.full_name ?? ''
  const displayName = profile.display_name ?? fullName

  return {
    id:          profile.id,
    email:       profile.email,
    fullName,
    displayName,
    initials:    makeInitials(displayName || fullName || profile.email),
    avatarUrl:   profile.avatar_url ?? null,
    plan:        profile.plan ?? 'free',
    joinedAt:    profile.created_at,
  }
}

export async function updateProfile(
  userId: string,
  updates: { fullName?: string; avatarUrl?: string },
) {
  const supabase = getClient()
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name:  updates.fullName,
      avatar_url: updates.avatarUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
  if (error) throw new Error(error.message)
}

// ── Preferences ───────────────────────────────────────────────────────────────

export async function getPreferences(userId: string): Promise<AppPreferences | null> {
  const supabase = getClient()
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error || !data) return null

  const p = data as UserPreferences
  return {
    primaryLanguage: p.primary_language,
    voiceGender:     p.voice_gender,
    pitch:           p.pitch,
    readingRate:     p.reading_rate,
    signLanguage:    p.sign_language,
    speechAssist:    p.speech_assist,
    ttsEnabled:      p.tts_enabled,
    outputMode:      p.output_mode,
  }
}

export async function upsertPreferences(
  userId: string,
  prefs: Partial<AppPreferences>,
) {
  const supabase = getClient()
  const { error } = await supabase.from('user_preferences').upsert({
    user_id:          userId,
    primary_language: prefs.primaryLanguage,
    voice_gender:     prefs.voiceGender,
    pitch:            prefs.pitch,
    reading_rate:     prefs.readingRate,
    sign_language:    prefs.signLanguage,
    speech_assist:    prefs.speechAssist,
    tts_enabled:      prefs.ttsEnabled,
    output_mode:      prefs.outputMode,
  })
  if (error) throw new Error(error.message)
}

// ── Preferences ───────────────────────────────────────────────────────────────

export async function getPreferences(userId: string): Promise<AppPreferences | null> {
  const supabase = getClient()
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error || !data) return null

  const p = data as UserPreferences
  return {
    primaryLanguage: p.primary_language,
    voiceGender:     p.voice_gender,
    pitch:           p.pitch,
    readingRate:     p.reading_rate,
    signLanguage:    p.sign_language,
    speechAssist:    p.speech_assist,
    ttsEnabled:      p.tts_enabled,
    outputMode:      p.output_mode,
  }
}

export async function upsertPreferences(
  userId: string,
  prefs: Partial<AppPreferences>,
) {
  const supabase = getClient()
  const { error } = await supabase.from('user_preferences').upsert({
    user_id:          userId,
    primary_language: prefs.primaryLanguage,
    voice_gender:     prefs.voiceGender,
    pitch:            prefs.pitch,
    reading_rate:     prefs.readingRate,
    sign_language:    prefs.signLanguage,
    speech_assist:    prefs.speechAssist,
    tts_enabled:      prefs.ttsEnabled,
    output_mode:      prefs.outputMode,
  })
  if (error) throw new Error(error.message)
}