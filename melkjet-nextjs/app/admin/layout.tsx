import { getRealSession } from '@/app/lib/session'

// همیشه per-request اجرا شود (هرگز کش/پری‌رندر نشود) تا گاردِ سرور هر بار بررسی شود.
export const dynamic = 'force-dynamic'

// محافظتِ سمتِ سرور (لایهٔ دوم — لایهٔ اول proxy است): فقط سوپرادمین یا پرسنلِ دارای بخشِ
// اعطاشده (فاز ۱۱۵ — claim staff داخلِ JWT). بقیه صفحهٔ صریحِ «عدمِ دسترسی» می‌بینند
// (فیدبکِ مستقیم: «باید فقط عدمِ دسترسی نشان بدهد») — نه پوستهٔ پنل، نه ۴۰۴ِ گنگ.
// از getRealSession تا هنگامِ impersonation خودِ سوپرادمین قفل نشود.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await getRealSession()
  const ok = !!s && (s.role === 'super_admin' || (s.staff || []).length > 0)
  if (!ok) {
    return (
      <div dir="rtl" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0e0c', color: '#ece5d8', fontFamily: "'Vazirmatn', system-ui, sans-serif" }}>
        <div style={{ textAlign: 'center', padding: 32, maxWidth: 420 }}>
          <div style={{ fontSize: 52 }}>⛔</div>
          <div style={{ fontSize: 18, fontWeight: 900, marginTop: 12 }}>عدمِ دسترسی</div>
          <p style={{ fontSize: 13, color: 'rgba(236,229,216,.65)', lineHeight: 2, marginTop: 10 }}>
            این بخش مخصوصِ مدیریتِ ملک‌جت است. اگر از پرسنل هستید، از مدیر بخواهید دسترسیِ شما را فعال کند و سپس یک‌بار خارج و دوباره وارد شوید.
          </p>
          <a href="/" style={{ display: 'inline-block', marginTop: 14, padding: '10px 26px', borderRadius: 12, background: 'linear-gradient(140deg,#e9cd7a,#c9a84c)', color: '#16140f', fontWeight: 800, fontSize: 13.5, textDecoration: 'none' }}>بازگشت به ملک‌جت ←</a>
        </div>
      </div>
    )
  }
  return <>{children}</>
}
