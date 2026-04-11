import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Switch, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { COLORS, RADIUS } from '../../src/lib/theme'

export default function SettingsScreen() {
  const router = useRouter()
  const [notifications, setNotifications] = useState(true)
  const [speechAssist,  setSpeechAssist]  = useState(true)
  const [ttsEnabled,    setTtsEnabled]    = useState(true)
  const [noiseCancell,  setNoiseCancell]  = useState(true)
  const [darkMode,      setDarkMode]      = useState(true)

  const TOGGLES = [
    { label: 'Speech Assistance',  sub: 'Real-time voice-to-text',     val: speechAssist,  set: setSpeechAssist  },
    { label: 'Text to Speech',     sub: 'Convert typed text to audio',  val: ttsEnabled,    set: setTtsEnabled    },
    { label: 'Noise Cancellation', sub: 'Remove background noise',      val: noiseCancell,  set: setNoiseCancell  },
    { label: 'Notifications',      sub: 'App alerts and reminders',     val: notifications, set: setNotifications },
    { label: 'Dark Mode',          sub: 'App appearance',               val: darkMode,      set: setDarkMode      },
  ]

  const LINKS = [
    { emoji: '🌍', label: 'Language Preferences', action: () => Alert.alert('Coming soon') },
    { emoji: '🔒', label: 'Privacy & Security',    action: () => Alert.alert('Coming soon') },
    { emoji: '🚨', label: 'Emergency Contacts',    action: () => router.push('/settings/safety' as any) },
    { emoji: '❓', label: 'Help & Support',         action: () => Alert.alert('Contact: support@voxel.app') },
    { emoji: '📋', label: 'About Voxel',            action: () => Alert.alert('Voxel v1.0.0\nAI speech assistance for Uganda') },
  ]

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.heading}>Settings</Text>
        <Text style={s.sub}>Customize your Voxel experience</Text>

        <Text style={s.sectionLabel}>PREFERENCES</Text>
        <View style={s.card}>
          {TOGGLES.map(({ label, sub, val, set }, i, arr) => (
            <View key={label} style={[s.row, i < arr.length - 1 && s.rowBorder]}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowLabel}>{label}</Text>
                <Text style={s.rowSub}>{sub}</Text>
              </View>
              <Switch
                value={val}
                onValueChange={set}
                trackColor={{ false: COLORS.border, true: COLORS.teal }}
                thumbColor="#fff"
              />
            </View>
          ))}
        </View>

        <Text style={s.sectionLabel}>ACCOUNT</Text>
        <View style={s.card}>
          {LINKS.map(({ emoji, label, action }, i, arr) => (
            <TouchableOpacity key={label} style={[s.row, i < arr.length - 1 && s.rowBorder]}
              onPress={action} activeOpacity={0.7}>
              <Text style={{ fontSize: 20, marginRight: 12 }}>{emoji}</Text>
              <Text style={[s.rowLabel, { flex: 1 }]}>{label}</Text>
              <Text style={{ color: COLORS.muted, fontSize: 18 }}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.footer}>
          <Text style={s.footerText}>Voxel v1.0.0 · Built for Uganda 🇺🇬</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: COLORS.bg },
  scroll:       { flex: 1, paddingHorizontal: 20, paddingBottom: 30 },
  heading:      { color: COLORS.text, fontWeight: '800', fontSize: 22, marginTop: 16, marginBottom: 4 },
  sub:          { color: COLORS.subtle, fontSize: 13, marginBottom: 20 },
  sectionLabel: { color: COLORS.muted, fontSize: 10, fontWeight: '600', letterSpacing: 1.5, marginBottom: 8, marginTop: 8 },
  card:         { backgroundColor: COLORS.card, borderRadius: RADIUS.xxl, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, marginBottom: 16 },
  row:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  rowBorder:    { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowLabel:     { color: COLORS.text, fontSize: 14, fontWeight: '500' },
  rowSub:       { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  footer:       { alignItems: 'center', paddingVertical: 24 },
  footerText:   { color: COLORS.muted, fontSize: 12 },
})
