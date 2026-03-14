'use client'

import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store/authStore'
import { signIn, signUp, signOut, getProfile } from '@/lib/api/supabase'
import toast from 'react-hot-toast'

export function useAuth() {
  const router  = useRouter()
  const store   = useAuthStore()
  const supabase = createClient()

  // Sync Supabase session on mount
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        store.setToken(session.access_token)
        const profile = await getProfile(session.user.id)
        if (profile) store.setUser(profile)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          store.setToken(session.access_token)
          const profile = await getProfile(session.user.id)
          if (profile) store.setUser(profile)
          router.push('/home')
        }
        if (event === 'SIGNED_OUT') {
          store.logout()
          router.push('/login')
        }
        if (event === 'TOKEN_REFRESHED' && session) {
          store.setToken(session.access_token)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (email: string, password: string) => {
    try {
      await signIn(email, password)
      toast.success('Welcome back!')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed'
      toast.error(msg)
      throw err
    }
  }, [])

  const register = useCallback(async (email: string, password: string, fullName: string) => {
    try {
      await signUp(email, password, fullName)
      toast.success('Account created! Check your email to confirm.')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed'
      toast.error(msg)
      throw err
    }
  }, [])

  const logout = useCallback(async () => {
    await signOut()
    toast.success('Signed out')
  }, [])

  return {
    user:      store.user,
    token:     store.accessToken,
    isLoading: store.isLoading,
    isAuthed:  !!store.user,
    login,
    register,
    logout,
  }
}
