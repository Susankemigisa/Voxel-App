'use client'

import { useState, useRef, useEffect } from 'react'
import { Mic, Square, Copy, CheckCircle, RefreshCw, Play, Pause, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { PageHeader } from '@/components/layout/PageHeader'
import { useRouter } from 'next/navigation'
import { detectNavigationIntent } from '@/hooks/useNavigationIntent'
import { Navigation } from 'lucide-react'

type State = 'idle' | 'listening' | 'processing' | 'done' | 'error'

const STEP_LABELS = ['Cleaning audio', 'Transcribing speech', 'Reconstructing text', 'Generating voice']

interface PipelineResult {
  raw_transcript: string
  clean_text:     string
  audio_base64?:  string
  confidence:     number
  pipeline_ms:    number
}

export default function VoicePage() {
  const [state,      setState]     = useState<State>('idle')
  const [language,   setLanguage]  = useState<'en' | 'lg'>('en')
  const [mode,       setMode]      = useState<'both' | 'audio' | 'visual'>('both')
  const [step,       setStep]      = useState(-1)
  const [result,     setResult]    = useState<PipelineResult | null>(null)
  const [copied,     setCopied]    = useState<'raw' | 'clean' | null>(null)
  const [showRaw,    setShowRaw]   = useState(false)
  const [isPlaying,  setIsPlaying] = useState(false)
  const router    = useRouter()
  const audioRef  = useRef<HTMLAudioElement | null>(null)
  const mediaRef  = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  useEffect(() => { return () => { audioRef.current?.pause() } }, [])
  useEffect(() => { setState('idle'); setResult(null); setStep(-1) }, [])

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr     = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = e => chunksRef.current.push(e.data)
      mr.onstop = () => processAudio(new Blob(chunksRef.current, { type: 'audio/webm' }))
      mr.start()
      mediaRef.current = mr
      setState('listening')
    } catch {
      toast.error('Microphone access denied. Please allow microphone access.')
      setState('error')
    }
  }

  const stop = () => {
    mediaRef.current?.stop()
    mediaRef.current?.stream.getTracks().forEach(t => t.stop())
    setState('processing')
  }

  const processAudio = async (blob: Blob) => {
    for (let i = 0; i < STEP_LABELS.length; i++) {
      setStep(i)
      await new Promise(r => setTimeout(r, 600))
    }

    try {
      const form = new FormData()
      form.append('audio', blob)
      form.append('language', language)
      form.append('output_mode', mode)
      form.append('rate', '1.0')
      form.append('pitch', '0.5')

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/pipeline/process`, {
        method: 'POST',
        body: form,
      })
      if (!res.ok) throw new Error('Backend unavailable')
      const data: PipelineResult = await res.json()

      if (data.audio_base64 && mode !== 'visual') {
        const bytes = atob(data.audio_base64)
        const arr   = new Uint8Array(bytes.length).map((_, i) => bytes.charCodeAt(i))
        const url   = URL.createObjectURL(new Blob([arr], { type: 'audio/wav' }))
        const audio = new Audio(url)
        audio.onended = () => setIsPlaying(false)
        audio.onpause = () => setIsPlaying(false)
        audioRef.current = audio
      } else {
        audioRef.current = null
      }

      setResult(data)
      setShowRaw(false)
      setIsPlaying(false)

      // ── Navigation intent detection ──
      const textToCheck = data.clean_text || data.raw_transcript || ''
      const intent = detectNavigationIntent(textToCheck)
      if (intent.isNavigation && intent.confidence >= 0.65) {
        setTimeout(() => {
          router.push(
            `/navigate?destination=${encodeURIComponent(intent.destination)}&query=${encodeURIComponent(intent.query)}`
          )
        }, 1200) // short delay so user sees the transcript first
      }
    } catch {
      setResult({
        raw_transcript: '',
        clean_text: 'Voice recorded ✓ — Start the FastAPI backend to get AI-powered speech cleanup.',
        pipeline_ms: 0,
        confidence: 0,
      })
      audioRef.current = null
    }
    setStep(-1)
    setState('done')
  }

  const playPause = () => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
      setIsPlaying(true)
    }
  }

  const copy = (type: 'raw' | 'clean') => {
    const text = type === 'raw' ? result?.raw_transcript : result?.clean_text
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopied(type)
    toast.success('Copied!')
    setTimeout(() => setCopied(null), 2000)
  }

  const reset = () => {
    audioRef.current?.pause()
    audioRef.current = null
    setState('idle')
    setResult(null)
    setStep(-1)
    setShowRaw(false)
    setIsPlaying(false)
  }

  const normalise     = (s: string) => s.replace(/[.,!?]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
  const rawDiffers    = result ? normalise(result.raw_transcript) !== normalise(result.clean_text) : false
  const hasRaw        = !!(result?.raw_transcript)

  return (
    <div className="px-5 pb-28 space-y-5" style={{ animation: 'fadeIn 0.4s ease-out forwards' }}>

      <PageHeader title="Voice Assistant" subtitle="Speak naturally" back="/home" />

      {/* Language + mode toggles */}
      <div className="flex gap-3">
        <div className="flex p-1 rounded-2xl flex-1"
             style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          {(['en', 'lg'] as const).map(l => (
            <button key={l} onClick={() => setLanguage(l)}
                    className="flex-1 py-2 rounded-xl text-xs font-sora font-semibold transition-all"
                    style={language === l
                      ? { background: 'linear-gradient(135deg,#0b9488,#14b8a6)', color: '#fff' }
                      : { color: 'var(--subtle)' }}>
              {l === 'en' ? '🇬🇧 English' : '🇺🇬 Luganda'}
            </button>
          ))}
        </div>
        <select value={mode} onChange={e => setMode(e.target.value as typeof mode)}
                className="rounded-2xl px-3 text-xs font-dm"
                style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--subtle)', outline: 'none' }}>
          <option value="both">🔊+📺 Both</option>
          <option value="audio">🔊 Audio</option>
          <option value="visual">📺 Visual</option>
        </select>
      </div>

      {/* Main card */}
      <div className="card flex flex-col items-center py-10 gap-5 relative overflow-hidden min-h-[240px] justify-center">
        {state === 'listening' && (
          <div className="absolute inset-0 pointer-events-none"
               style={{ background: 'radial-gradient(ellipse at center, rgba(11,148,136,0.1) 0%, transparent 65%)' }} />
        )}

        {state === 'idle' && (
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full flex items-center justify-center"
                 style={{ background: 'var(--border)' }}>
              <Mic size={28} style={{ color: 'var(--muted)' }} />
            </div>
            <p className="font-sora font-semibold text-sm text-white">TAP TO SPEAK</p>
            <p className="text-xs font-dm text-center" style={{ color: 'var(--muted)' }}>
              AI will clean and reconstruct your speech
            </p>
          </div>
        )}

        {state === 'listening' && (
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full animate-ping opacity-30"
                   style={{ background: 'rgba(239,68,68,0.4)' }} />
              <div className="w-16 h-16 rounded-full flex items-center justify-center relative"
                   style={{ background: '#ef4444', boxShadow: '0 0 24px rgba(239,68,68,0.5)' }}>
                <Mic size={28} className="text-white" />
              </div>
            </div>
            <p className="font-sora font-semibold text-sm text-white animate-pulse">LISTENING...</p>
            <div className="flex items-end gap-1 h-8">
              {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} className="w-1 rounded-full wave-bar"
                     style={{ animationDelay: `${i * 0.07}s` }} />
              ))}
            </div>
          </div>
        )}

        {state === 'processing' && (
          <div className="flex flex-col items-center gap-4 w-full max-w-xs">
            {STEP_LABELS.map((label, i) => (
              <div key={label} className="flex items-center gap-3 w-full px-4 py-2 rounded-2xl transition-all"
                   style={{
                     background: step === i ? 'rgba(11,148,136,0.1)' : 'transparent',
                     border: `1px solid ${step === i ? 'rgba(11,148,136,0.3)' : 'transparent'}`,
                   }}>
                {step > i
                  ? <CheckCircle size={15} style={{ color: '#14b8a6' }} />
                  : step === i
                    ? <span className="w-4 h-4 border-2 rounded-full animate-spin flex-shrink-0"
                            style={{ borderColor: 'rgba(11,148,136,0.3)', borderTopColor: '#14b8a6' }} />
                    : <span className="w-4 h-4 rounded-full flex-shrink-0"
                            style={{ border: '2px solid var(--border)' }} />
                }
                <span className="text-sm font-dm"
                      style={{ color: step >= i ? 'var(--text)' : 'var(--muted)' }}>{label}</span>
              </div>
            ))}
          </div>
        )}

        {state === 'done' && result && (
          <div className="w-full space-y-3">

            {/* ── Raw transcript — always shown, collapsible ── */}
            {hasRaw && (
              <div className="rounded-2xl overflow-hidden"
                   style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                <button
                  onClick={() => setShowRaw(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-white/5"
                  style={{ color: 'var(--subtle)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-sora font-semibold uppercase tracking-widest">
                      Raw Transcript
                    </span>
                    {/* Badge shows if AI actually changed anything */}
                    {rawDiffers
                      ? <span className="text-xs px-2 py-0.5 rounded-full font-dm"
                               style={{ background: 'rgba(249,115,22,0.15)', color: '#f97316' }}>
                          modified
                        </span>
                      : <span className="text-xs px-2 py-0.5 rounded-full font-dm"
                               style={{ background: 'rgba(11,148,136,0.15)', color: '#14b8a6' }}>
                          unchanged
                        </span>
                    }
                  </div>
                  <div className="flex items-center gap-2">
                    {result.confidence > 0 && (
                      <span className="text-xs font-dm px-2 py-0.5 rounded-full"
                            style={{ background: 'var(--border)', color: 'var(--muted)' }}>
                        {Math.round(result.confidence * 100)}% conf
                      </span>
                    )}
                    {showRaw ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                </button>

                {showRaw && (
                  <div className="px-4 pb-4 pt-0 border-t"
                       style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-start justify-between gap-2 pt-3">
                      <p className="text-sm font-dm leading-relaxed"
                         style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
                        "{result.raw_transcript}"
                      </p>
                      <button onClick={() => copy('raw')}
                              className="p-1.5 rounded-xl flex-shrink-0 hover:bg-white/5"
                              style={{ color: 'var(--muted)' }}>
                        {copied === 'raw'
                          ? <CheckCircle size={13} style={{ color: '#14b8a6' }} />
                          : <Copy size={13} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Cleaned text ── */}
            <div className="rounded-2xl p-4"
                 style={{ background: 'rgba(11,148,136,0.06)', border: '1px solid rgba(11,148,136,0.25)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-sora font-semibold uppercase tracking-widest"
                      style={{ color: '#14b8a6' }}>
                  {rawDiffers ? 'Cleaned Text' : 'Transcript'}
                </span>
                <button onClick={() => copy('clean')}
                        className="p-2 rounded-xl hover:bg-white/5"
                        style={{ color: 'var(--subtle)' }}>
                  {copied === 'clean'
                    ? <CheckCircle size={14} style={{ color: '#14b8a6' }} />
                    : <Copy size={14} />}
                </button>
              </div>
              <p className="text-base font-dm font-medium text-white leading-relaxed">
                "{result.clean_text}"
              </p>
            </div>

            {/* ── Audio playback ── */}
            {audioRef.current && mode !== 'visual' && (
              <button
                onClick={playPause}
                className="w-full flex items-center justify-center gap-3 py-3 rounded-2xl font-sora font-semibold text-sm transition-all active:scale-95"
                style={{
                  background: isPlaying ? 'rgba(11,148,136,0.15)' : 'linear-gradient(135deg,#0b9488,#14b8a6)',
                  border: isPlaying ? '1px solid rgba(11,148,136,0.4)' : 'none',
                  color: '#fff',
                  boxShadow: isPlaying ? 'none' : '0 4px 16px rgba(11,148,136,0.35)',
                }}>
                {isPlaying
                  ? <><Pause size={17} fill="currentColor" /> Pause Audio</>
                  : <><Play  size={17} fill="currentColor" /> Play Cleaned Audio</>}
              </button>
            )}

          </div>
        )}

        {state === 'error' && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm font-dm text-red-400">Could not access microphone</p>
            <p className="text-xs font-dm text-center" style={{ color: 'var(--muted)' }}>
              Please allow microphone access in your browser settings
            </p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {(state === 'idle' || state === 'error') && (
        <button onClick={start}
                className="w-full py-4 rounded-2xl font-sora font-semibold text-base text-white flex items-center justify-center gap-3 transition-all active:scale-95"
                style={{ background: 'linear-gradient(135deg,#0b9488,#14b8a6)', boxShadow: '0 6px 24px rgba(11,148,136,0.4)' }}>
          <Mic size={20} /> Start Speaking
        </button>
      )}
      {state === 'listening' && (
        <button onClick={stop}
                className="w-full py-4 rounded-2xl font-sora font-semibold text-base flex items-center justify-center gap-3 transition-all active:scale-95"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
          <Square size={20} fill="currentColor" /> Stop Recording
        </button>
      )}
      {state === 'done' && (
        <button onClick={reset}
                className="w-full py-4 rounded-2xl font-sora font-semibold text-base flex items-center justify-center gap-3 transition-all active:scale-95"
                style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}>
          <RefreshCw size={18} /> Record Again
        </button>
      )}
    </div>
  )
}