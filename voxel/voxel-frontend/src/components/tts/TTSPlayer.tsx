'use client'

import { Play, Square, Volume2, RefreshCw } from 'lucide-react'
import type { VoiceGender } from '@/types'

interface TTSPlayerProps {
  isPlaying:  boolean
  isLoading:  boolean
  isReady:    boolean
  text:       string
  voice:      VoiceGender
  pitch:      number
  rate:       number
  onPlay:     () => void
  onStop:     () => void
  onReset:    () => void
  onVoiceChange: (v: VoiceGender) => void
  onPitchChange: (p: number) => void
  onRateChange:  (r: number) => void
}

const VOICES: { id: VoiceGender; label: string; emoji: string }[] = [
  { id: 'female', label: 'Female', emoji: '👩' },
  { id: 'male',   label: 'Male',   emoji: '👨' },
  { id: 'robot',  label: 'Robot',  emoji: '🤖' },
]

export function TTSPlayer({
  isPlaying, isLoading, isReady, text,
  voice, pitch, rate,
  onPlay, onStop, onReset,
  onVoiceChange, onPitchChange, onRateChange,
}: TTSPlayerProps) {
  return (
    <div className="rounded-3xl p-5 space-y-5"
         style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>

      {/* Waveform */}
      <div className="flex items-end justify-center gap-0.5 h-12 px-2">
        {Array.from({ length: 40 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 rounded-full transition-all duration-150"
            style={{
              height: isPlaying
                ? `${8 + Math.abs(Math.sin((i + Date.now() / 200) * 0.5)) * 30}px`
                : isReady ? '6px' : '3px',
              background: isPlaying
                ? 'linear-gradient(to top, #0b9488, #5eead4)'
                : 'var(--border)',
            }}
          />
        ))}
      </div>

      {/* Playback controls */}
      <div className="flex items-center justify-center gap-6">
        <button
          onClick={onReset}
          className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:opacity-80"
          style={{ background: 'var(--border)', color: 'var(--subtle)' }}
          title="Reset"
        >
          <RefreshCw size={15} />
        </button>

        <button
          onClick={isPlaying ? onStop : onPlay}
          disabled={isLoading || !isReady}
          className="w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-40"
          style={{
            background:  'linear-gradient(135deg, #0b9488, #14b8a6)',
            boxShadow:   '0 0 24px rgba(11,148,136,0.4)',
          }}
          title={isPlaying ? 'Stop' : 'Play'}
        >
          {isLoading ? (
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : isPlaying ? (
            <Square size={20} className="text-white" fill="white" />
          ) : (
            <Play size={20} className="text-white" fill="white" style={{ marginLeft: 3 }} />
          )}
        </button>

        <button
          className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:opacity-80"
          style={{ background: 'var(--border)', color: 'var(--subtle)' }}
          title="Volume"
        >
          <Volume2 size={15} />
        </button>
      </div>

      {/* Voice picker */}
      <div className="flex gap-2">
        {VOICES.map(v => (
          <button
            key={v.id}
            onClick={() => onVoiceChange(v.id)}
            className="flex-1 py-3 rounded-2xl flex flex-col items-center gap-1 text-xs font-dm font-medium transition-all"
            style={{
              background: voice === v.id ? 'rgba(11,148,136,0.12)' : 'var(--surface)',
              border:     `1px solid ${voice === v.id ? 'rgba(11,148,136,0.4)' : 'var(--border)'}`,
              color:      voice === v.id ? '#14b8a6' : 'var(--subtle)',
            }}
          >
            <span className="text-lg">{v.emoji}</span>
            {v.label}
          </button>
        ))}
      </div>

      {/* Sliders */}
      <div className="space-y-3">
        {[
          { label: '🎵 Pitch', value: pitch, onChange: onPitchChange },
          { label: '⚡ Rate',  value: rate,  onChange: onRateChange  },
        ].map(({ label, value, onChange }) => (
          <div key={label}>
            <div className="flex justify-between mb-1.5">
              <span className="text-xs font-dm" style={{ color: 'var(--subtle)' }}>{label}</span>
              <span className="text-xs font-dm font-semibold" style={{ color: '#14b8a6' }}>{value}%</span>
            </div>
            <input
              type="range" min={0} max={100} value={value}
              onChange={e => onChange(+e.target.value)}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: '#0b9488' }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
