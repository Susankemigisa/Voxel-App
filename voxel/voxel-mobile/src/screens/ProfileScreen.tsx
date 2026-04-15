import React, { useState } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, TextInput, Alert, ActivityIndicator,
} from 'react-native'
import { Header } from '../components/Header'
import { colors, font, spacing, radius } from '../theme'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../supabase'

export function ProfileScreen() {
  const user       = useAuthStore(s => s.user)
  const updateUser = useAuthStore(s => s.updateUser)
  const logout     = useAuthStore(s => s.logout)

  const [editingName, setEditingName] = useState(false)
  const [nameInput,   setNameInput]   = useState(user?.displayName || '')
  const [saving,      setSaving]      = useState(false)
  const [loggingOut,  setLoggingOut]  = useState(false)

  const joined = user?.joinedAt
    ? new Date(user.joinedAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : ''

  const saveDisplayName = async () => {
    if (!nameInput.trim() || !user?.id) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: nameInput.trim() })
        .eq('id', user.id)
      if (error) throw error
      updateUser({ displayName: nameInput.trim() })
      setEditingName(false)
      Alert.alert('Saved', 'Display name updated!')
    } catch {
      Alert.alert('Error', 'Could not save name')
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          setLoggingOut(true)
          try {
            await supabase.auth.signOut()
            logout()
          } catch {
            Alert.alert('Error', 'Could not sign out')
            setLoggingOut(false)
          }
        },
      },
    ])
  }

  return (
    <View style={styles.flex}>
      <Header title="Profile" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Avatar + name */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.initials || '?'}</Text>
          </View>
          {editingName ? (
            <View style={styles.nameEditRow}>
              <TextInput
                style={styles.nameInput}
                value={nameInput}
                onChangeText={setNameInput}
                autoFocus
                selectTextOnFocus
              />
              <TouchableOpacity style={styles.saveBtn} onPress={saveDisplayName} disabled={saving}>
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.saveBtnText}>Save</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingName(false)}>
                <Text style={styles.cancelBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setEditingName(true)} style={styles.nameRow}>
              <Text style={styles.displayName}>{user?.displayName || user?.fullName || 'User'}</Text>
              <Text style={styles.editIcon}>✏️</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.email}>{user?.email}</Text>
          {joined && <Text style={styles.joined}>Member since {joined}</Text>}
        </View>

        {/* Plan badge */}
        <View style={styles.planCard}>
          <View style={styles.planLeft}>
            <Text style={styles.planIcon}>{user?.plan === 'pro' ? '⭐' : '🆓'}</Text>
            <View>
              <Text style={styles.planTitle}>{user?.plan === 'pro' ? 'Pro Plan' : 'Free Plan'}</Text>
              <Text style={styles.planSub}>{user?.plan === 'pro' ? 'All features unlocked' : 'Basic features'}</Text>
            </View>
          </View>
          {user?.plan !== 'pro' && (
            <TouchableOpacity style={styles.upgradeBtn}>
              <Text style={styles.upgradeBtnText}>Upgrade</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Info rows */}
        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Full Name</Text>
            <Text style={styles.infoValue}>{user?.fullName || '—'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user?.email || '—'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Account ID</Text>
            <Text style={styles.infoValue}>{user?.id?.slice(0, 8)}…</Text>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          disabled={loggingOut}
          activeOpacity={0.8}
        >
          {loggingOut
            ? <ActivityIndicator color={colors.error} />
            : <Text style={styles.logoutText}>Sign Out</Text>
          }
        </TouchableOpacity>

      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex:    { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 120 },

  avatarSection: { alignItems: 'center', paddingVertical: spacing.xl },
  avatar: {
    width:          80,
    height:         80,
    borderRadius:   40,
    backgroundColor: colors.teal,
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   spacing.md,
  },
  avatarText:  { fontSize: font.xxl, fontWeight: '700', color: '#fff' },
  nameRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 4 },
  displayName: { fontSize: font.xl, fontWeight: '700', color: colors.text },
  editIcon:    { fontSize: 16 },
  email:       { fontSize: font.sm, color: colors.textSub },
  joined:      { fontSize: font.xs, color: colors.textMuted, marginTop: 4 },

  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 4 },
  nameInput: {
    flex:              1,
    fontSize:          font.lg,
    fontWeight:        '700',
    color:             colors.text,
    borderBottomWidth: 1,
    borderBottomColor: colors.teal,
    paddingVertical:   4,
  },
  saveBtn: {
    backgroundColor: colors.teal,
    borderRadius:    radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   6,
  },
  saveBtnText:   { fontSize: font.sm, fontWeight: '700', color: '#fff' },
  cancelBtn:     { padding: spacing.xs },
  cancelBtnText: { fontSize: font.md, color: colors.textSub },

  planCard: {
    backgroundColor: colors.bgCard,
    borderRadius:    radius.lg,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    marginBottom:    spacing.md,
  },
  planLeft:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  planIcon:    { fontSize: 28 },
  planTitle: { fontSize: font.md, fontWeight: '700', color: colors.text },
  planSub:   { fontSize: font.xs, color: colors.textSub, marginTop: 2 },
  upgradeBtn: {
    backgroundColor: colors.teal,
    borderRadius:    radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs,
  },
  upgradeBtnText: { fontSize: font.xs, fontWeight: '700', color: '#fff' },

  infoSection: {
    backgroundColor: colors.bgCard,
    borderRadius:    radius.lg,
    borderWidth:     1,
    borderColor:     colors.border,
    marginBottom:    spacing.lg,
    overflow:        'hidden',
  },
  infoRow: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  infoLabel: { fontSize: font.sm, color: colors.textSub },
  infoValue: { fontSize: font.sm, color: colors.text, fontWeight: '600' },
  divider:   { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md },

  logoutBtn: {
    backgroundColor: colors.error + '15',
    borderRadius:    radius.lg,
    paddingVertical: spacing.md,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     colors.error + '40',
  },
  logoutText: { fontSize: font.md, fontWeight: '700', color: colors.error },
})