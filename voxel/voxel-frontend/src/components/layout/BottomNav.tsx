'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Mic, Type, User, Settings, Navigation } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/home',     icon: Home,       label: 'Home'     },
  { href: '/voice',    icon: Mic,        label: 'Voice'    },
  { href: '/navigate', icon: Navigation, label: 'Navigate' },
  { href: '/tts',      icon: Type,       label: 'Speak'    },
  { href: '/settings', icon: Settings,   label: 'Settings' },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4">
      <div className="glass rounded-3xl px-2 py-2 flex items-center justify-around max-w-lg mx-auto"
           style={{ boxShadow: '0 -4px 30px rgba(0,0,0,0.4)' }}>
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href} className={`nav-item ${active ? 'active' : ''}`}>
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
