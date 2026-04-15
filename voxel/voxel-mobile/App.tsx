import React, { useEffect, useState } from 'react'
import { View, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'

import { supabase } from './src/supabase'
import { useAuthStore, makeInitials } from './src/store/authStore'
import { colors } from './src/theme'

import { LoginScreen }    from './src/screens/LoginScreen'
import { RegisterScreen } from './src/screens/RegisterScreen'
import { HomeScreen }     from './src/screens/HomeScreen'
import { VoiceScreen }    from './src/screens/VoiceScreen'
import { NavigateScreen } from './src/screens/NavigateScreen'
import { TTSScreen }      from './src/screens/TTSScreen'
import { ProfileScreen }  from './src/screens/ProfileScreen'
import { BottomNav }      from './src/components/BottomNav'
import type { TabName }   from './src/components/BottomNav'

export default function App() {
  const { user, isLoading, setUser, setToken, setLoading } = useAuthStore()
  const [authScreen, setAuthScreen] = useState<'login' | 'register'>('login')
  const [activeTab,  setActiveTab]  = useState<TabName>('home')

  useEffect(() => {
    // Check existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        setToken(session.access_token)
        await loadProfile(session.user.id)
      }
      setLoading(false)
    })

    // Listen for auth changes
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
    } catch {
      // Profile fetch failed — user still authed, just no profile data
    }
  }

  // Loading splash
  if (isLoading) {
    return (
      <View style={styles.splash}>
        <View style={styles.splashLogo}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
      </View>
    )
  }

  // Not authenticated
  if (!user) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        {authScreen === 'login'
          ? <LoginScreen    onSwitch={() => setAuthScreen('register')} />
          : <RegisterScreen onSwitch={() => setAuthScreen('login')}    />
        }
      </SafeAreaProvider>
    )
  }

  // Authenticated — main app
  const renderScreen = () => {
    switch (activeTab) {
      case 'home':     return <HomeScreen     onNavigate={setActiveTab} />
      case 'voice':    return <VoiceScreen    />
      case 'navigate': return <NavigateScreen />
      case 'tts':      return <TTSScreen      />
      case 'profile':  return <ProfileScreen  />
      default:         return <HomeScreen     onNavigate={setActiveTab} />
    }
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View style={styles.app}>
        {renderScreen()}
        <BottomNav active={activeTab} onPress={setActiveTab} />
      </View>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  splash: {
    flex:            1,
    backgroundColor: colors.bg,
    alignItems:      'center',
    justifyContent:  'center',
  },
  splashLogo: {
    width:          80,
    height:         80,
    borderRadius:   20,
    backgroundColor: colors.teal,
    alignItems:     'center',
    justifyContent: 'center',
  },
  app: {
    flex:            1,
    backgroundColor: colors.bg,
  },
})