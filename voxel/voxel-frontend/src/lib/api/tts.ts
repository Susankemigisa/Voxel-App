import { apiClient } from './client'
import type { TTSResponse, Language, VoiceGender } from '@/types'

interface TTSOptions {
  language?: Language
  voice?:    VoiceGender
  pitch?:    number   // 0–100
  rate?:     number   // 0–100
}

export async function synthesize(
  text: string,
  options: TTSOptions = {},
): Promise<TTSResponse> {
  const res = await apiClient.post<TTSResponse>('/tts/synthesize', {
    text,
    language: options.language ?? 'en',
    voice:    options.voice    ?? 'female',
    pitch:    (options.pitch   ?? 50) / 100,   // convert 0-100 → 0.0-1.0
    rate:     (options.rate    ?? 50) / 50,    // convert 0-100 → 0.0-2.0
  })
  return res.data
}

/**
 * Decode a base64 WAV string, play it, and return the Audio element
 * so the caller can pause/stop it if needed.
 */
export function playBase64Audio(base64: string): HTMLAudioElement {
  const binary  = atob(base64)
  const bytes   = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const blob    = new Blob([bytes], { type: 'audio/wav' })
  const url     = URL.createObjectURL(blob)
  const audio   = new Audio(url)
  audio.play().catch(console.error)
  audio.addEventListener('ended', () => URL.revokeObjectURL(url))
  return audio
}