import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, Linking, RefreshControl,
} from 'react-native'
import * as Location from 'expo-location'
import { Header } from '../components/Header'
import { font, spacing, radius } from '../theme'
import { useColors } from '../ThemeContext'
import { extractNavigation } from '../lib/api'
import type { NavigationExtractResponse } from '../lib/api'

// ── Uganda-realistic travel time estimation ───────────────────────────────────
type TravelMode = 'driving' | 'boda' | 'walking'

function getHour() { return new Date().getHours() }
function isPeakHour(h = getHour()) { return (h >= 7 && h <= 9) || (h >= 17 && h <= 20) }

function estimateDuration(distanceM: number, mode: TravelMode, peak?: boolean): number {
  const p = peak !== undefined ? peak : isPeakHour()
  if (mode === 'walking') return distanceM / (4000 / 3600)
  if (mode === 'boda')    return distanceM / ((p ? 14 : 20) * 1000 / 3600)
  // driving
  let kmh: number
  if      (distanceM < 5_000)  kmh = p ? 8  : 15
  else if (distanceM < 15_000) kmh = p ? 15 : 25
  else if (distanceM < 40_000) kmh = p ? 25 : 35
  else                         kmh = p ? 50 : 70
  return distanceM / (kmh * 1000 / 3600)
}

function fmtDur(s: number): string {
  if (s < 60)   return `${Math.round(s)}s`
  if (s < 3600) return `${Math.round(s / 60)} min`
  const h = Math.floor(s / 3600)
  const m = Math.round((s % 3600) / 60)
  return m ? `${h}h ${m}min` : `${h}h`
}
function fmtDist(m: number): string {
  return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`
}

// ── Live traffic alerts ───────────────────────────────────────────────────────
interface TrafficAlert { icon: string; msg: string; color: string; bg: string }

function getLiveTrafficAlerts(): TrafficAlert[] {
  const h    = getHour()
  const peak = isPeakHour(h)
  const alerts: TrafficAlert[] = []

  if (h >= 7 && h <= 9) {
    alerts.push({ icon: '🚦', msg: 'Morning rush hour — heavy traffic on all Kampala routes', color: '#f87171', bg: 'rgba(239,68,68,0.10)' })
    alerts.push({ icon: '🏍️', msg: 'Boda bodas fastest right now — cutting through traffic', color: '#fbbf24', bg: 'rgba(245,158,11,0.10)' })
    alerts.push({ icon: '⏰', msg: `Peak hours until 9:00 AM — ${9 - h < 1 ? 'almost over' : `${9 - h}h remaining`}`, color: '#f87171', bg: 'rgba(239,68,68,0.10)' })
  } else if (h >= 17 && h <= 20) {
    alerts.push({ icon: '🚦', msg: 'Evening rush hour — expect delays on Entebbe Rd, Jinja Rd & Gaba Rd', color: '#f87171', bg: 'rgba(239,68,68,0.10)' })
    alerts.push({ icon: '🌧️', msg: h >= 15 && h <= 17 ? 'Afternoon rain possible — roads may be slippery' : 'Avoid Kampala–Entebbe road after dark if possible', color: '#fbbf24', bg: 'rgba(245,158,11,0.10)' })
    alerts.push({ icon: '⏰', msg: `Peak hours until 8:00 PM — ${20 - h}h remaining`, color: '#f87171', bg: 'rgba(239,68,68,0.10)' })
  } else if (h >= 10 && h <= 16) {
    alerts.push({ icon: '✅', msg: 'Roads clear — off-peak hours, good time to travel', color: '#4ade80', bg: 'rgba(74,222,128,0.10)' })
    alerts.push({ icon: '🌤️', msg: 'Normal traffic conditions across Kampala', color: '#4ade80', bg: 'rgba(74,222,128,0.10)' })
    if (h >= 12 && h <= 14) {
      alerts.push({ icon: '🍽️', msg: 'Lunchtime — slight slowdowns near Kampala CBD & Garden City', color: '#fbbf24', bg: 'rgba(245,158,11,0.10)' })
    }
  } else if (h >= 21 || h <= 5) {
    alerts.push({ icon: '🌙', msg: 'Night hours — light traffic, drive safely', color: '#818cf8', bg: 'rgba(129,140,248,0.10)' })
    alerts.push({ icon: '⚠️', msg: 'Limited boda bodas at this hour — plan ahead', color: '#fbbf24', bg: 'rgba(245,158,11,0.10)' })
  } else {
    alerts.push({ icon: '✅', msg: 'Light traffic — good travel conditions', color: '#4ade80', bg: 'rgba(74,222,128,0.10)' })
  }

  // Day-specific alerts
  const day = new Date().getDay()
  if (day === 5 && peak) alerts.push({ icon: '📅', msg: 'Friday evening — extra heavy traffic, leave early', color: '#f87171', bg: 'rgba(239,68,68,0.10)' })
  if (day === 0) alerts.push({ icon: '⛪', msg: 'Sunday — traffic near churches 8–11 AM', color: '#fbbf24', bg: 'rgba(245,158,11,0.10)' })
  if (day === 1 && h >= 7 && h <= 9) alerts.push({ icon: '📅', msg: 'Monday rush — busiest day of the week', color: '#f87171', bg: 'rgba(239,68,68,0.10)' })

  return alerts
}

// ── Geocoding ─────────────────────────────────────────────────────────────────
async function geocode(query: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const q   = /uganda/i.test(query) ? query : `${query}, Uganda`
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=ug`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'VoxelApp/1.0' } }
    )
    const data = await res.json()
    if (data[0]) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }
    return null
  } catch { return null }
}

// ── OSRM distance via road network ───────────────────────────────────────────
async function fetchDistance(
  origin: [number, number],
  dest:   [number, number]
): Promise<number | null> {
  try {
    const coords = `${origin[1]},${origin[0]};${dest[1]},${dest[0]}`
    const res    = await fetch(
      `https://router.project-osrm.org/route/v1/car/${coords}?overview=false`
    )
    const data = await res.json()
    if (data.code === 'Ok' && data.routes?.[0]) return data.routes[0].distance
    return null
  } catch { return null }
}

// ── Google Maps helpers ───────────────────────────────────────────────────────
function openGoogleMaps(destination: string) {
  const q = encodeURIComponent(`${destination}, Uganda`)
  Linking.canOpenURL(`comgooglemaps://?q=${q}`)
    .then(ok => Linking.openURL(ok ? `comgooglemaps://?q=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`))
    .catch(() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${destination}, Uganda`)}`))
}
function openDirections(destination: string) {
  Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${destination}, Uganda`)}`)
}

const QUICK_DESTS = [
  { label: 'Kampala CBD',  query: 'Kampala CBD'              },
  { label: 'Ntinda',       query: 'Ntinda Kampala'           },
  { label: 'Entebbe',      query: 'Entebbe Uganda'           },
  { label: 'Makerere',     query: 'Makerere University'      },
  { label: 'Jinja',        query: 'Jinja Uganda'             },
  { label: 'Mulago',       query: 'Mulago Hospital Kampala'  },
  { label: 'Kawempe',      query: 'Kawempe Kampala'          },
  { label: 'Fort Portal',  query: 'Fort Portal Uganda'       },
]

const MODES: { key: TravelMode; emoji: string; label: string }[] = [
  { key: 'driving', emoji: '🚗', label: 'Drive' },
  { key: 'boda',    emoji: '🏍️', label: 'Boda'  },
  { key: 'walking', emoji: '🚶', label: 'Walk'  },
]

export function NavigateScreen() {
  const c       = useColors()
  const styles  = buildStyles(c)

  const [query,       setQuery]       = useState('')
  const [destination, setDestination] = useState('')
  const [mode,        setMode]        = useState<TravelMode>('driving')
  const [distanceM,   setDistanceM]   = useState<number | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [navResult,   setNavResult]   = useState<NavigationExtractResponse | null>(null)
  const [language,    setLanguage]    = useState<'en' | 'lg'>('en')
  const [origin,      setOrigin]      = useState<[number, number]>([0.3133, 32.5811]) // Kampala CBD default
  const [gpsReady,    setGpsReady]    = useState(false)
  const [locationName, setLocationName] = useState('Kampala CBD')

  // Live traffic alerts — rotate every 8 seconds
  const [alerts,       setAlerts]       = useState<TrafficAlert[]>(getLiveTrafficAlerts())
  const [alertIdx,     setAlertIdx]     = useState(0)
  const alertTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Get user's GPS location on mount
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') return
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        setOrigin([pos.coords.latitude, pos.coords.longitude])
        setGpsReady(true)
        // Reverse geocode to get readable location name
        const places = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
        if (places[0]) {
          const p = places[0]
          setLocationName(p.district || p.subregion || p.city || 'Your location')
        }
      } catch {}
    })()
  }, [])

  // Refresh alerts every 8s for live feel
  useEffect(() => {
    alertTimer.current = setInterval(() => {
      const live = getLiveTrafficAlerts()
      setAlerts(live)
      setAlertIdx(i => (i + 1) % live.length)
    }, 8000)
    return () => { if (alertTimer.current) clearInterval(alertTimer.current) }
  }, [])

  const currentAlert = alerts[alertIdx % alerts.length]

  // Recalculate durations when mode changes (no refetch)
  const durations = distanceM != null ? {
    driving: fmtDur(estimateDuration(distanceM, 'driving')),
    boda:    fmtDur(estimateDuration(distanceM, 'boda')),
    walking: fmtDur(estimateDuration(distanceM, 'walking')),
  } : null

  const handleSearch = async (q?: string) => {
    const text = (q || query).trim()
    if (!text) { Alert.alert('Error', 'Enter a destination'); return }
    setLoading(true)
    setNavResult(null)
    setDistanceM(null)
    setDestination(text)

    try {
      const nav      = await extractNavigation({ transcript: text, language })
      setNavResult(nav)
      const destName = nav.is_navigation && nav.destination ? nav.destination : text

      const geo = await geocode(destName)
      if (!geo) {
        Alert.alert('Not found', `Could not find "${destName}". Try a more specific name.`)
        setLoading(false)
        return
      }
      const dist = await fetchDistance(origin, [geo.lat, geo.lon])
      setDistanceM(dist)
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not get route')
    } finally {
      setLoading(false)
    }
  }

  const refresh = () => {
    if (destination) handleSearch(destination)
    const live = getLiveTrafficAlerts()
    setAlerts(live)
  }

  const peak        = isPeakHour()
  const offPeakDurs = distanceM != null ? {
    driving: fmtDur(estimateDuration(distanceM, 'driving', false)),
    boda:    fmtDur(estimateDuration(distanceM, 'boda', false)),
    walking: fmtDur(estimateDuration(distanceM, 'walking', false)),
  } : null

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <Header title="Navigate" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={c.teal} />}
      >

        {/* Your location */}
        <View style={[styles.locRow, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <Text style={styles.locIcon}>{gpsReady ? '📍' : '🔵'}</Text>
          <View style={styles.locText}>
            <Text style={[styles.locLabel, { color: c.textMuted }]}>Your location</Text>
            <Text style={[styles.locName, { color: c.text }]}>{locationName}{!gpsReady ? ' (approx)' : ''}</Text>
          </View>
          {gpsReady && <Text style={[styles.gpsTag, { color: c.teal }]}>GPS ✓</Text>}
        </View>

        {/* Language toggle */}
        <View style={styles.langRow}>
          {(['en', 'lg'] as const).map(l => (
            <TouchableOpacity key={l}
              style={[styles.langBtn, { backgroundColor: c.bgCard, borderColor: c.border }, language === l && { backgroundColor: c.teal + '20', borderColor: c.teal }]}
              onPress={() => setLanguage(l)}
            >
              <Text style={[styles.langText, { color: language === l ? c.teal : c.textSub }]}>
                {l === 'en' ? '🇬🇧 English' : '🇺🇬 Luganda'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Search */}
        <View style={[styles.searchCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <TextInput
            style={[styles.searchInput, { color: c.text }]}
            placeholder={language === 'lg' ? '"Ntwala e Kampala"' : '"Take me to Ntinda"'}
            placeholderTextColor={c.textMuted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => handleSearch()}
            returnKeyType="search"
          />
          <TouchableOpacity
            style={[styles.searchBtn, { backgroundColor: c.teal }, loading && { opacity: 0.6 }]}
            onPress={() => handleSearch()} disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.searchBtnText}>Go</Text>}
          </TouchableOpacity>
        </View>

        {/* LIVE traffic alert — rotating */}
        {currentAlert && (
          <View style={[styles.alertBanner, { backgroundColor: currentAlert.bg, borderColor: currentAlert.color + '40' }]}>
            <Text style={styles.alertIcon}>{currentAlert.icon}</Text>
            <View style={styles.alertContent}>
              <Text style={[styles.alertText, { color: currentAlert.color }]}>{currentAlert.msg}</Text>
              <Text style={[styles.alertTime, { color: c.textMuted }]}>
                {new Date().toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' })} · Live
              </Text>
            </View>
            <View style={[styles.liveTag, { backgroundColor: currentAlert.color + '20' }]}>
              <View style={[styles.liveDot, { backgroundColor: currentAlert.color }]} />
              <Text style={[styles.liveText, { color: currentAlert.color }]}>LIVE</Text>
            </View>
          </View>
        )}

        {/* Quick destinations */}
        <Text style={[styles.sectionLabel, { color: c.textMuted }]}>QUICK DESTINATIONS</Text>
        <View style={styles.quickWrap}>
          {QUICK_DESTS.map(d => (
            <TouchableOpacity
              key={d.label}
              style={[styles.quickChip, { backgroundColor: c.bgCard, borderColor: c.border }]}
              onPress={() => { setQuery(d.query); handleSearch(d.query) }}
            >
              <Text style={[styles.quickChipText, { color: c.textSub }]}>📍 {d.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Results */}
        {destination && !loading && (
          <>
            {/* Mode tabs */}
            <View style={[styles.modeTabs, { backgroundColor: c.bgCard, borderColor: c.border }]}>
              {MODES.map(m => (
                <TouchableOpacity key={m.key}
                  style={[styles.modeTab, mode === m.key && { backgroundColor: c.teal + '30' }]}
                  onPress={() => setMode(m.key)}
                >
                  <Text style={styles.modeEmoji}>{m.emoji}</Text>
                  <Text style={[styles.modeLabel, { color: mode === m.key ? c.teal : c.textSub }]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 3 mode cards */}
            {durations && (
              <>
                <Text style={[styles.sectionLabel, { color: c.textMuted }]}>
                  FROM {locationName.toUpperCase()} → {(navResult?.destination || destination).toUpperCase()}
                  {distanceM ? ` · ${fmtDist(distanceM)}` : ''}
                  {peak ? ' · 🚦 PEAK' : ' · ✅ OFF-PEAK'}
                </Text>

                <View style={styles.modeCardsRow}>
                  {MODES.map(m => {
                    const dur        = durations[m.key]
                    const isSelected = mode === m.key
                    return (
                      <TouchableOpacity key={m.key}
                        style={[styles.modeCard, { backgroundColor: c.bgCard, borderColor: isSelected ? c.teal : c.border },
                          isSelected && { backgroundColor: c.teal + '12' }]}
                        onPress={() => setMode(m.key)} activeOpacity={0.8}
                      >
                        <Text style={styles.modeCardEmoji}>{m.emoji}</Text>
                        <Text style={[styles.modeCardDuration, { color: isSelected ? c.teal : c.text }]}>{dur}</Text>
                        <Text style={[styles.modeCardLabel, { color: c.textSub }]}>{m.label}</Text>
                        {isSelected && <View style={[styles.selectedDot, { backgroundColor: c.teal }]} />}
                      </TouchableOpacity>
                    )
                  })}
                </View>

                {/* Peak vs off-peak comparison */}
                {peak && offPeakDurs && distanceM != null && (
                  <View style={[styles.compareCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
                    <Text style={[styles.compareTitle, { color: c.text }]}>⏳ If you leave off-peak:</Text>
                    <View style={styles.compareRow}>
                      {MODES.map(m => {
                        const peakSec   = estimateDuration(distanceM, m.key, true)
                        const offSec    = estimateDuration(distanceM, m.key, false)
                        const savedMins = Math.round((peakSec - offSec) / 60)
                        return (
                          <View key={m.key} style={styles.compareItem}>
                            <Text style={styles.compareEmoji}>{m.emoji}</Text>
                            <Text style={[styles.compareTime, { color: c.text }]}>{offPeakDurs[m.key]}</Text>
                            {savedMins > 0 && (
                              <Text style={styles.compareSave}>-{savedMins}min</Text>
                            )}
                          </View>
                        )
                      })}
                    </View>
                  </View>
                )}
              </>
            )}

            {/* Nav result + map buttons */}
            {navResult?.is_navigation && navResult.destination && (
              <View style={[styles.resultCard, { backgroundColor: c.bgCard, borderColor: c.teal + '50' }]}>
                <View style={styles.resultHeader}>
                  <Text style={styles.resultIcon}>🗺️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.resultDest, { color: c.text }]}>{navResult.destination}</Text>
                    <Text style={[styles.resultConf, { color: c.textSub }]}>
                      {Math.round(navResult.confidence * 100)}% match · {navResult.reason}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity style={[styles.mapBtn, { backgroundColor: c.teal }]}
                  onPress={() => openGoogleMaps(navResult.destination)}>
                  <Text style={styles.mapBtnText}>🗺️ Open in Google Maps</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.directionsBtn, { borderColor: c.teal }]}
                  onPress={() => openDirections(navResult.destination)}>
                  <Text style={[styles.directionsBtnText, { color: c.teal }]}>🧭 Get Directions</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Uganda traffic info */}
            <View style={[styles.tipCard, { backgroundColor: c.warning + '10', borderColor: c.warning + '30' }]}>
              <Text style={[styles.tipTitle, { color: c.warning }]}>⚠️ Uganda Traffic Info</Text>
              <Text style={[styles.tipText, { color: c.textSub }]}>
                Times use real Kampala averages.{'\n'}
                🚗 City driving: {peak ? '8–25' : '15–35'} km/h · 🏍️ Boda: {peak ? '14' : '20'} km/h · 🚶 Walk: 4 km/h{'\n'}
                Peak hours: 7–9 AM and 5–8 PM daily
              </Text>
            </View>
          </>
        )}

        {/* Empty state tips */}
        {!destination && (
          <>
            <Text style={[styles.sectionLabel, { color: c.textMuted }]}>TIPS</Text>
            <View style={[styles.tipsCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
              <Text style={[styles.tipLine, { color: c.textSub }]}>🇬🇧 Try: "Take me to Entebbe airport"</Text>
              <Text style={[styles.tipLine, { color: c.textSub }]}>🇺🇬 Try: "Ntwala e Kampala" or "Genda e Ntinda"</Text>
              <Text style={[styles.tipLine, { color: c.textSub }]}>📍 Or type a place name and tap Go</Text>
              <Text style={[styles.tipLine, { color: c.textSub }]}>🏍️ Compare drive, boda and walk times</Text>
              <Text style={[styles.tipLine, { color: c.textSub }]}>🔄 Pull down to refresh traffic info</Text>
            </View>
          </>
        )}

      </ScrollView>
    </View>
  )
}

function buildStyles(c: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    flex:    { flex: 1 },
    content: { paddingHorizontal: spacing.lg, paddingBottom: 120 },

    locRow:  { flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, borderWidth: 1, padding: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.sm, gap: spacing.sm },
    locIcon: { fontSize: 20 },
    locText: { flex: 1 },
    locLabel: { fontSize: font.xs },
    locName:  { fontSize: font.sm, fontWeight: '600' },
    gpsTag:   { fontSize: font.xs, fontWeight: '700' },

    langRow:   { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
    langBtn:   { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, alignItems: 'center', borderWidth: 1 },
    langText:  { fontSize: font.sm, fontWeight: '600' },

    searchCard:  { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm, borderRadius: radius.lg, padding: spacing.sm, borderWidth: 1 },
    searchInput: { flex: 1, fontSize: font.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
    searchBtn:   { borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, alignItems: 'center', justifyContent: 'center', minWidth: 52 },
    searchBtnText: { fontSize: font.md, fontWeight: '700', color: '#fff' },

    alertBanner: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, borderWidth: 1, padding: spacing.md, marginBottom: spacing.md, gap: spacing.sm },
    alertIcon:   { fontSize: 22, flexShrink: 0 },
    alertContent: { flex: 1 },
    alertText:   { fontSize: font.sm, fontWeight: '600', lineHeight: 18 },
    alertTime:   { fontSize: font.xs, marginTop: 2 },
    liveTag:     { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
    liveDot:     { width: 6, height: 6, borderRadius: 3 },
    liveText:    { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

    sectionLabel: { fontSize: font.xs, fontWeight: '700', letterSpacing: 1, marginTop: spacing.md, marginBottom: spacing.sm },

    quickWrap:     { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
    quickChip:     { borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 6, borderWidth: 1 },
    quickChipText: { fontSize: font.sm },

    modeTabs: { flexDirection: 'row', borderRadius: radius.lg, borderWidth: 1, padding: 4, gap: 4, marginBottom: spacing.sm },
    modeTab:  { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.md, gap: 2 },
    modeEmoji: { fontSize: 18 },
    modeLabel: { fontSize: font.xs, fontWeight: '700' },

    modeCardsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    modeCard: { flex: 1, alignItems: 'center', padding: spacing.sm, borderRadius: radius.lg, borderWidth: 1.5, gap: 4 },
    modeCardEmoji:    { fontSize: 24 },
    modeCardDuration: { fontSize: font.md, fontWeight: '800' },
    modeCardLabel:    { fontSize: font.xs, fontWeight: '600' },
    selectedDot:      { width: 6, height: 6, borderRadius: 3, marginTop: 2 },

    compareCard:  { borderRadius: radius.lg, borderWidth: 1, padding: spacing.md, marginBottom: spacing.md },
    compareTitle: { fontSize: font.sm, fontWeight: '700', marginBottom: spacing.sm },
    compareRow:   { flexDirection: 'row', justifyContent: 'space-around' },
    compareItem:  { alignItems: 'center', gap: 2 },
    compareEmoji: { fontSize: 20 },
    compareTime:  { fontSize: font.sm, fontWeight: '700' },
    compareSave:  { fontSize: font.xs, fontWeight: '700', color: '#4ade80' },

    resultCard:   { borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, marginBottom: spacing.md },
    resultHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
    resultIcon:   { fontSize: 32 },
    resultDest:   { fontSize: font.lg, fontWeight: '700' },
    resultConf:   { fontSize: font.xs, marginTop: 2 },
    mapBtn:       { borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center', marginTop: spacing.xs },
    mapBtnText:   { fontSize: font.md, fontWeight: '700', color: '#fff' },
    directionsBtn: { borderRadius: radius.md, borderWidth: 1, paddingVertical: spacing.sm, alignItems: 'center', marginTop: spacing.xs, backgroundColor: 'transparent' },
    directionsBtnText: { fontSize: font.md, fontWeight: '700' },

    tipCard:  { borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, marginBottom: spacing.md },
    tipTitle: { fontSize: font.sm, fontWeight: '700', marginBottom: spacing.xs },
    tipText:  { fontSize: font.xs, lineHeight: 20 },

    tipsCard: { borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, gap: spacing.sm },
    tipLine:  { fontSize: font.sm },
  })
}
