$base = "D:\Voxel-App\voxel\voxel-frontend\src\lib"

# Create folders
New-Item -ItemType Directory -Force -Path "$base\store" | Out-Null
New-Item -ItemType Directory -Force -Path "$base\utils" | Out-Null
New-Item -ItemType Directory -Force -Path "$base\api"   | Out-Null

# supabase.ts
@'
import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (client) return client
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  return client
}
'@ | Out-File -FilePath "$base\supabase.ts" -Encoding utf8

# store/authStore.ts
@'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface VoxelUser {
  id:          string
  email:       string
  fullName:    string
  displayName: string
  initials:    string
  avatarUrl:   string | null
  plan:        'free' | 'pro'
  joinedAt:    string
}

interface AppState {
  user:         VoxelUser | null
  accessToken:  string | null
  isLoading:    boolean
  setUser:         (user: VoxelUser | null) => void
  updateUser:      (partial: Partial<VoxelUser>) => void
  setToken:        (token: string | null) => void
  setLoading:      (v: boolean) => void
  logout:          () => void
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export { initials }

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      user:        null,
      accessToken: null,
      isLoading:   false,
      setUser:    (user)        => set({ user }),
      updateUser: (partial)     => {
        const cur = get().user
        if (!cur) return
        const updated = { ...cur, ...partial }
        if (partial.displayName) updated.initials = initials(partial.displayName)
        set({ user: updated })
      },
      setToken:   (accessToken) => set({ accessToken }),
      setLoading: (isLoading)   => set({ isLoading }),
      logout:     ()            => set({ user: null, accessToken: null }),
    }),
    {
      name: 'voxel-app-v2',
      partialize: (s) => ({ user: s.user, accessToken: s.accessToken }),
    }
  )
)

export const useAuthStore = useAppStore
'@ | Out-File -FilePath "$base\store\authStore.ts" -Encoding utf8

# utils/cn.ts
@'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
'@ | Out-File -FilePath "$base\utils\cn.ts" -Encoding utf8

# utils/formatters.ts
@'
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes      = Math.floor(totalSeconds / 60)
  const seconds      = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function formatConfidence(score: number): string {
  return `${Math.round(score * 100)}%`
}

export function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const s    = Math.floor(diff / 1000)
  if (s < 60)   return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60)   return `${m} minute${m > 1 ? 's' : ''} ago`
  const h = Math.floor(m / 60)
  if (h < 24)   return `${h} hour${h > 1 ? 's' : ''} ago`
  const d = Math.floor(h / 24)
  return `${d} day${d > 1 ? 's' : ''} ago`
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + '...'
}

export function capitalise(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
'@ | Out-File -FilePath "$base\utils\formatters.ts" -Encoding utf8

# utils/audio.ts
@'
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export function base64ToAudioUrl(base64: string, mimeType = 'audio/wav'): string {
  const binary = atob(base64)
  const bytes  = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  const blob = new Blob([bytes], { type: mimeType })
  return URL.createObjectURL(blob)
}

export function isRecordingSupported(): boolean {
  return !!(
    typeof window !== 'undefined' &&
    navigator.mediaDevices &&
    typeof MediaRecorder !== 'undefined'
  )
}
'@ | Out-File -FilePath "$base\utils\audio.ts" -Encoding utf8

# api/realtime.ts
@'
import { createClient } from '@/lib/supabase'

const supabase = createClient()

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

export async function fetchProfile(userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('full_name, display_name, email, plan, created_at')
    .eq('id', userId)
    .single()
  return data
}

export async function updateDisplayName(userId: string, displayName: string) {
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', userId)
  return !error
}

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
'@ | Out-File -FilePath "$base\api\realtime.ts" -Encoding utf8

# api/client.ts
@'
import axios from 'axios'
import { useAuthStore } from '@/lib/store/authStore'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
export { API_URL }

export const apiClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
  timeout: 30_000,
})

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)
'@ | Out-File -FilePath "$base\api\client.ts" -Encoding utf8

Write-Host "All files restored successfully!"
Get-ChildItem "$base" -Recurse -File | Select-Object FullName
