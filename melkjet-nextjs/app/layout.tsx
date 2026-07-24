import type { Metadata, Viewport } from 'next'
import './globals.css'
import { getAdminData } from './lib/admin-store'
import BottomNav from './components/BottomNav'
import SessionKeeper from './components/SessionKeeper'
import LocationDetector from './components/LocationDetector'
import Tracker from './components/Tracker'
import AuthModal from './components/AuthModal'
import DeferredShell from './components/DeferredShell'
import MissionChip from './components/MissionChip'
import ThemeFab from './components/ThemeFab'

export const metadata: Metadata = {
  // فاز ۲۱۸ (ممیزیِ سئو): مبنای همهٔ URLهای نسبیِ متادیتا (og:image و…) — بدونش نسبی‌ها ناقص resolve می‌شدند
  metadataBase: new URL('https://melkjet.com'),
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
  // فاز ۱۴۱ — Google Analytics 4: شناسه از پنلِ ادمین (اتصال‌ها) می‌آید؛ پیش‌فرض = پراپرتیِ melkjet.com.
  // ذخیرهٔ رشتهٔ خالی در ادمین = خاموش. (صفحه‌های استاتیک مقدارِ لحظهٔ build را دارند — تغییرِ شناسه دیپلوی می‌خواهد.)
  let ga4 = 'G-E7HCXKSREJ'
  try { const v = getAdminData().ga4Id; if (v !== undefined) ga4 = v } catch {}
  return (
    <html lang="fa" dir="rtl">
      <head>
        {ga4 && <>
          <script async src={`https://www.googletagmanager.com/gtag/js?id=${ga4}`} />
          <script dangerouslySetInnerHTML={{ __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${ga4}');` }} />
        </>}
        {/* Theme init — runs before render to prevent flash of wrong theme.
            فاز ۱۲۹: بدونِ انتخابِ صریحِ کاربر، تم از ساعتِ خودِ او می‌آید (۷ تا ۱۹ = روز)؛ انتخابِ دستی ('light'/'dark') همیشه مقدم است. */}
        <script dangerouslySetInnerHTML={{__html:`(function(){try{var t=localStorage.getItem('melkjet-theme');var h=(new Date()).getHours();if(t==='light'||(t!=='dark'&&h>=7&&h<19))document.documentElement.classList.add('light')}catch(e){}})()`}}/>
        {/* فونت‌ها کاملاً لوکال‌اند (public/fonts) — هیچ وابستگی به گوگل. @font-face در globals.css */}
        <link rel="preload" href="/fonts/Vazirmatn-Regular.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/Vazirmatn-Bold.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/Vazirmatn-ExtraBold.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
        <SessionKeeper />
        <LocationDetector />
        <Tracker />
        {children}
        <AuthModal />
        <BottomNav />
        {/* فاز ۱۲۹ — دکمهٔ تمِ شناور برای پوسته‌های بدونِ Nav (پنل‌ها/ادمین/ابزارها) */}
        <ThemeFab />
        {/* فاز ۱۰۸: هفت overlay غیرِحیاتی بعد از idle/اولین تعامل mount می‌شوند (TBT موبایل) */}
        <DeferredShell />
        <MissionChip />
      </body>
    </html>
  )
}
