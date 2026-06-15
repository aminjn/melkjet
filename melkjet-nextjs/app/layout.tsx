import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ملک‌جت - اکوسیستم هوشمند املاک',
  description: 'بزرگ‌ترین اکوسیستم هوشمند صنعت املاک و ساختمان ایران',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
      </head>
      <body style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
        {children}
      </body>
    </html>
  )
}
