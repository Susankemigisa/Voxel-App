'use client'
import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'

function Toggle({ defaultOn = false }: { defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <button onClick={() => setOn(p => !p)} className="relative w-11 h-6 rounded-full transition-all duration-300" style={{ background: on ? '#0b9488' : 'var(--border)' }}>
      <span className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300" style={{ transform: on ? 'translateX(20px)' : 'translateX(0)' }} />
    </button>
  )
}

export default function AudioPage() {
  const [volume, setVolume] = useState(75)
  const [rate,   setRate]   = useState(60)
  return (
    <div className="px-5 pb-28 space-y-5" style={{ animation: 'fadeIn 0.4s ease-out forwards' }}>
      <PageHeader title="Audio & Voice" subtitle="Sound and recognition" back="/settings" />
      <div className="card space-y-5">
        {[
          { label: '🔊 Output Volume', value: volume, set: setVolume },
          { label: '⚡ Speech Rate',   value: rate,   set: setRate   },
        ].map(({ label, value, set }) => (
          <div key={label}>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-dm" style={{ color: 'var(--subtle)' }}>{label}</span>
              <span className="text-sm font-dm font-semibold" style={{ color: '#14b8a6' }}>{value}%</span>
            </div>
            <input type="range" min={0} max={100} value={value} onChange={e => set(+e.target.value)} className="w-full h-1.5 rounded-full appearance-none cursor-pointer" style={{ accentColor: '#0b9488' }} />
          </div>
        ))}
      </div>
      <div className="card p-0 overflow-hidden">
        {[
          { label: 'Noise Cancellation', sub: 'Remove background noise',          on: true  },
          { label: 'Auto Gain Control',  sub: 'Normalise microphone input',        on: true  },
          { label: 'Echo Cancellation',  sub: 'Remove echo from recordings',       on: true  },
          { label: 'AI Voice Cleanup',   sub: 'Remove stutters using AI',          on: true  },
        ].map((item, i, arr) => (
          <div key={item.label} className="flex items-center justify-between px-4 py-4" style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div>
              <p className="text-sm font-dm font-medium text-white">{item.label}</p>
              <p className="text-xs font-dm mt-0.5" style={{ color: 'var(--muted)' }}>{item.sub}</p>
            </div>
            <Toggle defaultOn={item.on} />
          </div>
        ))}
      </div>
    </div>
  )
}
