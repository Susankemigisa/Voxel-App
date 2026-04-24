import React, { useState } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  TextInput, Alert, ActivityIndicator, Switch,
} from 'react-native'
import { Header } from '../components/Header'
import { font, spacing, radius } from '../theme'
import { useColors } from '../ThemeContext'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../supabase'

interface Props {
  theme:         'dark' | 'light'
  onToggleTheme: () => void
  isDark:        boolean
}

type Section = 'main' | 'profile' | 'language' | 'notifications' | 'privacy'

export function SettingsScreen({ theme, onToggleTheme, isDark }: Props) {
  const c        = useColors()
  const user     = useAuthStore(s => s.user)
  const updateUser = useAuthStore(s => s.updateUser)
  const logout   = useAuthStore(s => s.logout)

  const [section,     setSection]     = useState<Section>('main')
  const [editingName, setEditingName] = useState(false)
  const [nameInput,   setNameInput]   = useState(user?.displayName || '')
  const [saving,      setSaving]      = useState(false)
  const [loggingOut,  setLoggingOut]  = useState(false)

  // Notification toggles
  const [notifSession,  setNotifSession]  = useState(true)
  const [notifTips,     setNotifTips]     = useState(true)
  const [notifUpdates,  setNotifUpdates]  = useState(false)

  // Privacy toggles
  const [saveHistory,   setSaveHistory]   = useState(true)
  const [analytics,     setAnalytics]     = useState(false)
  const [crashReports,  setCrashReports]  = useState(true)

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => {
        setLoggingOut(true)
        try { await supabase.auth.signOut(); logout() }
        catch { Alert.alert('Error', 'Could not sign out'); setLoggingOut(false) }
      }},
    ])
  }

  const saveDisplayName = async () => {
    if (!nameInput.trim() || !user?.id) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles').update({ display_name: nameInput.trim() }).eq('id', user.id)
      if (error) throw error
      updateUser({ displayName: nameInput.trim() })
      setEditingName(false)
      Alert.alert('Saved', 'Display name updated!')
    } catch { Alert.alert('Error', 'Could not save name') }
    finally   { setSaving(false) }
  }

  // ── Language Hub ────────────────────────────────────────────────────────────
  if (section === 'language') {
    return (
      <View style={[s.flex, { backgroundColor: c.bg }]}>
        <Header title="Language Hub" showBack onBack={() => setSection('main')} />
        <ScrollView contentContainerStyle={s.content}>
          <Text style={[s.sectionDesc, { color: c.textSub }]}>
            Voxel supports English and Luganda for speech recognition, text-to-speech, and translation.
          </Text>

          <Text style={[s.groupLabel, { color: c.textMuted }]}>SUPPORTED LANGUAGES</Text>
          <View style={[s.card, { backgroundColor: c.bgCard, borderColor: c.border }]}>
            {[
              { flag: '🇬🇧', lang: 'English',  note: 'ASR · TTS · Navigation',        active: true  },
              { flag: '🇺🇬', lang: 'Luganda',   note: 'ASR · TTS · Translation',       active: true  },
            ].map((item, i, arr) => (
              <React.Fragment key={item.lang}>
                <View style={s.langRow}>
                  <Text style={s.langFlag}>{item.flag}</Text>
                  <View style={s.langInfo}>
                    <Text style={[s.langName, { color: c.text }]}>{item.lang}</Text>
                    <Text style={[s.langNote, { color: c.textSub }]}>{item.note}</Text>
                  </View>
                  <View style={[s.activeBadge, { backgroundColor: c.teal + '20', borderColor: c.teal + '50' }]}>
                    <Text style={[s.activeBadgeText, { color: c.teal }]}>Active</Text>
                  </View>
                </View>
                {i < arr.length - 1 && <View style={[s.divider, { backgroundColor: c.border }]} />}
              </React.Fragment>
            ))}
          </View>

          <Text style={[s.groupLabel, { color: c.textMuted }]}>SPEECH RECOGNITION</Text>
          <View style={[s.card, { backgroundColor: c.bgCard, borderColor: c.border }]}>
            <View style={s.infoRow}>
              <Text style={[s.infoLabel, { color: c.textSub }]}>English Model</Text>
              <Text style={[s.infoValue, { color: c.text }]}>Whisper (Ugandan fine-tuned)</Text>
            </View>
            <View style={[s.divider, { backgroundColor: c.border }]} />
            <View style={s.infoRow}>
              <Text style={[s.infoLabel, { color: c.textSub }]}>Luganda Model</Text>
              <Text style={[s.infoValue, { color: c.text }]}>MMS-1B (facebook/mms-1b-all)</Text>
            </View>
          </View>

          <Text style={[s.groupLabel, { color: c.textMuted }]}>TEXT TO SPEECH</Text>
          <View style={[s.card, { backgroundColor: c.bgCard, borderColor: c.border }]}>
            <View style={s.infoRow}>
              <Text style={[s.infoLabel, { color: c.textSub }]}>English Female</Text>
              <Text style={[s.infoValue, { color: c.text }]}>SpeechT5</Text>
            </View>
            <View style={[s.divider, { backgroundColor: c.border }]} />
            <View style={s.infoRow}>
              <Text style={[s.infoLabel, { color: c.textSub }]}>English Male/Robot</Text>
              <Text style={[s.infoValue, { color: c.text }]}>MMS-TTS (English)</Text>
            </View>
            <View style={[s.divider, { backgroundColor: c.border }]} />
            <View style={s.infoRow}>
              <Text style={[s.infoLabel, { color: c.textSub }]}>Luganda</Text>
              <Text style={[s.infoValue, { color: c.text }]}>MMS-TTS (Luganda)</Text>
            </View>
          </View>

          <Text style={[s.groupLabel, { color: c.textMuted }]}>COMING SOON</Text>
          <View style={[s.card, { backgroundColor: c.bgCard, borderColor: c.border }]}>
            {['Runyankore', 'Acholi', 'Ateso', 'Lusoga'].map((lang, i, arr) => (
              <React.Fragment key={lang}>
                <View style={s.infoRow}>
                  <Text style={[s.infoLabel, { color: c.textSub }]}>{lang}</Text>
                  <View style={[s.comingSoonBadge, { backgroundColor: c.bgElevated }]}>
                    <Text style={[s.comingSoonText, { color: c.textMuted }]}>Coming soon</Text>
                  </View>
                </View>
                {i < arr.length - 1 && <View style={[s.divider, { backgroundColor: c.border }]} />}
              </React.Fragment>
            ))}
          </View>
        </ScrollView>
      </View>
    )
  }

  // ── Notifications ───────────────────────────────────────────────────────────
  if (section === 'notifications') {
    return (
      <View style={[s.flex, { backgroundColor: c.bg }]}>
        <Header title="Notifications" showBack onBack={() => setSection('main')} />
        <ScrollView contentContainerStyle={s.content}>
          <Text style={[s.sectionDesc, { color: c.textSub }]}>
            Choose what Voxel notifies you about.
          </Text>

          <Text style={[s.groupLabel, { color: c.textMuted }]}>ACTIVITY</Text>
          <View style={[s.card, { backgroundColor: c.bgCard, borderColor: c.border }]}>
            {[
              { label: 'Session complete',    sub: 'When voice processing finishes', value: notifSession,  set: setNotifSession  },
              { label: 'Usage tips',          sub: 'Helpful tips to get more from Voxel', value: notifTips, set: setNotifTips },
              { label: 'App updates',         sub: 'New features and improvements',  value: notifUpdates, set: setNotifUpdates  },
            ].map((item, i, arr) => (
              <React.Fragment key={item.label}>
                <View style={s.toggleRow}>
                  <View style={s.toggleLeft}>
                    <Text style={[s.toggleLabel, { color: c.text }]}>{item.label}</Text>
                    <Text style={[s.toggleSub, { color: c.textSub }]}>{item.sub}</Text>
                  </View>
                  <Switch
                    value={item.value}
                    onValueChange={item.set}
                    trackColor={{ false: c.border, true: c.teal }}
                    thumbColor="#fff"
                  />
                </View>
                {i < arr.length - 1 && <View style={[s.divider, { backgroundColor: c.border }]} />}
              </React.Fragment>
            ))}
          </View>

          <Text style={[s.noteText, { color: c.textMuted }]}>
            Push notifications require device permission. Go to device Settings → Voxel → Notifications to manage system-level permissions.
          </Text>
        </ScrollView>
      </View>
    )
  }

  // ── Privacy & Security ──────────────────────────────────────────────────────
  if (section === 'privacy') {
    return (
      <View style={[s.flex, { backgroundColor: c.bg }]}>
        <Header title="Privacy & Security" showBack onBack={() => setSection('main')} />
        <ScrollView contentContainerStyle={s.content}>
          <Text style={[s.sectionDesc, { color: c.textSub }]}>
            Control how Voxel handles your data.
          </Text>

          <Text style={[s.groupLabel, { color: c.textMuted }]}>DATA</Text>
          <View style={[s.card, { backgroundColor: c.bgCard, borderColor: c.border }]}>
            {[
              { label: 'Save session history',  sub: 'Store transcripts in your account', value: saveHistory,  set: setSaveHistory  },
              { label: 'Usage analytics',       sub: 'Help improve Voxel anonymously',    value: analytics,    set: setAnalytics    },
              { label: 'Crash reports',         sub: 'Send error reports automatically',  value: crashReports, set: setCrashReports },
            ].map((item, i, arr) => (
              <React.Fragment key={item.label}>
                <View style={s.toggleRow}>
                  <View style={s.toggleLeft}>
                    <Text style={[s.toggleLabel, { color: c.text }]}>{item.label}</Text>
                    <Text style={[s.toggleSub, { color: c.textSub }]}>{item.sub}</Text>
                  </View>
                  <Switch
                    value={item.value}
                    onValueChange={item.set}
                    trackColor={{ false: c.border, true: c.teal }}
                    thumbColor="#fff"
                  />
                </View>
                {i < arr.length - 1 && <View style={[s.divider, { backgroundColor: c.border }]} />}
              </React.Fragment>
            ))}
          </View>

          <Text style={[s.groupLabel, { color: c.textMuted }]}>SECURITY</Text>
          <View style={[s.card, { backgroundColor: c.bgCard, borderColor: c.border }]}>
            <View style={s.infoRow}>
              <Text style={[s.infoLabel, { color: c.textSub }]}>Auth Provider</Text>
              <Text style={[s.infoValue, { color: c.text }]}>Supabase Auth</Text>
            </View>
            <View style={[s.divider, { backgroundColor: c.border }]} />
            <View style={s.infoRow}>
              <Text style={[s.infoLabel, { color: c.textSub }]}>Encryption</Text>
              <Text style={[s.infoValue, { color: c.text }]}>TLS 1.3 in transit</Text>
            </View>
            <View style={[s.divider, { backgroundColor: c.border }]} />
            <View style={s.infoRow}>
              <Text style={[s.infoLabel, { color: c.textSub }]}>Audio storage</Text>
              <Text style={[s.infoValue, { color: c.text }]}>Not stored on servers</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[s.dangerBtn, { borderColor: c.error + '40', backgroundColor: c.error + '10' }]}
            onPress={() => Alert.alert(
              'Delete Account',
              'This will permanently delete your account and all data. This cannot be undone.\n\nContact support@voxel.app to proceed.',
              [{ text: 'OK' }]
            )}
          >
            <Text style={[s.dangerBtnText, { color: c.error }]}>Delete Account</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    )
  }

  // ── Profile sub-section ─────────────────────────────────────────────────────
  if (section === 'profile') {
    const joined = user?.joinedAt
      ? new Date(user.joinedAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
      : ''
    return (
      <View style={[s.flex, { backgroundColor: c.bg }]}>
        <Header title="My Profile" showBack onBack={() => setSection('main')} />
        <ScrollView contentContainerStyle={s.content}>
          <View style={[s.profileHero, { backgroundColor: c.bgCard, borderColor: c.border }]}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{user?.initials || '?'}</Text>
            </View>
            {editingName ? (
              <View style={s.nameEditRow}>
                <TextInput
                  style={[s.nameInput, { color: c.text, borderBottomColor: c.teal }]}
                  value={nameInput} onChangeText={setNameInput} autoFocus
                />
                <TouchableOpacity style={[s.saveBtn, { backgroundColor: c.teal }]} onPress={saveDisplayName} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveBtnText}>Save</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setEditingName(false)} style={s.cancelBtn}>
                  <Text style={[s.cancelBtnText, { color: c.textSub }]}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={() => setEditingName(true)} style={s.nameRow}>
                <Text style={[s.displayName, { color: c.text }]}>{user?.displayName || user?.fullName || 'User'}</Text>
                <Text style={s.editIcon}>✏️</Text>
              </TouchableOpacity>
            )}
            <Text style={[s.hintText, { color: c.textSub }]}>Tap name to edit</Text>
            <Text style={[s.emailText, { color: c.textSub }]}>{user?.email}</Text>
            {joined ? <Text style={[s.joinedText, { color: c.textMuted }]}>Member since {joined}</Text> : null}
            <View style={[s.planBadge, { backgroundColor: c.teal + '20', borderColor: c.teal + '40' }]}>
              <Text style={[s.planBadgeText, { color: c.teal }]}>{user?.plan === 'pro' ? '⭐ Pro Plan' : '🆓 Free Plan'}</Text>
            </View>
          </View>

          <View style={[s.card, { backgroundColor: c.bgCard, borderColor: c.border }]}>
            {[
              { label: 'Full Name',  value: user?.fullName || '—' },
              { label: 'Email',      value: user?.email    || '—' },
              { label: 'Account ID', value: user?.id ? `${user.id.slice(0, 8)}…` : '—' },
              { label: 'Plan',       value: user?.plan === 'pro' ? '⭐ Pro' : '🆓 Free' },
            ].map((row, i, arr) => (
              <React.Fragment key={row.label}>
                <View style={s.infoRow}>
                  <Text style={[s.infoLabel, { color: c.textSub }]}>{row.label}</Text>
                  <Text style={[s.infoValue, { color: c.text }]}>{row.value}</Text>
                </View>
                {i < arr.length - 1 && <View style={[s.divider, { backgroundColor: c.border }]} />}
              </React.Fragment>
            ))}
          </View>

          <TouchableOpacity style={[s.logoutBtn, { backgroundColor: c.error + '15', borderColor: c.error + '40' }]} onPress={handleLogout} disabled={loggingOut}>
            {loggingOut ? <ActivityIndicator color={c.error} /> : <Text style={[s.logoutText, { color: c.error }]}>Sign Out</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    )
  }

  // ── Main settings ───────────────────────────────────────────────────────────
  const ITEMS = [
    { icon: isDark ? '☀️' : '🌙', title: 'Dark Mode',         sub: 'Switch app appearance',   onPress: onToggleTheme,              arrow: false, toggle: true, toggleValue: isDark },
    { icon: '🌍',                  title: 'Language Hub',       sub: 'English · Luganda',        onPress: () => setSection('language'),     arrow: true,  toggle: false },
    { icon: '🔔',                  title: 'Notifications',      sub: 'Smart alerts',             onPress: () => setSection('notifications'), arrow: true,  toggle: false },
    { icon: '🔒',                  title: 'Privacy & Security', sub: 'Data and permissions',     onPress: () => setSection('privacy'),      arrow: true,  toggle: false },
    { icon: 'ℹ️',                  title: 'About Voxel',        sub: 'v1.0.0 · Built for accessibility', onPress: () => Alert.alert('Voxel', 'AI-powered speech assistance for Uganda.\n\nBuilt with ❤️ for accessibility.\n\nVersion 1.0.0'), arrow: true, toggle: false },
  ]

  return (
    <View style={[s.flex, { backgroundColor: c.bg }]}>
      <Header title="Settings" />
      <ScrollView contentContainerStyle={s.content}>

        <TouchableOpacity
          style={[s.userCard, { backgroundColor: c.bgCard, borderColor: c.border }]}
          onPress={() => setSection('profile')} activeOpacity={0.8}
        >
          <View style={[s.userAvatar, { backgroundColor: c.teal }]}>
            <Text style={s.userInitials}>{user?.initials || '?'}</Text>
          </View>
          <View style={s.userInfo}>
            <Text style={[s.userName, { color: c.text }]}>{user?.displayName || user?.fullName || 'User'}</Text>
            <Text style={[s.userEmail, { color: c.textSub }]}>{user?.email}</Text>
          </View>
          <View style={[s.editBadge, { borderColor: c.teal + '60' }]}>
            <Text style={[s.editBadgeText, { color: c.teal }]}>Edit Profile</Text>
          </View>
          <Text style={[s.arrowText, { color: c.textMuted }]}>›</Text>
        </TouchableOpacity>

        <View style={[s.list, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          {ITEMS.map((item, i) => (
            <React.Fragment key={item.title}>
              <TouchableOpacity style={s.row} onPress={item.onPress} activeOpacity={0.7}>
                <View style={s.rowLeft}>
                  <View style={[s.rowIcon, { backgroundColor: c.bgElevated }]}>
                    <Text style={s.rowIconText}>{item.icon}</Text>
                  </View>
                  <View>
                    <Text style={[s.rowTitle, { color: c.text }]}>{item.title}</Text>
                    <Text style={[s.rowSub, { color: c.textSub }]}>{item.sub}</Text>
                  </View>
                </View>
                {item.toggle
                  ? <Switch value={item.toggleValue} onValueChange={item.onPress} trackColor={{ false: c.border, true: c.teal }} thumbColor="#fff" />
                  : item.arrow && <Text style={[s.arrowText, { color: c.textMuted }]}>›</Text>
                }
              </TouchableOpacity>
              {i < ITEMS.length - 1 && <View style={[s.divider, { backgroundColor: c.border, marginHorizontal: spacing.md }]} />}
            </React.Fragment>
          ))}
        </View>

        <TouchableOpacity style={[s.logoutBtn, { backgroundColor: c.error + '15', borderColor: c.error + '40' }]} onPress={handleLogout} disabled={loggingOut}>
          {loggingOut ? <ActivityIndicator color={c.error} /> : <Text style={[s.logoutText, { color: c.error }]}>Sign Out</Text>}
        </TouchableOpacity>

        <Text style={[s.footer, { color: c.textMuted }]}>Voxel v1.0.0 · Built for accessibility</Text>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  flex:    { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 120 },

  sectionDesc: { fontSize: font.sm, lineHeight: 22, marginVertical: spacing.md },
  groupLabel:  { fontSize: font.xs, fontWeight: '700', letterSpacing: 1, marginTop: spacing.lg, marginBottom: spacing.sm },
  noteText:    { fontSize: font.xs, lineHeight: 18, marginTop: spacing.md },

  card:    { borderRadius: radius.xl, borderWidth: 1, marginBottom: spacing.sm, overflow: 'hidden' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.md },
  infoLabel: { fontSize: font.sm, flex: 1 },
  infoValue: { fontSize: font.sm, fontWeight: '600', textAlign: 'right', flex: 1 },
  divider:   { height: 1, marginHorizontal: spacing.md },

  langRow:  { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.sm },
  langFlag: { fontSize: 28 },
  langInfo: { flex: 1 },
  langName: { fontSize: font.md, fontWeight: '600' },
  langNote: { fontSize: font.xs, marginTop: 2 },
  activeBadge: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  activeBadgeText: { fontSize: font.xs, fontWeight: '700' },
  comingSoonBadge: { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  comingSoonText: { fontSize: font.xs },

  toggleRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md },
  toggleLeft: { flex: 1, marginRight: spacing.md },
  toggleLabel: { fontSize: font.md, fontWeight: '500' },
  toggleSub:   { fontSize: font.xs, marginTop: 2 },

  dangerBtn:     { borderRadius: radius.lg, borderWidth: 1, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.lg },
  dangerBtnText: { fontSize: font.md, fontWeight: '700' },

  userCard:    { flexDirection: 'row', alignItems: 'center', borderRadius: radius.xl, padding: spacing.md, marginVertical: spacing.md, borderWidth: 1, gap: spacing.md },
  userAvatar:  { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  userInitials: { fontSize: font.lg, fontWeight: '700', color: '#fff' },
  userInfo:    { flex: 1 },
  userName:    { fontSize: font.md, fontWeight: '700' },
  userEmail:   { fontSize: font.sm, marginTop: 2 },
  editBadge:   { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  editBadgeText: { fontSize: font.xs, fontWeight: '600' },
  arrowText:   { fontSize: font.xl },

  list:    { borderRadius: radius.xl, borderWidth: 1, overflow: 'hidden', marginBottom: spacing.lg },
  row:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, paddingHorizontal: spacing.md },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  rowIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowIconText: { fontSize: 20 },
  rowTitle: { fontSize: font.md, fontWeight: '600' },
  rowSub:   { fontSize: font.xs, marginTop: 2 },

  profileHero: { borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.md },
  avatar:      { width: 80, height: 80, borderRadius: 40, backgroundColor: '#0b9488', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  avatarText:  { fontSize: font.xxl, fontWeight: '700', color: '#fff' },
  nameRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 4 },
  displayName: { fontSize: font.xl, fontWeight: '700' },
  editIcon:    { fontSize: 16 },
  hintText:    { fontSize: font.xs, marginBottom: 4, textAlign: 'center' },
  emailText:   { fontSize: font.sm },
  joinedText:  { fontSize: font.xs, marginTop: 4 },
  planBadge:   { marginTop: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full, borderWidth: 1 },
  planBadgeText: { fontSize: font.xs, fontWeight: '700' },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 4 },
  nameInput:   { flex: 1, fontSize: font.lg, fontWeight: '700', borderBottomWidth: 1, paddingVertical: 4 },
  saveBtn:     { borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  saveBtnText: { fontSize: font.sm, fontWeight: '700', color: '#fff' },
  cancelBtn:   { padding: spacing.xs },
  cancelBtnText: { fontSize: font.md },

  logoutBtn:  { borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center', borderWidth: 1, marginBottom: spacing.md },
  logoutText: { fontSize: font.md, fontWeight: '700' },
  footer:     { fontSize: font.xs, textAlign: 'center', marginBottom: spacing.lg },
})
