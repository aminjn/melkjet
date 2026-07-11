import type { Metadata, Viewport } from 'next'
import './globals.css'
import BottomNav from './components/BottomNav'
import PWAInstall from './components/PWAInstall'
import SessionKeeper from './components/SessionKeeper'
import ImpersonationBar from './components/ImpersonationBar'
import LocationDetector from './components/LocationDetector'
import Tracker from './components/Tracker'
import AuthModal from './components/AuthModal'
import SuspensionGate from './components/SuspensionGate'
import PlanLock from './components/PlanLock'
import CompareBar from './components/CompareBar'
import SupportLauncher from './components/SupportLauncher'
import LegalAssistant from './components/LegalAssistant'

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
  // maximumScale را حذف کردیم: قفل‌کردنِ زوم یک خطای دسترسی‌پذیری (accessibility) است
  // و کاربرانِ کم‌بینا نمی‌توانند بزرگ‌نمایی کنند. Lighthouse هم همین را ایراد می‌گرفت.
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
        {/* فونت‌ها کاملاً لوکال‌اند (public/fonts) — هیچ وابستگی به گوگل. @font-face در globals.css */}
        <link rel="preload" href="/fonts/Vazirmatn-Regular.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/Vazirmatn-Bold.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
        <SessionKeeper />
        <LocationDetector />
        <Tracker />
        {children}
        <ImpersonationBar />
        <AuthModal />
        <SuspensionGate />
        <PlanLock />
        <CompareBar />
        <SupportLauncher />
        <LegalAssistant />
        <BottomNav />
        <PWAInstall />
      </body>
    </html>
  )
}
