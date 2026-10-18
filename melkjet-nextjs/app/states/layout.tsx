// صفحهٔ «states» یک دموی داخلیِ UI-kit است (نه محتوای عمومی). از ایندکسِ گوگل خارج می‌شود
// تا با عنوانِ پیش‌فرضِ ریشه در نتایج ظاهر نشود. (صفحهٔ کلاینتی است و خودش metadata نمی‌دهد.)
import type { Metadata } from 'next'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function StatesLayout({ children }: { children: React.ReactNode }) {
  return children
}
