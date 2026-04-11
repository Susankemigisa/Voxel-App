import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { StatusBar } from 'expo-status-bar'
import { supabase } from '../src/lib/supabase'
import { useAppStore, initials } from '../src/store/authStore'

function AuthGate() {
  const router   = useRouter()
  const segments = useSegments()
  const { user, setUser, setToken, logout } = useAppStore()

  useEffect(() => {
    async function hydrateUser(session: any) {
      if (!session) return
      const u = session.user
      const authName = u.user_metadata?.full_name ?? u.email ?? ''

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, full_name, plan')
        .eq('id', u.id)
        .single()

      const displayName =
        profile?.display_name?.trim() ||
        profile?.full_name?.trim()    ||
        authName.split(' ')[0]        ||
        u.email?.split('@')[0]        ||
        'User'

      setToken(session.access_token)
      setUser({
        id:          u.id,
        email:       u.email!,
        fullName:    profile?.full_name ?? authName,
        displayName,
        initials:    initials(displayName),
        avatarUrl:   u.user_metadata?.avatar_url ?? null,
        plan:        profile?.plan ?? 'free',
        joinedAt:    u.created_at,
      })
    }

    supabase.auth.getSession().then(({ data: { session } }) => hydrateUser(session))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) logout()
      else hydrateUser(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Route guard
  useEffect(() => {
    const inAuth = segments[0] === '(auth)'
    if (!user && !inAuth) router.replace('/(auth)/login')
    if (user && inAuth)  router.replace('/(tabs)/home')
  }, [user, segments])

  return null
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" backgroundColor="#080d1a" />
      <AuthGate />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#080d1a' } }}>
        <Stack.Screen name="index"    options={{ headerShown: false }} />
        <Stack.Screen name="(auth)"   options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)"   options={{ headerShown: false }} />
        <Stack.Screen name="sessions" options={{ headerShown: false, presentation: 'card' }} />
        <Stack.Screen name="settings" options={{ headerShown: false, presentation: 'card' }} />
      </Stack>
    </GestureHandlerRootView>
  )
}
