import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Alert, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../src/lib/supabase'
import { useAppStore, initials } from '../../src/store/authStore'
import { COLORS, RADIUS } from '../../src/lib/theme'

export default function ProfileScreen() {
  const user       = useAppStore(s => s.user)
  const updateUser = useAppStore(s => s.updateUser)
  const logout     = useAppStore(s => s.logout)

  const [editing,    setEditing]    = useState(false)
  const [nameInput,  setNameInput]  = useState(user?.displayName ?? '')
  const [saving,     setSaving]     = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  async function saveDisplayName() {
    if (!nameInput.trim() || !user?.id) return
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: nameInput.trim() })
      .eq('id', user.id)
    setSaving(false)
    if (error) { Alert.alert('Error', error.message); return }
    updateUser({ displayName: nameInput.trim(), initials: initials(nameInput.trim()) })
    setEditing(false)
    Alert.alert('Saved', 'Display name updated successfully')
  }

  async function handleLogout() {
    setLoggingOut(true)
    await supabase.auth.signOut()
    logout()
    setLoggingOut(false)
  }

  if (!user) return (
    <SafeAreaView style={s.safe}>
      <ActivityIndicator color={COLORS.teal} style={{ marginTop: 60 }} />
    </SafeAreaView>
  )

  const joined = user.joinedAt
    ? new Date(user.joinedAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : ''

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.heading}>My Profile</Text>
        <Text style={s.sub}>Account and preferences</Text>

        {/* Avatar card */}
        <View style={s.avatarCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{user.initials}</Text>
          </View>

          {editing ? (
            <View style={s.editRow}>
              <TextInput
                style={s.nameInput} value={nameInput} onChangeText={setNameInput}
                autoFocus placeholder="Display name" placeholderTextColor={COLORS.muted}
              />
              <TouchableOpacity style={s.saveBtn} onPress={saveDisplayName} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveBtnText}>✓</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setEditing(false)}>
                <Text style={s.cancelBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => { setEditing(true); setNameInput(user.displayName) }} style={s.nameRow}>
              <Text style={s.displayName}>{user.displayName}</Text>
              <Text>  ✏️</Text>
            </TouchableOpacity>
          )}

          <Text style={s.tapHint}>Tap name to change what Voxel calls you</Text>
          <Text style={s.email}>{user.email}</Text>
          {joined ? <Text style={s.joined}>Member since {joined}</Text> : null}
          <View style={s.planBadge}>
            <Text style={s.planText}>{user.plan === 'pro' ? '⚡ Pro Plan' : '✦ Free Plan'}</Text>
          </View>
        </View>

        {/* Info rows */}
        <View style={s.infoCard}>
          {[
            { label: 'Email',     value: user.email },
            { label: 'Full Name', value: user.fullName || '—' },
            { label: 'Plan',      value: user.plan === 'pro' ? 'Pro' : 'Free' },
            { label: 'Joined',    value: joined || '—' },
          ].map(({ label, value }, i, arr) => (
            <View key={label} style={[s.infoRow, i < arr.length - 1 && s.infoRowBorder]}>
              <Text style={s.infoLabel}>{label}</Text>
              <Text style={s.infoValue} numberOfLines={1}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} disabled={loggingOut} activeOpacity={0.8}>
          {loggingOut
            ? <ActivityIndicator color={COLORS.red} />
            : <Text style={s.logoutText}>🚪 Sign Out</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: COLORS.bg },
  scroll:        { flex: 1, paddingHorizontal: 20, paddingBottom: 30 },
  heading:       { color: COLORS.text, fontWeight: '800', fontSize: 22, marginTop: 16, marginBottom: 4 },
  sub:           { color: COLORS.subtle, fontSize: 13, marginBottom: 20 },
  avatarCard:    { backgroundColor: COLORS.card, borderRadius: RADIUS.xxl, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, marginBottom: 16 },
  avatar:        { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.teal, alignItems: 'center', justifyContent: 'center', marginBottom: 14, shadowColor: COLORS.teal, shadowOpacity: 0.5, shadowRadius: 20, elevation: 8 },
  avatarText:    { color: '#fff', fontWeight: '800', fontSize: 26 },
  editRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  nameInput:     { flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, paddingHorizontal: 12, paddingVertical: 8, color: COLORS.text, fontSize: 16, fontWeight: '700', borderWidth: 1, borderColor: COLORS.teal },
  saveBtn:       { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.teal, alignItems: 'center', justifyContent: 'center' },
  saveBtnText:   { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancelBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { color: COLORS.subtle, fontSize: 16 },
  nameRow:       { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  displayName:   { color: COLORS.text, fontWeight: '700', fontSize: 20 },
  tapHint:       { color: COLORS.muted, fontSize: 11, marginBottom: 6 },
  email:         { color: COLORS.muted, fontSize: 13, marginBottom: 4 },
  joined:        { color: COLORS.muted, fontSize: 12, marginBottom: 10 },
  planBadge:     { backgroundColor: 'rgba(11,148,136,0.15)', borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 6 },
  planText:      { color: COLORS.teal2, fontWeight: '600', fontSize: 13 },
  infoCard:      { backgroundColor: COLORS.card, borderRadius: RADIUS.xxl, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, marginBottom: 16 },
  infoRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  infoLabel:     { color: COLORS.muted, fontSize: 13 },
  infoValue:     { color: COLORS.text, fontSize: 13, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  logoutBtn:     { backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: RADIUS.xl, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', marginBottom: 30 },
  logoutText:    { color: COLORS.red, fontWeight: '700', fontSize: 15 },
})
