'use client'

import { useState, useRef, useCallback } from 'react'

export type RecordingState = 'idle' | 'requesting' | 'recording' | 'stopped' | 'error'

interface UseVoiceRecorderOptions {
  onStop?: (blob: Blob) => void
  maxDurationMs?: number     // auto-stop after N ms (default: 30s)
  mimeType?: string
}

interface UseVoiceRecorderReturn {
  state:         RecordingState
  audioBlob:     Blob | null
  durationMs:    number
  error:         string | null
  startRecording: () => Promise<void>
  stopRecording:  () => void
  resetRecording: () => void
  audioLevel:     number     // 0–100, real-time volume
}

export function useVoiceRecorder(opts: UseVoiceRecorderOptions = {}): UseVoiceRecorderReturn {
  const {
    onStop,
    maxDurationMs = 30_000,
    mimeType      = 'audio/webm;codecs=opus',
  } = opts

  const [state,      setState]      = useState<RecordingState>('idle')
  const [audioBlob,  setAudioBlob]  = useState<Blob | null>(null)
  const [durationMs, setDurationMs] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)
  const [error,      setError]      = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef        = useRef<Blob[]>([])
  const streamRef        = useRef<MediaStream | null>(null)
  const analyserRef      = useRef<AnalyserNode | null>(null)
  const animFrameRef     = useRef<number>(0)
  const startTimeRef     = useRef<number>(0)
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const maxTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stopAnalyser = () => {
    cancelAnimationFrame(animFrameRef.current)
    setAudioLevel(0)
  }

  const startAnalyser = (stream: MediaStream) => {
    const ctx      = new AudioContext()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    const source   = ctx.createMediaStreamSource(stream)
    source.connect(analyser)
    analyserRef.current = analyser

    const data = new Uint8Array(analyser.frequencyBinCount)
    const tick = () => {
      analyser.getByteFrequencyData(data)
      const avg = data.reduce((a, b) => a + b, 0) / data.length
      setAudioLevel(Math.min(100, Math.round(avg * 2.5)))
      animFrameRef.current = requestAnimationFrame(tick)
    }
    tick()
  }

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    streamRef.current?.getTracks().forEach(t => t.stop())
    stopAnalyser()
    if (durationTimerRef.current) clearInterval(durationTimerRef.current)
    if (maxTimerRef.current)      clearTimeout(maxTimerRef.current)
  }, [])

  const startRecording = useCallback(async () => {
    setError(null)
    chunksRef.current = []
    setState('requesting')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation:    true,
          noiseSuppression:    true,   // browser-level pre-denoise
          autoGainControl:     true,
          channelCount:        1,
          sampleRate:          16_000, // wav2vec2 expects 16kHz
        }
      })
      streamRef.current = stream

      // Pick best supported mime type
      const actualMime = MediaRecorder.isTypeSupported(mimeType)
        ? mimeType
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : ''

      const recorder = new MediaRecorder(stream, actualMime ? { mimeType: actualMime } : undefined)
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: actualMime || 'audio/webm' })
        setAudioBlob(blob)
        setState('stopped')
        setDurationMs(Date.now() - startTimeRef.current)
        onStop?.(blob)
      }

      recorder.onerror = () => {
        setError('Recording failed. Please try again.')
        setState('error')
        stopAnalyser()
      }

      recorder.start(100) // collect chunks every 100ms
      startTimeRef.current = Date.now()
      setState('recording')

      // Live duration counter
      durationTimerRef.current = setInterval(() => {
        setDurationMs(Date.now() - startTimeRef.current)
      }, 100)

      // Auto-stop after maxDuration
      maxTimerRef.current = setTimeout(() => {
        stopRecording()
      }, maxDurationMs)

      // Start waveform analyser
      startAnalyser(stream)

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Microphone access denied'
      setError(msg.includes('denied') ? 'Microphone access denied. Please allow mic in browser settings.' : msg)
      setState('error')
    }
  }, [mimeType, maxDurationMs, onStop, stopRecording])

  const resetRecording = useCallback(() => {
    stopRecording()
    setAudioBlob(null)
    setDurationMs(0)
    setAudioLevel(0)
    setError(null)
    setState('idle')
  }, [stopRecording])

  return {
    state,
    audioBlob,
    durationMs,
    error,
    audioLevel,
    startRecording,
    stopRecording,
    resetRecording,
  }
}
