import React, { useEffect, useState, useRef } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Animated,
} from 'react-native'
import { useAuthStore } from '../store/authStore'
import { Header } from '../components/Header'
import { colors, font, spacing, radius } from '../theme'
import { supabase } from '../supabase'
import type { TabName } from '../components/BottomNav'

interface Props {
  onNavigate: (tab: TabName) => void
}

function useGreeting(name: string) {
  const h = new Date().getHours()
  const time = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return `${time}, ${name || 'there'} 👋`
}

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const s    = Math.floor(diff / 1000)
  if (s < 60)  return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60)  return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h} hr ago`
  const d = Math.floor(h / 24)
  if (d === 1) return 'Yesterday'
  return `${d} days ago`
}

function WaveAnimation() {
  const anims = useRef([...Array(12)].map(() => new Animated.Value(0.3))).current

  useEffect(() => {
    const loops = anims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 120),
          Animated.timing(anim, { toValue: 1,   duration: 500, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.3, duration: 500, useNativeDriver: true }),
        ])
      )
    )
    loops.forEach(l => l.start())
    return () => loops.forEach(l => l.stop())
  }, [])

  return (
    <View style={wave.container}>
      {anims.map((anim, i) => (
        <Animated.View key={`wave-${i}`} style={[wave.bar, { transform: [{ scaleY: anim }] }]} />
      ))}
    </View>
  )
}

const wave = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', height: 32, gap: 3, marginTop: spacing.sm },
  bar:       { width: 3, height: 20, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.4)' },
})

const QUICK_ACTIONS = [
  { tab: 'voice'    as TabName, icon: '🎙️', title: 'Voice Input',    sub: 'Speak naturally',   bg: colors.teal   },
  { tab: 'navigate' as TabName, icon: '🧭', title: 'Navigate',       sub: 'Get directions',    bg: colors.blue   },
  { tab: 'tts'      as TabName, icon: '🔊', title: 'Text to Speech', sub: 'Convert & hear it', bg: colors.purple },
]

interface Stats   { sessions: number; accuracy: number; languages: number }
interface Session { id: string; transcript: string; language: string; created_at: string }

export function HomeScreen({ onNavigate }: Props) {
  const user     = useAuthStore(s => s.user)
  const greeting = useGreeting(user?.displayName?.split(' ')[0] || '')

  const [stats,   setStats]   = useState<Stats>({ sessions: 0, accuracy: 0, languages: 0 })
  const [recent,  setRecent]  = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    loadData(user.id)
  }, [user?.id])

  const loadData = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('transcription_history')
        .select('id, transcript, language, confidence, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (data && data.length > 0) {
        const sessions  = data.length
        const avgConf   = data.reduce((s, r) => s + (r.confidence || 0.9), 0) / sessions
        const langs     = new Set(data.map(r => r.language)).size
        setStats({ sessions, accuracy: Math.round(avgConf * 100), languages: langs })
        setRecent(data.slice(0, 3) as Session[])
      }
    } catch { /* ignore */ }
    finally   { setLoading(false) }
  }

  const STAT_ITEMS = [
    { label: 'Sessions',  value: loading ? '—' : String(stats.sessions)                          },
    { label: 'Accuracy',  value: loading ? '—' : stats.accuracy ? `${stats.accuracy}%` : '—'    },
    { label: 'Languages', value: loading ? '—' : stats.languages ? String(stats.languages) : '—' },
  ]

  return (
    <View style={styles.flex}>
      <Header />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroDot} />
          <View style={styles.heroTop}>
            <View style={styles.heroUserBadge}>
              <View style={styles.heroCircle}>
                <Text style={styles.heroInitials}>{user?.initials || '?'}</Text>
              </View>
              <View>
                <Text style={styles.heroWelcome}>Welcome back</Text>
                <Text style={styles.heroName}>{user?.displayName?.split(' ')[0] || 'there'}</Text>
              </View>
            </View>
            <View style={styles.aiBadge}>
              <View style={styles.aiDot} />
              <Text style={styles.aiBadgeText}>AI Ready</Text>
            </View>
          </View>
          <Text style={styles.heroGreeting}>{greeting}</Text>
          <Text style={styles.heroSub}>What would you like to communicate today?</Text>
          <WaveAnimation />
        </View>

        {/* Quick actions */}
        <View style={styles.actionsRow}>
          {QUICK_ACTIONS.map(action => (
            <TouchableOpacity
              key={action.tab}
              style={[styles.actionCard, { borderColor: action.bg + '40' }]}
              onPress={() => onNavigate(action.tab)}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIcon, { backgroundColor: action.bg }]}>
                <Text style={styles.actionEmoji}>{action.icon}</Text>
              </View>
              <Text style={styles.actionTitle}>{action.title}</Text>
              <Text style={styles.actionSub}>{action.sub}</Text>
              <Text style={[styles.actionArrow, { color: action.bg }]}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Activity stats */}
        <View style={styles.activityCard}>
          <Text style={styles.sectionTitle}>YOUR ACTIVITY</Text>
          <View style={styles.statsRow}>
            {STAT_ITEMS.map((s, i) => (
              <React.Fragment key={s.label}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
                {i < STAT_ITEMS.length - 1 && <View style={styles.statDivider} />}
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* Recent sessions */}
        <View style={styles.recentCard}>
          <View style={styles.recentHeader}>
            <View style={styles.recentLeft}>
              <Text style={styles.recentIcon}>🕐</Text>
              <View>
                <Text style={styles.recentTitle}>Recent Sessions</Text>
                <Text style={styles.recentSub}>
                  {stats.sessions > 0 ? `${stats.sessions} transcription${stats.sessions !== 1 ? 's' : ''}` : 'No sessions yet'}
                </Text>
              </View>
            </View>
            <Text style={styles.arrow}>›</Text>
          </View>

          {recent.length > 0 && (
            <View style={styles.recentList}>
              {recent.map((session, i) => (
                <View key={session.id} style={[styles.recentItem, i < recent.length - 1 && styles.recentItemBorder]}>
                  <Text style={styles.recentItemText} numberOfLines={1}>{session.transcript}</Text>
                  <Text style={styles.recentItemMeta}>
                    {session.language?.toUpperCase()} · {formatRelative(session.created_at)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex:    { flex: 1, backgroundColor: colors.bg },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 120 },

  hero: { backgroundColor: colors.teal, borderRadius: radius.xxl, padding: spacing.lg, marginBottom: spacing.md, marginTop: spacing.sm, overflow: 'hidden' },
  heroDot: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.08)', top: -40, right: -40 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  heroUserBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heroCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  heroInitials: { fontSize: font.sm, fontWeight: '700', color: '#fff' },
  heroWelcome:  { fontSize: font.xs, color: 'rgba(255,255,255,0.7)' },
  heroName:     { fontSize: font.sm, fontWeight: '700', color: '#fff' },
  aiBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full },
  aiDot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ade80' },
  aiBadgeText: { fontSize: font.xs, color: '#fff', fontWeight: '600' },
  heroGreeting: { fontSize: font.xl, fontWeight: '800', color: '#fff' },
  heroSub:      { fontSize: font.sm, color: 'rgba(255,255,255,0.8)', marginTop: 4 },

  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  actionCard: { flex: 1, borderRadius: radius.lg, padding: spacing.sm, borderWidth: 1, alignItems: 'center', gap: 4, backgroundColor: colors.bgCard },
  actionIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionEmoji: { fontSize: 22 },
  actionTitle: { fontSize: font.xs, fontWeight: '700', color: colors.text, textAlign: 'center' },
  actionSub:   { fontSize: 10, color: colors.textSub, textAlign: 'center' },
  actionArrow: { fontSize: font.lg, fontWeight: '700' },

  activityCard: { backgroundColor: colors.bgCard, borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  sectionTitle: { fontSize: font.xs, fontWeight: '700', color: colors.textMuted, letterSpacing: 1, marginBottom: spacing.md },
  statsRow:    { flexDirection: 'row', justifyContent: 'space-around' },
  statItem:    { alignItems: 'center', flex: 1 },
  statValue:   { fontSize: font.xxl, fontWeight: '800', color: colors.text },
  statLabel:   { fontSize: font.xs, color: colors.textSub, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: colors.border },

  recentCard: { backgroundColor: colors.bgCard, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md, overflow: 'hidden' },
  recentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md },
  recentLeft:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  recentIcon:   { fontSize: 24 },
  recentTitle:  { fontSize: font.md, fontWeight: '700', color: colors.text },
  recentSub:    { fontSize: font.xs, color: colors.textSub, marginTop: 2 },
  arrow:        { fontSize: font.xl, color: colors.textMuted },

  recentList:   { borderTopWidth: 1, borderTopColor: colors.border },
  recentItem:   { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  recentItemBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  recentItemText: { fontSize: font.sm, color: colors.text },
  recentItemMeta: { fontSize: font.xs, color: colors.textSub, marginTop: 2 },
})