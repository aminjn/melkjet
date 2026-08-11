import type { ReactNode } from 'react'
import type { Metadata } from 'next'

// فاز ۲۵۴ (ارتقاءِ سئو): صفحهٔ هابِ کلاینتی خودش متادیتا نمی‌تواند بدهد؛ این layoutِ سرورساید
// عنوان/توضیحات/canonical/OG را تأمین می‌کند تا گوگل عنوانِ یکتا و لینکِ حقیقی ببیند (نه پیش‌فرضِ ریشه).
export const metadata: Metadata = {
  title: 'تعرفه و پلن‌های اشتراک',
  description: 'پلن‌ها و تعرفه‌های اشتراکِ ملک‌جت برای مشاوران، آژانس‌ها و سازندگان — انتخابِ پلنِ مناسب برای رشدِ کسب‌وکارِ املاک.',
  alternates: { canonical: 'https://melkjet.com/pricing' },
  openGraph: { title: 'تعرفه و پلن‌های اشتراک', url: 'https://melkjet.com/pricing', type: 'website' },
}
export default function Layout({ children }: { children: ReactNode }) { return children }
