'use client'

import { Mic, Square } from 'lucide-react'

interface VoiceMicButtonProps {
  state: 'idle' | 'listening' | 'processing' | 'done' | 'error'
  onStart:  () => void
  onStop:   () => void
  onReset?: () => void
}

export function VoiceMicButton({ state, onStart, onStop, onReset }: VoiceMicButtonProps) {
  if (state === 'listening') {
    return (
      <button
        onClick={onStop}
        aria-label="Stop recording"
        className="w-20 h-20 rounded-full flex items-center justify-center transition-all active:scale-95"
        style={{ background: '#ef4444', boxShadow: '0 0 30px rgba(239,68,68,0.4)' }}
      >
        <Square size={24} className="text-white" fill="white" />
      </button>
    )
  }

  if (state === 'idle' || state === 'error') {
    return (
      <div className="relative flex items-center justify-center">
        {/* Pulse rings */}
        <span className="absolute w-20 h-20 rounded-full animate-ping opacity-20"
              style={{ background: 'rgba(11,148,136,0.4)', animationDuration: '2s' }} />
        <button
          onClick={onStart}
          aria-label="Start recording"
          className="relative w-20 h-20 rounded-full flex items-center justify-center transition-all active:scale-95"
          style={{
            background:  'linear-gradient(135deg, #0b9488, #14b8a6)',
            boxShadow:   '0 0 32px rgba(11,148,136,0.5)',
          }}
        >
          <Mic size={32} className="text-white" />
        </button>
      </div>
    )
  }

  return null
}
