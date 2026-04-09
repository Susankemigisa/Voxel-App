'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Mic, Volume2, ChevronRight, Zap, Clock, TrendingUp, Globe, Navigation } from 'lucide-react'
import { useAppStore } from '@/lib/store/authStore'
import { fetchUserStats } from '@/lib/api/realtime'
import { useRef } from 'react'

function useGreeting(name: string) {
  const h    = new Date().getHours()
  const time = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return `${time}, ${name || 'there'} 👋`
}

function AnimatedWave() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let frame = 0, raf: number
    const resize = () => {
      canvas.width  = canvas.offsetWidth  * window.devicePixelRatio
      canvas.height = canvas.offsetHeight * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }
    resize()
    const draw = () => {
      const w = canvas.offsetWidth, h = canvas.offsetHeight
      ctx.clearRect(0, 0, w, h)
      for (let l = 0; l < 3; l++) {
        ctx.beginPath()
        const amp = [12,7,4][l], freq = [0.02,0.03,0.015][l], speed = [0.025,0.04,0.018][l]
        ctx.moveTo(0, h*.5)
        for (let x = 0; x <= w; x += 2)
          ctx.lineTo(x, h*.5 + Math.sin(x*freq+frame*speed)*amp + Math.sin(x*freq*1.6+frame*speed*1.2)*(amp*.4))
        ctx.strokeStyle = `rgba(255,255,255,${[0.5,0.25,0.12][l]})`
        ctx.lineWidth = [2,1.5,1][l]; ctx.stroke()
      }
      frame++; raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={canvasRef} className="w-full h-full" />
}

export default function HomePage() {
  const user     = useAppStore(s => s.user)
  const greeting = useGreeting(user?.displayName?.split(' ')[0] || '')

  const [stats,   setStats]   = useState({ sessions: 0, accuracy: 0, languages: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    fetchUserStats(user.id).then(s => { setStats(s); setLoading(false) })
  }, [user?.id])

  const QUICK_ACTIONS = [
    { href: '/voice',    icon: Mic,        title: 'Voice Input',    sub: 'Speak naturally',   grad: 'linear-gradient(135deg,#0b9488,#14b8a6)', glow: 'rgba(11,148,136,0.45)' },
    { href: '/navigate', icon: Navigation, title: 'Navigate',       sub: 'Get directions',    grad: 'linear-gradient(135deg,#2563eb,#3b82f6)', glow: 'rgba(37,99,235,0.45)'  },
    { href: '/tts',      icon: Volume2,    title: 'Text to Speech', sub: 'Convert & hear it', grad: 'linear-gradient(135deg,#7c3aed,#a78bfa)', glow: 'rgba(124,58,237,0.45)' },
  ]

  const STAT_ITEMS = [
    { label: 'Sessions',  value: loading ? '—' : String(stats.sessions),                          icon: TrendingUp },
    { label: 'Accuracy',  value: loading ? '—' : stats.accuracy ? `${stats.accuracy}%` : '—',     icon: Zap        },
    { label: 'Languages', value: loading ? '—' : stats.languages ? String(stats.languages) : '—', icon: Globe      },
  ]

  return (
    <div className="px-5 pb-6 space-y-5" style={{ animation: 'fadeIn 0.4s ease-out forwards' }}>

      {/* Greeting hero */}
      <div className="relative rounded-3xl overflow-hidden" style={{ background: 'linear-gradient(135deg,#0b9488 0%,#0a6560 100%)', minHeight: 156 }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle,white 1px,transparent 1px)', backgroundSize: '20px 20px' }} />
        <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full opacity-15" style={{ background: 'radial-gradient(circle,white,transparent)' }} />
        <div className="relative z-10 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-sora font-bold text-sm text-white"
                   style={{ background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.35)' }}>
                {user?.initials || '?'}
              </div>
              <div>
                <p className="text-xs font-dm" style={{ color: 'rgba(255,255,255,0.65)' }}>Welcome back</p>
                <p className="font-sora font-semibold text-white text-sm">{user?.displayName || '...'}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                 style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span className="text-xs font-dm text-white">AI Ready</span>
            </div>
          </div>
          <h2 className="font-clash font-bold text-2xl text-white mb-1 leading-tight">{greeting}</h2>
          <p className="text-sm font-dm mb-3" style={{ color: 'rgba(255,255,255,0.7)' }}>What would you like to communicate today?</p>
          <div className="h-7 w-full"><AnimatedWave /></div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-3">
        {QUICK_ACTIONS.map(({ href, icon: Icon, title, sub, grad, glow }) => (
          <Link key={href} href={href}
                className="relative rounded-3xl p-5 flex flex-col gap-3 overflow-hidden transition-all active:scale-95"
                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-10 -translate-y-3 translate-x-3"
                 style={{ background: glow.replace('0.45','1') }} />
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
                 style={{ background: grad, boxShadow: `0 4px 16px ${glow}` }}>
              <Icon size={20} className="text-white" />
            </div>
            <div>
              <p className="font-sora font-semibold text-sm" style={{ color: 'var(--text)' }}>{title}</p>
              <p className="font-dm text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{sub}</p>
            </div>
            <ChevronRight size={14} className="absolute bottom-4 right-4" style={{ color: 'var(--muted)' }} />
          </Link>
        ))}
      </div>

      {/* Stats */}
      <div className="rounded-3xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <p className="text-xs font-sora font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>
          Your Activity
        </p>
        <div className="flex items-center justify-between">
          {STAT_ITEMS.map(({ label, value, icon: Icon }, i, arr) => (
            <div key={label} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2" style={{ background: 'rgba(11,148,136,0.12)' }}>
                  <Icon size={14} style={{ color: '#14b8a6' }} />
                </div>
                <p className="font-sora font-bold text-lg" style={{ color: 'var(--text)' }}>{value}</p>
                <p className="font-dm text-xs" style={{ color: 'var(--muted)' }}>{label}</p>
              </div>
              {i < arr.length - 1 && <div className="w-px h-12" style={{ background: 'var(--border)' }} />}
            </div>
          ))}
        </div>
        {!loading && stats.sessions === 0 && (
          <p className="text-center text-xs font-dm mt-3 pt-3"
             style={{ color: 'var(--muted)', borderTop: '1px solid var(--border)' }}>
            No sessions yet — tap Voice Input to get started 🎙️
          </p>
        )}
      </div>

      {/* Recent Sessions — single button linking to full sessions page */}
      <Link
        href="/sessions"
        className="flex items-center gap-4 rounded-3xl p-4 transition-all active:scale-[0.98]"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
             style={{ background: 'rgba(11,148,136,0.1)' }}>
          <Clock size={20} style={{ color: '#14b8a6' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-sora font-semibold text-sm" style={{ color: 'var(--text)' }}>Recent Sessions</p>
          <p className="font-dm text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            {loading ? 'Loading…' : stats.sessions === 0 ? 'No sessions yet' : `${stats.sessions} transcription${stats.sessions !== 1 ? 's' : ''}`}
          </p>
        </div>
        <ChevronRight size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} />
      </Link>

    </div>
  )
}