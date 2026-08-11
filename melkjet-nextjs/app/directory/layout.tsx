import type { ReactNode } from 'react'
import type { Metadata } from 'next'

// فاز ۲۵۴ (ارتقاءِ سئو): صفحهٔ هابِ کلاینتی خودش متادیتا نمی‌تواند بدهد؛ این layoutِ سرورساید
// عنوان/توضیحات/canonical/OG را تأمین می‌کند تا گوگل عنوانِ یکتا و لینکِ حقیقی ببیند (نه پیش‌فرضِ ریشه).
export const metadata: Metadata = {
  title: 'دایرکتوری متخصصان و خدمات املاک',
  description: 'متخصص و خدماتِ املاک پیدا کنید: مشاور، آژانس، وکیل، کارشناس، پیمانکار و سازنده در سراسر ایران — دایرکتوریِ ملک‌جت.',
  alternates: { canonical: 'https://melkjet.com/directory' },
  openGraph: { title: 'دایرکتوری متخصصان و خدمات املاک', url: 'https://melkjet.com/directory', type: 'website' },
}
export default function Layout({ children }: { children: ReactNode }) { return children }
