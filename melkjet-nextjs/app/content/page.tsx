'use client'
import { useEffect, useState } from 'react'
import Nav from '@/app/components/Nav'
import ArticleEditor from '@/app/components/ArticleEditor'
import PanelReturnBar from '@/app/components/PanelReturnBar'

// «مقالاتِ من» — مدیریتِ مقالهٔ هر کاربرِ حرفه‌ای (مشاور/آژانس/سازنده/…). دسته‌بندی از سوپرادمین
// (فقط انتخابی، غیرقابل‌تغییر)؛ مقاله‌ها هم در وبلاگِ ملک‌جت و هم داخلِ سایت‌سازِ خودِ کاربر دیده می‌شوند.
export default function ContentStudio() {
  const [me, setMe] = useState<{ name?: string; role?: string; dash?: string; phone?: string } | null | undefined>(undefined)
  useEffect(() => { fetch('/api/auth/profile', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setMe(d && d.phone ? d : null)).catch(() => setMe(null)) }, [])

  const wrap = (children: React.ReactNode) => (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}><Nav />{children}<PanelReturnBar tool="مقالات" /></div>
  )
  if (me === undefined) return wrap(<main style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>در حال بارگذاری…</main>)
  if (!me) return wrap(<main style={{ minHeight: '50vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--muted)' }}>برای مدیریتِ مقالات وارد شوید. <a href="/auth" style={{ color: 'var(--gold)', fontWeight: 700 }}>ورود</a></main>)
  if (me.role === 'buyer') return wrap(<main style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', textAlign: 'center', padding: 24 }}>بخشِ مقالات برای کاربرانِ حرفه‌ای (مشاور، آژانس، سازنده و…) است.</main>)

  const isSuper = me.role === 'super_admin'
  const author = isSuper ? undefined : (me.name || me.phone || '')   // سوپرادمین همه را می‌بیند؛ بقیه فقط مالِ خودشان
  return wrap(
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '24px 20px 96px' }}>
      <h1 style={{ fontSize: 'clamp(20px,3vw,26px)', fontWeight: 900, margin: '0 0 4px' }}>✎ مقالاتِ من</h1>
      <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.95, margin: '0 0 18px' }}>
        مقاله بنویس (با دستیارِ هوش مصنوعی + تولیدِ خودکارِ عکسِ کاور). دسته‌بندی‌ها از سوپرادمین است و اینجا فقط انتخاب می‌شوند.
        مقاله‌هایت هم در <b>وبلاگِ ملک‌جت</b> و هم داخلِ <b>سایت‌سازِ خودت</b> نمایش داده می‌شوند.
      </p>
      <ArticleEditor author={author} />
    </div>
  )
}
