'use client'

import { Trash2, ChevronRight } from 'lucide-react'
import type { SavedPhraseItem } from '@/types'

interface QuickPhrasesProps {
  phrases:   SavedPhraseItem[]
  onSelect:  (phrase: string) => void
  onDelete?: (id: string) => void
  loading?:  boolean
}

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  navigation: { bg: 'rgba(11,148,136,0.1)',  color: '#14b8a6' },
  emergency:  { bg: 'rgba(239,68,68,0.1)',   color: '#f87171' },
  custom:     { bg: 'rgba(124,58,237,0.1)',  color: '#a78bfa' },
}

export function QuickPhrases({ phrases, onSelect, onDelete, loading }: QuickPhrasesProps) {
  if (loading) {
    return (
      <div className="rounded-3xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-4 animate-pulse"
               style={{ borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
            <div className="h-3 rounded-full flex-1" style={{ background: 'var(--border)' }} />
          </div>
        ))}
      </div>
    )
  }

  if (!phrases.length) {
    return (
      <div className="rounded-3xl p-6 text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <p className="text-sm font-dm" style={{ color: 'var(--muted)' }}>
          No saved phrases yet. Save frequently used phrases for quick access.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-3xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      {phrases.map((item, i) => {
        const catStyle = CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS.custom
        return (
          <div
            key={item.id}
            className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/5 group"
            style={{ borderBottom: i < phrases.length - 1 ? '1px solid var(--border)' : 'none' }}
          >
            {/* Category dot */}
            <span className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: catStyle.color }} />

            {/* Phrase text — tap to use */}
            <button
              onClick={() => onSelect(item.phrase)}
              className="flex-1 text-left text-sm font-dm text-white hover:text-teal-400 transition-colors"
            >
              {item.phrase}
            </button>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {onDelete && (
                <button
                  onClick={() => onDelete(item.id)}
                  className="p-1.5 rounded-xl transition-colors hover:bg-red-500/10"
                  style={{ color: 'var(--muted)' }}
                  title="Delete phrase"
                >
                  <Trash2 size={13} />
                </button>
              )}
              <ChevronRight size={14} style={{ color: 'var(--muted)' }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
