import type { ReactNode } from 'react'
import type { Metadata } from 'next'

// فاز ۲۵۴ (سئو H1): هابِ کلاینتیِ /store خودش متادیتا نمی‌دهد؛ این layoutِ سرورساید عنوان/توضیحات/
// canonical/OG را تأمین می‌کند. صفحاتِ /store/[slug] خودشان متادیتای خود را دارند و این را override می‌کنند.
export const metadata: Metadata = {
  title: 'بازار مصالح و محصولات ساختمانی',
  description: 'بازارِ مصالح و محصولاتِ ساختمانی ملک‌جت — خرید مصالح از فروشگاه‌های معتبر، مقایسهٔ قیمت و دسته‌بندی کامل.',
  alternates: { canonical: 'https://melkjet.com/store' },
  openGraph: { title: 'بازار مصالح و محصولات ساختمانی', url: 'https://melkjet.com/store', type: 'website' },
}
export default function Layout({ children }: { children: ReactNode }) { return children }
