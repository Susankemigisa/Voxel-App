'use client'

import { useState } from 'react'
import { Check, Search, Globe, Users, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'

const LANGUAGES = [
  { code: 'en',    name: 'English',  native: 'English',    flag: '🇬🇧', dialects: ['English (US)', 'English (UK)', 'English (AU)'] },
  { code: 'lg',    name: 'Luganda',  native: 'Luganda',    flag: '🇺🇬', dialects: ['Central Luganda', 'Kiswahili'] },
]

export default function LanguageHubPage() {
  const [selected, setSelected]   = useState<string[]>(['en', 'lg'])
  const [dialect, setDialect]     = useState('English (US)')
  const [search, setSearch]       = useState('')

  const filtered = LANGUAGES.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.native.toLowerCase().includes(search.toLowerCase())
  )

  const activeLanguage = LANGUAGES.find(l => selected[0] === l.code)

  return (
    <div className="px-5 space-y-5" style={{ animation: 'fadeIn 0.4s ease-out forwards' }}>
      <PageHeader title="Language Hub" subtitle="Languages and translation" back="/settings" />

      {/* Back */}
      <Link href="/settings" className="flex items-center gap-1.5 text-sm font-dm"
            style={{ color: 'var(--subtle)' }}>
        <ChevronLeft size={16} /> Settings
      </Link>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
        <input
          type="text"
          placeholder="Search languages..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-base pl-10"
        />
      </div>

      {/* Available languages */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-sora font-semibold uppercase tracking-widest" style={{ color: 'var(--subtle)' }}>
            Available Languages
          </p>
          <span className="badge badge-teal">{selected.length} languages</span>
        </div>
        <div className="space-y-2">
          {filtered.map(lang => {
            const active = selected.includes(lang.code)
            return (
              <button key={lang.code}
                      onClick={() => setSelected(p =>
                        active && p.length > 1
                          ? p.filter(c => c !== lang.code)
                          : [...new Set([...p, lang.code])]
                      )}
                      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all"
                      style={{
                        background: active ? 'rgba(11,148,136,0.1)' : 'var(--card)',
                        border: `1px solid ${active ? 'rgba(11,148,136,0.35)' : 'var(--border)'}`,
                      }}>
                <span className="text-2xl">{lang.flag}</span>
                <div className="flex-1 text-left">
                  <p className="font-dm font-semibold text-sm text-white">{lang.name}</p>
                  <p className="text-xs font-dm" style={{ color: 'var(--muted)' }}>{lang.native}</p>
                </div>
                {active && <Check size={18} style={{ color: 'var(--teal2)' }} />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Dialect picker */}
      {activeLanguage && activeLanguage.dialects.length > 0 && (
        <div>
          <p className="text-xs font-sora font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--subtle)' }}>
            Pick a Dialect
          </p>
          <div className="space-y-2">
            {activeLanguage.dialects.map(d => (
              <button key={d}
                      onClick={() => setDialect(d)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all text-left"
                      style={{
                        background: dialect === d ? 'rgba(11,148,136,0.08)' : 'var(--card)',
                        border: `1px solid ${dialect === d ? 'rgba(11,148,136,0.2)' : 'var(--border)'}`,
                      }}>
                <span className="text-lg">{activeLanguage.flag}</span>
                <span className="text-sm font-dm font-medium flex-1"
                      style={{ color: dialect === d ? 'var(--text)' : 'var(--subtle)' }}>{d}</span>
                {dialect === d && <Check size={16} style={{ color: 'var(--teal2)' }} />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Community translations */}
      <div className="card"
           style={{ background: 'rgba(11,148,136,0.05)', border: '1px solid rgba(11,148,136,0.15)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Users size={16} style={{ color: 'var(--teal2)' }} />
          <span className="font-sora font-semibold text-sm text-white">Community Translations</span>
        </div>
        <p className="text-xs font-dm leading-relaxed" style={{ color: 'var(--muted)' }}>
          Luganda and other local dialects are community-verified for high accuracy in rural navigation.
        </p>
        <button className="text-xs font-dm mt-2 underline" style={{ color: 'var(--teal2)' }}>
          Learn more →
        </button>
      </div>

      {/* Global support */}
      <div className="card">
        <div className="flex items-center gap-2 mb-2">
          <Globe size={16} style={{ color: 'var(--subtle)' }} />
          <span className="font-sora font-semibold text-sm text-white">Global Support</span>
        </div>
        <p className="text-xs font-dm leading-relaxed" style={{ color: 'var(--muted)' }}>
          New languages are added every month to ensure everyone can navigate safely.
        </p>
      </div>

      {/* Save */}
      <button className="btn-primary w-full py-4">Save Language Settings</button>

    </div>
  )
}
