import React, { useState } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, TextInput, Alert, ActivityIndicator, Image, Linking,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Header } from '../components/Header'
import { font, spacing, radius } from '../theme'
import { useColors } from '../ThemeContext'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../supabase'

export function ProfileScreen() {
  const c          = useColors()
  const getStyles  = buildStyles(c)
  const user       = useAuthStore(s => s.user)
  const updateUser = useAuthStore(s => s.updateUser)
  const logout     = useAuthStore(s => s.logout)

  const [editingName, setEditingName] = useState(false)
  const [nameInput,   setNameInput]   = useState(user?.displayName || '')
  const [saving,      setSaving]      = useState(false)
  const [loggingOut,  setLoggingOut]  = useState(false)
  const [uploading,   setUploading]   = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)

  const joined = user?.joinedAt
    ? new Date(user.joinedAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : ''

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

  const pickAndUploadPhoto = async () => {
    // Ask for permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access to set a profile picture.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    })

    if (result.canceled || !result.assets?.[0]) return

    const asset = result.assets[0]
    setUploading(true)

    try {
      // Read file as base64
      const response = await fetch(asset.uri)
      const blob     = await response.blob()

      // Upload to Supabase Storage
      const ext      = asset.uri.split('.').pop() || 'jpg'
      const path     = `avatars/${user!.id}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { upsert: true, contentType: `image/${ext}` })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)

      // Save to profile
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user!.id)
      updateUser({ avatarUrl: publicUrl })
      Alert.alert('Done', 'Profile photo updated!')
    } catch (e: unknown) {
      Alert.alert('Error', 'Could not upload photo. Make sure you have an "avatars" bucket in Supabase Storage.')
    } finally {
      setUploading(false)
    }
  }

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    })
    if (result.canceled || !result.assets?.[0]) return

    const asset = result.assets[0]
    setUploading(true)
    try {
      const response = await fetch(asset.uri)
      const blob     = await response.blob()
      const path     = `avatars/${user!.id}.jpg`
      const { error } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user!.id)
      updateUser({ avatarUrl: publicUrl })
      Alert.alert('Done', 'Profile photo updated!')
    } catch { Alert.alert('Error', 'Could not upload photo.') }
    finally { setUploading(false) }
  }

  const handlePhotoPress = () => {
    Alert.alert('Profile Photo', 'Choose how to update your photo', [
      { text: 'Camera',        onPress: takePhoto },
      { text: 'Photo Library', onPress: pickAndUploadPhoto },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  const handleLogout = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => {
        setLoggingOut(true)
        try { await supabase.auth.signOut(); logout() }
        catch { Alert.alert('Error', 'Could not sign out'); setLoggingOut(false) }
      }},
    ])
  }

  const styles = getStyles

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <Header title="Profile" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handlePhotoPress} style={styles.avatarWrap} disabled={uploading}>
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: c.teal }]}>
                <Text style={styles.avatarText}>{user?.initials || '?'}</Text>
              </View>
            )}
            <View style={[styles.cameraBtn, { backgroundColor: c.teal }]}>
              {uploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.cameraBtnText}>📷</Text>
              )}
            </View>
          </TouchableOpacity>

          {/* Name editor */}
          {editingName ? (
            <View style={styles.nameEditRow}>
              <TextInput
                style={[styles.nameInput, { color: c.text, borderBottomColor: c.teal }]}
                value={nameInput} onChangeText={setNameInput} autoFocus selectTextOnFocus
              />
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: c.teal }]} onPress={saveDisplayName} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingName(false)}>
                <Text style={[styles.cancelBtnText, { color: c.textSub }]}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setEditingName(true)} style={styles.nameRow}>
              <Text style={[styles.displayName, { color: c.text }]}>{user?.displayName || user?.fullName || 'User'}</Text>
              <Text style={styles.editIcon}>✏️</Text>
            </TouchableOpacity>
          )}
          <Text style={[styles.email, { color: c.textSub }]}>{user?.email}</Text>
          {joined && <Text style={[styles.joined, { color: c.textMuted }]}>Member since {joined}</Text>}
          <Text style={[styles.photoHint, { color: c.textMuted }]}>Tap photo to change it</Text>
        </View>

        {/* Plan card */}
        <View style={[styles.planCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <View style={styles.planLeft}>
            <Text style={styles.planIcon}>{user?.plan === 'pro' ? '⭐' : '🆓'}</Text>
            <View>
              <Text style={[styles.planTitle, { color: c.text }]}>{user?.plan === 'pro' ? 'Pro Plan' : 'Free Plan'}</Text>
              <Text style={[styles.planSub, { color: c.textSub }]}>{user?.plan === 'pro' ? 'All features unlocked' : 'Basic features'}</Text>
            </View>
          </View>
          {user?.plan !== 'pro' && (
            <TouchableOpacity style={[styles.upgradeBtn, { backgroundColor: c.teal }]} onPress={() => setShowUpgrade(true)}>
              <Text style={styles.upgradeBtnText}>Upgrade</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Upgrade modal */}
        {showUpgrade && (
          <View style={[styles.upgradeCard, { backgroundColor: c.bgCard, borderColor: c.teal + '50' }]}>
            <Text style={[styles.upgradeTitle, { color: c.text }]}>⭐ Upgrade to Pro</Text>
            <Text style={[styles.upgradeSub, { color: c.textSub }]}>UGX 15,000/month · Cancel anytime</Text>

            <View style={styles.upgradeFeatures}>
              {['✅ Unlimited voice sessions', '✅ Priority processing', '✅ Luganda + English TTS', '✅ Session history forever', '✅ Advanced navigation'].map(f => (
                <Text key={f} style={[styles.upgradeFeature, { color: c.text }]}>{f}</Text>
              ))}
            </View>

            <Text style={[styles.payLabel, { color: c.textSub }]}>Pay with Mobile Money:</Text>

            <TouchableOpacity
              style={[styles.payBtn, { backgroundColor: '#FFCD00' }]}
              onPress={() => {
                Alert.alert('MTN Mobile Money', 'Send UGX 15,000 to:\n\nMerchant Code: 347821\nRef: VOXEL-' + user?.id?.slice(0, 6).toUpperCase() + '\n\nThen contact support to activate Pro.')
              }}
            >
              <Text style={styles.payBtnTextDark}>📱 Pay with MTN MoMo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.payBtn, { backgroundColor: '#E40520', marginTop: spacing.sm }]}
              onPress={() => {
                Alert.alert('Airtel Money', 'Send UGX 15,000 to:\n\nMerchant: 0755347821\nRef: VOXEL-' + user?.id?.slice(0, 6).toUpperCase() + '\n\nThen contact support to activate Pro.')
              }}
            >
              <Text style={styles.payBtnText}>📱 Pay with Airtel Money</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.payBtn, { backgroundColor: c.bgElevated, borderWidth: 1, borderColor: c.border, marginTop: spacing.sm }]}
              onPress={() => Linking.openURL('mailto:support@voxel.app?subject=Pro Upgrade&body=User ID: ' + user?.id)}
            >
              <Text style={[styles.payBtnText, { color: c.text }]}>✉️ Contact Support</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowUpgrade(false)} style={styles.cancelUpgrade}>
              <Text style={[styles.cancelUpgradeText, { color: c.textMuted }]}>Maybe later</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Info rows */}
        <View style={[styles.infoSection, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          {[
            { label: 'Full Name',  value: user?.fullName || '—' },
            { label: 'Email',      value: user?.email    || '—' },
            { label: 'Account ID', value: user?.id ? `${user.id.slice(0, 8)}…` : '—' },
            { label: 'Plan',       value: user?.plan === 'pro' ? '⭐ Pro' : '🆓 Free' },
          ].map((row, i, arr) => (
            <React.Fragment key={row.label}>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: c.textSub }]}>{row.label}</Text>
                <Text style={[styles.infoValue, { color: c.text }]}>{row.value}</Text>
              </View>
              {i < arr.length - 1 && <View style={[styles.divider, { backgroundColor: c.border }]} />}
            </React.Fragment>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.logoutBtn, { backgroundColor: c.error + '15', borderColor: c.error + '40' }]}
          onPress={handleLogout} disabled={loggingOut} activeOpacity={0.8}
        >
          {loggingOut ? <ActivityIndicator color={c.error} /> : <Text style={[styles.logoutText, { color: c.error }]}>Sign Out</Text>}
        </TouchableOpacity>

      </ScrollView>
    </View>
  )
}

function buildStyles(c: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    flex:    { flex: 1 },
    content: { paddingHorizontal: spacing.lg, paddingBottom: 120 },

    avatarSection: { alignItems: 'center', paddingVertical: spacing.xl },
    avatarWrap:    { position: 'relative', marginBottom: spacing.md },
    avatarImage:   { width: 88, height: 88, borderRadius: 44 },
    avatar:        { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
    avatarText:    { fontSize: font.xxl, fontWeight: '700', color: '#fff' },
    cameraBtn:     { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
    cameraBtnText: { fontSize: 14 },

    nameRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 4 },
    displayName: { fontSize: font.xl, fontWeight: '700' },
    editIcon:    { fontSize: 16 },
    email:       { fontSize: font.sm },
    joined:      { fontSize: font.xs, marginTop: 4 },
    photoHint:   { fontSize: font.xs, marginTop: 6 },

    nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 4 },
    nameInput:   { flex: 1, fontSize: font.lg, fontWeight: '700', borderBottomWidth: 1, paddingVertical: 4 },
    saveBtn:     { borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 6 },
    saveBtnText: { fontSize: font.sm, fontWeight: '700', color: '#fff' },
    cancelBtn:   { padding: spacing.xs },
    cancelBtnText: { fontSize: font.md },

    planCard:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, marginBottom: spacing.md },
    planLeft:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    planIcon:    { fontSize: 28 },
    planTitle:   { fontSize: font.md, fontWeight: '700' },
    planSub:     { fontSize: font.xs, marginTop: 2 },
    upgradeBtn:  { borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
    upgradeBtnText: { fontSize: font.xs, fontWeight: '700', color: '#fff' },

    upgradeCard:     { borderRadius: radius.xl, borderWidth: 1, padding: spacing.lg, marginBottom: spacing.md },
    upgradeTitle:    { fontSize: font.xl, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
    upgradeSub:      { fontSize: font.sm, textAlign: 'center', marginBottom: spacing.md },
    upgradeFeatures: { gap: spacing.xs, marginBottom: spacing.md },
    upgradeFeature:  { fontSize: font.sm },
    payLabel:        { fontSize: font.xs, fontWeight: '700', marginBottom: spacing.sm },
    payBtn:          { borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
    payBtnText:      { fontSize: font.md, fontWeight: '700', color: '#fff' },
    payBtnTextDark:  { fontSize: font.md, fontWeight: '700', color: '#000' },
    cancelUpgrade:   { alignItems: 'center', marginTop: spacing.md },
    cancelUpgradeText: { fontSize: font.sm },

    infoSection: { borderRadius: radius.lg, borderWidth: 1, marginBottom: spacing.lg, overflow: 'hidden' },
    infoRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.md },
    infoLabel:   { fontSize: font.sm },
    infoValue:   { fontSize: font.sm, fontWeight: '600' },
    divider:     { height: 1, marginHorizontal: spacing.md },

    logoutBtn:  { borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center', borderWidth: 1 },
    logoutText: { fontSize: font.md, fontWeight: '700' },
  })
}
