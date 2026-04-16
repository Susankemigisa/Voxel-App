import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../supabase'
import { colors, font, spacing, radius } from '../theme'

interface Props {
  onSwitch: () => void
  onBack:   () => void
}

export function LoginScreen({ onSwitch, onBack }: Props) {
  const insets = useSafeAreaInsets()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter your email and password')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) Alert.alert('Login failed', error.message)
    } catch {
      Alert.alert('Error', 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Enter your email', 'Type your email above then tap Forgot Password.')
      return
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim())
      if (error) Alert.alert('Error', error.message)
      else Alert.alert('Check your email', `Reset link sent to ${email.trim()}`)
    } catch {
      Alert.alert('Error', 'Could not send reset email.')
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing.md }]}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.logoWrap}>
          <View style={styles.logo}><Text style={styles.logoIcon}>⚡</Text></View>
          <Text style={styles.appName}>Voxel</Text>
          <Text style={styles.tagline}>Find Your Voice</Text>
        </View>

        <View style={styles.tabs}>
          <TouchableOpacity style={styles.tabInactive} onPress={onSwitch}>
            <Text style={styles.tabInactiveText}>Sign Up</Text>
          </TouchableOpacity>
          <View style={styles.tabActive}>
            <Text style={styles.tabActiveText}>Sign In</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome back</Text>
          <Text style={styles.cardSub}>Sign in to continue your journey</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputWrap}>
              <Text style={styles.inputIcon}>✉️</Text>
              <TextInput
                style={styles.input}
                placeholder="name@example.com"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Password</Text>
              <TouchableOpacity onPress={handleForgotPassword}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.inputWrap}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
              />
              <TouchableOpacity onPress={() => setShowPass(p => !p)} style={styles.eyeBtn}>
                <Text style={styles.eyeIcon}>{showPass ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleLogin} disabled={loading} activeOpacity={0.8}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Sign In →</Text>}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity style={styles.googleBtn} activeOpacity={0.8}>
            <Text style={styles.googleG}>G</Text>
            <Text style={styles.googleText}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onSwitch} style={styles.switchWrap}>
            <Text style={styles.switchText}>Don't have an account? <Text style={styles.switchLink}>Create one free</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex:      { flex: 1, backgroundColor: colors.bg },
  container: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  backBtn:   { marginBottom: spacing.md },
  backText:  { fontSize: font.md, color: colors.textSub, fontWeight: '600' },
  logoWrap:  { alignItems: 'center', marginBottom: spacing.lg },
  logo:      { width: 64, height: 64, borderRadius: 18, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  logoIcon:  { fontSize: 30 },
  appName:   { fontSize: font.xxl, fontWeight: '800', color: colors.text, letterSpacing: 1 },
  tagline:   { fontSize: font.sm, color: colors.textSub, marginTop: 2 },
  tabs:      { flexDirection: 'row', backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 4, marginBottom: spacing.md },
  tabActive: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, alignItems: 'center', backgroundColor: colors.teal },
  tabActiveText: { fontSize: font.sm, fontWeight: '700', color: '#fff' },
  tabInactive:   { flex: 1, paddingVertical: spacing.sm, alignItems: 'center' },
  tabInactiveText: { fontSize: font.sm, color: colors.textSub },
  card:      { backgroundColor: colors.bgCard, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontSize: font.xl, fontWeight: '700', color: colors.text, marginBottom: 4 },
  cardSub:   { fontSize: font.sm, color: colors.textSub, marginBottom: spacing.lg },
  field:     { marginBottom: spacing.md },
  labelRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  label:     { fontSize: font.sm, color: colors.textSub, marginBottom: spacing.xs, fontWeight: '600' },
  forgotText: { fontSize: font.xs, color: colors.teal, fontWeight: '600' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgElevated, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md },
  inputIcon: { fontSize: 16, marginRight: spacing.sm },
  input:     { flex: 1, paddingVertical: spacing.sm + 4, fontSize: font.md, color: colors.text },
  eyeBtn:    { padding: spacing.xs },
  eyeIcon:   { fontSize: 16 },
  btn:       { backgroundColor: colors.teal, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  btnDisabled: { opacity: 0.6 },
  btnText:   { fontSize: font.md, fontWeight: '700', color: '#fff' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.md, gap: spacing.sm },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontSize: font.xs, color: colors.textMuted, fontWeight: '600' },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.bgElevated, borderRadius: radius.md, paddingVertical: spacing.sm + 4, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  googleG:   { fontSize: font.lg, fontWeight: '800', color: '#4285F4' },
  googleText: { fontSize: font.md, color: colors.text, fontWeight: '600' },
  switchWrap: { alignItems: 'center', marginTop: spacing.xs },
  switchText: { fontSize: font.sm, color: colors.textSub },
  switchLink: { color: colors.teal, fontWeight: '700' },
})