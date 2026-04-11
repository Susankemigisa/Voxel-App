import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAppStore } from '../../src/store/authStore'
import { supabase } from '../../src/lib/supabase'
import { COLORS, RADIUS } from '../../src/lib/theme'

function greeting(name: string) {
  const h = new Date().getHours()
  const t = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return `${t}, ${name || 'there'} 👋`
}

async function fetchStats(userId: string) {
  const { data } = await supabase
    .from('transcription_history')
    .select('language, confidence')
    .eq('user_id', userId)
  if (!data) return { sessions: 0, accuracy: 0, languages: 0 }
  const sessions  = data.length
  const accuracy  = sessions ? Math.round(data.reduce((s,r) => s + (r.confidence ?? 0.9), 0) / sessions * 100) : 0
  const languages = new Set(data.map(r => r.language)).size
  return { sessions, accuracy, languages }
}

export default function HomeScreen() {
  const router = useRouter()
  const user   = useAppStore(s => s.user)
  const [stats, setStats]   = useState({ sessions: 0, accuracy: 0, languages: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    fetchStats(user.id).then(s => { setStats(s); setLoading(false) })
  }, [user?.id])

  const ACTIONS = [
    { emoji: '🎙️', title: 'Voice Input',    sub: 'Speak naturally',   route: '/(tabs)/voice',    color: COLORS.teal   },
    { emoji: '🗺️', title: 'Navigate',       sub: 'Get directions',    route: '/(tabs)/navigate', color: COLORS.blue   },
    { emoji: '🔊', title: 'Text to Speech', sub: 'Convert & hear it', route: '/(tabs)/tts',      color: '#7c3aed'     },
  ]

  const STATS = [
    { label: 'Sessions',  value: loading ? '—' : String(stats.sessions)                       },
    { label: 'Accuracy',  value: loading ? '—' : stats.accuracy ? `${stats.accuracy}%` : '—' },
    { label: 'Languages', value: loading ? '—' : stats.languages ? String(stats.languages) : '—' },
  ]

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={s.hero}>
          <View style={s.heroTop}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{user?.initials ?? '?'}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.heroWelcome}>Welcome back</Text>
              <Text style={s.heroName}>{user?.displayName ?? '...'}</Text>
            </View>
            <View style={s.aiBadge}>
              <View style={s.aiBadgeDot} />
              <Text style={s.aiBadgeText}>AI Ready</Text>
            </View>
          </View>
          <Text style={s.heroGreeting}>{greeting(user?.displayName?.split(' ')[0] ?? '')}</Text>
          <Text style={s.heroSub}>What would you like to communicate today?</Text>
        </View>

        {/* Quick actions */}
        <View style={s.actionsRow}>
          {ACTIONS.map(a => (
            <TouchableOpacity key={a.route} style={s.actionCard} onPress={() => router.push(a.route as any)} activeOpacity={0.8}>
              <View style={[s.actionIcon, { backgroundColor: a.color + '22' }]}>
                <Text style={{ fontSize: 22 }}>{a.emoji}</Text>
              </View>
              <Text style={s.actionTitle}>{a.title}</Text>
              <Text style={s.actionSub}>{a.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Stats */}
        <View style={s.statsCard}>
          <Text style={s.sectionLabel}>YOUR ACTIVITY</Text>
          <View style={s.statsRow}>
            {STATS.map((st, i) => (
              <View key={st.label} style={[s.statItem, i < STATS.length - 1 && s.statDivider]}>
                <Text style={s.statValue}>{st.value}</Text>
                <Text style={s.statLabel}>{st.label}</Text>
              </View>
            ))}
          </View>
          {!loading && stats.sessions === 0 && (
            <Text style={s.emptyHint}>No sessions yet — tap Voice Input to get started 🎙️</Text>
          )}
        </View>

        {/* Sessions button */}
        <TouchableOpacity style={s.sessionBtn} onPress={() => router.push('/sessions')} activeOpacity={0.8}>
          <View style={s.sessionIcon}><Text style={{ fontSize: 18 }}>🕐</Text></View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.sessionTitle}>Recent Sessions</Text>
            <Text style={s.sessionSub}>
              {loading ? 'Loading…' : stats.sessions === 0 ? 'No sessions yet' : `${stats.sessions} transcription${stats.sessions !== 1 ? 's' : ''}`}
            </Text>
          </View>
          <Text style={{ color: COLORS.muted, fontSize: 18 }}>›</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: COLORS.bg },
  scroll:       { flex: 1, paddingHorizontal: 20 },
  hero:         { backgroundColor: COLORS.teal, borderRadius: RADIUS.xxl, padding: 20, marginTop: 16, marginBottom: 16 },
  heroTop:      { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar:       { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  avatarText:   { color: '#fff', fontWeight: '700', fontSize: 14 },
  heroWelcome:  { color: 'rgba(255,255,255,0.65)', fontSize: 11 },
  heroName:     { color: '#fff', fontWeight: '600', fontSize: 14 },
  aiBadge:      { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 5 },
  aiBadgeDot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff', marginRight: 5 },
  aiBadgeText:  { color: '#fff', fontSize: 11, fontWeight: '500' },
  heroGreeting: { color: '#fff', fontWeight: '800', fontSize: 22, marginBottom: 4 },
  heroSub:      { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  actionsRow:   { flexDirection: 'row', gap: 10, marginBottom: 16 },
  actionCard:   { flex: 1, backgroundColor: COLORS.card, borderRadius: RADIUS.xl, padding: 14, borderWidth: 1, borderColor: COLORS.border },
  actionIcon:   { width: 44, height: 44, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  actionTitle:  { color: COLORS.text, fontWeight: '600', fontSize: 12, marginBottom: 2 },
  actionSub:    { color: COLORS.muted, fontSize: 10 },
  statsCard:    { backgroundColor: COLORS.card, borderRadius: RADIUS.xxl, padding: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12 },
  sectionLabel: { color: COLORS.muted, fontSize: 10, fontWeight: '600', letterSpacing: 1.5, marginBottom: 12 },
  statsRow:     { flexDirection: 'row' },
  statItem:     { flex: 1, alignItems: 'center' },
  statDivider:  { borderRightWidth: 1, borderRightColor: COLORS.border },
  statValue:    { color: COLORS.text, fontWeight: '700', fontSize: 20, marginBottom: 2 },
  statLabel:    { color: COLORS.muted, fontSize: 11 },
  emptyHint:    { color: COLORS.muted, fontSize: 11, textAlign: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  sessionBtn:   { backgroundColor: COLORS.card, borderRadius: RADIUS.xxl, padding: 16, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', alignItems: 'center', marginBottom: 30 },
  sessionIcon:  { width: 44, height: 44, borderRadius: RADIUS.lg, backgroundColor: 'rgba(11,148,136,0.12)', alignItems: 'center', justifyContent: 'center' },
  sessionTitle: { color: COLORS.text, fontWeight: '600', fontSize: 14 },
  sessionSub:   { color: COLORS.muted, fontSize: 12, marginTop: 2 },
})
