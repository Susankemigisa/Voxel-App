import AsyncStorage from '@react-native-async-storage/async-storage'

const KEYS = {
  PENDING_SESSIONS: 'voxel:pending_sessions',
  CACHED_PHRASES:   'voxel:cached_phrases',
  OFFLINE_CORRECTIONS: 'voxel:offline_corrections',
}

export interface PendingSession {
  id:          string
  user_id:     string
  transcript:  string
  clean_text:  string
  language:    string
  confidence:  number | null
  pipeline_ms: number | null
  created_at:  string
}

// ── Pending sessions (recorded offline, sync when back online) ────────────────
export async function savePendingSession(session: Omit<PendingSession, 'id'>) {
  const raw = await AsyncStorage.getItem(KEYS.PENDING_SESSIONS)
  const list: PendingSession[] = raw ? JSON.parse(raw) : []
  list.push({ ...session, id: `local_${Date.now()}` })
  await AsyncStorage.setItem(KEYS.PENDING_SESSIONS, JSON.stringify(list))
}

export async function getPendingSessions(): Promise<PendingSession[]> {
  const raw = await AsyncStorage.getItem(KEYS.PENDING_SESSIONS)
  return raw ? JSON.parse(raw) : []
}

export async function clearPendingSession(id: string) {
  const raw  = await AsyncStorage.getItem(KEYS.PENDING_SESSIONS)
  const list = raw ? JSON.parse(raw) : []
  await AsyncStorage.setItem(
    KEYS.PENDING_SESSIONS,
    JSON.stringify(list.filter((s: PendingSession) => s.id !== id))
  )
}

// ── Cached quick phrases (available offline) ──────────────────────────────────
export async function cacheQuickPhrases(phrases: string[]) {
  await AsyncStorage.setItem(KEYS.CACHED_PHRASES, JSON.stringify(phrases))
}

export async function getCachedPhrases(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(KEYS.CACHED_PHRASES)
  return raw ? JSON.parse(raw) : [
    'Where is the exit?',
    'I need a wheelchair.',
    'Please call a doctor.',
    'I need help.',
    'Can someone assist me?',
  ]
}

// ── Offline AI correction cache (most-used corrections stored locally) ────────
export interface CorrectionEntry {
  input:   string
  output:  string
  language: string
  hits:    number
}

export async function getCachedCorrection(input: string, language: string): Promise<string | null> {
  const raw = await AsyncStorage.getItem(KEYS.OFFLINE_CORRECTIONS)
  const cache: CorrectionEntry[] = raw ? JSON.parse(raw) : []
  const norm = input.toLowerCase().trim()
  const match = cache.find(c => c.language === language && c.input === norm)
  if (match) {
    // Bump hit count
    match.hits++
    await AsyncStorage.setItem(KEYS.OFFLINE_CORRECTIONS, JSON.stringify(cache))
    return match.output
  }
  return null
}

export async function saveCorrectionToCache(input: string, output: string, language: string) {
  const raw = await AsyncStorage.getItem(KEYS.OFFLINE_CORRECTIONS)
  let cache: CorrectionEntry[] = raw ? JSON.parse(raw) : []
  const norm = input.toLowerCase().trim()
  const existing = cache.find(c => c.language === language && c.input === norm)
  if (existing) {
    existing.output = output
    existing.hits++
  } else {
    cache.push({ input: norm, output, language, hits: 1 })
    // Keep only the 200 most-used corrections to save storage
    if (cache.length > 200) {
      cache = cache.sort((a, b) => b.hits - a.hits).slice(0, 200)
    }
  }
  await AsyncStorage.setItem(KEYS.OFFLINE_CORRECTIONS, JSON.stringify(cache))
}
