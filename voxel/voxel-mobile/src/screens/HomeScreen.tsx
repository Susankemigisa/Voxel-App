import React, { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native'
import { useAuthStore } from '../store/authStore'
import { Header } from '../components/Header'
import { colors, font, spacing, radius } from '../theme'
import type { TabName } from '../components/BottomNav'

interface Props {
  onNavigate: (tab: TabName) => void
}

function useGreeting(name: string) {
  const h = new Date().getHours()
  const time = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return `${time}, ${name || 'there'} 👋`
}

const QUICK_ACTIONS = [
  {
    tab:      'voice' as TabName,
    icon:     '🎙️',
    title:    'Voice Input',
    sub:      'Speak naturally',
    bg:       colors.teal,
  },
  {
    tab:      'navigate' as TabName,
    icon:     '🧭',
    title:    'Navigate',
    sub:      'Get directions',
    bg:       colors.blue,
  },
  {
    tab:      'tts' as TabName,
    icon:     '🔊',
    title:    'Text to Speech',
    sub:      'Convert & hear it',
    bg:       colors.purple,
  },
]

export function HomeScreen({ onNavigate }: Props) {
  const user     = useAuthStore(s => s.user)
  const greeting = useGreeting(user?.displayName?.split(' ')[0] || '')
  const [time,   setTime]   = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  const timeStr = time.toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' })
  const dateStr = time.toLocaleDateString('en-UG', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <View style={styles.flex}>
      <Header />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero greeting card */}
        <View style={styles.hero}>
          <View style={styles.heroDot} />
          <View style={styles.heroInner}>
            <Text style={styles.heroTime}>{timeStr}</Text>
            <Text style={styles.heroGreeting}>{greeting}</Text>
            <Text style={styles.heroDate}>{dateStr}</Text>
          </View>
          <View style={styles.heroInitials}>
            <Text style={styles.heroInitialsText}>{user?.initials || '?'}</Text>
          </View>
        </View>

        {/* Quick actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          {QUICK_ACTIONS.map(action => (
            <TouchableOpacity
              key={action.tab}
              style={[styles.actionCard, { backgroundColor: action.bg + '20', borderColor: action.bg + '40' }]}
              onPress={() => onNavigate(action.tab)}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIcon, { backgroundColor: action.bg }]}>
                <Text style={styles.actionEmoji}>{action.icon}</Text>
              </View>
              <Text style={styles.actionTitle}>{action.title}</Text>
              <Text style={styles.actionSub}>{action.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Info cards */}
        <Text style={styles.sectionTitle}>About Voxel</Text>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>🌍 Bilingual AI</Text>
          <Text style={styles.infoText}>
            Voxel supports both English and Luganda — powered by AI models fine-tuned for Ugandan speech.
          </Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>🗺️ Local Navigation</Text>
          <Text style={styles.infoText}>
            Navigate to places across Uganda. Say "Take me to Ntinda" and get real route directions.
          </Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>♿ Accessibility First</Text>
          <Text style={styles.infoText}>
            Built for everyone — voice-first design with text-to-speech for people with visual or physical challenges.
          </Text>
        </View>

      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex:    { flex: 1, backgroundColor: colors.bg },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 120 },

  hero: {
    backgroundColor: colors.teal,
    borderRadius:    radius.xxl,
    padding:         spacing.lg,
    marginBottom:    spacing.lg,
    marginTop:       spacing.sm,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    overflow:        'hidden',
  },
  heroDot: {
    position:        'absolute',
    width:           160,
    height:          160,
    borderRadius:    80,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top:             -40,
    right:           -40,
  },
  heroInner:    { flex: 1 },
  heroTime: {
    fontSize:   font.xxl,
    fontWeight: '800',
    color:      '#fff',
  },
  heroGreeting: {
    fontSize:   font.md,
    color:      'rgba(255,255,255,0.9)',
    marginTop:  4,
    fontWeight: '600',
  },
  heroDate: {
    fontSize:  font.sm,
    color:     'rgba(255,255,255,0.65)',
    marginTop: 4,
  },
  heroInitials: {
    width:          52,
    height:         52,
    borderRadius:   26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems:     'center',
    justifyContent: 'center',
    borderWidth:    2,
    borderColor:    'rgba(255,255,255,0.3)',
  },
  heroInitialsText: {
    fontSize:   font.lg,
    fontWeight: '700',
    color:      '#fff',
  },

  sectionTitle: {
    fontSize:     font.md,
    fontWeight:   '700',
    color:        colors.textSub,
    marginBottom: spacing.sm,
    marginTop:    spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  actionsRow: {
    flexDirection:  'row',
    gap:            spacing.sm,
    marginBottom:   spacing.lg,
  },
  actionCard: {
    flex:          1,
    borderRadius:  radius.lg,
    padding:       spacing.sm,
    borderWidth:   1,
    alignItems:    'center',
    gap:           spacing.xs,
  },
  actionIcon: {
    width:          44,
    height:         44,
    borderRadius:   12,
    alignItems:     'center',
    justifyContent: 'center',
  },
  actionEmoji:  { fontSize: 22 },
  actionTitle: {
    fontSize:   font.xs,
    fontWeight: '700',
    color:      colors.text,
    textAlign:  'center',
  },
  actionSub: {
    fontSize:  font.xs - 1,
    color:     colors.textSub,
    textAlign: 'center',
  },

  infoCard: {
    backgroundColor: colors.bgCard,
    borderRadius:    radius.lg,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
    marginBottom:    spacing.sm,
  },
  infoTitle: {
    fontSize:     font.md,
    fontWeight:   '700',
    color:        colors.text,
    marginBottom: spacing.xs,
  },
  infoText: {
    fontSize:   font.sm,
    color:      colors.textSub,
    lineHeight: 20,
  },
})