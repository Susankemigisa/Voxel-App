'use client'

import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface PageHeaderProps {
  title:    string
  subtitle?: string
  back?:    string   // explicit back path, defaults to router.back()
}

export function PageHeader({ title, subtitle, back }: PageHeaderProps) {
  const router = useRouter()

  return (
    <div className="flex items-center gap-4 px-5 pt-5 pb-4">
      <button
        onClick={() => back ? router.push(back) : router.back()}
        className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all active:scale-95"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--subtle)' }}
        aria-label="Go back"
      >
        <ArrowLeft size={18} />
      </button>
      <div className="flex-1 min-w-0">
        <h1 className="font-sora font-bold text-lg leading-tight truncate" style={{ color: 'var(--text)' }}>
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs font-dm mt-0.5 truncate" style={{ color: 'var(--muted)' }}>{subtitle}</p>
        )}
      </div>
    </div>
  )
}
