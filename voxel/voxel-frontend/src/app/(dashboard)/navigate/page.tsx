'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Navigation, MapPin, Clock, Car, PersonStanding,
  RefreshCw, Share2, AlertTriangle, ChevronRight, Mic, Type,
  RotateCcw, Zap,
} from 'lucide-react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Route {
  id: string
  label: string
  duration: string
  distance: string
  via: string
  traffic: 'light' | 'moderate' | 'heavy'
  recommended: boolean
  mode: TravelMode
}

type TravelMode = 'driving' | 'walking' | 'transit'

const TRAFFIC_COLOR: Record<Route['traffic'], string> = {
  light:    '#14b8a6',
  moderate: '#f59e0b',
  heavy:    '#ef4444',
}

const TRAFFIC_LABEL: Record<Route['traffic'], string> = {
  light:    'Light traffic',
  moderate: 'Moderate traffic',
  heavy:    'Heavy traffic',
}

// ─── Mock route generator (replace with real Directions API later) ─────────────
function generateRoutes(destination: string, mode: TravelMode): Route[] {
  const dest = destination.toLowerCase()

  const drivingTimes: Record<string, [string, string][]> = {
    'kampala':    [['25–35 min', '12.4 km'], ['35–50 min', '14.1 km'], ['40–55 min', '11.8 km']],
    'ntinda':     [['18–25 min', '6.2 km'],  ['25–35 min', '7.8 km']],
    'kawempe':    [['20–30 min', '8.5 km'],  ['30–40 min', '9.2 km']],
    'jinja':      [['1h 20–1h 40 min', '81 km'], ['1h 30–1h 50 min', '84 km']],
    'fort portal':['3h 30–4h', '302 km'],
    'fortportal': [['3h 30–4h', '302 km']],
    'entebbe':    [['45–60 min', '41 km'],   ['55–70 min', '43 km']],
    'gulu':       [['4h–4h 30', '337 km']],
    'mbarara':    [['3h–3h 30', '272 km']],
    'mbale':      [['3h 30–4h', '232 km']],
  }

  const viaOptions: Record<string, string[][]> = {
    'kampala':    [['Jinja Road'], ['Kampala–Entebbe Expressway'], ['Old Port Bell Road']],
    'ntinda':     [['Ntinda Road'], ['Bukoto–Ntinda Road']],
    'kawempe':    [['Northern Bypass'], ['Bombo Road']],
    'jinja':      [['Jinja Road / A109'], ['Mukono Road']],
    'fort portal':[['Kampala–Fort Portal Road (A109)']],
    'fortportal': [['Kampala–Fort Portal Road (A109)']],
    'entebbe':    [['Entebbe Expressway'], ['Old Entebbe Road']],
    'gulu':       [['Gulu Highway (A1)']],
    'mbarara':    [['Masaka Road (A109)']],
    'mbale':      [['Jinja–Mbale Road']],
  }

  const matched = Object.keys(drivingTimes).find(k => dest.includes(k))
  const times   = matched ? drivingTimes[matched] : [['30–45 min', '15 km'], ['40–55 min', '18 km']]
  const vias    = matched ? viaOptions[matched]   : [['Main Road'], ['Alternative Road']]

  if (mode === 'walking') {
    return times.slice(0, 1).map((t, i) => ({
      id: `w${i}`,
      label: i === 0 ? 'Walking Route' : `Walking Alt ${i + 1}`,
      duration: t[0].replace(/\d+–\d+ min/, m => {
        const [lo, hi] = m.replace(' min', '').split('–').map(Number)
        return `${lo * 12}–${hi * 12} min`
      }),
      distance: t[1],
      via: vias[i]?.[0] ?? 'Walking Path',
      traffic: 'light' as const,
      recommended: i === 0,
      mode: 'walking',
    }))
  }

  if (mode === 'transit') {
    return times.slice(0, 2).map((t, i) => ({
      id: `t${i}`,
      label: i === 0 ? 'Taxi / Matatu' : 'Boda Boda Route',
      duration: t[0],
      distance: t[1],
      via: i === 0 ? (vias[i]?.[0] ?? 'Stage Route') : 'Boda Route',
      traffic: (['light', 'moderate', 'heavy'] as const)[Math.min(i, 2)],
      recommended: i === 0,
      mode: 'transit',
    }))
  }

  // Driving
  const traffics: Route['traffic'][] = ['light', 'moderate', 'heavy']
  return times.map((t, i) => ({
    id: `d${i}`,
    label: i === 0 ? 'Fastest Route' : i === 1 ? 'Alternative Route' : 'Scenic Route',
    duration: t[0],
    distance: t[1],
    via: vias[i]?.[0] ?? `Route ${i + 1}`,
    traffic: traffics[Math.min(i, 2)],
    recommended: i === 0,
    mode: 'driving',
  }))
}

// ─── Map iframe URL builder ────────────────────────────────────────────────────
function buildMapUrl(destination: string, mode: TravelMode) {
  const modeParam: Record<TravelMode, string> = {
    driving: 'driving',
    walking: 'walking',
    transit: 'transit',
  }
  const encoded = encodeURIComponent(destination)
  // Use embed directions from current location to destination
  return `https://www.google.com/maps/embed/v1/directions?key=AIzaSyBFw0Qbyqaan3AFQFTObNMZL32PFVZL5DM&origin=Kampala,Uganda&destination=${encoded}&mode=${modeParam[mode]}`
}

function buildExternalUrl(destination: string, mode: TravelMode) {
  const modeParam: Record<TravelMode, string> = {
    driving: 'driving',
    walking: 'walking',
    transit: 'transit',
  }
  const encoded = encodeURIComponent(destination)
  return `https://www.google.com/maps/dir/?api=1&destination=${encoded}&travelmode=${modeParam[mode]}`
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function RouteCard({ route, selected, onSelect }: { route: Route; selected: boolean; onSelect: () => void }) {
  const modeIcon: Record<TravelMode, string> = { driving: '🚗', walking: '🚶', transit: '🚌' }

  return (
    <button
      onClick={onSelect}
      className="w-full text-left rounded-2xl p-4 transition-all active:scale-98"
      style={{
        background: selected ? 'rgba(11,148,136,0.08)' : 'var(--card)',
        border: `1.5px solid ${selected ? 'rgba(11,148,136,0.45)' : 'var(--border)'}`,
        boxShadow: selected ? '0 0 0 1px rgba(11,148,136,0.15)' : 'none',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
            style={{ background: selected ? 'rgba(11,148,136,0.15)' : 'var(--border)' }}
          >
            {modeIcon[route.mode]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-sora font-semibold text-sm" style={{ color: 'var(--text)' }}>
                {route.label}
              </span>
              {route.recommended && (
                <span
                  className="text-xs font-sora font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(11,148,136,0.15)', color: '#14b8a6' }}
                >
                  Recommended
                </span>
              )}
            </div>
            <p className="text-xs font-dm mt-0.5 truncate" style={{ color: 'var(--muted)' }}>
              via {route.via}
            </p>
          </div>
        </div>
        <ChevronRight size={16} style={{ color: 'var(--muted)', flexShrink: 0, marginTop: 2 }} />
      </div>

      <div className="flex items-center gap-4 mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex items-center gap-1.5">
          <Clock size={13} style={{ color: '#14b8a6' }} />
          <span className="font-sora font-bold text-sm" style={{ color: 'var(--text)' }}>
            {route.duration}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <MapPin size={13} style={{ color: 'var(--muted)' }} />
          <span className="font-dm text-xs" style={{ color: 'var(--muted)' }}>
            {route.distance}
          </span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: TRAFFIC_COLOR[route.traffic] }}
          />
          <span className="font-dm text-xs" style={{ color: TRAFFIC_COLOR[route.traffic] }}>
            {TRAFFIC_LABEL[route.traffic]}
          </span>
        </div>
      </div>
    </button>
  )
}

// ─── Main Navigate Page ────────────────────────────────────────────────────────
function NavigateContent() {
  const params      = useSearchParams()
  const router      = useRouter()
  const rawDest     = params.get('destination') || ''
  const rawQuery    = params.get('query') || rawDest

  const [destination, setDestination] = useState(rawDest)
  const [query,       setQuery]       = useState(rawQuery || (rawDest ? `${rawDest}, Uganda` : ''))
  const [mode,        setMode]        = useState<TravelMode>('driving')
  const [routes,      setRoutes]      = useState<Route[]>([])
  const [selectedId,  setSelectedId]  = useState<string>('')
  const [mapLoaded,   setMapLoaded]   = useState(false)
  const [customInput, setCustomInput] = useState('')
  const [showInput,   setShowInput]   = useState(!rawDest)

  const loadRoutes = useCallback((dest: string, m: TravelMode) => {
    setMapLoaded(false)
    const r = generateRoutes(dest, m)
    setRoutes(r)
    setSelectedId(r[0]?.id ?? '')
    setTimeout(() => setMapLoaded(true), 800)
  }, [])

  useEffect(() => {
    if (destination) loadRoutes(destination, mode)
  }, [destination, mode, loadRoutes])

  const handleCustomSearch = () => {
    if (!customInput.trim()) return
    const dest  = customInput.trim()
    const q     = dest.toLowerCase().includes('uganda') ? dest : `${dest}, Uganda`
    setDestination(dest)
    setQuery(q)
    setShowInput(false)
    setCustomInput('')
    router.replace(`/navigate?destination=${encodeURIComponent(dest)}&query=${encodeURIComponent(q)}`)
  }

  const openInMaps = () => {
    window.open(buildExternalUrl(query || `${destination}, Uganda`, mode), '_blank')
  }

  const share = () => {
    const url = buildExternalUrl(query || `${destination}, Uganda`, mode)
    if (navigator.share) {
      navigator.share({ title: `Navigate to ${destination}`, url })
    } else {
      navigator.clipboard.writeText(url)
    }
  }

  const MODES: { key: TravelMode; icon: string; label: string }[] = [
    { key: 'driving', icon: '🚗', label: 'Drive'  },
    { key: 'transit', icon: '🚌', label: 'Taxi'   },
    { key: 'walking', icon: '🚶', label: 'Walk'   },
  ]

  const QUICK_DESTINATIONS = [
    { name: 'Kampala CBD',   query: 'Kampala CBD, Uganda'        },
    { name: 'Ntinda',        query: 'Ntinda, Kampala, Uganda'    },
    { name: 'Kawempe',       query: 'Kawempe, Kampala, Uganda'   },
    { name: 'Entebbe',       query: 'Entebbe, Uganda'            },
    { name: 'Jinja',         query: 'Jinja, Uganda'              },
    { name: 'Fort Portal',   query: 'Fort Portal, Uganda'        },
  ]

  return (
    <div className="flex flex-col pb-28" style={{ minHeight: '100vh' }}>

      {/* ── Header ── */}
      <div
        className="sticky top-0 z-30 px-5 pt-12 pb-4"
        style={{ background: 'linear-gradient(135deg,#0b9488,#0a6560)' }}
      >
        <div className="flex items-center gap-3 mb-3">
          <Link
            href="/home"
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.2)' }}
          >
            <ArrowLeft size={18} className="text-white" />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-dm" style={{ color: 'rgba(255,255,255,0.7)' }}>
              Navigating to
            </p>
            <h1 className="font-clash font-bold text-lg text-white truncate leading-tight">
              {destination || 'Choose destination'}
            </h1>
          </div>
          <button
            onClick={() => setShowInput(v => !v)}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.2)' }}
          >
            {showInput ? <RotateCcw size={16} className="text-white" /> : <Type size={16} className="text-white" />}
          </button>
        </div>

        {/* Mode tabs */}
        <div
          className="flex p-1 rounded-2xl gap-1"
          style={{ background: 'rgba(0,0,0,0.2)' }}
        >
          {MODES.map(m => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className="flex-1 py-2 rounded-xl text-xs font-sora font-semibold transition-all flex items-center justify-center gap-1.5"
              style={mode === m.key
                ? { background: 'rgba(255,255,255,0.25)', color: '#fff' }
                : { color: 'rgba(255,255,255,0.6)' }}
            >
              <span>{m.icon}</span> {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 pt-4 space-y-4">

        {/* ── Custom input ── */}
        {showInput && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <div className="p-3">
              <p className="text-xs font-sora font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>
                Enter Destination
              </p>
              <div className="flex gap-2">
                <input
                  value={customInput}
                  onChange={e => setCustomInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCustomSearch()}
                  placeholder="e.g. Ntinda, Fort Portal, Mulago…"
                  className="flex-1 rounded-xl px-3 py-2.5 text-sm font-dm outline-none"
                  style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  autoFocus
                />
                <button
                  onClick={handleCustomSearch}
                  className="px-4 py-2.5 rounded-xl font-sora font-semibold text-sm text-white flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#0b9488,#14b8a6)' }}
                >
                  Go
                </button>
              </div>
            </div>

            {/* Quick destinations */}
            <div className="px-3 pb-3">
              <p className="text-xs font-dm mb-2" style={{ color: 'var(--muted)' }}>Quick destinations:</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_DESTINATIONS.map(d => (
                  <button
                    key={d.name}
                    onClick={() => { setDestination(d.name); setQuery(d.query); setShowInput(false) }}
                    className="px-3 py-1.5 rounded-xl text-xs font-sora font-semibold transition-all active:scale-95"
                    style={{ background: 'rgba(11,148,136,0.1)', color: '#14b8a6', border: '1px solid rgba(11,148,136,0.2)' }}
                  >
                    📍 {d.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {destination && (
          <>
            {/* ── Map ── */}
            <div
              className="rounded-3xl overflow-hidden relative"
              style={{ height: 220, background: 'var(--card)', border: '1px solid var(--border)' }}
            >
              {!mapLoaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10"
                     style={{ background: 'var(--card)' }}>
                  <div
                    className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: 'rgba(11,148,136,0.3)', borderTopColor: '#14b8a6' }}
                  />
                  <p className="text-xs font-dm" style={{ color: 'var(--muted)' }}>Loading map…</p>
                </div>
              )}
              <iframe
                title="map"
                width="100%"
                height="100%"
                style={{ border: 0, opacity: mapLoaded ? 1 : 0, transition: 'opacity 0.4s' }}
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://www.google.com/maps/embed/v1/directions?key=AIzaSyC6gkClYPyCO_GXFa7YgHJvqHjRTGqd0GI&origin=My+Location&destination=${encodeURIComponent(query || destination + ', Uganda')}&mode=${mode}`}
                onLoad={() => setMapLoaded(true)}
              />
            </div>

            {/* Open in Google Maps button */}
            <div className="flex gap-3">
              <button
                onClick={openInMaps}
                className="flex-1 py-3 rounded-2xl font-sora font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-95"
                style={{
                  background: 'linear-gradient(135deg,#0b9488,#14b8a6)',
                  boxShadow: '0 4px 16px rgba(11,148,136,0.4)',
                }}
              >
                <Navigation size={16} /> Open in Google Maps
              </button>
              <button
                onClick={share}
                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all active:scale-95"
                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
              >
                <Share2 size={16} style={{ color: 'var(--muted)' }} />
              </button>
            </div>

            {/* ── Routes ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-sora font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                  {routes.length} {routes.length === 1 ? 'Route' : 'Routes'} Available
                </p>
                <button
                  onClick={() => loadRoutes(destination, mode)}
                  className="flex items-center gap-1.5 text-xs font-dm"
                  style={{ color: '#14b8a6' }}
                >
                  <RefreshCw size={12} /> Refresh
                </button>
              </div>
              <div className="space-y-3">
                {routes.map(r => (
                  <RouteCard
                    key={r.id}
                    route={r}
                    selected={r.id === selectedId}
                    onSelect={() => {
                      setSelectedId(r.id)
                      openInMaps()
                    }}
                  />
                ))}
              </div>
            </div>

            {/* ── Tips ── */}
            <div
              className="rounded-2xl p-4 flex gap-3"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}
            >
              <AlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }} />
              <div>
                <p className="text-xs font-sora font-semibold" style={{ color: '#f59e0b' }}>Uganda Traffic Tip</p>
                <p className="text-xs font-dm mt-0.5" style={{ color: 'var(--muted)' }}>
                  Kampala traffic peaks 7–9 AM and 5–8 PM. Boda bodas are fastest for short distances in the city. For long distances, matatu stages have fixed fares.
                </p>
              </div>
            </div>

            {/* ── Voice input again ── */}
            <div
              className="rounded-2xl p-4 flex items-center gap-4"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(11,148,136,0.1)' }}
              >
                <Mic size={18} style={{ color: '#14b8a6' }} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-sora font-semibold" style={{ color: 'var(--text)' }}>
                  Navigate somewhere else?
                </p>
                <p className="text-xs font-dm mt-0.5" style={{ color: 'var(--muted)' }}>
                  Say "Take me to…" or type a new destination
                </p>
              </div>
              <Link
                href="/voice"
                className="px-3 py-2 rounded-xl text-xs font-sora font-semibold"
                style={{ background: 'rgba(11,148,136,0.1)', color: '#14b8a6' }}
              >
                Speak
              </Link>
            </div>
          </>
        )}

        {/* ── Empty state ── */}
        {!destination && !showInput && (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <div
              className="w-16 h-16 rounded-3xl flex items-center justify-center"
              style={{ background: 'rgba(11,148,136,0.1)' }}
            >
              <Navigation size={28} style={{ color: '#14b8a6' }} />
            </div>
            <div>
              <p className="font-clash font-bold text-lg" style={{ color: 'var(--text)' }}>
                Where are you going?
              </p>
              <p className="font-dm text-sm mt-1" style={{ color: 'var(--muted)' }}>
                Say "Take me to Ntinda" on the Voice page, or type a destination above
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/voice"
                className="flex items-center gap-2 px-4 py-3 rounded-2xl font-sora font-semibold text-sm text-white"
                style={{ background: 'linear-gradient(135deg,#0b9488,#14b8a6)' }}
              >
                <Mic size={16} /> Voice Input
              </Link>
              <button
                onClick={() => setShowInput(true)}
                className="flex items-center gap-2 px-4 py-3 rounded-2xl font-sora font-semibold text-sm"
                style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
              >
                <Type size={16} /> Type It
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function NavigatePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
             style={{ borderColor: 'rgba(11,148,136,0.3)', borderTopColor: '#14b8a6' }} />
      </div>
    }>
      <NavigateContent />
    </Suspense>
  )
}
