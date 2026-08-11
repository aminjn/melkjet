import type { ReactNode } from 'react'
import type { Metadata } from 'next'

// فاز ۲۵۴ (سئو H1): هابِ کلاینتیِ /builders خودش متادیتا نمی‌دهد؛ این layoutِ سرورساید آن را تأمین
// می‌کند. صفحاتِ /builders/[slug] خودشان متادیتا دارند و این را override می‌کنند.
export const metadata: Metadata = {
  title: 'سازندگان و پروژه‌های ساختمانی',
  description: 'سازندگان و پروژه‌های ساختمانی در ملک‌جت — پروفایلِ سازنده‌ها، پروژه‌های در حالِ ساخت و پیش‌فروش، سوابق و تماس.',
  alternates: { canonical: 'https://melkjet.com/builders' },
  openGraph: { title: 'سازندگان و پروژه‌های ساختمانی', url: 'https://melkjet.com/builders', type: 'website' },
}
export default function Layout({ children }: { children: ReactNode }) { return children }
