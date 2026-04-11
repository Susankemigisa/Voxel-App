import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

export interface VoxelUser {
  id:          string
  email:       string
  fullName:    string
  displayName: string
  initials:    string
  avatarUrl:   string | null
  plan:        'free' | 'pro'
  joinedAt:    string
}

interface AppState {
  user:        VoxelUser | null
  accessToken: string | null
  isLoading:   boolean
  setUser:     (user: VoxelUser | null) => void
  updateUser:  (partial: Partial<VoxelUser>) => void
  setToken:    (token: string | null) => void
  setLoading:  (v: boolean) => void
  logout:      () => void
}

export function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      user:        null,
      accessToken: null,
      isLoading:   false,
      setUser:    (user)       => set({ user }),
      updateUser: (partial)    => {
        const cur = get().user; if (!cur) return
        const updated = { ...cur, ...partial }
        if (partial.displayName) updated.initials = initials(partial.displayName)
        set({ user: updated })
      },
      setToken:   (accessToken) => set({ accessToken }),
      setLoading: (isLoading)   => set({ isLoading }),
      logout:     ()            => set({ user: null, accessToken: null }),
    }),
    {
      name:    'voxel-app-v2',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: s => ({ user: s.user, accessToken: s.accessToken }),
    }
  )
)
