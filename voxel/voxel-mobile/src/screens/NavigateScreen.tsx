import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { WebView } from 'react-native-webview'
import { Header } from '../components/Header'
import { colors, font, spacing, radius } from '../theme'
import { extractNavigation } from '../lib/api'
import type { NavigationExtractResponse } from '../lib/api'

const UGANDA_COORDS: Record<string, [number, number]> = {
  kampala: [0.3476, 32.5825], entebbe: [0.0423, 32.4435],
  jinja: [0.4137, 33.135],   gulu: [2.7777, 32.2833],
  mbarara: [-0.6117, 29.6363], ntinda: [0.3699, 32.5857],
  kawempe: [0.4167, 32.5667], nakawa: [0.3733, 32.6167],
  makerere: [0.3425, 32.574], kololo: [0.2881, 32.5753],
  bukoto: [0.3604, 32.5933],  kira: [0.3458, 32.7292],
  namugongo: [0.334, 32.5833], mukono: [0.3536, 32.7553],
  wakiso: [0.4, 32.4583],
}

const QUICK_DESTS = [
  { label: 'Kampala CBD',  query: 'Kampala CBD, Uganda'        },
  { label: 'Ntinda',       query: 'Ntinda, Kampala, Uganda'    },
  { label: 'Entebbe',      query: 'Entebbe, Uganda'            },
  { label: 'Makerere',     query: 'Makerere University, Uganda'},
  { label: 'Jinja',        query: 'Jinja, Uganda'              },
]

function buildMapHtml(destName: string, coords: [number, number]) {
  const [lat, lng] = coords
  return `<!DOCTYPE html><html><head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>*{margin:0;padding:0}body{font-family:sans-serif}#map{width:100vw;height:100vh}
    .info{position:absolute;bottom:16px;left:16px;background:#0e1628;color:#f0f4ff;padding:12px 16px;border-radius:12px;z-index:1000;border:1px solid #1e2d45}
    .info-title{font-size:13px;color:#8899bb;font-weight:600}
    .info-dest{font-size:16px;font-weight:700;margin-top:4px}</style></head>
  <body><div id="map"></div>
    <div class="info"><div class="info-title">📍 Destination</div><div class="info-dest">${destName}</div></div>
    <script>
      var map = L.map('map').setView([${lat},${lng}], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OSM'}).addTo(map);
      L.marker([${lat},${lng}]).addTo(map).bindPopup('${destName}').openPopup();
    </script></body></html>`
}

export function NavigateScreen() {
  const [query,   setQuery]   = useState('')
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState<NavigationExtractResponse | null>(null)
  const [showMap, setShowMap] = useState(false)

  const handleExtract = async (q?: string) => {
    const text = (q || query).trim()
    if (!text) { Alert.alert('Error', 'Enter a destination or phrase'); return }
    setLoading(true)
    setResult(null)
    setShowMap(false)
    try {
      const data = await extractNavigation({ transcript: text })
      setResult(data)
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not extract destination')
    } finally {
      setLoading(false)
    }
  }

  const destCoords = result?.destination
    ? UGANDA_COORDS[result.destination.toLowerCase()] || UGANDA_COORDS['kampala']
    : null

  if (showMap && result && destCoords) {
    return (
      <View style={styles.flex}>
        <Header title={result.destination} showBack onBack={() => setShowMap(false)} />
        <WebView
          source={{ html: buildMapHtml(result.destination, destCoords) }}
          style={styles.flex}
          javaScriptEnabled
        />
      </View>
    )
  }

  return (
    <View style={styles.flex}>
      <Header title="Navigate" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Search */}
        <View style={styles.searchCard}>
          <TextInput
            style={styles.searchInput}
            placeholder='e.g. "Take me to Ntinda"'
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => handleExtract()}
            returnKeyType="search"
          />
          <TouchableOpacity
            style={[styles.searchBtn, loading && styles.searchBtnDisabled]}
            onPress={() => handleExtract()}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.searchBtnText}>Go</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Quick destinations */}
        <Text style={styles.sectionLabel}>Quick Destinations</Text>
        <View style={styles.quickWrap}>
          {QUICK_DESTS.map(d => (
            <TouchableOpacity
              key={d.label}
              style={styles.quickChip}
              onPress={() => { setQuery(d.query); handleExtract(d.query) }}
            >
              <Text style={styles.quickChipText}>📍 {d.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Result */}
        {result && (
          <View style={[styles.resultCard, !result.is_navigation && styles.resultCardNone]}>
            {result.is_navigation ? (
              <>
                <View style={styles.resultHeader}>
                  <Text style={styles.resultIcon}>🗺️</Text>
                  <View style={styles.resultHeaderText}>
                    <Text style={styles.resultDest}>{result.destination}</Text>
                    <Text style={styles.resultConf}>
                      {Math.round(result.confidence * 100)}% confidence · {result.reason}
                    </Text>
                  </View>
                </View>
                {result.corrected_text && (
                  <Text style={styles.resultCorrected}>"{result.corrected_text}"</Text>
                )}
                <TouchableOpacity
                  style={styles.mapBtn}
                  onPress={() => setShowMap(true)}
                >
                  <Text style={styles.mapBtnText}>🗺️ View on Map</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.noNavText}>
                🤔 No navigation intent detected. Try saying "Take me to Kampala" or "Genda e Ntinda".
              </Text>
            )}
          </View>
        )}

        {/* Tips */}
        <Text style={styles.sectionLabel}>Tips</Text>
        <View style={styles.tipsCard}>
          <Text style={styles.tipText}>🇬🇧 Try: "Take me to Entebbe airport"</Text>
          <Text style={styles.tipText}>🇺🇬 Try: "Ntwala e Kampala"</Text>
          <Text style={styles.tipText}>📍 Or just type a place name directly</Text>
        </View>

      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex:    { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 120 },

  searchCard: {
    flexDirection:   'row',
    gap:             spacing.sm,
    marginVertical:  spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius:    radius.lg,
    padding:         spacing.sm,
    borderWidth:     1,
    borderColor:     colors.border,
  },
  searchInput: {
    flex:      1,
    fontSize:  font.md,
    color:     colors.text,
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs,
  },
  searchBtn: {
    backgroundColor: colors.teal,
    borderRadius:    radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    alignItems:      'center',
    justifyContent:  'center',
    minWidth:        52,
  },
  searchBtnDisabled: { opacity: 0.6 },
  searchBtnText: { fontSize: font.md, fontWeight: '700', color: '#fff' },

  sectionLabel: {
    fontSize:     font.sm,
    fontWeight:   '700',
    color:        colors.textSub,
    marginTop:    spacing.md,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  quickWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  quickChip: {
    backgroundColor:   colors.bgCard,
    borderRadius:      radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs + 2,
    borderWidth:       1,
    borderColor:       colors.border,
  },
  quickChipText: { fontSize: font.sm, color: colors.textSub },

  resultCard: {
    backgroundColor: colors.bgCard,
    borderRadius:    radius.lg,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.teal + '50',
    marginBottom:    spacing.md,
  },
  resultCardNone: { borderColor: colors.border },
  resultHeader:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  resultIcon:     { fontSize: 32 },
  resultHeaderText: { flex: 1 },
  resultDest: { fontSize: font.xl, fontWeight: '700', color: colors.text },
  resultConf: { fontSize: font.xs, color: colors.textSub, marginTop: 2 },
  resultCorrected: {
    fontSize:        font.sm,
    color:           colors.textSub,
    fontStyle:       'italic',
    marginBottom:    spacing.sm,
    paddingLeft:     spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: colors.teal,
  },
  mapBtn: {
    backgroundColor: colors.teal,
    borderRadius:    radius.md,
    paddingVertical: spacing.sm,
    alignItems:      'center',
    marginTop:       spacing.sm,
  },
  mapBtnText:  { fontSize: font.md, fontWeight: '700', color: '#fff' },
  noNavText:   { fontSize: font.md, color: colors.textSub, lineHeight: 22 },

  tipsCard: {
    backgroundColor: colors.bgCard,
    borderRadius:    radius.lg,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
    gap:             spacing.sm,
  },
  tipText: { fontSize: font.sm, color: colors.textSub },
})