import Link from 'next/link'
import { ChevronRight, Mic, Volume2, Globe, Settings, Lock, Navigation } from 'lucide-react'

const MAIN_CONFIG = [
  { icon: Mic,     label: 'Input Methods',    sub: 'Sign, Voice, and Text config',     href: '/settings/input'    },
  { icon: Volume2, label: 'Audio & Voice',    sub: 'Volume, TTS, and Speech recognition', href: '/settings/audio' },
  { icon: Globe,   label: 'Language Hub',     sub: 'Select system and translation language', href: '/settings/language' },
  { icon: Settings,  label: 'Safety & SOS',     sub: 'Manage emergency contacts',        href: '/settings/safety'   },
  { icon: Navigation,  label: 'Saved Places',    sub: 'Your frequent locations',          href: '/settings/places'   },
]

const APP_PREFS = [
  { icon: Settings,       label: 'Notifications',  sub: 'Smart alerts enabled',     href: '/settings/notifications' },
  { icon: Lock,       label: 'Privacy & Security', sub: 'Data and permissions', href: '/settings/privacy'       },
  { icon: Settings, label: 'Help & Support', sub: 'Guides and contact',       href: '/settings/help'          },
]

function SettingsRow({ icon: Icon, label, sub, href }: { icon: any; label: string; sub: string; href: string }) {
  return (
    <Link href={href}
          className="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-white/5">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
           style={{ background: 'rgba(11,148,136,0.1)' }}>
        <Icon size={17} style={{ color: 'var(--teal2)' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-dm font-medium text-white">{label}</p>
        <p className="text-xs font-dm truncate" style={{ color: 'var(--muted)' }}>{sub}</p>
      </div>
      <ChevronRight size={16} style={{ color: 'var(--muted)' }} />
    </Link>
  )
}

export default function SettingsPage() {
  return (
    <div className="px-5 space-y-5" style={{ animation: 'fadeIn 0.4s ease-out forwards' }}>

      {/* Main config */}
      <div>
        <p className="text-xs font-sora font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--subtle)' }}>
          Main Configuration
        </p>
        <div className="card p-0 overflow-hidden">
          {MAIN_CONFIG.map((item, i) => (
            <div key={item.href} style={{ borderBottom: i < MAIN_CONFIG.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <SettingsRow {...item} />
            </div>
          ))}
        </div>
      </div>

      {/* App preferences */}
      <div>
        <p className="text-xs font-sora font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--subtle)' }}>
          App Preferences
        </p>
        <div className="card p-0 overflow-hidden">
          {APP_PREFS.map((item, i) => (
            <div key={item.href} style={{ borderBottom: i < APP_PREFS.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <SettingsRow {...item} />
            </div>
          ))}
        </div>
      </div>

      {/* Version */}
      <p className="text-center text-xs font-dm pb-2" style={{ color: 'var(--muted)' }}>
        Voxel v1.0.0 · Built for accessibility
      </p>

    </div>
  )
}
