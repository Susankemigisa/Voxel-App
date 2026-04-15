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
}

export function LoginScreen({ onSwitch }: Props) {
  const insets = useSafeAreaInsets()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
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
      Alert.alert('Error', 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoWrap}>
          <View style={styles.logo}>
            <Text style={styles.logoIcon}>⚡</Text>
          </View>
          <Text style={styles.appName}>Voxel</Text>
          <Text style={styles.tagline}>Find Your Voice</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome back</Text>
          <Text style={styles.cardSub}>Sign in to continue</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Sign In</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={onSwitch} style={styles.switchWrap}>
            <Text style={styles.switchText}>
              Don't have an account? <Text style={styles.switchLink}>Sign up</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex:      { flex: 1, backgroundColor: colors.bg },
  container: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

  logoWrap:  { alignItems: 'center', marginBottom: spacing.xl },
  logo: {
    width:          72,
    height:         72,
    borderRadius:   20,
    backgroundColor: colors.teal,
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   spacing.md,
  },
  logoIcon:  { fontSize: 36 },
  appName: {
    fontSize:   font.xxxl,
    fontWeight: '800',
    color:      colors.text,
    letterSpacing: 1,
  },
  tagline: {
    fontSize:  font.md,
    color:     colors.textSub,
    marginTop: 4,
  },

  card: {
    backgroundColor: colors.bgCard,
    borderRadius:    radius.xl,
    padding:         spacing.lg,
    borderWidth:     1,
    borderColor:     colors.border,
  },
  cardTitle: {
    fontSize:     font.xxl,
    fontWeight:   '700',
    color:        colors.text,
    marginBottom: 4,
  },
  cardSub: {
    fontSize:     font.md,
    color:        colors.textSub,
    marginBottom: spacing.lg,
  },

  field:        { marginBottom: spacing.md },
  label: {
    fontSize:     font.sm,
    color:        colors.textSub,
    marginBottom: spacing.xs,
    fontWeight:   '600',
  },
  input: {
    backgroundColor: colors.bgElevated,
    borderRadius:    radius.md,
    borderWidth:     1,
    borderColor:     colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm + 4,
    fontSize:        font.md,
    color:           colors.text,
  },

  btn: {
    backgroundColor: colors.teal,
    borderRadius:    radius.md,
    paddingVertical: spacing.md,
    alignItems:      'center',
    marginTop:       spacing.sm,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: {
    fontSize:   font.md,
    fontWeight: '700',
    color:      '#fff',
  },

  switchWrap: { alignItems: 'center', marginTop: spacing.md },
  switchText: { fontSize: font.sm, color: colors.textSub },
  switchLink: { color: colors.teal, fontWeight: '700' },
})