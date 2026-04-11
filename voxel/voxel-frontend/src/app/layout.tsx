import type { Metadata, Viewport } from 'next'
import '../styles/globals.css'
import { Providers } from '@/components/shared/Providers'

export const metadata: Metadata = {
  title: 'Voxel — Find Your Voice',
  description: 'AI-powered speech assistance in English and Luganda. Accessible for everyone.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Voxel',
  },
  other: {
    // Android Chrome install banner
    'mobile-web-app-capable': 'yes',
    // iOS Safari full-screen
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': 'Voxel',
    // MS Tiles
    'msapplication-TileColor': '#0b9488',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0b9488',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* iOS splash / touch icons */}
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icons/icon-512.png" />
      </head>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}