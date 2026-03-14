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

export default function NotificationsPage() {
  const items = [
    { label: 'Session reminders', sub: 'Remind me to practice daily',        on: true  },
    { label: 'New features',      sub: 'Updates and improvements',           on: true  },
    { label: 'Emergency alerts',  sub: 'SOS and safety notifications',       on: true  },
    { label: 'Weekly summary',    sub: 'Usage stats and progress',           on: false },
  ]
  return (
    <div className="px-5 pb-28 space-y-5" style={{ animation: 'fadeIn 0.4s ease-out forwards' }}>
      <PageHeader title="Notifications" subtitle="Choose what alerts you" back="/settings" />
      <div className="card p-0 overflow-hidden">
        {items.map((item, i) => (
          <div key={item.label} className="flex items-center justify-between px-4 py-4" style={{ borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none' }}>
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
