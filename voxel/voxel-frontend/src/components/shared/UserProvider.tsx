'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useAppStore, initials } from '@/lib/store/authStore'

/**
 * UserProvider
 * Syncs the Supabase auth session into the Zustand store on mount
 * and listens for auth state changes (sign-in / sign-out) throughout
 * the session. Renders children immediately — no loading gate needed
 * because Zustand's persisted state already hydrates from localStorage.
 */
export function UserProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setToken, logout } = useAppStore()

  useEffect(() => {
    // Use the singleton — createClient() returns the same instance every time
    const supabase = createClient()

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      const u = session.user
      const fullName    = u.user_metadata?.full_name ?? u.email ?? ''
      const displayName = u.user_metadata?.display_name ?? fullName.split(' ')[0] ?? ''
      setToken(session.access_token)
      setUser({
        id:          u.id,
        email:       u.email!,
        fullName,
        displayName,
        initials:    initials(displayName || fullName),
        avatarUrl:   u.user_metadata?.avatar_url ?? null,
        plan:        'free',
        joinedAt:    u.created_at,
      })
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) {
          logout()
          return
        }
        const u = session.user
        const fullName    = u.user_metadata?.full_name ?? u.email ?? ''
        const displayName = u.user_metadata?.display_name ?? fullName.split(' ')[0] ?? ''
        setToken(session.access_token)
        setUser({
          id:          u.id,
          email:       u.email!,
          fullName,
          displayName,
          initials:    initials(displayName || fullName),
          avatarUrl:   u.user_metadata?.avatar_url ?? null,
          plan:        'free',
          joinedAt:    u.created_at,
        })
      }
    )

    return () => subscription.unsubscribe()
  }, [setUser, setToken, logout])

  return <>{children}</>
}