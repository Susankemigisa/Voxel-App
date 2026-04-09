'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Navigation, Clock, RefreshCw, ChevronRight, Mic } from 'lucide-react'
import Link from 'next/link'

type TravelMode = 'driving' | 'walking' | 'cycling'

interface RouteResult {
  id: string
  label: string
  duration: string
  distance: string
  durationSec: number
  distanceM: number
  coordinates: [number, number][]
  recommended: boolean
  color: string
}

const ROUTE_COLORS = ['#14b8a6', '#3b82f6', '#a855f7']
const ROUTE_LABELS = ['Fastest Route', 'Alternative Route', 'Scenic Route']
const KAMPALA: [number, number] = [0.3476, 32.5825]

// ── Realistic Uganda time estimation ─────────────────────────────────────────
// OSRM gives wildly wrong times for Uganda (assumes European road speeds).
// We use OSRM only for the ROUTE GEOMETRY (distance + road path) which is
// accurate, and compute duration ourselves from real Uganda speed averages.
//
// Real-world Uganda averages (from traffic data & local knowledge):
//   Driving city <5km:    8 km/h peak,  15 km/h off-peak  (severe congestion)
//   Driving 5–15km:      15 km/h peak,  25 km/h off-peak
//   Driving 15–40km:     25 km/h peak,  35 km/h off-peak  (mixed urban/peri)
//   Driving >40km:       50 km/h peak,  70 km/h off-peak  (more highway)
//   Boda boda:           14 km/h peak,  20 km/h off-peak  (weaves but slower)
//   Walking:              4 km/h        (fairly constant)
//
// Result: Mukono→Kampala ~35km driving = ~60–85 min (realistic), not 7 min.
function estimateUgandaDuration(distanceM: number, mode: TravelMode): number {
  const hour = new Date().getHours()
  const isPeak = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20)

  if (mode === 'walking') {
    return distanceM / (4000 / 3600)  // 4 km/h constant
  }

  if (mode === 'cycling') {
    // Boda boda is faster than a car in heavy traffic but still slows down
    const speedKmh = isPeak ? 14 : 20
    return distanceM / (speedKmh * 1000 / 3600)
  }

  // Driving — segment by distance
  let speedKmh: number
  if (distanceM < 5_000) {
    speedKmh = isPeak ? 8 : 15
  } else if (distanceM < 15_000) {
    speedKmh = isPeak ? 15 : 25
  } else if (distanceM < 40_000) {
    speedKmh = isPeak ? 25 : 35
  } else {
    speedKmh = isPeak ? 50 : 70
  }
  return distanceM / (speedKmh * 1000 / 3600)
}

function fmtDur(s: number): string {
  if (s < 60) return `${Math.round(s)}s`
  if (s < 3600) return `${Math.round(s / 60)} min`
  const h = Math.floor(s / 3600)
  const m = Math.round((s % 3600) / 60)
  return m ? `${h}h ${m}min` : `${h}h`
}

function fmtDist(m: number): string {
  return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`
}

async function geocode(query: string) {
  try {
    const q = /uganda/i.test(query) ? query : `${query}, Uganda`
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=ug`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'VoxelASR/1.0' } }
    )
    const data = await res.json()
    if (!data[0]) return null
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }
  } catch { return null }
}

async function fetchRoutes(
  origin: [number, number],
  dest: [number, number],
  mode: TravelMode
): Promise<RouteResult[]> {
  // ALWAYS use the car profile regardless of mode.
  // Reason: bike/foot profiles return very different (often longer) distances
  // because OSRM routes them along cycling/pedestrian paths instead of roads.
  // This causes boda to look slower than driving for the same trip.
  // Car profile gives the actual road distance, which we then apply
  // Uganda-realistic speeds to per mode.
  const coords = `${origin[1]},${origin[0]};${dest[1]},${dest[0]}`
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/car/${coords}?alternatives=true&overview=full&geometries=geojson`
    )
    const data = await res.json()
    if (data.code !== 'Ok' || !data.routes?.length) return []
    return data.routes.slice(0, 3).map((r: any, i: number) => {
      // Same road distance for all modes — duration differs by mode speed only.
      const realisticDuration = estimateUgandaDuration(r.distance, mode)
      return {
        id: `r${i}`,
        label: ROUTE_LABELS[i] ?? `Route ${i + 1}`,
        duration: fmtDur(realisticDuration),
        distance: fmtDist(r.distance),
        durationSec: realisticDuration,
        distanceM: r.distance,
        coordinates: r.geometry.coordinates as [number, number][],
        recommended: i === 0,
        color: ROUTE_COLORS[i] ?? '#6b7280',
      }
    })
  } catch { return [] }
}

// ── Map ───────────────────────────────────────────────────────────────────────
function MapView(props: {
  origin: [number, number]; destination: [number, number]
  routes: RouteResult[]; selectedId: string
}) {
  const divRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const linesRef = useRef<any>(null)
  const { origin, destination, routes, selectedId } = props

  function drawLines(L: any) {
    if (!mapRef.current) return
    if (linesRef.current) linesRef.current.clearLayers()
    const group = L.layerGroup().addTo(mapRef.current)
    linesRef.current = group
    routes.forEach(r => {
      const isSelected = r.id === selectedId
      const latLngs = r.coordinates.map(([lng, lat]: [number, number]) => [lat, lng])
      L.polyline(latLngs, {
        color: r.color, weight: isSelected ? 6 : 3,
        opacity: isSelected ? 0.95 : 0.4, dashArray: isSelected ? undefined : '8 6',
      }).addTo(group)
    })
  }

  function buildMap(L: any) {
    if (!divRef.current || mapRef.current) return
    delete (L.Icon.Default.prototype as any)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    })
    const mid: [number, number] = [(origin[0] + destination[0]) / 2, (origin[1] + destination[1]) / 2]
    const map = L.map(divRef.current).setView(mid, 12)
    mapRef.current = map
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map)
    L.marker([origin[0], origin[1]], {
      icon: L.divIcon({ html: '<div style="width:14px;height:14px;border-radius:50%;background:#14b8a6;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4)"></div>', className: '', iconAnchor: [7, 7] }),
    }).addTo(map).bindPopup('Your Location')
    L.marker([destination[0], destination[1]], {
      icon: L.divIcon({ html: '<div style="width:16px;height:16px;border-radius:50%;background:#ef4444;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4)"></div>', className: '', iconAnchor: [8, 8] }),
    }).addTo(map).bindPopup('Destination')
    map.fitBounds([[origin[0], origin[1]], [destination[0], destination[1]]], { padding: [48, 48] })
    if (routes.length) drawLines(L)
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!document.getElementById('lf-css')) {
      const link = document.createElement('link')
      link.id = 'lf-css'; link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }
    const win = window as any
    if (win.L) { buildMap(win.L) }
    else if (!document.getElementById('lf-js')) {
      const script = document.createElement('script')
      script.id = 'lf-js'; script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      script.onload = () => buildMap((window as any).L)
      document.head.appendChild(script)
    } else {
      const t = setInterval(() => { if ((window as any).L) { clearInterval(t); buildMap((window as any).L) } }, 80)
      return () => clearInterval(t)
    }
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null } }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const L = (window as any).L
    if (L && mapRef.current) drawLines(L)
  }, [routes, selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={divRef} style={{ width: '100%', height: '100%' }} />
}

function RouteCard({ route, selected, onSelect }: { route: RouteResult; selected: boolean; onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="w-full text-left rounded-2xl p-4 transition-all active:scale-[0.98]"
            style={{ background: selected ? 'rgba(11,148,136,0.08)' : 'var(--card)', border: `1.5px solid ${selected ? route.color : 'var(--border)'}` }}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
             style={{ background: selected ? `${route.color}22` : 'var(--border)' }}>
          {route.recommended ? '⭐' : '🗺️'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-sora font-semibold text-sm" style={{ color: 'var(--text)' }}>{route.label}</span>
            {route.recommended && (
              <span className="text-xs font-sora font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: `${route.color}22`, color: route.color }}>Recommended</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex items-center gap-1">
              <Clock size={11} style={{ color: route.color }} />
              <span className="font-sora font-bold text-sm" style={{ color: 'var(--text)' }}>{route.duration}</span>
            </div>
            <div className="flex items-center gap-1">
              <Navigation size={11} style={{ color: 'var(--muted)' }} />
              <span className="font-dm text-xs" style={{ color: 'var(--muted)' }}>{route.distance}</span>
            </div>
            <div className="flex items-center gap-1 ml-auto">
              <div className="w-5 h-2 rounded-full" style={{ background: route.color }} />
              <span className="text-xs font-dm" style={{ color: 'var(--muted)' }}>on map</span>
            </div>
          </div>
        </div>
        <ChevronRight size={15} style={{ color: 'var(--muted)', flexShrink: 0 }} />
      </div>
    </button>
  )
}

function Spinner() {
  return <div className="w-6 h-6 rounded-full border-2 animate-spin"
              style={{ borderColor: 'rgba(11,148,136,0.3)', borderTopColor: '#14b8a6' }} />
}

function NavigateContent() {
  const params = useSearchParams()
  const router = useRouter()
  const [destination, setDestination] = useState(params.get('destination') || '')
  const [customInput, setCustomInput] = useState('')
  const [showInput, setShowInput] = useState(!params.get('destination'))
  const [origin, setOrigin] = useState<[number, number]>(KAMPALA)
  const [destCoords, setDestCoords] = useState<[number, number] | null>(null)
  const [routes, setRoutes] = useState<RouteResult[]>([])
  // Cache raw OSRM geometry so switching mode never re-fetches the network
  const rawRoutesRef = useRef<Array<{ distance: number; coordinates: [number, number][] }>>([])
  const [selectedId, setSelectedId] = useState('')
  const [mode, setMode] = useState<TravelMode>('driving')
  const [geocoding, setGeocoding] = useState(false)
  const [routing, setRouting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(p => setOrigin([p.coords.latitude, p.coords.longitude]), () => {})
  }, [])

  // Recompute times from cached geometry when mode changes — no network call needed
  function recomputeForMode(m: TravelMode) {
    if (!rawRoutesRef.current.length) return
    const computed = rawRoutesRef.current.map((r, i) => ({
      id: `r${i}`,
      label: ROUTE_LABELS[i] ?? `Route ${i + 1}`,
      duration: fmtDur(estimateUgandaDuration(r.distance, m)),
      distance: fmtDist(r.distance),
      durationSec: estimateUgandaDuration(r.distance, m),
      distanceM: r.distance,
      coordinates: r.coordinates,
      recommended: i === 0,
      color: ROUTE_COLORS[i] ?? '#6b7280',
    }))
    setRoutes(computed)
    setSelectedId(computed[0]?.id ?? '')
  }

  async function go(dest: string, m: TravelMode) {
    if (!dest.trim()) return
    setError(''); setGeocoding(true); setRoutes([]); setDestCoords(null)
    rawRoutesRef.current = []
    const geo = await geocode(dest)
    setGeocoding(false)
    if (!geo) { setError(`Could not find "${dest}". Try a more specific name.`); return }
    const dc: [number, number] = [geo.lat, geo.lon]
    setDestCoords(dc); setRouting(true)
    const r = await fetchRoutes(origin, dc, m)
    // Cache raw route data (distance + geometry only) for mode switching
    rawRoutesRef.current = r.map(route => ({ distance: route.distanceM, coordinates: route.coordinates }))
    setRouting(false); setRoutes(r); setSelectedId(r[0]?.id ?? '')
  }

  // Only re-fetch when destination changes (not mode — mode just recomputes times)
  useEffect(() => { if (destination) go(destination, mode) }, [destination]) // eslint-disable-line

  // When mode tab changes, instantly recompute from cached data — no loading spinner
  useEffect(() => { recomputeForMode(mode) }, [mode]) // eslint-disable-line

  function handleSearch() {
    if (!customInput.trim()) return
    const d = customInput.trim()
    setDestination(d); setShowInput(false); setCustomInput('')
    router.replace(`/navigate?destination=${encodeURIComponent(d)}`)
  }

  const MODES: { key: TravelMode; emoji: string; label: string }[] = [
    { key: 'driving', emoji: '🚗', label: 'Drive' },
    { key: 'cycling', emoji: '🚴', label: 'Boda' },
    { key: 'walking', emoji: '🚶', label: 'Walk' },
  ]
  const QUICK = [
    { name: 'Kampala CBD', dest: 'Kampala CBD' },
    { name: 'Ntinda', dest: 'Ntinda Kampala' },
    { name: 'Kawempe', dest: 'Kawempe Kampala' },
    { name: 'Entebbe', dest: 'Entebbe Uganda' },
    { name: 'Jinja', dest: 'Jinja Uganda' },
    { name: 'Fort Portal', dest: 'Fort Portal Uganda' },
    { name: 'Mulago', dest: 'Mulago Hospital Kampala' },
    { name: 'Makerere', dest: 'Makerere University Kampala' },
  ]

  const loading = geocoding || routing
  const hour = new Date().getHours()
  const isPeak = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20)

  return (
    <div className="flex flex-col pb-28" style={{ minHeight: '100vh' }}>
      <div className="sticky top-0 z-30 px-5 pt-12 pb-4"
           style={{ background: 'linear-gradient(135deg,#0b9488,#0a6560)' }}>
        <div className="flex items-center gap-3 mb-3">
          <Link href="/home" className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.2)' }}>
            <span className="text-white font-bold text-lg leading-none">←</span>
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-dm" style={{ color: 'rgba(255,255,255,0.7)' }}>Navigating to</p>
            <h1 className="font-clash font-bold text-lg text-white truncate">{destination || 'Choose a destination'}</h1>
          </div>
          <button onClick={() => setShowInput(v => !v)} className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.2)' }}>
            <span className="text-white text-sm">⌨️</span>
          </button>
        </div>
        <div className="flex p-1 rounded-2xl gap-1" style={{ background: 'rgba(0,0,0,0.2)' }}>
          {MODES.map(m => (
            <button key={m.key} onClick={() => setMode(m.key)}
                    className="flex-1 py-2 rounded-xl text-xs font-sora font-semibold transition-all flex items-center justify-center gap-1"
                    style={mode === m.key ? { background: 'rgba(255,255,255,0.25)', color: '#fff' } : { color: 'rgba(255,255,255,0.6)' }}>
              {m.emoji} {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 pt-4 space-y-4">
        {isPeak && (
          <div className="rounded-2xl px-4 py-2.5 flex items-center gap-2"
               style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <span>🚦</span>
            <p className="text-xs font-dm" style={{ color: '#f87171' }}>Peak hour — Kampala traffic delays included in times</p>
          </div>
        )}

        {showInput && (
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="p-3">
              <p className="text-xs font-sora font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>Enter Destination</p>
              <div className="flex gap-2">
                <input value={customInput} onChange={e => setCustomInput(e.target.value)}
                       onKeyDown={e => e.key === 'Enter' && handleSearch()}
                       placeholder="e.g. Ntinda, Fort Portal, Mulago…" autoFocus
                       className="flex-1 rounded-xl px-3 py-2.5 text-sm font-dm outline-none"
                       style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                <button onClick={handleSearch} className="px-4 py-2.5 rounded-xl font-sora font-semibold text-sm text-white flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg,#0b9488,#14b8a6)' }}>Go</button>
              </div>
            </div>
            <div className="px-3 pb-3">
              <p className="text-xs font-dm mb-2" style={{ color: 'var(--muted)' }}>Quick destinations:</p>
              <div className="flex flex-wrap gap-2">
                {QUICK.map(d => (
                  <button key={d.name} onClick={() => { setDestination(d.dest); setShowInput(false) }}
                          className="px-3 py-1.5 rounded-xl text-xs font-sora font-semibold transition-all active:scale-95"
                          style={{ background: 'rgba(11,148,136,0.1)', color: '#14b8a6', border: '1px solid rgba(11,148,136,0.2)' }}>
                    📍 {d.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-2xl p-4 flex gap-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <span>⚠️</span><p className="text-sm font-dm" style={{ color: '#ef4444' }}>{error}</p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-3 py-8">
            <Spinner />
            <p className="text-sm font-dm" style={{ color: 'var(--muted)' }}>
              {geocoding ? `Finding "${destination}"…` : 'Calculating routes…'}
            </p>
          </div>
        )}

        {destCoords && !loading && (
          <>
            <div className="rounded-3xl overflow-hidden" style={{ height: 300, border: '1px solid var(--border)', position: 'relative' }}>
              <MapView origin={origin} destination={destCoords} routes={routes} selectedId={selectedId} />
              <div className="absolute bottom-2 left-2 z-[999] px-2 py-0.5 rounded-full text-xs font-dm"
                   style={{ background: 'rgba(0,0,0,0.55)', color: 'rgba(255,255,255,0.7)', pointerEvents: 'none' }}>
                © OpenStreetMap contributors
              </div>
            </div>

            <button onClick={() => window.open(`https://www.openstreetmap.org/directions?from=${origin[0]},${origin[1]}&to=${destCoords[0]},${destCoords[1]}`, '_blank')}
                    className="w-full py-3 rounded-2xl font-sora font-semibold text-sm text-white flex items-center justify-center gap-2 active:scale-95"
                    style={{ background: 'linear-gradient(135deg,#0b9488,#14b8a6)', boxShadow: '0 4px 16px rgba(11,148,136,0.4)' }}>
              <Navigation size={16} /> Open Full Map in Browser
            </button>

            {routes.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-sora font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                    {routes.length} Route{routes.length > 1 ? 's' : ''} Found
                  </p>
                  <button onClick={() => go(destination, mode)} className="flex items-center gap-1.5 text-xs font-dm" style={{ color: '#14b8a6' }}>
                    <RefreshCw size={12} /> Refresh
                  </button>
                </div>
                <div className="space-y-3">
                  {routes.map(r => <RouteCard key={r.id} route={r} selected={r.id === selectedId} onSelect={() => setSelectedId(r.id)} />)}
                </div>
              </div>
            )}

            <div className="rounded-2xl p-4 flex gap-3" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <span>⚠️</span>
              <div>
                <p className="text-xs font-sora font-semibold" style={{ color: '#f59e0b' }}>Uganda Traffic Tip</p>
                <p className="text-xs font-dm mt-0.5" style={{ color: 'var(--muted)' }}>
                  Times use real Kampala averages: driving ~8–35 km/h in city, boda ~14–20 km/h, walking ~4 km/h.
                  Peak hours (7–9 AM, 5–8 PM) significantly increase drive times.
                </p>
              </div>
            </div>
          </>
        )}

        {!destination && !showInput && (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="w-16 h-16 rounded-3xl flex items-center justify-center" style={{ background: 'rgba(11,148,136,0.1)' }}>
              <Navigation size={28} style={{ color: '#14b8a6' }} />
            </div>
            <div>
              <p className="font-clash font-bold text-lg" style={{ color: 'var(--text)' }}>Where are you going?</p>
              <p className="font-dm text-sm mt-1" style={{ color: 'var(--muted)' }}>Say "Take me to Ntinda" on Voice, or type a destination above</p>
            </div>
            <div className="flex gap-3">
              <Link href="/voice" className="flex items-center gap-2 px-4 py-3 rounded-2xl font-sora font-semibold text-sm text-white"
                    style={{ background: 'linear-gradient(135deg,#0b9488,#14b8a6)' }}>
                <Mic size={16} /> Voice Input
              </Link>
              <button onClick={() => setShowInput(true)} className="flex items-center gap-2 px-4 py-3 rounded-2xl font-sora font-semibold text-sm"
                      style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                ⌨️ Type It
              </button>
            </div>
          </div>
        )}

        {destination && (
          <div className="rounded-2xl p-4 flex items-center gap-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(11,148,136,0.1)' }}>
              <Mic size={18} style={{ color: '#14b8a6' }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-sora font-semibold" style={{ color: 'var(--text)' }}>Go somewhere else?</p>
              <p className="text-xs font-dm mt-0.5" style={{ color: 'var(--muted)' }}>Say "Take me to…" or type a new destination</p>
            </div>
            <Link href="/voice" className="px-3 py-2 rounded-xl text-xs font-sora font-semibold"
                  style={{ background: 'rgba(11,148,136,0.1)', color: '#14b8a6' }}>Speak</Link>
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
        <div className="w-8 h-8 rounded-full border-2 animate-spin"
             style={{ borderColor: 'rgba(11,148,136,0.3)', borderTopColor: '#14b8a6' }} />
      </div>
    }>
      <NavigateContent />
    </Suspense>
  )
}