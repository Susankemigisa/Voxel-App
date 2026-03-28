'use client'

import { useState, useRef } from 'react'
import { Play, Square, Volume2, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { PageHeader } from '@/components/layout/PageHeader'
import { useRouter } from 'next/navigation'
import { detectNavigationIntent } from '@/hooks/useNavigationIntent'
import { Navigation } from 'lucide-react'

const VOICES = [
  { id: 'female', label: 'Female', emoji: '👩' },
  { id: 'male',   label: 'Male',   emoji: '👨' },
  { id: 'robot',  label: 'Robot',  emoji: '🤖' },
]

const QUICK_PHRASES = [
  'Where is the exit?',
  'I need a wheelchair.',
  'Please call a doctor.',
  'I need help finding the bathroom.',
  'Can someone assist me please?',
]

const NAV_PHRASES = [
  { label: 'Take me to Kampala CBD', dest: 'Kampala CBD', query: 'Kampala CBD, Uganda' },
  { label: 'Take me to Ntinda',      dest: 'Ntinda',      query: 'Ntinda, Kampala, Uganda' },
  { label: 'Take me to Entebbe',     dest: 'Entebbe',     query: 'Entebbe, Uganda' },
  { label: 'Take me to Kawempe',     dest: 'Kawempe',     query: 'Kawempe, Kampala, Uganda' },
  { label: 'Take me to Jinja',       dest: 'Jinja',       query: 'Jinja, Uganda' },
  { label: 'Take me to Fort Portal', dest: 'Fort Portal', query: 'Fort Portal, Uganda' },
]

export default function TTSPage() {
  const router = useRouter()
  const [text, setText]       = useState('')
  const [voice, setVoice]     = useState('female')
  const [pitch, setPitch]     = useState(50)
  const [rate, setRate]       = useState(60)
  const [playing, setPlaying] = useState(false)
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null)
  const charLimit = 300

  const handleSpeak = () => {
    if (!text.trim()) return toast.error('Enter some text first')

    // Use browser Web Speech API for local preview
    // (Backend TTS kicks in when backend is running)
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utter     = new SpeechSynthesisUtterance(text)
      utter.rate      = rate / 60
      utter.pitch     = pitch / 50
      const voices    = window.speechSynthesis.getVoices()
      if (voice === 'female') {
        utter.voice = voices.find(v => v.name.toLowerCase().includes('female') || v.name.includes('Zira') || v.name.includes('Susan')) ?? null
      } else if (voice === 'male') {
        utter.voice = voices.find(v => v.name.toLowerCase().includes('male') || v.name.includes('David') || v.name.includes('Mark')) ?? null
      }
      utter.onstart = () => setPlaying(true)
      utter.onend   = () => setPlaying(false)
      utter.onerror = () => setPlaying(false)
      synthRef.current = utter
      window.speechSynthesis.speak(utter)
    } else {
      toast.error('Speech synthesis not supported in this browser')
    }
  }

  const handleStop = () => {
    window.speechSynthesis?.cancel()
    setPlaying(false)
  }

  return (
    <div className="px-5 pb-28 space-y-5" style={{ animation: 'fadeIn 0.4s ease-out forwards' }}>

      {/* Header */}
      <PageHeader title="Text to Speech" subtitle="Volume2 and hear it" back="/home" />

      {/* Text input */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 size={14} style={{ color: 'var(--teal2)' }} />
            <span className="text-xs font-sora font-semibold uppercase tracking-widest"
                  style={{ color: 'var(--subtle)' }}>Your Message</span>
          </div>
          <span className="text-xs font-dm" style={{ color: text.length > charLimit * 0.8 ? '#f87171' : 'var(--muted)' }}>
            {text.length}/{charLimit}
          </span>
        </div>
        <textarea
          value={text}
          onChange={e => setText(e.target.value.slice(0, charLimit))}
          placeholder="Volume2 what you want to say..."
          rows={4}
          className="w-full rounded-2xl px-4 py-3 text-sm font-dm resize-none transition-all"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            outline: 'none',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--teal)'}
          onBlur={e  => e.target.style.borderColor = 'var(--border)'}
        />
      </div>

      {/* Voice picker */}
      <div className="flex gap-2">
        {VOICES.map(v => (
          <button key={v.id} onClick={() => setVoice(v.id)}
                  className="flex-1 py-3 rounded-2xl flex flex-col items-center gap-1 text-xs font-dm font-medium transition-all"
                  style={{
                    background: voice === v.id ? 'rgba(11,148,136,0.12)' : 'var(--card)',
                    border: `1px solid ${voice === v.id ? 'rgba(11,148,136,0.4)' : 'var(--border)'}`,
                    color:  voice === v.id ? '#14b8a6' : 'var(--subtle)',
                  }}>
            <span className="text-lg">{v.emoji}</span>
            {v.label}
          </button>
        ))}
      </div>

      {/* Sliders */}
      <div className="card space-y-4">
        {[
          { label: 'Pitch', value: pitch, set: setPitch, icon: '🎵' },
          { label: 'Speed', value: rate,  set: setRate,  icon: '⚡' },
        ].map(({ label, value, set, icon }) => (
          <div key={label}>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-dm" style={{ color: 'var(--subtle)' }}>{icon} {label}</span>
              <span className="text-sm font-dm font-semibold" style={{ color: '#14b8a6' }}>{value}%</span>
            </div>
            <input type="range" min={0} max={100} value={value}
                   onChange={e => set(+e.target.value)}
                   className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                   style={{ accentColor: '#0b9488' }} />
          </div>
        ))}
      </div>

      {/* Play / Stop button */}
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={playing ? handleStop : handleSpeak}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-sora font-semibold text-base text-white transition-all active:scale-95"
          style={{
            background: playing ? 'rgba(239,68,68,0.15)' : 'linear-gradient(135deg,#0b9488,#14b8a6)',
            border: playing ? '1px solid rgba(239,68,68,0.3)' : 'none',
            color: playing ? '#f87171' : 'white',
            boxShadow: playing ? 'none' : '0 6px 24px rgba(11,148,136,0.4)',
          }}
        >
          {playing ? (
            <><Square size={18} fill="currentColor" /> Stop Speaking</>
          ) : (
            <><Volume2 size={18} /> Speak Text</>
          )}
        </button>

        {/* Waveform visual when playing */}
        {playing && (
          <div className="flex items-end justify-center gap-1 h-10 w-full"
               style={{ animation: 'fadeIn 0.3s ease-out' }}>
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="flex-1 rounded-full wave-bar"
                   style={{ animationDelay: `${i * 0.05}s` }} />
            ))}
          </div>
        )}
      </div>

      {/* Quick phrases */}
      <div>
        <p className="text-xs font-sora font-semibold uppercase tracking-widest mb-3"
           style={{ color: 'var(--subtle)' }}>Quick Phrases</p>
        <div className="card p-0 overflow-hidden">
          {QUICK_PHRASES.map((phrase, i) => (
            <button key={phrase}
                    onClick={() => setText(phrase)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/5"
                    style={{ borderBottom: i < QUICK_PHRASES.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span className="flex-1 text-sm font-dm text-white">{phrase}</span>
              <ChevronRight size={14} style={{ color: 'var(--muted)' }} />
            </button>
          ))}
        </div>
      </div>

    </div>
  )
}
