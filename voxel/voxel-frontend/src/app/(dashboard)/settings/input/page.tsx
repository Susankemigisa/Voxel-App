'use client'
import { useState } from 'react'
import { Mic } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'

function Toggle({ defaultOn = false }: { defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <button onClick={() => setOn(p => !p)} className="relative w-11 h-6 rounded-full transition-all duration-300" style={{ background: on ? '#0b9488' : 'var(--border)' }}>
      <span className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300" style={{ transform: on ? 'translateX(20px)' : 'translateX(0)' }} />
    </button>
  )
}

export default function InputPage() {
  return (
    <div className="px-5 pb-28 space-y-5" style={{ animation: 'fadeIn 0.4s ease-out forwards' }}>
      <PageHeader title="Input Methods" subtitle="Configure communication" back="/settings" />
      <div className="card p-0 overflow-hidden">
        {[
          { icon: Mic,      label: 'Voice Input',   sub: 'Speak to communicate',         on: true  },
          { icon: Mic, label: 'Text Input',     sub: 'Volume2 your messages',            on: true  },
          { icon: Mic,   label: 'Sign Language',  sub: 'Use camera for visual input',   on: false },
        ].map(({ icon: Icon, label, sub, on }, i, arr) => (
          <div key={label} className="flex items-center gap-4 px-4 py-4" style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(11,148,136,0.1)' }}>
              <Icon size={18} style={{ color: '#14b8a6' }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-dm font-medium text-white">{label}</p>
              <p className="text-xs font-dm mt-0.5" style={{ color: 'var(--muted)' }}>{sub}</p>
            </div>
            <Toggle defaultOn={on} />
          </div>
        ))}
      </div>
    </div>
  )
}
