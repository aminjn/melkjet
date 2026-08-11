import type { ReactNode } from 'react'
import type { Metadata } from 'next'

// فاز ۲۵۴ (ارتقاءِ سئو): صفحهٔ هابِ کلاینتی خودش متادیتا نمی‌تواند بدهد؛ این layoutِ سرورساید
// عنوان/توضیحات/canonical/OG را تأمین می‌کند تا گوگل عنوانِ یکتا و لینکِ حقیقی ببیند (نه پیش‌فرضِ ریشه).
export const metadata: Metadata = {
  title: 'فروشگاه‌های مصالح ساختمانی',
  description: 'فهرستِ فروشگاه‌های مصالح ساختمانی در ملک‌جت — خرید مصالح، مقایسهٔ قیمت و ارتباط مستقیم با فروشندگان.',
  alternates: { canonical: 'https://melkjet.com/stores' },
  openGraph: { title: 'فروشگاه‌های مصالح ساختمانی', url: 'https://melkjet.com/stores', type: 'website' },
}
export default function Layout({ children }: { children: ReactNode }) { return children }
