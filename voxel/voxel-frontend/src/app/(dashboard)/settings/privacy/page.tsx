'use client'
import { useState } from 'react'
import { Shield, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'

function Toggle({ defaultOn = false }: { defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <button onClick={() => setOn(p => !p)} className="relative w-11 h-6 rounded-full transition-all duration-300" style={{ background: on ? '#0b9488' : 'var(--border)' }}>
      <span className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300" style={{ transform: on ? 'translateX(20px)' : 'translateX(0)' }} />
    </button>
  )
}

export default function PrivacyPage() {
  return (
    <div className="px-5 pb-28 space-y-5" style={{ animation: 'fadeIn 0.4s ease-out forwards' }}>
      <PageHeader title="Privacy & Security" subtitle="Control your data" back="/settings" />
      <div className="card p-4 flex items-center gap-3" style={{ background: 'rgba(11,148,136,0.06)', border: '1px solid rgba(11,148,136,0.2)' }}>
        <Shield size={20} style={{ color: '#14b8a6' }} />
        <p className="text-sm font-dm flex-1" style={{ color: 'var(--subtle)' }}>Your voice data is processed securely and never sold to third parties.</p>
      </div>
      <div className="card p-0 overflow-hidden">
        {[
          { label: 'Save transcription history', sub: 'Store past voice sessions',         on: true  },
          { label: 'Analytics',                  sub: 'Help improve the app',              on: false },
          { label: 'Crash reports',              sub: 'Send error reports automatically',  on: true  },
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
      <button className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-sora font-semibold text-base" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
        <Trash2 size={18} /> Delete All My Data
      </button>
    </div>
  )
}
