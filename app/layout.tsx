import type { Metadata, Viewport } from 'next'
import { Inter, Oswald } from 'next/font/google'
import { DataProvider } from '@/lib/store'
import './globals.css'

const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })
const display = Oswald({ subsets: ['latin'], variable: '--font-display', weight: ['500', '600'], display: 'swap' })

export const metadata: Metadata = {
  title: { default: 'FoS Productions App', template: '%s · FoS Productions' },
  description: 'Cast & crew management for Field of Screams Branson and Nixa.',
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: 'FoS Productions', statusBarStyle: 'black-translucent' },
}

export const viewport: Viewport = {
  themeColor: '#07070a',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="font-sans">
        <DataProvider>{children}</DataProvider>
      </body>
    </html>
  )
}
