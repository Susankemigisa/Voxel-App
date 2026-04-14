import { apiClient } from './client'
import type { TTSResponse, Language, VoiceGender } from '@/types'

interface TTSOptions {
  text:      string
  language?: Language
  voice?:    VoiceGender
  pitch?:    number   // 0–100
  rate?:     number   // 0–100
}

export async function synthesizeSpeech(options: TTSOptions): Promise<TTSResponse> {
  const res = await apiClient.post<TTSResponse>('/tts/synthesize', {
    text:     options.text,
    language: options.language ?? 'en',
    voice:    options.voice    ?? 'female',
    pitch:    (options.pitch   ?? 50) / 100,
    rate:     (options.rate    ?? 50) / 50,
  })
  return res.data
}

// Alias for useASR which imports playBase64Audio from here
export async function synthesize(
  text: string,
  options: Omit<TTSOptions, 'text'> = {},
): Promise<TTSResponse> {
  return synthesizeSpeech({ text, ...options })
}

export function playBase64Audio(base64: string): HTMLAudioElement {
  const binary = atob(base64)
  const bytes  = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const blob   = new Blob([bytes], { type: 'audio/wav' })
  const url    = URL.createObjectURL(blob)
  const audio  = new Audio(url)
  audio.play().catch(console.error)
  audio.addEventListener('ended', () => URL.revokeObjectURL(url))
  return audio
}