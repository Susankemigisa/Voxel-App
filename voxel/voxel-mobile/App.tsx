import React, { useEffect, useState } from 'react'
import { View, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'

import { supabase }          from './src/supabase'
import { useAuthStore, makeInitials } from './src/store/authStore'
import { ThemeProvider, useTheme }   from './src/ThemeContext'
import { colors }            from './src/theme'

import { LandingScreen }  from './src/screens/LandingScreen'
import { LoginScreen }    from './src/screens/LoginScreen'
import { RegisterScreen } from './src/screens/RegisterScreen'
import { HomeScreen }     from './src/screens/HomeScreen'
import { VoiceScreen }    from './src/screens/VoiceScreen'
import { NavigateScreen } from './src/screens/NavigateScreen'
import { TTSScreen }      from './src/screens/TTSScreen'
import { SettingsScreen } from './src/screens/SettingsScreen'
import { BottomNav }      from './src/components/BottomNav'
import type { TabName }   from './src/components/BottomNav'

type AuthFlow = 'landing' | 'login' | 'register'

function AppInner() {
  const { user, isLoading, setUser, setToken, setLoading } = useAuthStore()
  const { theme, toggle, isDark } = useTheme()
  const [authFlow,  setAuthFlow]  = useState<AuthFlow>('landing')
  const [activeTab, setActiveTab] = useState<TabName>('home')

  const bg = isDark ? colors.bg : '#f0f4ff'

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        setToken(session.access_token)
        await loadProfile(session.user.id)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setToken(session.access_token)
        await loadProfile(session.user.id)
        setLoading(false)
      }
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setToken(null)
        setLoading(false)
        setAuthFlow('landing')
      }
      if (event === 'TOKEN_REFRESHED' && session) {
        setToken(session.access_token)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadProfile = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (data) {
        const fullName    = data.full_name    ?? ''
        const displayName = data.display_name ?? fullName
        setUser({
          id:          data.id,
          email:       data.email,
          fullName,
          displayName,
          initials:    makeInitials(displayName || fullName || data.email),
          avatarUrl:   data.avatar_url ?? null,
          plan:        data.plan       ?? 'free',
          joinedAt:    data.created_at,
        })
      }
    } catch { /* profile fetch failed */ }
  }

  if (isLoading) {
    return (
      <View style={[styles.splash, { backgroundColor: bg }]}>
        <View style={styles.splashLogo}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
      </View>
    )
  }

  if (!user) {
    return (
      <View style={[styles.app, { backgroundColor: bg }]}>
        <StatusBar style="light" />
        {authFlow === 'landing' && (
          <LandingScreen
            onGetStarted={() => setAuthFlow('register')}
            onSignIn={()     => setAuthFlow('login')}
          />
        )}
        {authFlow === 'login' && (
          <LoginScreen
            onSwitch={() => setAuthFlow('register')}
            onBack={()   => setAuthFlow('landing')}
          />
        )}
        {authFlow === 'register' && (
          <RegisterScreen
            onSwitch={() => setAuthFlow('login')}
            onBack={()   => setAuthFlow('landing')}
          />
        )}
      </View>
    )
  }

  const renderScreen = () => {
    switch (activeTab) {
      case 'home':     return <HomeScreen     onNavigate={setActiveTab} />
      case 'voice':    return <VoiceScreen    />
      case 'navigate': return <NavigateScreen />
      case 'tts':      return <TTSScreen      />
      case 'settings': return <SettingsScreen theme={theme} onToggleTheme={toggle} isDark={isDark} />
      default:         return <HomeScreen     onNavigate={setActiveTab} />
    }
  }

  return (
    <View style={[styles.app, { backgroundColor: bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {renderScreen()}
      <BottomNav active={activeTab} onPress={setActiveTab} isDark={isDark} />
    </View>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppInner />
      </ThemeProvider>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  splashLogo: { width: 80, height: 80, borderRadius: 20, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center' },
  app: { flex: 1 },
})