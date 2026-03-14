'use client'

import { useState, useRef, useEffect } from 'react'
import { Mic, Square, Copy, CheckCircle, Volume2, RefreshCw, Languages } from 'lucide-react'
import toast from 'react-hot-toast'
import { PageHeader } from '@/components/layout/PageHeader'

type State = 'idle' | 'listening' | 'processing' | 'done' | 'error'

const STEP_LABELS = ['Cleaning audio', 'Transcribing speech', 'Reconstructing text', 'Generating voice']

export default function VoicePage() {
  const [state,    setState]   = useState<State>('idle')
  const [language, setLanguage] = useState<'en' | 'lg'>('en')
  const [mode,     setMode]    = useState<'both' | 'audio' | 'visual'>('both')
  const [step,     setStep]    = useState(-1)
  const [result,   setResult]  = useState('')
  const [copied,   setCopied]  = useState(false)
  const mediaRef  = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

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
    // Animate through steps
    for (let i = 0; i < STEP_LABELS.length; i++) {
      setStep(i)
      await new Promise(r => setTimeout(r, 600))
    }

    // Try backend, fall back to browser speech recognition demo
    try {
      const form = new FormData()
      form.append('audio', blob)
      form.append('language', language)
      form.append('output_mode', mode)

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/pipeline/process`, {
        method: 'POST',
        body: form,
      })
      if (!res.ok) throw new Error('Backend unavailable')
      const data = await res.json()
      setResult(data.clean_text)
      if (data.audio_base64 && mode !== 'visual') {
        const bytes  = atob(data.audio_base64)
        const arr    = new Uint8Array(bytes.length).map((_, i) => bytes.charCodeAt(i))
        const url    = URL.createObjectURL(new Blob([arr], { type: 'audio/wav' }))
        new Audio(url).play()
      }
    } catch {
      // Backend not running — show demo result
      // Use browser speech recognition as fallback
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        setResult('Voice recorded ✓ — Start the FastAPI backend to get AI-powered speech cleanup.')
      } else {
        setResult('Voice recorded ✓ — Start the FastAPI backend to process and clean up your speech.')
      }
    }
    setStep(-1)
    setState('done')
  }

  const reset = () => { setState('idle'); setResult(''); setStep(-1) }

  // Reset to idle on every mount so stale state doesn't show
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setState('idle'); setResult(''); setStep(-1) }, [])

  const copy = () => {
    navigator.clipboard.writeText(result)
    setCopied(true)
    toast.success('Copied!')
    setTimeout(() => setCopied(false), 2000)
  }

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
                {step > i ? (
                  <CheckCircle size={15} style={{ color: '#14b8a6' }} />
                ) : step === i ? (
                  <span className="w-4 h-4 border-2 rounded-full animate-spin flex-shrink-0"
                        style={{ borderColor: 'rgba(11,148,136,0.3)', borderTopColor: '#14b8a6' }} />
                ) : (
                  <span className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ border: '2px solid var(--border)' }} />
                )}
                <span className="text-sm font-dm"
                      style={{ color: step >= i ? 'var(--text)' : 'var(--muted)' }}>{label}</span>
              </div>
            ))}
          </div>
        )}

        {state === 'done' && result && (
          <div className="w-full space-y-3">
            <div className="rounded-2xl p-4"
                 style={{ background: 'rgba(11,148,136,0.06)', border: '1px solid rgba(11,148,136,0.25)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-sora font-semibold uppercase tracking-widest"
                      style={{ color: '#14b8a6' }}>Result</span>
                <div className="flex gap-1">
                  <button onClick={copy}
                          className="p-2 rounded-xl hover:bg-white/5"
                          style={{ color: 'var(--subtle)' }}>
                    {copied ? <CheckCircle size={14} style={{ color: '#14b8a6' }} /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
              <p className="text-base font-dm font-medium text-white leading-relaxed">"{result}"</p>
            </div>
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

      {/* Action button */}
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