import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator, Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { WebView } from 'react-native-webview'
import * as Location from 'expo-location'
import { useLocalSearchParams } from 'expo-router'
import { COLORS, RADIUS } from '../../src/lib/theme'

type Mode = 'driving' | 'cycling' | 'walking'

const KAMPALA: [number, number] = [0.3476, 32.5825]
const QUICK = [
  { name: 'Kampala CBD',  dest: 'Kampala CBD, Uganda' },
  { name: 'Ntinda',       dest: 'Ntinda, Kampala, Uganda' },
  { name: 'Entebbe',      dest: 'Entebbe, Uganda' },
  { name: 'Jinja',        dest: 'Jinja, Uganda' },
  { name: 'Mulago',       dest: 'Mulago Hospital, Kampala, Uganda' },
  { name: 'Makerere',     dest: 'Makerere University, Kampala, Uganda' },
  { name: 'Fort Portal',  dest: 'Fort Portal, Uganda' },
  { name: 'Kawempe',      dest: 'Kawempe, Kampala, Uganda' },
]

function estimateDuration(distanceM: number, mode: Mode): string {
  const h = new Date().getHours()
  const peak = (h >= 7 && h <= 9) || (h >= 17 && h <= 20)
  let secs: number
  if (mode === 'walking') {
    secs = distanceM / (4000 / 3600)
  } else if (mode === 'cycling') {
    secs = distanceM / ((peak ? 14 : 20) * 1000 / 3600)
  } else {
    let kmh: number
    if      (distanceM < 5000)  kmh = peak ? 8  : 15
    else if (distanceM < 15000) kmh = peak ? 15 : 25
    else if (distanceM < 40000) kmh = peak ? 25 : 35
    else                        kmh = peak ? 50 : 70
    secs = distanceM / (kmh * 1000 / 3600)
  }
  if (secs < 3600) return `${Math.round(secs / 60)} min`
  const hrs = Math.floor(secs / 3600), mins = Math.round((secs % 3600) / 60)
  return mins ? `${hrs}h ${mins}min` : `${hrs}h`
}

async function geocode(query: string): Promise<[number,number] | null> {
  try {
    const q = /uganda/i.test(query) ? query : `${query}, Uganda`
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=ug`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'VoxelRN/1.0' } }
    )
    const d = await res.json()
    if (!d[0]) return null
    return [parseFloat(d[0].lat), parseFloat(d[0].lon)]
  } catch { return null }
}

async function getRoutes(from: [number,number], to: [number,number], mode: Mode) {
  const coords = `${from[1]},${from[0]};${to[1]},${to[0]}`
  const res = await fetch(
    `https://router.project-osrm.org/route/v1/car/${coords}?alternatives=true&overview=false`
  )
  const d = await res.json()
  if (d.code !== 'Ok') return []
  return d.routes.slice(0, 3).map((r: any, i: number) => ({
    id: `r${i}`,
    label: ['Fastest Route', 'Alternative', 'Scenic Route'][i] ?? `Route ${i+1}`,
    duration: estimateDuration(r.distance, mode),
    distance: r.distance < 1000 ? `${Math.round(r.distance)}m` : `${(r.distance/1000).toFixed(1)}km`,
    recommended: i === 0,
  }))
}

export default function NavigateScreen() {
  const params = useLocalSearchParams<{ destination?: string }>()
  const [dest,      setDest]      = useState(params.destination ?? '')
  const [input,     setInput]     = useState('')
  const [showInput, setShowInput] = useState(!params.destination)
  const [origin,    setOrigin]    = useState<[number,number]>(KAMPALA)
  const [destCoords,setDestCoords]= useState<[number,number] | null>(null)
  const [routes,    setRoutes]    = useState<any[]>([])
  const [mode,      setMode]      = useState<Mode>('driving')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')

  useEffect(() => {
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status === 'granted')
        Location.getCurrentPositionAsync({}).then(loc =>
          setOrigin([loc.coords.latitude, loc.coords.longitude])
        )
    })
  }, [])

  useEffect(() => { if (dest) search(dest) }, [dest])
  useEffect(() => { if (destCoords) recompute(destCoords) }, [mode])

  async function search(query: string) {
    setLoading(true); setError(''); setRoutes([])
    const coords = await geocode(query)
    if (!coords) { setError(`Could not find "${query}"`); setLoading(false); return }
    setDestCoords(coords)
    await recompute(coords)
    setLoading(false)
  }

  async function recompute(dc: [number,number]) {
    const r = await getRoutes(origin, dc, mode).catch(() => [])
    setRoutes(r)
  }

  const mapUrl = destCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${destCoords[1]-0.05},${destCoords[0]-0.05},${destCoords[1]+0.05},${destCoords[0]+0.05}&layer=mapnik&marker=${destCoords[0]},${destCoords[1]}`
    : ''

  const MODES = [
    { key: 'driving' as Mode, emoji: '🚗', label: 'Drive' },
    { key: 'cycling' as Mode, emoji: '🚴', label: 'Boda'  },
    { key: 'walking' as Mode, emoji: '🚶', label: 'Walk'  },
  ]

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.headerSub}>Navigating to</Text>
          <Text style={s.headerTitle} numberOfLines={1}>{dest || 'Choose a destination'}</Text>
        </View>
        <TouchableOpacity style={s.keyBtn} onPress={() => setShowInput(v => !v)}>
          <Text style={{ fontSize: 18 }}>⌨️</Text>
        </TouchableOpacity>
      </View>

      {/* Mode tabs */}
      <View style={s.modeTabs}>
        {MODES.map(m => (
          <TouchableOpacity key={m.key} style={[s.modeTab, mode === m.key && s.modeTabActive]}
            onPress={() => setMode(m.key)}>
            <Text style={[s.modeTabText, mode === m.key && s.modeTabTextActive]}>{m.emoji} {m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Input */}
        {showInput && (
          <View style={s.inputCard}>
            <Text style={s.inputLabel}>ENTER DESTINATION</Text>
            <View style={s.inputRow}>
              <TextInput style={s.input} placeholder="e.g. Ntinda, Mulago…"
                placeholderTextColor={COLORS.muted} value={input} onChangeText={setInput}
                onSubmitEditing={() => { if (input.trim()) { setDest(input.trim()); setShowInput(false); setInput('') } }}
              />
              <TouchableOpacity style={s.goBtn} onPress={() => { if (input.trim()) { setDest(input.trim()); setShowInput(false); setInput('') } }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Go</Text>
              </TouchableOpacity>
            </View>
            <View style={s.quickWrap}>
              {QUICK.map(q => (
                <TouchableOpacity key={q.name} style={s.quickChip}
                  onPress={() => { setDest(q.dest); setShowInput(false) }}>
                  <Text style={s.quickText}>📍 {q.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {error ? (
          <View style={s.errorCard}><Text style={s.errorText}>⚠️ {error}</Text></View>
        ) : null}

        {loading && (
          <View style={s.loadingWrap}>
            <ActivityIndicator color={COLORS.teal2} />
            <Text style={s.loadingText}>Finding route…</Text>
          </View>
        )}

        {/* Map */}
        {destCoords && !loading && (
          <>
            <View style={s.mapWrap}>
              <WebView source={{ uri: mapUrl }} style={s.map} scrollEnabled={false} />
            </View>

            <TouchableOpacity style={s.fullMapBtn}
              onPress={() => Linking.openURL(`https://www.openstreetmap.org/directions?from=${origin[0]},${origin[1]}&to=${destCoords[0]},${destCoords[1]}`)}>
              <Text style={s.fullMapText}>🗺️ Open Full Map</Text>
            </TouchableOpacity>

            {routes.map(r => (
              <View key={r.id} style={[s.routeCard, r.recommended && s.routeCardActive]}>
                <Text style={{ fontSize: 20, marginRight: 12 }}>{r.recommended ? '⭐' : '🗺️'}</Text>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={s.routeLabel}>{r.label}</Text>
                    {r.recommended && <View style={s.recBadge}><Text style={s.recText}>Recommended</Text></View>}
                  </View>
                  <Text style={s.routeMeta}>⏱ {r.duration}  📏 {r.distance}</Text>
                </View>
              </View>
            ))}

            <View style={s.tip}>
              <Text style={s.tipTitle}>⚠️ Uganda Traffic Tip</Text>
              <Text style={s.tipText}>Times use real Kampala averages: driving ~8–35 km/h in city, boda ~14–20 km/h, walking ~4 km/h. Peak hours add delays.</Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: COLORS.bg },
  header:         { backgroundColor: COLORS.teal, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, flexDirection: 'row', alignItems: 'center' },
  headerSub:      { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  headerTitle:    { color: '#fff', fontWeight: '700', fontSize: 16 },
  keyBtn:         { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  modeTabs:       { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 12, paddingVertical: 6, gap: 8 },
  modeTab:        { flex: 1, paddingVertical: 8, borderRadius: RADIUS.lg, alignItems: 'center' },
  modeTabActive:  { backgroundColor: 'rgba(255,255,255,0.15)' },
  modeTabText:    { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600' },
  modeTabTextActive: { color: '#fff' },
  scroll:         { flex: 1, paddingHorizontal: 16 },
  inputCard:      { backgroundColor: COLORS.card, borderRadius: RADIUS.xl, padding: 14, marginTop: 12, borderWidth: 1, borderColor: COLORS.border },
  inputLabel:     { color: COLORS.muted, fontSize: 10, fontWeight: '600', letterSpacing: 1, marginBottom: 8 },
  inputRow:       { flexDirection: 'row', gap: 8, marginBottom: 12 },
  input:          { flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, paddingHorizontal: 12, paddingVertical: 10, color: COLORS.text, fontSize: 13, borderWidth: 1, borderColor: COLORS.border },
  goBtn:          { backgroundColor: COLORS.teal, borderRadius: RADIUS.lg, paddingHorizontal: 16, justifyContent: 'center' },
  quickWrap:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickChip:      { backgroundColor: 'rgba(11,148,136,0.1)', borderRadius: RADIUS.lg, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(11,148,136,0.2)' },
  quickText:      { color: COLORS.teal2, fontSize: 12 },
  errorCard:      { backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: RADIUS.xl, padding: 14, marginTop: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' },
  errorText:      { color: COLORS.red, fontSize: 13 },
  loadingWrap:    { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 20, justifyContent: 'center' },
  loadingText:    { color: COLORS.muted, fontSize: 13 },
  mapWrap:        { height: 240, borderRadius: RADIUS.xl, overflow: 'hidden', marginTop: 12, borderWidth: 1, borderColor: COLORS.border },
  map:            { flex: 1 },
  fullMapBtn:     { backgroundColor: COLORS.teal, borderRadius: RADIUS.xl, paddingVertical: 14, alignItems: 'center', marginTop: 10, marginBottom: 10 },
  fullMapText:    { color: '#fff', fontWeight: '700', fontSize: 14 },
  routeCard:      { backgroundColor: COLORS.card, borderRadius: RADIUS.xl, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', alignItems: 'center' },
  routeCardActive:{ borderColor: COLORS.teal, backgroundColor: 'rgba(11,148,136,0.06)' },
  routeLabel:     { color: COLORS.text, fontWeight: '600', fontSize: 13 },
  recBadge:       { backgroundColor: 'rgba(11,148,136,0.15)', borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 2 },
  recText:        { color: COLORS.teal2, fontSize: 10, fontWeight: '600' },
  routeMeta:      { color: COLORS.muted, fontSize: 12, marginTop: 4 },
  tip:            { backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: RADIUS.xl, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)' },
  tipTitle:       { color: COLORS.amber, fontWeight: '600', fontSize: 12, marginBottom: 4 },
  tipText:        { color: COLORS.muted, fontSize: 11, lineHeight: 16 },
})
