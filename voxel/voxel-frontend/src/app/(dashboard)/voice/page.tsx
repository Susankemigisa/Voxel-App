'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Mic, Square, Copy, CheckCircle, RefreshCw,
  Play, Pause, ChevronDown, ChevronUp, Zap,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { PageHeader } from '@/components/layout/PageHeader'
import { useRouter } from 'next/navigation'
import { detectNavigationIntent } from '@/hooks/useNavigationIntent'
import { apiClient } from '@/lib/api/client'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store/authStore'
import type { PipelineResponse, Language, OutputMode } from '@/types'

type State = 'idle' | 'listening' | 'processing' | 'done' | 'error'

const STEP_LABELS = ['Cleaning audio', 'Transcribing speech', 'Reconstructing text', 'Generating voice']

// Singleton supabase client
const supabase = createClient()

// ── Animated orb ──────────────────────────────────────────────────────────────
function MicOrb({ state, onClick }: { state: State; onClick: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef  = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx    = canvas.getContext('2d')!
    let raf: number

    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const W = canvas.offsetWidth, H = canvas.offsetHeight
      canvas.width  = W * dpr; canvas.height = H * dpr
      ctx.scale(dpr, dpr)
      const cx = W / 2, cy = H / 2
      const t  = frameRef.current * 0.018
      ctx.clearRect(0, 0, W, H)

      const rings = state === 'listening' ? 3 : state === 'processing' ? 2 : 1
      for (let r = 0; r < rings; r++) {
        const pulse  = state === 'idle' || state === 'done' ? 0.15
          : Math.sin(t * 1.4 + r * 1.2) * 0.4 + 0.6
        const radius = 56 + r * 14 + (state === 'listening' ? Math.sin(t + r) * 6 : 0)
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(11,148,136,${(0.18 - r * 0.04) * pulse})`
        ctx.lineWidth   = 1.5
        ctx.stroke()
      }

      if (state === 'listening') {
        ctx.beginPath()
        const pts = 64
        for (let i = 0; i <= pts; i++) {
          const angle = (i / pts) * Math.PI * 2
          const noise = Math.sin(angle * 3 + t * 2.1) * 5
                      + Math.sin(angle * 5 + t * 3.3) * 3
                      + Math.sin(angle * 7 + t * 1.7) * 2
          const rad   = 52 + noise
          const x = cx + Math.cos(angle) * rad
          const y = cy + Math.sin(angle) * rad
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.closePath()
        ctx.strokeStyle = 'rgba(11,148,136,0.55)'
        ctx.lineWidth   = 1.5
        ctx.stroke()
      }

      frameRef.current++
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [state])

  const bg = state === 'listening'
    ? 'radial-gradient(circle at 35% 35%, #f87171, #ef4444)'
    : state === 'processing'
    ? 'radial-gradient(circle at 35% 35%, #94a3b8, #64748b)'
    : 'radial-gradient(circle at 35% 35%, #14b8a6, #0b9488)'

  const shadow = state === 'listening'
    ? '0 0 40px rgba(239,68,68,0.55), 0 8px 32px rgba(0,0,0,0.5)'
    : state === 'processing'
    ? '0 0 30px rgba(100,116,139,0.3), 0 8px 32px rgba(0,0,0,0.5)'
    : '0 0 40px rgba(11,148,136,0.55), 0 8px 32px rgba(0,0,0,0.5)'

  return (
    <div className="relative flex items-center justify-center" style={{ width: 160, height: 160 }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
      <button
        onClick={onClick}
        disabled={state === 'processing'}
        aria-label={state === 'listening' ? 'Stop recording' : 'Start recording'}
        className="relative z-10 flex items-center justify-center rounded-full transition-all duration-300 active:scale-95"
        style={{ width: 96, height: 96, background: bg, boxShadow: shadow,
                 opacity: state === 'processing' ? 0.6 : 1,
                 cursor:  state === 'processing' ? 'not-allowed' : 'pointer' }}>
        {state === 'listening'
          ? <Square size={28} className="text-white" fill="white" />
          : state === 'processing'
          ? <span className="w-6 h-6 border-2 rounded-full animate-spin"
                  style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
          : <Mic size={32} className="text-white" />}
      </button>
    </div>
  )
}

// ── Wave bars ─────────────────────────────────────────────────────────────────
function WaveBars() {
  return (
    <div className="flex items-end justify-center gap-[3px]" style={{ height: 28 }}>
      {Array.from({ length: 18 }).map((_, i) => (
        <div key={i} className="rounded-full"
             style={{
               width: 3, minHeight: 4,
               background: 'linear-gradient(to top, #0b9488, #5eead4)',
               animationName: 'waveBar',
               animationDuration: `${0.7 + (i % 5) * 0.12}s`,
               animationDelay: `${i * 0.07}s`,
               animationTimingFunction: 'ease-in-out',
               animationIterationCount: 'infinite',
               animationDirection: i % 2 === 0 ? 'alternate' : 'alternate-reverse',
             }} />
      ))}
    </div>
  )
}

// ── Processing steps ──────────────────────────────────────────────────────────
function ProcessingSteps({ step }: { step: number }) {
  return (
    <div className="w-full max-w-[260px] space-y-2">
      {STEP_LABELS.map((label, i) => {
        const isDone   = step > i
        const isActive = step === i
        return (
          <div key={label}
               className="flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-all duration-300"
               style={{
                 background: isActive ? 'rgba(11,148,136,0.1)' : 'transparent',
                 border: `1px solid ${isActive ? 'rgba(11,148,136,0.3)' : 'transparent'}`,
               }}>
            {isDone
              ? <CheckCircle size={14} style={{ color: '#14b8a6', flexShrink: 0 }} />
              : isActive
              ? <span className="w-3.5 h-3.5 border-2 rounded-full animate-spin flex-shrink-0"
                      style={{ borderColor: 'rgba(11,148,136,0.25)', borderTopColor: '#14b8a6' }} />
              : <span className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                      style={{ border: '2px solid var(--border)' }} />}
            <span className="text-xs font-dm"
                  style={{ color: isDone ? 'var(--teal2)' : isActive ? 'var(--text)' : 'var(--muted)' }}>
              {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Result view ───────────────────────────────────────────────────────────────
function ResultView({
  result, copied, showRaw, rawDiffers,
  onCopy, onToggleRaw, onPlay, isPlaying, hasAudio,
}: {
  result: PipelineResponse
  copied: 'raw' | 'clean' | null
  showRaw: boolean
  rawDiffers: boolean
  onCopy: (t: 'raw' | 'clean') => void
  onToggleRaw: () => void
  onPlay: () => void
  isPlaying: boolean
  hasAudio: boolean
}) {
  return (
    <div className="w-full space-y-3" style={{ animation: 'slideUp 0.35s ease-out forwards' }}>

      {result.confidence > 0 && (
        <div className="flex items-center gap-2 justify-center">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-sora font-semibold"
               style={{ background: 'rgba(11,148,136,0.12)', color: '#14b8a6',
                        border: '1px solid rgba(11,148,136,0.2)' }}>
            <Zap size={11} fill="currentColor" />
            {Math.round(result.confidence * 100)}% confidence
          </div>
          {result.pipeline_ms > 0 && (
            <span className="text-xs font-dm" style={{ color: 'var(--muted)' }}>
              {result.pipeline_ms}ms
            </span>
          )}
        </div>
      )}

      {result.raw_transcript && (
        <div className="rounded-2xl overflow-hidden"
             style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
          <button onClick={onToggleRaw}
                  className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-white/5"
                  style={{ color: 'var(--subtle)' }}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-sora font-semibold uppercase tracking-widest">Raw</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-dm"
                    style={rawDiffers
                      ? { background: 'rgba(249,115,22,0.15)', color: '#f97316' }
                      : { background: 'rgba(11,148,136,0.12)', color: '#14b8a6' }}>
                {rawDiffers ? 'modified' : 'unchanged'}
              </span>
            </div>
            {showRaw ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {showRaw && (
            <div className="px-4 pb-4 pt-0 border-t" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-start justify-between gap-2 pt-3">
                <p className="text-sm font-dm leading-relaxed italic" style={{ color: 'var(--muted)' }}>
                  "{result.raw_transcript}"
                </p>
                <button onClick={() => onCopy('raw')}
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

      <div className="rounded-2xl p-4"
           style={{ background: 'rgba(11,148,136,0.06)', border: '1px solid rgba(11,148,136,0.25)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-sora font-semibold uppercase tracking-widest"
                style={{ color: '#14b8a6' }}>
            {rawDiffers ? 'Cleaned Text' : 'Transcript'}
          </span>
          <button onClick={() => onCopy('clean')}
                  className="p-2 rounded-xl hover:bg-white/5 transition-colors"
                  style={{ color: 'var(--subtle)' }}>
            {copied === 'clean'
              ? <CheckCircle size={14} style={{ color: '#14b8a6' }} />
              : <Copy size={14} />}
          </button>
        </div>
        <p className="text-base font-dm font-medium leading-relaxed" style={{ color: 'var(--text)' }}>
          "{result.clean_text}"
        </p>
      </div>

      {hasAudio && (
        <button onClick={onPlay}
                className="w-full flex items-center justify-center gap-3 py-3 rounded-2xl font-sora font-semibold text-sm transition-all active:scale-95"
                style={{
                  background: isPlaying ? 'rgba(11,148,136,0.12)' : 'linear-gradient(135deg,#0b9488,#14b8a6)',
                  border: isPlaying ? '1px solid rgba(11,148,136,0.35)' : 'none',
                  color: '#fff',
                  boxShadow: isPlaying ? 'none' : '0 4px 18px rgba(11,148,136,0.35)',
                }}>
          {isPlaying
            ? <><Pause size={16} fill="currentColor" /> Pause</>
            : <><Play  size={16} fill="currentColor" /> Play Cleaned Audio</>}
        </button>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function VoicePage() {
  const [state,     setState]     = useState<State>('idle')
  const [language,  setLanguage]  = useState<Language>('en')
  const [mode,      setMode]      = useState<OutputMode>('both')
  const backendUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
  const [step,      setStep]      = useState(-1)
  const [result,    setResult]    = useState<PipelineResponse | null>(null)
  const [copied,    setCopied]    = useState<'raw' | 'clean' | null>(null)
  const [showRaw,   setShowRaw]   = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [apiError,  setApiError]  = useState<string | null>(null)

  const router    = useRouter()
  const user      = useAppStore(s => s.user)   // ← get current user for saving sessions
  const audioRef  = useRef<HTMLAudioElement | null>(null)
  const mediaRef  = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  useEffect(() => () => { audioRef.current?.pause() }, [])

  const normalise  = (s: string) => s.replace(/[.,!?]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
  const rawDiffers = result
    ? normalise(result.raw_transcript) !== normalise(result.clean_text)
    : false

  const processAudio = useCallback(async (blob: Blob) => {
    const stepPromise = (async () => {
      for (let i = 0; i < STEP_LABELS.length; i++) {
        setStep(i)
        await new Promise(r => setTimeout(r, 500))
      }
    })()

    const apiPromise = (async (): Promise<PipelineResponse> => {
      const form = new FormData()
      form.append('audio',       blob, 'recording.webm')
      form.append('language',    language)
      form.append('output_mode', mode)
      form.append('rate',        '1.0')
      form.append('pitch',       '0.5')

      const { data } = await apiClient.post<PipelineResponse>(
        '/pipeline/process',
        form,
        { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120_000 }
      )
      return data
    })()

    const [, data] = await Promise.allSettled([stepPromise, apiPromise])

    setStep(-1)

    if (data.status === 'rejected') {
      const msg = (data.reason as any)?.response?.data?.detail
        ?? (data.reason as any)?.message
        ?? 'Pipeline failed'
      console.error('Pipeline error:', data.reason)
      setApiError(msg)
      setState('error')
      return
    }

    const result = data.value
    setApiError(null)

    if (result.audio_base64 && mode !== 'visual') {
      try {
        const bytes = atob(result.audio_base64)
        const arr   = new Uint8Array(bytes.length).map((_, i) => bytes.charCodeAt(i))
        const audio = new Audio(URL.createObjectURL(new Blob([arr], { type: 'audio/wav' })))
        audio.onended = () => setIsPlaying(false)
        audio.onpause = () => setIsPlaying(false)
        audioRef.current = audio
      } catch {
        audioRef.current = null
      }
    } else {
      audioRef.current = null
    }

    setResult(result)
    setShowRaw(false)
    setIsPlaying(false)
    setState('done')

    // ── Save session to Supabase transcription_history ──────────────────────
    // This makes "Your Activity" and "Recent Sessions" on the home page work.
    if (user?.id) {
      supabase.from('transcription_history').insert({
        user_id:     user.id,
        transcript:  result.raw_transcript  ?? '',
        clean_text:  result.clean_text      ?? '',
        language:    language,
        confidence:  result.confidence      ?? null,
        pipeline_ms: result.pipeline_ms     ?? null,
        created_at:  new Date().toISOString(),
      }).then(({ error }) => {
        if (error) console.warn('Session save failed:', error.message)
      })
    }
    // ────────────────────────────────────────────────────────────────────────

    // Navigation intent detection
    const textToCheck = result.clean_text || result.raw_transcript || ''
    const intent = detectNavigationIntent(textToCheck)
    if (intent.isNavigation && intent.confidence >= 0.65) {
      setTimeout(() => router.push(
        `/navigate?destination=${encodeURIComponent(intent.destination)}&query=${encodeURIComponent(intent.query)}`
      ), 1200)
    }
  }, [language, mode, router, user])

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr     = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => processAudio(new Blob(chunksRef.current, { type: 'audio/webm' }))
      mr.start()
      mediaRef.current = mr
      setApiError(null)
      setState('listening')
    } catch {
      toast.error('Microphone access denied.')
      setState('error')
    }
  }

  const stop = () => {
    mediaRef.current?.stop()
    mediaRef.current?.stream.getTracks().forEach(t => t.stop())
    setState('processing')
  }

  const orbClick = () => {
    if (state === 'idle' || state === 'error') start()
    else if (state === 'listening') stop()
  }

  const playPause = () => {
    const audio = audioRef.current; if (!audio) return
    if (isPlaying) { audio.pause() } else { audio.play(); setIsPlaying(true) }
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
    audioRef.current?.pause(); audioRef.current = null
    setState('idle'); setResult(null); setStep(-1)
    setShowRaw(false); setIsPlaying(false); setApiError(null)
  }

  const stateLabel = {
    idle:       'Tap to speak',
    listening:  'Listening…',
    processing: 'Processing…',
    done:       'Done',
    error:      apiError ? 'Error' : 'Microphone denied',
  }[state]

  return (
    <>
      <style>{`
        @keyframes waveBar {
          from { height: 4px; }
          to   { height: 22px; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>

      <div className="px-5 pb-28 space-y-5" style={{ animation: 'fadeIn 0.35s ease-out forwards' }}>

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
          <select value={mode} onChange={e => setMode(e.target.value as OutputMode)}
                  className="rounded-2xl px-3 text-xs font-dm"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)',
                           color: 'var(--subtle)', outline: 'none' }}>
            <option value="both">🔊+📺 Both</option>
            <option value="audio">🔊 Audio</option>
            <option value="visual">📺 Visual</option>
          </select>
        </div>

        {/* Main card */}
        <div className="card flex flex-col items-center gap-5 relative overflow-hidden"
             style={{ minHeight: 300, paddingTop: 32, paddingBottom: 32 }}>

          <div className="absolute inset-0 pointer-events-none transition-opacity duration-500"
               style={{
                 background: state === 'listening'
                   ? 'radial-gradient(ellipse 70% 50% at 50% 60%, rgba(11,148,136,0.10) 0%, transparent 70%)'
                   : 'none',
               }} />

          <MicOrb state={state} onClick={orbClick} />

          <p className="font-sora font-semibold text-sm tracking-wide"
             style={{ color: state === 'listening' ? '#f87171'
                           : state === 'error' ? '#f87171' : 'var(--text)' }}>
            {stateLabel}
          </p>

          {state === 'listening'   && <WaveBars />}
          {state === 'processing'  && <ProcessingSteps step={step} />}

          {state === 'done' && result && (
            <ResultView
              result={result}
              copied={copied}
              showRaw={showRaw}
              rawDiffers={rawDiffers}
              onCopy={copy}
              onToggleRaw={() => setShowRaw(v => !v)}
              onPlay={playPause}
              isPlaying={isPlaying}
              hasAudio={!!audioRef.current && mode !== 'visual'}
            />
          )}

          {state === 'idle' && (
            <p className="text-xs font-dm text-center max-w-[200px]" style={{ color: 'var(--muted)' }}>
              AI will clean and reconstruct your speech
            </p>
          )}

          {state === 'error' && (
            <div className="w-full space-y-2">
              <p className="text-xs font-dm text-center text-red-400">
                {apiError ?? 'Could not access microphone. Allow access in browser settings.'}
              </p>
              {apiError && (
                <p className="text-xs font-dm text-center" style={{ color: 'var(--muted)' }}>
                  Backend URL: {backendUrl}
                </p>
              )}
            </div>
          )}
        </div>

        {state === 'done' && (
          <button onClick={reset}
                  className="w-full py-4 rounded-2xl font-sora font-semibold text-base flex items-center justify-center gap-3 transition-all active:scale-95"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}>
            <RefreshCw size={18} /> Record Again
          </button>
        )}

        {state === 'error' && (
          <button onClick={reset}
                  className="w-full py-4 rounded-2xl font-sora font-semibold text-base flex items-center justify-center gap-3 transition-all active:scale-95"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}>
            <RefreshCw size={18} /> Try Again
          </button>
        )}

      </div>
    </>
  )
}