import type { ReactNode } from 'react'
import type { Metadata } from 'next'

// فاز ۲۵۴ (ارتقاءِ سئو): صفحهٔ هابِ کلاینتی خودش متادیتا نمی‌تواند بدهد؛ این layoutِ سرورساید
// عنوان/توضیحات/canonical/OG را تأمین می‌کند تا گوگل عنوانِ یکتا و لینکِ حقیقی ببیند (نه پیش‌فرضِ ریشه).
export const metadata: Metadata = {
  title: 'قیمت روز مصالح ساختمانی',
  description: 'نرخِ روزِ مصالح ساختمانی و شاخصِ قیمتِ مصالحِ ملک‌جت — سیمان، میلگرد، آجر و … با روندِ تغییرات.',
  alternates: { canonical: 'https://melkjet.com/materials-prices' },
  openGraph: { title: 'قیمت روز مصالح ساختمانی', url: 'https://melkjet.com/materials-prices', type: 'website' },
}
export default function Layout({ children }: { children: ReactNode }) { return children }
