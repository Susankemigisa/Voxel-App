'use client'

import { useState } from 'react'
import { Home, Settings, Navigation, Trash2, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'

const ICON_MAP: Record<string, any> = { home: Home, work: Settings, favourite: Settings, other: Navigation }

export default function PlacesPage() {
  const [places, setPlaces] = useState([
    { id: '1', label: 'Home',   address: '123 Kampala Road',    type: 'home'      },
    { id: '2', label: 'Work',   address: 'Nakasero Office Park', type: 'work'     },
    { id: '3', label: 'Clinic', address: 'Mulago Hospital',     type: 'favourite' },
  ])

  return (
    <div className="px-5 pb-28 space-y-5" style={{ animation: 'fadeIn 0.4s ease-out forwards' }}>
      <PageHeader title="Saved Places" subtitle="Your frequent locations" back="/settings" />

      <p className="text-sm font-dm" style={{ color: 'var(--muted)' }}>
        Quick access to your frequent locations
      </p>

      <div className="rounded-3xl p-4 flex items-center gap-4"
           style={{ background: 'rgba(11,148,136,0.06)', border: '1px solid rgba(11,148,136,0.2)' }}>
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
             style={{ background: 'rgba(11,148,136,0.15)' }}>
          <Navigation size={18} style={{ color: '#14b8a6' }} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-dm font-semibold" style={{ color: 'var(--text)' }}>Nearby Services</p>
          <p className="text-xs font-dm" style={{ color: 'var(--muted)' }}>Hospitals, pharmacies, emergency services near you</p>
        </div>
        <ChevronRight size={16} style={{ color: 'var(--muted)' }} />
      </div>

      <div>
        <p className="text-xs font-sora font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--subtle)' }}>
          Saved Locations
        </p>
        <div className="rounded-3xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          {places.map(({ id, label, address, type }, i) => {
            const Icon = ICON_MAP[type] || Navigation
            return (
              <div key={id} className="flex items-center gap-3 px-4 py-4"
                   style={{ borderBottom: i < places.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                     style={{ background: 'rgba(11,148,136,0.1)' }}>
                  <Icon size={16} style={{ color: '#14b8a6' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-dm font-medium" style={{ color: 'var(--text)' }}>{label}</p>
                  <p className="text-xs font-dm truncate" style={{ color: 'var(--muted)' }}>{address}</p>
                </div>
                <button onClick={() => setPlaces(p => p.filter(x => x.id !== id))}
                        aria-label={`Remove ${label}`}
                        className="p-2 rounded-xl hover:bg-red-500/10 transition-colors"
                        style={{ color: 'var(--muted)' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>
        <button aria-label="Add new saved place"
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl mt-3 font-dm text-sm font-medium transition-all"
                style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--teal2)' }}>
          <span>+</span> Add New Place
        </button>
      </div>
    </div>
  )
}
