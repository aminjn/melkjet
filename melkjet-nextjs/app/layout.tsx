import type { Metadata, Viewport } from 'next'
import './globals.css'
import BottomNav from './components/BottomNav'
import PWAInstall from './components/PWAInstall'
import SessionKeeper from './components/SessionKeeper'
import ImpersonationBar from './components/ImpersonationBar'
import LocationDetector from './components/LocationDetector'

export const metadata: Metadata = {
  title: 'ملک‌جت - اکوسیستم هوشمند املاک',
  description: 'بزرگ‌ترین اکوسیستم هوشمند صنعت املاک و ساختمان ایران',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ملک‌جت',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icon-192.png' }],
  },
}

export const viewport: Viewport = {
  themeColor: '#c9a84c',
  width: 'device-width',
  initialScale: 1,
  maximumScale:1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        {/* Theme init — runs before render to prevent flash of wrong theme */}
        <script dangerouslySetInnerHTML={{__html:`(function(){try{var t=localStorage.getItem('melkjet-theme');if(t==='light')document.documentElement.classList.add('light')}catch(e){}})()`}}/>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
        <SessionKeeper />
        <LocationDetector />
        {children}
        <ImpersonationBar />
        <BottomNav />
        <PWAInstall />
      </body>
    </html>
  )
}
