import { notFound } from 'next/navigation'
import { getRealSession } from '@/app/lib/session'

// همیشه per-request اجرا شود (هرگز کش/پری‌رندر نشود) تا گاردِ سرور هر بار بررسی شود.
export const dynamic = 'force-dynamic'

// محافظتِ سمتِ سرور: هر کسی غیر از سوپرادمین به /admin برود، ۴۰۴ می‌بیند.
// از getRealSession استفاده می‌کنیم تا حتی هنگامِ «ورود به محیطِ کاربر» (impersonation)
// خودِ سوپرادمین قفل نشود، اما هیچ کاربرِ عادی‌ای به منوها دسترسی نداشته باشد.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await getRealSession()
  if (!s || s.role !== 'super_admin') notFound()
  return <>{children}</>
}
