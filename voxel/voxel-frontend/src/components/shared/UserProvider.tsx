'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useAppStore, initials } from '@/lib/store/authStore'

const supabase = createClient()

/**
 * UserProvider
 * On mount: loads the Supabase session, then fetches the profiles table
 * to get the user's saved display_name (which may differ from auth metadata).
 * This ensures name changes made in profile/page.tsx persist across refreshes.
 */
export function UserProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setToken, logout } = useAppStore()

  async function hydrateUser(session: any) {
    if (!session) return
    const u = session.user
    const authFullName = u.user_metadata?.full_name ?? u.email ?? ''

    // Query profiles table — display_name saved here is the source of truth,
    // not user_metadata which only reflects what was set at sign-up.
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, full_name, plan')
      .eq('id', u.id)
      .single()

    // Priority: profiles.display_name → profiles.full_name → auth full_name → email prefix
    const displayName =
      profile?.display_name?.trim() ||
      profile?.full_name?.trim() ||
      authFullName.split(' ')[0] ||
      u.email?.split('@')[0] ||
      'User'

    setToken(session.access_token)
    setUser({
      id:          u.id,
      email:       u.email!,
      fullName:    profile?.full_name ?? authFullName,
      displayName,
      initials:    initials(displayName),
      avatarUrl:   u.user_metadata?.avatar_url ?? null,
      plan:        profile?.plan ?? 'free',
      joinedAt:    u.created_at,
    })
  }

  useEffect(() => {
    // Hydrate store from current session on first render
    supabase.auth.getSession().then(({ data: { session } }) => hydrateUser(session))

    // Re-hydrate on auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) { logout(); return }
      hydrateUser(session)
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>
}