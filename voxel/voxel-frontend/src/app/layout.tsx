import type { Metadata, Viewport } from 'next'
import '../styles/globals.css'
import { Providers } from '@/components/shared/Providers'

export const metadata: Metadata = {
  title: 'Voxel — Find Your Voice',
  description: 'Accessible speech navigation and communication for everyone',
  manifest: '/manifest.json',
  icons: { icon: '/icon.png', apple: '/apple-icon.png' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0b9488',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
