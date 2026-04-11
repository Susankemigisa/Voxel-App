import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../src/lib/supabase'
import { COLORS, RADIUS } from '../../src/lib/theme'

export default function RegisterScreen() {
  const router = useRouter()
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [showPass, setShowPass] = useState(false)

  async function handleRegister() {
    if (!name || !email || !password) return Alert.alert('Error', 'All fields are required')
    if (password.length < 6) return Alert.alert('Error', 'Password must be at least 6 characters')
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: name } },
    })
    setLoading(false)
    if (error) Alert.alert('Registration failed', error.message)
    else Alert.alert('Check your email', 'We sent a confirmation link. Sign in after confirming.')
  }

  return (
    <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">

      <View style={s.logoWrap}>
        <View style={s.logoOrb}><Text style={s.logoText}>⚡</Text></View>
        <Text style={s.brand}>VOXEL</Text>
        <Text style={s.tagline}>Find Your Voice</Text>
      </View>

      <View style={s.card}>
        <Text style={s.title}>Create an Account</Text>
        <Text style={s.sub}>Join Voxel and find your voice</Text>

        <View style={s.tabs}>
          <View style={s.tabActive}>
            <Text style={s.tabActiveText}>Sign Up</Text>
          </View>
          <TouchableOpacity style={s.tabInactive} onPress={() => router.replace('/(auth)/login')}>
            <Text style={s.tabInactiveText}>Sign In</Text>
          </TouchableOpacity>
        </View>

        <View style={s.field}>
          <Text style={s.label}>Full Name</Text>
          <TextInput style={s.input} placeholder="Jane Doe" placeholderTextColor={COLORS.muted}
            value={name} onChangeText={setName} />
        </View>

        <View style={s.field}>
          <Text style={s.label}>Email Address</Text>
          <TextInput style={s.input} placeholder="name@example.com" placeholderTextColor={COLORS.muted}
            value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        </View>

        <View style={s.field}>
          <Text style={s.label}>Password</Text>
          <View style={s.inputRow}>
            <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} placeholder="••••••••"
              placeholderTextColor={COLORS.muted} value={password} onChangeText={setPassword}
              secureTextEntry={!showPass} />
            <TouchableOpacity onPress={() => setShowPass(p => !p)} style={s.eyeBtn}>
              <Text style={{ color: COLORS.muted, fontSize: 16 }}>{showPass ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.hint}>At least 6 characters</Text>
        </View>

        <TouchableOpacity style={s.btn} onPress={handleRegister} disabled={loading} activeOpacity={0.8}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Create Free Account →</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={s.switchWrap}>
          <Text style={s.switchText}>Already have an account? <Text style={{ color: COLORS.teal2 }}>Sign in</Text></Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container:    { flexGrow: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', padding: 20 },
  logoWrap:     { alignItems: 'center', marginBottom: 32 },
  logoOrb:      { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.teal, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  logoText:     { fontSize: 32 },
  brand:        { fontSize: 22, fontWeight: '800', color: COLORS.text, letterSpacing: 4 },
  tagline:      { fontSize: 13, color: COLORS.subtle, marginTop: 4 },
  card:         { width: '100%', backgroundColor: COLORS.card, borderRadius: RADIUS.xxl, padding: 24, borderWidth: 1, borderColor: COLORS.border },
  title:        { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  sub:          { fontSize: 13, color: COLORS.subtle, marginBottom: 20 },
  tabs:         { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: 4, marginBottom: 20 },
  tabActive:    { flex: 1, backgroundColor: COLORS.teal, borderRadius: RADIUS.lg, paddingVertical: 10, alignItems: 'center' },
  tabActiveText:{ color: '#fff', fontWeight: '600', fontSize: 13 },
  tabInactive:  { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabInactiveText: { color: COLORS.subtle, fontSize: 13 },
  field:        { marginBottom: 16 },
  label:        { fontSize: 12, color: COLORS.subtle, fontWeight: '600', marginBottom: 6 },
  input:        { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, paddingHorizontal: 14, paddingVertical: 12, color: COLORS.text, fontSize: 14 },
  inputRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, overflow: 'hidden' },
  eyeBtn:       { paddingHorizontal: 14 },
  hint:         { fontSize: 11, color: COLORS.muted, marginTop: 4 },
  btn:          { backgroundColor: COLORS.teal, borderRadius: RADIUS.xl, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnText:      { color: '#fff', fontWeight: '700', fontSize: 16 },
  switchWrap:   { marginTop: 16, alignItems: 'center' },
  switchText:   { fontSize: 13, color: COLORS.muted },
})
