import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface VoxelUser {
  id:          string
  email:       string
  fullName:    string
  displayName: string   // what the app calls the user — editable
  initials:    string
  avatarUrl:   string | null
  plan:        'free' | 'pro'
  joinedAt:    string
}

interface AppState {
  user:         VoxelUser | null
  accessToken:  string | null
  isLoading:    boolean

  // actions
  setUser:         (user: VoxelUser | null) => void
  updateUser:      (partial: Partial<VoxelUser>) => void
  setToken:        (token: string | null) => void
  setLoading:      (v: boolean) => void
  logout:          () => void
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export { initials }

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      user:        null,
      accessToken: null,
      isLoading:   false,

      setUser:    (user)        => set({ user }),
      updateUser: (partial)     => {
        const cur = get().user
        if (!cur) return
        const updated = { ...cur, ...partial }
        // Always keep initials in sync with displayName
        if (partial.displayName) updated.initials = initials(partial.displayName)
        set({ user: updated })
      },
      setToken:   (accessToken) => set({ accessToken }),
      setLoading: (isLoading)   => set({ isLoading }),
      logout:     ()            => set({ user: null, accessToken: null }),
    }),
    {
      name: 'voxel-app-v2',
      partialize: (s) => ({ user: s.user, accessToken: s.accessToken }),
    }
  )
)

// Keep legacy export working
export const useAuthStore = useAppStore
