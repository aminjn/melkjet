import { redirect } from 'next/navigation'

// REOS به داخلِ سوپرادمین منتقل شد (تبِ «REOS — مغزِ هوشمند»). این آدرس برای سازگاری ریدایرکت می‌شود.
export default function ReosAdminRedirect() {
  redirect('/admin?view=reos')
}
