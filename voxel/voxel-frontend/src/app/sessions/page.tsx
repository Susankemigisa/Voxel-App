'use client'

import { useEffect, useState } from 'react'
import { Clock, Mic, Search, Filter } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store/authStore'
import { formatRelative } from '@/lib/api/realtime'
import { PageHeader } from '@/components/layout/PageHeader'

const supabase = createClient()

type Language = 'all' | 'en' | 'lg'

interface Session {
  id: string
  transcript: string
  clean_text: string
  language: string
  created_at: string
  confidence: number | null
  pipeline_ms: number | null
}

async function fetchAllSessions(userId: string): Promise<Session[]> {
  const { data, error } = await supabase
    .from('transcription_history')
    .select('id, transcript, clean_text, language, created_at, confidence, pipeline_ms')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data
}

export default function SessionsPage() {
  const user = useAppStore(s => s.user)
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [langFilter, setLangFilter] = useState<Language>('all')

  useEffect(() => {
    if (!user?.id) return
    fetchAllSessions(user.id).then(s => { setSessions(s); setLoading(false) })
  }, [user?.id])

  const filtered = sessions.filter(s => {
    const matchesLang = langFilter === 'all' || s.language === langFilter
    const matchesSearch = !search.trim() ||
      (s.clean_text ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (s.transcript ?? '').toLowerCase().includes(search.toLowerCase())
    return matchesLang && matchesSearch
  })

  // Group sessions by date
  function groupByDate(sessions: Session[]) {
    const groups: Record<string, Session[]> = {}
    sessions.forEach(s => {
      const date = new Date(s.created_at)
      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)

      let key: string
      if (date.toDateString() === today.toDateString()) key = 'Today'
      else if (date.toDateString() === yesterday.toDateString()) key = 'Yesterday'
      else key = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

      if (!groups[key]) groups[key] = []
      groups[key].push(s)
    })
    return groups
  }

  const groups = groupByDate(filtered)

  return (
    <div className="px-5 pb-28 space-y-5" style={{ animation: 'fadeIn 0.4s ease-out forwards' }}>
      <PageHeader title="Recent Sessions" subtitle={`${sessions.length} total transcription${sessions.length !== 1 ? 's' : ''}`} back="/home" />

      {/* Search bar */}
      <div className="relative">
        <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search transcriptions…"
          className="w-full rounded-2xl pl-10 pr-4 py-3 text-sm font-dm outline-none"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
        />
      </div>

      {/* Language filter */}
      <div className="flex gap-2">
        <Filter size={14} style={{ color: 'var(--muted)', flexShrink: 0, marginTop: 6 }} />
        <div className="flex gap-2 flex-wrap">
          {(['all', 'en', 'lg'] as Language[]).map(l => (
            <button
              key={l}
              onClick={() => setLangFilter(l)}
              className="px-3 py-1.5 rounded-xl text-xs font-sora font-semibold transition-all"
              style={langFilter === l
                ? { background: 'linear-gradient(135deg,#0b9488,#14b8a6)', color: '#fff' }
                : { background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--subtle)' }}
            >
              {l === 'all' ? 'All Languages' : l === 'en' ? '🇬🇧 English' : '🇺🇬 Luganda'}
            </button>
          ))}
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="rounded-3xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-start gap-3 px-4 py-4 animate-pulse"
                 style={{ borderBottom: i < 5 ? '1px solid var(--border)' : 'none' }}>
              <div className="w-9 h-9 rounded-xl flex-shrink-0" style={{ background: 'var(--border)' }} />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-3 rounded-full w-4/5" style={{ background: 'var(--border)' }} />
                <div className="h-2.5 rounded-full w-2/5" style={{ background: 'var(--border)' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && sessions.length === 0 && (
        <div className="rounded-3xl p-8 flex flex-col items-center gap-4 text-center"
             style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
               style={{ background: 'rgba(11,148,136,0.1)' }}>
            <Mic size={24} style={{ color: '#14b8a6' }} />
          </div>
          <div>
            <p className="font-sora font-semibold text-base" style={{ color: 'var(--text)' }}>No sessions yet</p>
            <p className="font-dm text-sm mt-1" style={{ color: 'var(--muted)' }}>
              Your voice transcriptions will appear here after you use Voice Input
            </p>
          </div>
          <Link href="/voice"
                className="px-5 py-2.5 rounded-2xl text-sm font-sora font-semibold text-white"
                style={{ background: 'linear-gradient(135deg,#0b9488,#14b8a6)' }}>
            Try Voice Input →
          </Link>
        </div>
      )}

      {/* No search results */}
      {!loading && sessions.length > 0 && filtered.length === 0 && (
        <div className="rounded-3xl p-6 text-center"
             style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <p className="font-sora font-semibold text-sm" style={{ color: 'var(--text)' }}>No results</p>
          <p className="font-dm text-xs mt-1" style={{ color: 'var(--muted)' }}>
            Try a different search term or language filter
          </p>
        </div>
      )}

      {/* Session groups */}
      {!loading && Object.entries(groups).map(([date, items]) => (
        <div key={date}>
          <p className="text-xs font-sora font-semibold uppercase tracking-widest mb-2"
             style={{ color: 'var(--subtle)' }}>
            {date}
          </p>
          <div className="rounded-3xl overflow-hidden"
               style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            {items.map((session, i) => (
              <div
                key={session.id}
                className="flex items-start gap-3 px-4 py-4 transition-colors hover:bg-white/5"
                style={{ borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none' }}
              >
                {/* Icon */}
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                     style={{ background: 'rgba(11,148,136,0.1)' }}>
                  <Clock size={14} style={{ color: '#14b8a6' }} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-dm leading-snug" style={{ color: 'var(--text)' }}>
                    "{session.clean_text || session.transcript}"
                  </p>

                  {/* Show original if it was modified */}
                  {session.transcript && session.clean_text &&
                    session.transcript.toLowerCase().trim() !== session.clean_text.toLowerCase().trim() && (
                    <p className="text-xs font-dm mt-1 italic truncate" style={{ color: 'var(--muted)' }}>
                      Raw: "{session.transcript}"
                    </p>
                  )}

                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <span className="text-xs font-dm" style={{ color: 'var(--muted)' }}>
                      {formatRelative(session.created_at)}
                    </span>
                    {session.confidence != null && (
                      <span className="text-xs font-dm" style={{ color: 'var(--muted)' }}>
                        {Math.round(session.confidence * 100)}% confidence
                      </span>
                    )}
                    {session.pipeline_ms != null && (
                      <span className="text-xs font-dm" style={{ color: 'var(--muted)' }}>
                        {session.pipeline_ms}ms
                      </span>
                    )}
                  </div>
                </div>

                {/* Language badge */}
                <span className="text-xs font-sora font-semibold px-2 py-1 rounded-lg flex-shrink-0"
                      style={{ background: 'rgba(11,148,136,0.12)', color: '#14b8a6' }}>
                  {(session.language || 'en').toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}