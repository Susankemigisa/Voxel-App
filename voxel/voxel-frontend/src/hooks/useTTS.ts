'use client'

import { useState, useRef, useCallback } from 'react'
import { synthesizeSpeech, playBase64Audio } from '@/lib/api/tts'
import type { VoiceGender, Language } from '@/types'

interface UseTTSReturn {
  isPlaying:    boolean
  isLoading:    boolean
  duration:     number
  error:        string | null
  voice:        VoiceGender
  pitch:        number
  rate:         number
  setVoice:     (v: VoiceGender) => void
  setPitch:     (p: number) => void
  setRate:      (r: number) => void
  speak:        (text: string, language?: Language) => Promise<void>
  stop:         () => void
}

export function useTTS(): UseTTSReturn {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [duration,  setDuration]  = useState(0)
  const [error,     setError]     = useState<string | null>(null)
  const [voice,     setVoice]     = useState<VoiceGender>('female')
  const [pitch,     setPitch]     = useState(50)
  const [rate,      setRate]      = useState(60)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const stop = useCallback(() => {
    audioRef.current?.pause()
    audioRef.current = null
    setIsPlaying(false)
  }, [])

  const speak = useCallback(async (text: string, language: Language = 'en') => {
    if (!text.trim()) return
    stop()
    setError(null)
    setIsLoading(true)

    try {
      const result = await synthesizeSpeech({ text, language, voice, pitch, rate })
      setDuration(result.duration_ms)
      setIsLoading(false)
      setIsPlaying(true)
      const audio = playBase64Audio(result.audio_base64)
      audioRef.current = audio
      audio.onended = () => setIsPlaying(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'TTS failed')
      setIsLoading(false)
    }
  }, [voice, pitch, rate, stop])

  return { isPlaying, isLoading, duration, error, voice, pitch, rate, setVoice, setPitch, setRate, speak, stop }
}
