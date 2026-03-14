import { apiClient } from './client'
import type { TTSResponse, VoiceGender, Language } from '@/types'

export interface TTSOptions {
  text:        string
  language?:   Language
  voice?:      VoiceGender
  pitch?:      number   // 0–100
  rate?:       number   // 0–100
}

/**
 * Synthesize text to speech.
 * Returns base64 WAV audio + duration.
 */
export async function synthesizeSpeech(options: TTSOptions): Promise<TTSResponse> {
  const { data } = await apiClient.post<TTSResponse>('/tts/synthesize', {
    text:     options.text,
    language: options.language ?? 'en',
    voice:    options.voice    ?? 'female',
    pitch:    options.pitch    ?? 50,
    rate:     options.rate     ?? 60,
  })
  return data
}

/**
 * Decode base64 audio and play it in the browser.
 * Returns the HTMLAudioElement so the caller can pause/stop.
 */
export function playBase64Audio(base64: string): HTMLAudioElement {
  const binary  = atob(base64)
  const bytes   = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const blob    = new Blob([bytes], { type: 'audio/wav' })
  const url     = URL.createObjectURL(blob)
  const audio   = new Audio(url)
  audio.onended = () => URL.revokeObjectURL(url)
  audio.play()
  return audio
}
