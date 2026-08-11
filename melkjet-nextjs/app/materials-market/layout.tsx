import type { ReactNode } from 'react'
import type { Metadata } from 'next'

// فاز ۲۵۴ (ارتقاءِ سئو): صفحهٔ هابِ کلاینتی خودش متادیتا نمی‌تواند بدهد؛ این layoutِ سرورساید
// عنوان/توضیحات/canonical/OG را تأمین می‌کند تا گوگل عنوانِ یکتا و لینکِ حقیقی ببیند (نه پیش‌فرضِ ریشه).
export const metadata: Metadata = {
  title: 'بازار مصالح ساختمانی',
  description: 'بازارِ مصالح ساختمانی ملک‌جت — خرید مصالح از فروشگاه‌های معتبر، فیلترِ دسته و محدودهٔ قیمت.',
  alternates: { canonical: 'https://melkjet.com/materials-market' },
  openGraph: { title: 'بازار مصالح ساختمانی', url: 'https://melkjet.com/materials-market', type: 'website' },
}
export default function Layout({ children }: { children: ReactNode }) { return children }
