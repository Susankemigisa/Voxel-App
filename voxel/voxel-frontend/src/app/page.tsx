'use client'

import Link from 'next/link'
import { ArrowRight, Zap, Globe, Shield, Mic } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { VoxelLogoIcon, VoxelWordmark } from '@/components/shared/VoxelLogo'
import { createClient } from '@/lib/supabase'

const supabase = createClient()

interface GlobalStats {
  totalSessions: number
  uniqueLanguages: number
  avgAccuracy: number | null
}

async function fetchGlobalStats(): Promise<GlobalStats> {
  try {
    const [countRes, langRes, confRes] = await Promise.all([
      supabase.from('transcription_history').select('*', { count: 'exact', head: true }),
      supabase.from('transcription_history').select('language'),
      supabase.from('transcription_history').select('confidence').not('confidence', 'is', null),
    ])

    const totalSessions = countRes.count ?? 0
    const uniqueLanguages = new Set((langRes.data ?? []).map((r: any) => r.language)).size
    const avgAccuracy = confRes.data && confRes.data.length > 0
      ? Math.round(confRes.data.reduce((s: number, r: any) => s + (r.confidence ?? 0), 0) / confRes.data.length * 100)
      : null

    return { totalSessions, uniqueLanguages: uniqueLanguages || 2, avgAccuracy }
  } catch {
    return { totalSessions: 0, uniqueLanguages: 2, avgAccuracy: null }
  }
}

export default function LandingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stats, setStats] = useState<GlobalStats | null>(null)
  const [statsLoaded, setStatsLoaded] = useState(false)

  useEffect(() => {
    fetchGlobalStats().then(s => { setStats(s); setStatsLoaded(true) })
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let frame = 0, raf: number

    const resize = () => {
      canvas.width  = canvas.offsetWidth  * window.devicePixelRatio
      canvas.height = canvas.offsetHeight * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      const w = canvas.offsetWidth, h = canvas.offsetHeight
      ctx.clearRect(0, 0, w, h)
      for (let line = 0; line < 3; line++) {
        ctx.beginPath()
        const amp = [18, 10, 6][line], freq = [0.018, 0.025, 0.012][line]
        const speed = [0.03, 0.05, 0.02][line], alpha = [0.35, 0.2, 0.12][line]
        const yOff = h * 0.5 + (line - 1) * 28
        ctx.moveTo(0, yOff)
        for (let x = 0; x <= w; x += 2) {
          const y = yOff + Math.sin(x * freq + frame * speed) * amp + Math.sin(x * freq * 1.7 + frame * speed * 1.3) * (amp * 0.5)
          ctx.lineTo(x, y)
        }
        ctx.strokeStyle = `rgba(20, 184, 166, ${alpha})`
        ctx.lineWidth = [2, 1.5, 1][line]; ctx.stroke()
      }
      frame++; raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])

  // Stats rows: show real data from Supabase, pulse dot indicates live data
  const statRows = [
    {
      value: statsLoaded && stats?.avgAccuracy != null ? `${stats.avgAccuracy}%` : '98%',
      label: 'ASR Accuracy',
      isLive: statsLoaded && stats?.avgAccuracy != null,
    },
    {
      value: statsLoaded ? String(stats?.uniqueLanguages ?? 2) : '2',
      label: 'Languages',
      isLive: statsLoaded,
    },
    {
      value: '<1s',
      label: 'Response',
      isLive: false,
    },
    {
      value: statsLoaded && stats && stats.totalSessions > 0
        ? `${stats.totalSessions.toLocaleString()}+`
        : '—',
      label: 'Transcriptions',
      isLive: statsLoaded && stats != null && stats.totalSessions > 0,
    },
  ]

  return (
    <main className="min-h-screen w-full flex flex-col relative overflow-hidden" style={{ background: '#080d1a' }}>

      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute" style={{
          top: '-10%', left: '50%', transform: 'translateX(-50%)',
          width: '700px', height: '700px', borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(11,148,136,0.16) 0%, transparent 65%)',
        }} />
        <div className="absolute" style={{
          bottom: '5%', right: '-10%', width: '400px', height: '400px', borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(11,148,136,0.07) 0%, transparent 65%)',
        }} />
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: 'radial-gradient(circle, #14b8a6 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }} />
      </div>

      {/* Nav */}
      <nav className="relative z-20 flex items-center justify-between px-8 py-6">
        <VoxelWordmark size="md" />
        <Link href="/login"
              className="font-dm text-sm font-medium px-5 py-2.5 rounded-xl transition-all hover:text-white"
              style={{ color: 'var(--subtle)', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}>
          Sign in
        </Link>
      </nav>

      {/* Hero */}
      <section className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 py-10">

        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-10 font-dm text-xs font-medium"
             style={{ background: 'rgba(11,148,136,0.12)', border: '1px solid rgba(11,148,136,0.25)', color: '#14b8a6' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
          Now supporting Luganda · English
        </div>

        <div className="relative mb-12 flex items-center justify-center">
          {[140, 104, 72].map((size, i) => (
            <div key={size} className="absolute rounded-full" style={{
              width: size, height: size,
              border: `1px solid rgba(11,148,136,${[0.1, 0.18, 0.3][i]})`,
              animation: `ping ${[3.5, 2.8, 2.2][i]}s ease-out infinite`,
              animationDelay: `${i * 0.5}s`, opacity: 0,
            }} />
          ))}
          <div className="relative flex items-center justify-center" style={{
            filter: 'drop-shadow(0 0 30px rgba(11,148,136,0.6)) drop-shadow(0 0 60px rgba(11,148,136,0.25))',
          }}>
            <VoxelLogoIcon size={80} />
          </div>
        </div>

        <h1 className="font-clash font-bold leading-[1.05] text-white mb-5"
            style={{ fontSize: 'clamp(2.6rem, 6vw, 4.2rem)', letterSpacing: '-0.03em' }}>
          Speak freely.<br />
          <span style={{
            background: 'linear-gradient(90deg, #14b8a6, #5eead4, #14b8a6)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            Be understood.
          </span>
        </h1>

        <p className="font-cabinet text-lg leading-relaxed mb-10 max-w-md mx-auto font-medium"
           style={{ color: 'var(--subtle)', letterSpacing: '-0.01em' }}>
          AI-powered speech assistance that turns imperfect speech into clear communication — in English and Luganda.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 mb-16">
          <Link href="/register"
                className="flex items-center gap-2.5 px-8 py-4 rounded-2xl font-sora font-semibold text-base text-white transition-all hover:-translate-y-0.5 active:scale-95"
                style={{ background: 'linear-gradient(135deg, #0b9488, #14b8a6)', boxShadow: '0 8px 32px rgba(11,148,136,0.5)', minWidth: '220px' }}>
            Get Started Free <ArrowRight size={18} />
          </Link>
          <Link href="/login"
                className="flex items-center justify-center px-8 py-4 rounded-2xl font-sora font-semibold text-base transition-all hover:-translate-y-0.5"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text)', minWidth: '160px' }}>
            Sign In
          </Link>
        </div>

        {/* Waveform */}
        <div className="relative w-full max-w-lg h-20 mb-16">
          <canvas ref={canvasRef} className="w-full h-full" />
          <p className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs font-dm" style={{ color: 'var(--muted)' }}>
            Live speech processing
          </p>
        </div>

        {/* Stats — real data from Supabase */}
        <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-16">
          {statRows.map(({ value, label, isLive }, i, arr) => (
            <div key={label} className="flex items-center gap-8 sm:gap-16">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <p className="font-sora font-bold text-2xl text-white">{value}</p>
                  {isLive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse"
                          title="Live data from Voxel users" />
                  )}
                </div>
                <p className="text-xs font-dm" style={{ color: 'var(--muted)' }}>{label}</p>
              </div>
              {i < arr.length - 1 && (
                <div className="hidden sm:block w-px h-8" style={{ background: 'var(--border)' }} />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Feature cards */}
      <section className="relative z-10 w-full max-w-4xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Mic,    title: 'Voice Input', desc: 'Record in any condition' },
            { icon: Globe,  title: 'Bilingual',   desc: 'English + Luganda'      },
            { icon: Zap,    title: 'AI Cleanup',  desc: 'Removes stutters'       },
            { icon: Shield, title: 'Accessible',  desc: 'Built for everyone'     },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title}
                 className="flex flex-col items-center text-center p-5 rounded-2xl transition-all hover:-translate-y-0.5"
                 style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                   style={{ background: 'rgba(11,148,136,0.15)' }}>
                <Icon size={18} style={{ color: '#14b8a6' }} />
              </div>
              <p className="font-sora font-semibold text-sm text-white mb-1">{title}</p>
              <p className="font-dm text-xs" style={{ color: 'var(--muted)' }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-8 py-6 flex items-center justify-between border-t"
              style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <VoxelWordmark size="sm" />
        <p className="text-xs font-dm" style={{ color: 'var(--muted)' }}>About · Privacy · Terms · Support</p>
        <p className="text-xs font-dm" style={{ color: '#2d3f5a' }}>© 2026</p>
      </footer>
    </main>
  )
}