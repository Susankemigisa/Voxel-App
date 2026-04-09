import { createClient } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store/authStore'
import type { AppUser } from '@/types'

// Singleton — defined once at module level, shared by all functions in this file
const supabase = createClient()

export async function signUp(email: string, password: string, fullName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  })
  if (error) throw error
  return data
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error

  const store = useAuthStore.getState()
  store.setToken(data.session?.access_token ?? null)
  store.setUser({
    id:        data.user.id,
    email:     data.user.email!,
    fullName:  data.user.user_metadata?.full_name ?? '',
    avatarUrl: data.user.user_metadata?.avatar_url ?? null,
    plan:      'free',
  })
  return data
}

export async function signOut() {
  await supabase.auth.signOut()
  useAuthStore.getState().logout()
}

export async function getProfile(userId: string): Promise<AppUser | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error || !data) return null
  return {
    id:        data.id,
    email:     data.email,
    fullName:  data.full_name ?? '',
    avatarUrl: data.avatar_url,
    plan:      data.plan,
  }
}

export async function updateProfile(userId: string, updates: { full_name?: string; avatar_url?: string }) {
  const { error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
  if (error) throw error
}

export async function getUserPreferences(userId: string) {
  const { data } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .single()
  return data
}

export async function updateUserPreferences(userId: string, prefs: Record<string, unknown>) {
  const { error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: userId, ...prefs })
  if (error) throw error
}

export async function getSavedPhrases(userId: string) {
  const { data } = await supabase
    .from('saved_phrases')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function savePhrase(userId: string, phrase: string, language: string, category?: string) {
  const { error } = await supabase
    .from('saved_phrases')
    .insert({ user_id: userId, phrase, language, category })
  if (error) throw error
}

export async function deletePhrase(phraseId: string) {
  const { error } = await supabase
    .from('saved_phrases')
    .delete()
    .eq('id', phraseId)
  if (error) throw error
}