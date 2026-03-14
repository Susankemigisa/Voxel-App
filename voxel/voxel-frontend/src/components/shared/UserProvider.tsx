'use client'

/**
 * UserProvider — runs once when dashboard mounts.
 * Loads the user session + profile from Supabase, writes to global store.
 * All pages just read from useAppStore() — no per-page fetching needed.
 */
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useAppStore, initials, type VoxelUser } from '@/lib/store/authStore'

export function UserProvider({ children }: { children: React.ReactNode }) {
  const router    = useRouter()
  const supabase  = createClient()
  const { setUser, setToken, logout } = useAppStore()

  useEffect(() => {
    const loadUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.replace('/login')
        return
      }

      setToken(session.access_token)
      const authUser = session.user

      // Fetch profile from DB
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, display_name, plan, created_at')
        .eq('id', authUser.id)
        .single()

      const fullName    = profile?.full_name    || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User'
      const displayName = profile?.display_name || fullName

      const user: VoxelUser = {
        id:          authUser.id,
        email:       authUser.email ?? '',
        fullName,
        displayName,
        initials:    initials(displayName),
        avatarUrl:   authUser.user_metadata?.avatar_url ?? null,
        plan:        (profile?.plan as 'free' | 'pro') ?? 'free',
        joinedAt:    authUser.created_at,
      }

      setUser(user)
    }

    loadUser()

    // Keep session alive, redirect on sign-out
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') { logout(); router.replace('/login') }
      if (event === 'TOKEN_REFRESHED' && session) setToken(session.access_token)
    })

    return () => subscription.unsubscribe()
  }, [])

  return <>{children}</>
}
