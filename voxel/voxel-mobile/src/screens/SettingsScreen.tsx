import React, { useState } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, TextInput, Alert, ActivityIndicator, Switch,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Header } from '../components/Header'
import { colors, font, spacing, radius } from '../theme'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../supabase'

interface Props {
  theme:         'dark' | 'light'
  onToggleTheme: () => void
  isDark:        boolean
}

type Section = 'main' | 'profile'

export function SettingsScreen({ theme, onToggleTheme, isDark }: Props) {
  const insets     = useSafeAreaInsets()
  const user       = useAuthStore(s => s.user)
  const updateUser = useAuthStore(s => s.updateUser)
  const logout     = useAuthStore(s => s.logout)

  const [section,     setSection]     = useState<Section>('main')
  const [editingName, setEditingName] = useState(false)
  const [nameInput,   setNameInput]   = useState(user?.displayName || '')
  const [saving,      setSaving]      = useState(false)
  const [loggingOut,  setLoggingOut]  = useState(false)

  const bg     = isDark ? colors.bg      : '#f0f4ff'
  const card   = isDark ? colors.bgCard  : '#ffffff'
  const border = isDark ? colors.border  : '#e2e8f0'
  const text   = isDark ? colors.text    : '#0a0f1e'
  const sub    = isDark ? colors.textSub : '#475569'
  const elev   = isDark ? colors.bgElevated : '#f8faff'

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

  if (section === 'profile') {
    const joined = user?.joinedAt
      ? new Date(user.joinedAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
      : ''

    return (
      <View style={[s.flex, { backgroundColor: bg }]}>
        <Header title="My Profile" showBack onBack={() => setSection('main')} />
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

          <View style={[s.profileHero, { backgroundColor: card, borderColor: border }]}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{user?.initials || '?'}</Text>
            </View>
            {editingName ? (
              <View style={s.nameEditRow}>
                <TextInput
                  style={[s.nameInput, { color: text, borderBottomColor: colors.teal }]}
                  value={nameInput}
                  onChangeText={setNameInput}
                  autoFocus
                />
                <TouchableOpacity style={s.saveBtn} onPress={saveDisplayName} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveBtnText}>Save</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setEditingName(false)} style={s.cancelBtn}>
                  <Text style={[s.cancelBtnText, { color: sub }]}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={() => setEditingName(true)} style={s.nameRow}>
                <Text style={[s.displayName, { color: text }]}>{user?.displayName || user?.fullName || 'User'}</Text>
                <Text style={s.editIcon}>✏️</Text>
              </TouchableOpacity>
            )}
            <Text style={[s.hint, { color: sub }]}>Tap name to change what Voxel calls you</Text>
            <Text style={[s.email, { color: sub }]}>{user?.email}</Text>
            {joined ? <Text style={[s.joined, { color: colors.textMuted }]}>Member since {joined}</Text> : null}
            <TouchableOpacity style={s.planBadge}>
              <Text style={s.planBadgeText}>+ {user?.plan === 'pro' ? 'Pro Plan' : 'Free Plan'}</Text>
            </TouchableOpacity>
          </View>

          <View style={[s.section, { backgroundColor: card, borderColor: border }]}>
            {[
              { label: 'Full Name', value: user?.fullName || '—' },
              { label: 'Email',     value: user?.email    || '—' },
              { label: 'Plan',      value: user?.plan === 'pro' ? '⭐ Pro' : '🆓 Free' },
            ].map((row, i, arr) => (
              <React.Fragment key={row.label}>
                <View style={s.infoRow}>
                  <Text style={[s.infoLabel, { color: sub }]}>{row.label}</Text>
                  <Text style={[s.infoValue, { color: text }]}>{row.value}</Text>
                </View>
                {i < arr.length - 1 && <View style={[s.divider, { backgroundColor: border }]} />}
              </React.Fragment>
            ))}
          </View>

          <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} disabled={loggingOut}>
            {loggingOut ? <ActivityIndicator color={colors.error} /> : <Text style={s.logoutText}>Sign Out</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    )
  }

  // Main settings
  const ITEMS = [
    { icon: '👤', title: 'Profile',  sub: user?.displayName || user?.email || '', onPress: () => setSection('profile'), arrow: true,  toggle: false },
    { icon: isDark ? '☀️' : '🌙', title: 'Dark Mode', sub: 'Switch app appearance', onPress: onToggleTheme, arrow: false, toggle: true, toggleValue: isDark },
    { icon: '🌍', title: 'Language Hub', sub: 'English, Luganda', onPress: () => Alert.alert('Coming soon', 'Language settings coming in the next update.'), arrow: true, toggle: false },
    { icon: '🔔', title: 'Notifications', sub: 'Smart alerts', onPress: () => {}, arrow: true, toggle: false },
    { icon: '🔒', title: 'Privacy & Security', sub: 'Data and permissions', onPress: () => {}, arrow: true, toggle: false },
    { icon: 'ℹ️', title: 'About Voxel', sub: 'v1.0.0 · Built for accessibility', onPress: () => Alert.alert('Voxel', 'AI-powered speech assistance for Uganda.\n\nBuilt with ❤️ for accessibility.'), arrow: true, toggle: false },
  ]

  return (
    <View style={[s.flex, { backgroundColor: bg }]}>
      <Header title="Settings" />
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* User card */}
        <TouchableOpacity style={[s.userCard, { backgroundColor: card, borderColor: border }]} onPress={() => setSection('profile')} activeOpacity={0.8}>
          <View style={s.userAvatar}>
            <Text style={s.userInitials}>{user?.initials || '?'}</Text>
          </View>
          <View style={s.userInfo}>
            <Text style={[s.userName, { color: text }]}>{user?.displayName || user?.fullName || 'User'}</Text>
            <Text style={[s.userEmail, { color: sub }]}>{user?.email}</Text>
          </View>
          <Text style={[s.arrow, { color: colors.textMuted }]}>›</Text>
        </TouchableOpacity>

        <View style={[s.list, { backgroundColor: card, borderColor: border }]}>
          {ITEMS.map((item, i) => (
            <React.Fragment key={item.title}>
              <TouchableOpacity style={s.row} onPress={item.onPress} activeOpacity={0.7}>
                <View style={s.rowLeft}>
                  <View style={[s.rowIcon, { backgroundColor: elev }]}>
                    <Text style={s.rowIconText}>{item.icon}</Text>
                  </View>
                  <View>
                    <Text style={[s.rowTitle, { color: text }]}>{item.title}</Text>
                    <Text style={[s.rowSub, { color: sub }]}>{item.sub}</Text>
                  </View>
                </View>
                {item.toggle
                  ? <Switch value={item.toggleValue} onValueChange={item.onPress} trackColor={{ false: border, true: colors.teal }} thumbColor="#fff" />
                  : item.arrow && <Text style={[s.arrow, { color: colors.textMuted }]}>›</Text>
                }
              </TouchableOpacity>
              {i < ITEMS.length - 1 && <View style={[s.divider, { backgroundColor: border, marginHorizontal: spacing.md }]} />}
            </React.Fragment>
          ))}
        </View>

        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} disabled={loggingOut}>
          {loggingOut ? <ActivityIndicator color={colors.error} /> : <Text style={s.logoutText}>Sign Out</Text>}
        </TouchableOpacity>

        <Text style={[s.footer, { color: colors.textMuted }]}>Voxel v1.0.0 · Built for accessibility</Text>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  flex:    { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 120 },

  userCard:    { flexDirection: 'row', alignItems: 'center', borderRadius: radius.xl, padding: spacing.md, marginVertical: spacing.md, borderWidth: 1, gap: spacing.md },
  userAvatar:  { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center' },
  userInitials: { fontSize: font.lg, fontWeight: '700', color: '#fff' },
  userInfo:    { flex: 1 },
  userName:    { fontSize: font.md, fontWeight: '700' },
  userEmail:   { fontSize: font.sm, marginTop: 2 },

  list:    { borderRadius: radius.xl, borderWidth: 1, overflow: 'hidden', marginBottom: spacing.lg },
  row:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, paddingHorizontal: spacing.md },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  rowIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowIconText: { fontSize: 20 },
  rowTitle: { fontSize: font.md, fontWeight: '600' },
  rowSub:   { fontSize: font.xs, marginTop: 2 },
  arrow:    { fontSize: font.xl },
  divider:  { height: 1 },

  // Profile section
  profileHero: { borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.md },
  avatar:      { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  avatarText:  { fontSize: font.xxl, fontWeight: '700', color: '#fff' },
  nameRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 4 },
  displayName: { fontSize: font.xl, fontWeight: '700' },
  editIcon:    { fontSize: 16 },
  hint:        { fontSize: font.xs, marginBottom: 4, textAlign: 'center' },
  email:       { fontSize: font.sm },
  joined:      { fontSize: font.xs, marginTop: 4 },
  planBadge:   { marginTop: spacing.sm, backgroundColor: colors.teal + '20', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full, borderWidth: 1, borderColor: colors.teal + '40' },
  planBadgeText: { fontSize: font.xs, color: colors.teal, fontWeight: '700' },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 4 },
  nameInput:   { flex: 1, fontSize: font.lg, fontWeight: '700', borderBottomWidth: 1, paddingVertical: 4 },
  saveBtn:     { backgroundColor: colors.teal, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  saveBtnText: { fontSize: font.sm, fontWeight: '700', color: '#fff' },
  cancelBtn:   { padding: spacing.xs },
  cancelBtnText: { fontSize: font.md },
  section:     { borderRadius: radius.lg, borderWidth: 1, marginBottom: spacing.lg, overflow: 'hidden' },
  infoRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.md },
  infoLabel:   { fontSize: font.sm },
  infoValue:   { fontSize: font.sm, fontWeight: '600' },

  logoutBtn:  { backgroundColor: colors.error + '15', borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.error + '40', marginBottom: spacing.md },
  logoutText: { fontSize: font.md, fontWeight: '700', color: colors.error },
  footer:     { fontSize: font.xs, textAlign: 'center', marginBottom: spacing.lg },
})