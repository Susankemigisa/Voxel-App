import { createClient } from '@/lib/supabase'

const supabase = createClient()

/** Fetch real user stats from Supabase */
export async function fetchUserStats(userId: string) {
  const { data, error } = await supabase
    .from('transcription_history')
    .select('language, confidence, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error || !data) return { sessions: 0, accuracy: 0, languages: 0 }

  const sessions   = data.length
  const accuracy   = data.length
    ? Math.round(data.reduce((s, r) => s + (r.confidence ?? 0.9), 0) / data.length * 100)
    : 0
  const languages  = new Set(data.map(r => r.language)).size

  return { sessions, accuracy, languages }
}

/** Fetch recent transcription history */
export async function fetchRecentSessions(userId: string, limit = 3) {
  const { data, error } = await supabase
    .from('transcription_history')
    .select('id, transcript, clean_text, language, created_at, confidence')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return data
}

/** Fetch user profile including display_name */
export async function fetchProfile(userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('full_name, display_name, email, plan, created_at')
    .eq('id', userId)
    .single()
  return data
}

/** Update display_name in profiles */
export async function updateDisplayName(userId: string, displayName: string) {
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', userId)
  return !error
}

/** Format relative time */
export function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const s    = Math.floor(diff / 1000)
  if (s < 60)   return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60)   return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24)   return `${h} hr ago`
  const d = Math.floor(h / 24)
  if (d === 1)  return 'Yesterday'
  return `${d} days ago`
}
