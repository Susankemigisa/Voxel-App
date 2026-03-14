'use client'

import { useState } from 'react'
import { Copy, CheckCircle, Volume2, Languages } from 'lucide-react'
import toast from 'react-hot-toast'
import type { PipelineResponse } from '@/types'

interface TranscriptCardProps {
  result: PipelineResponse
  onReplay?: () => void
  onTranslate?: () => void
}

export function TranscriptCard({ result, onReplay, onTranslate }: TranscriptCardProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(result.clean_text)
    setCopied(true)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-3" style={{ animation: 'slideUp 0.4s ease-out forwards' }}>

      {/* Meta badges */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-dm font-medium"
              style={{ background: 'rgba(11,148,136,0.15)', color: '#14b8a6' }}>
          {Math.round(result.confidence * 100)}% confidence
        </span>
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-dm font-medium"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--subtle)' }}>
          {result.model_used} · {result.pipeline_ms}ms
        </span>
      </div>

      {/* Raw transcript */}
      {result.raw_transcript && result.raw_transcript !== result.clean_text && (
        <div className="rounded-2xl p-4"
             style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-sora font-semibold uppercase tracking-widest"
                  style={{ color: 'var(--muted)' }}>
              Raw transcript
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-dm font-medium"
                  style={{ background: 'rgba(249,115,22,0.15)', color: '#fb923c' }}>
              Unclean
            </span>
          </div>
          <p className="text-sm font-dm italic" style={{ color: 'var(--muted)' }}>
            "{result.raw_transcript}"
          </p>
        </div>
      )}

      {/* Cleaned output */}
      <div className="rounded-2xl p-4"
           style={{ background: 'rgba(11,148,136,0.06)', border: '1px solid rgba(11,148,136,0.25)' }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-sora font-semibold uppercase tracking-widest"
                style={{ color: '#14b8a6' }}>
            Cleaned output
          </span>
          <div className="flex gap-1">
            <button onClick={handleCopy}
                    className="p-2 rounded-xl transition-colors hover:bg-white/5"
                    style={{ color: 'var(--subtle)' }}
                    title="Copy text">
              {copied
                ? <CheckCircle size={14} style={{ color: '#14b8a6' }} />
                : <Copy size={14} />}
            </button>
            {onTranslate && (
              <button onClick={onTranslate}
                      className="p-2 rounded-xl transition-colors hover:bg-white/5"
                      style={{ color: 'var(--subtle)' }}
                      title="Translate">
                <Languages size={14} />
              </button>
            )}
            {onReplay && result.audio_base64 && (
              <button onClick={onReplay}
                      className="p-2 rounded-xl transition-colors hover:bg-white/5"
                      style={{ color: 'var(--subtle)' }}
                      title="Replay audio">
                <Volume2 size={14} />
              </button>
            )}
          </div>
        </div>
        <p className="text-base font-dm font-medium text-white leading-relaxed">
          "{result.clean_text}"
        </p>
      </div>
    </div>
  )
}
