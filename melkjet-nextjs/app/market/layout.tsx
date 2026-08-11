import type { ReactNode } from 'react'
import type { Metadata } from 'next'

// فاز ۲۵۴ (ارتقاءِ سئو): صفحهٔ هابِ کلاینتی خودش متادیتا نمی‌تواند بدهد؛ این layoutِ سرورساید
// عنوان/توضیحات/canonical/OG را تأمین می‌کند تا گوگل عنوانِ یکتا و لینکِ حقیقی ببیند (نه پیش‌فرضِ ریشه).
export const metadata: Metadata = {
  title: 'تحلیل بازار مسکن ایران',
  description: 'تحلیلِ بازارِ مسکنِ ایران به تفکیکِ شهر و محله — میانگینِ قیمتِ هر متر، روند و پیش‌بینی بر پایهٔ دادهٔ واقعیِ آگهی‌ها.',
  alternates: { canonical: 'https://melkjet.com/market' },
  openGraph: { title: 'تحلیل بازار مسکن ایران', url: 'https://melkjet.com/market', type: 'website' },
}
export default function Layout({ children }: { children: ReactNode }) { return children }
