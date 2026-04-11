'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { ThemeProvider } from './ThemeProvider'
import { UserProvider } from './UserProvider'
import { PWARegister } from './PWARegister'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 60 * 1000, retry: 1 } }
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <UserProvider>
          <PWARegister />
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: 'var(--card)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                fontFamily: 'DM Sans, sans-serif',
                fontSize: '14px',
              },
              success: { iconTheme: { primary: '#14b8a6', secondary: '#fff' } },
            }}
          />
        </UserProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}