'use client'

import { useState, useCallback, useRef } from 'react'
import { useVoiceRecorder } from './useVoiceRecorder'
import { runPipeline } from '@/lib/api/asr'
import type { Language, OutputMode, PipelineResponse, PipelineStepStatus } from '@/types'
import { playBase64Audio } from '@/lib/api/tts'

const STEPS: PipelineStepStatus[] = [
  { id: 'audio_cleanup',       label: 'Cleaning audio',       state: 'pending' },
  { id: 'asr',                 label: 'Transcribing speech',  state: 'pending' },
  { id: 'text_reconstruction', label: 'Reconstructing text',  state: 'pending' },
  { id: 'tts',                 label: 'Generating voice',     state: 'pending' },
]

type ASRState = 'idle' | 'listening' | 'processing' | 'done' | 'error'

interface UseASRReturn {
  asrState:      ASRState
  steps:         PipelineStepStatus[]
  result:        PipelineResponse | null
  error:         string | null
  audioLevel:    number
  durationMs:    number
  language:      Language
  outputMode:    OutputMode
  setLanguage:   (l: Language) => void
  setOutputMode: (m: OutputMode) => void
  startListening: () => void
  stopListening:  () => void
  reset:          () => void
}

export function useASR(): UseASRReturn {
  const [asrState,   setAsrState]   = useState<ASRState>('idle')
  const [steps,      setSteps]      = useState<PipelineStepStatus[]>(STEPS.map(s => ({ ...s })))
  const [result,     setResult]     = useState<PipelineResponse | null>(null)
  const [error,      setError]      = useState<string | null>(null)
  const [language,   setLanguage]   = useState<Language>('en')
  const [outputMode, setOutputMode] = useState<OutputMode>('both')
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const setStep = (id: string, state: PipelineStepStatus['state']) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, state } : s))
  }

  const handleAudioReady = useCallback(async (blob: Blob) => {
    setAsrState('processing')

    // Reset steps
    setSteps(STEPS.map(s => ({ ...s, state: 'pending' })))

    try {
      // Simulate step progression (in prod the backend streams progress)
      setStep('audio_cleanup', 'active')
      await new Promise(r => setTimeout(r, 300))
      setStep('audio_cleanup', 'done')

      setStep('asr', 'active')
      // Call backend
      const data = await runPipeline(blob, { language, outputMode })
      setStep('asr', 'done')

      setStep('text_reconstruction', 'active')
      await new Promise(r => setTimeout(r, 200))
      setStep('text_reconstruction', 'done')

      if (outputMode !== 'visual') {
        setStep('tts', 'active')
        await new Promise(r => setTimeout(r, 200))
        setStep('tts', 'done')

        // Auto-play audio
        if (data.audio_base64) {
          audioRef.current = playBase64Audio(data.audio_base64)
        }
      }

      setResult(data)
      setAsrState('done')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Processing failed'
      setError(msg)
      setAsrState('error')
      setSteps(prev => prev.map(s => s.state === 'active' ? { ...s, state: 'error' } : s))
    }
  }, [language, outputMode])

  const { state: recState, audioLevel, durationMs,
          startRecording, stopRecording, resetRecording } = useVoiceRecorder({
    onStop: handleAudioReady,
    maxDurationMs: 30_000,
  })

  const startListening = useCallback(() => {
    setError(null)
    setResult(null)
    setSteps(STEPS.map(s => ({ ...s, state: 'pending' })))
    setAsrState('listening')
    startRecording()
  }, [startRecording])

  const stopListening = useCallback(() => {
    stopRecording()
  }, [stopRecording])

  const reset = useCallback(() => {
    audioRef.current?.pause()
    audioRef.current = null
    resetRecording()
    setAsrState('idle')
    setResult(null)
    setError(null)
    setSteps(STEPS.map(s => ({ ...s, state: 'pending' })))
  }, [resetRecording])

  return {
    asrState: recState === 'requesting' ? 'listening' : asrState,
    steps,
    result,
    error,
    audioLevel,
    durationMs,
    language,
    outputMode,
    setLanguage,
    setOutputMode,
    startListening,
    stopListening,
    reset,
  }
}
