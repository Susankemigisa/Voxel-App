import { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { supabase } from '../src/lib/supabase'
import { useAppStore } from '../src/store/authStore'
import { COLORS, RADIUS } from '../src/lib/theme'

function fmtRelative(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

function groupByDate(sessions: any[]) {
  const groups: Record<string, any[]> = {}
  const today     = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()
  sessions.forEach(s => {
    const d = new Date(s.created_at)
    const key = d.toDateString() === today ? 'Today'
      : d.toDateString() === yesterday ? 'Yesterday'
      : d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
    if (!groups[key]) groups[key] = []
    groups[key].push(s)
  })
  return groups
}

export default function SessionsScreen() {
  const router = useRouter()
  const user   = useAppStore(s => s.user)
  const [sessions, setSessions] = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [lang,     setLang]     = useState<'all'|'en'|'lg'>('all')

  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('transcription_history')
      .select('id, transcript, clean_text, language, created_at, confidence, pipeline_ms')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setSessions(data ?? []); setLoading(false) })
  }, [user?.id])

  const filtered = sessions.filter(s => {
    const matchLang   = lang === 'all' || s.language === lang
    const matchSearch = !search.trim() ||
      (s.clean_text ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (s.transcript ?? '').toLowerCase().includes(search.toLowerCase())
    return matchLang && matchSearch
  })

  const groups = groupByDate(filtered)

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={s.heading}>Recent Sessions</Text>
          <Text style={s.sub}>{sessions.length} transcription{sessions.length !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput style={s.searchInput} placeholder="Search transcriptions…"
          placeholderTextColor={COLORS.muted} value={search} onChangeText={setSearch} />
      </View>

      {/* Lang filter */}
      <View style={s.filterRow}>
        {(['all','en','lg'] as const).map(l => (
          <TouchableOpacity key={l} style={[s.filterBtn, lang === l && s.filterBtnActive]}
            onPress={() => setLang(l)}>
            <Text style={[s.filterText, lang === l && s.filterTextActive]}>
              {l === 'all' ? 'All' : l === 'en' ? '🇬🇧 English' : '🇺🇬 Luganda'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {loading && <ActivityIndicator color={COLORS.teal} style={{ marginTop: 40 }} />}

        {!loading && sessions.length === 0 && (
          <View style={s.empty}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>🎙️</Text>
            <Text style={s.emptyTitle}>No sessions yet</Text>
            <Text style={s.emptySub}>Your transcriptions will appear here after you use Voice Input</Text>
          </View>
        )}

        {!loading && sessions.length > 0 && filtered.length === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>No results</Text>
            <Text style={s.emptySub}>Try a different search or language filter</Text>
          </View>
        )}

        {Object.entries(groups).map(([date, items]) => (
          <View key={date}>
            <Text style={s.dateLabel}>{date}</Text>
            <View style={s.group}>
              {items.map((item, i) => (
                <View key={item.id} style={[s.item, i < items.length - 1 && s.itemBorder]}>
                  <View style={s.itemIcon}><Text style={{ fontSize: 14 }}>🕐</Text></View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={s.itemText} numberOfLines={2}>"{item.clean_text || item.transcript}"</Text>
                    {item.transcript && item.clean_text &&
                      item.transcript.toLowerCase().trim() !== item.clean_text.toLowerCase().trim() && (
                      <Text style={s.itemRaw} numberOfLines={1}>Raw: "{item.transcript}"</Text>
                    )}
                    <View style={s.itemMeta}>
                      <Text style={s.itemTime}>{fmtRelative(item.created_at)}</Text>
                      {item.confidence != null && (
                        <Text style={s.itemConf}>{Math.round(item.confidence * 100)}% conf</Text>
                      )}
                    </View>
                  </View>
                  <View style={s.langBadge}>
                    <Text style={s.langText}>{(item.language || 'en').toUpperCase()}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}
        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: COLORS.bg },
  header:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 14 },
  backBtn:       { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  backText:      { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  heading:       { color: COLORS.text, fontWeight: '800', fontSize: 18 },
  sub:           { color: COLORS.subtle, fontSize: 12 },
  searchWrap:    { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, backgroundColor: COLORS.card, borderRadius: RADIUS.xl, paddingHorizontal: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: 10 },
  searchIcon:    { fontSize: 16, marginRight: 8 },
  searchInput:   { flex: 1, color: COLORS.text, fontSize: 14, paddingVertical: 12 },
  filterRow:     { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 14 },
  filterBtn:     { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  filterBtnActive:{ backgroundColor: COLORS.teal, borderColor: COLORS.teal },
  filterText:    { color: COLORS.subtle, fontSize: 12, fontWeight: '600' },
  filterTextActive:{ color: '#fff' },
  scroll:        { flex: 1, paddingHorizontal: 20 },
  empty:         { alignItems: 'center', paddingTop: 60 },
  emptyTitle:    { color: COLORS.text, fontWeight: '700', fontSize: 16, marginBottom: 8 },
  emptySub:      { color: COLORS.muted, fontSize: 13, textAlign: 'center', maxWidth: 260, lineHeight: 18 },
  dateLabel:     { color: COLORS.subtle, fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },
  group:         { backgroundColor: COLORS.card, borderRadius: RADIUS.xl, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, marginBottom: 16 },
  item:          { flexDirection: 'row', alignItems: 'flex-start', padding: 14 },
  itemBorder:    { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  itemIcon:      { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(11,148,136,0.1)', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  itemText:      { color: COLORS.text, fontSize: 13, lineHeight: 19, marginBottom: 4 },
  itemRaw:       { color: COLORS.muted, fontSize: 11, fontStyle: 'italic', marginBottom: 4 },
  itemMeta:      { flexDirection: 'row', gap: 10 },
  itemTime:      { color: COLORS.muted, fontSize: 11 },
  itemConf:      { color: COLORS.muted, fontSize: 11 },
  langBadge:     { backgroundColor: 'rgba(11,148,136,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 8, alignSelf: 'flex-start' },
  langText:      { color: COLORS.teal2, fontSize: 10, fontWeight: '700' },
})
