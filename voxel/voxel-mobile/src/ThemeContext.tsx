import React, { createContext, useContext, useState } from 'react'

type Theme = 'dark' | 'light'

interface ThemeContextType {
  theme:  Theme
  toggle: () => void
  isDark: boolean
}

const ThemeContext = createContext<ThemeContextType>({
  theme:  'dark',
  toggle: () => {},
  isDark: true,
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')

  const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  return (
    <ThemeContext.Provider value={{ theme, toggle, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}

// Dynamic colors based on theme
export function getColors(isDark: boolean) {
  return {
    teal:        '#0b9488',
    tealDark:    '#0a6560',
    tealLight:   '#14b8a6',
    blue:        '#2563eb',
    purple:      '#7c3aed',
    bg:          isDark ? '#080d1a' : '#f0f4ff',
    bgCard:      isDark ? '#0e1628' : '#ffffff',
    bgElevated:  isDark ? '#131d30' : '#f8faff',
    border:      isDark ? '#1e2d45' : '#e2e8f0',
    borderLight: isDark ? '#243350' : '#cbd5e1',
    text:        isDark ? '#f0f4ff' : '#0a0f1e',
    textSub:     isDark ? '#8899bb' : '#475569',
    textMuted:   isDark ? '#4a5a7a' : '#94a3b8',
    success:     '#22c55e',
    error:       '#ef4444',
    warning:     '#f59e0b',
  }
}