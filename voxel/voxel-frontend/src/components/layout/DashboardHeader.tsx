'use client'

import { Settings, Sun, Moon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from '@/components/shared/ThemeProvider'

// Pages that have their own PageHeader — DashboardHeader shows only logo + controls
const SUB_PAGES = ['/voice', '/tts', '/profile', '/settings/']

export function DashboardHeader() {
  const pathname          = usePathname()
  const { theme, toggle } = useTheme()

  const isHome     = pathname === '/home'
  const isSettings = pathname === '/settings'
  // Sub-pages manage their own title via PageHeader
  const isSubPage  = SUB_PAGES.some(p => pathname.startsWith(p))

  return (
    <header className="flex items-center justify-between px-5 pt-5 pb-3">
      <div className="flex items-center gap-2.5">
        <svg width="32" height="32" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="50" fill="white" />
          <path d="M57 12L26 54H46L38 88L74 46H54L57 12Z" fill="#0a0f1e" />
        </svg>
        {/* Only show text title on home and settings — sub-pages use PageHeader */}
        {!isSubPage && (
          <span className="font-sora font-bold text-base" style={{ color: 'var(--text)' }}>
            {isHome ? 'Voxel' : 'Settings'}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={toggle}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--subtle)' }}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
        {isHome && (
          <Link
            href="/settings"
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--subtle)' }}
          >
            <Settings size={16} />
          </Link>
        )}
      </div>
    </header>
  )
}