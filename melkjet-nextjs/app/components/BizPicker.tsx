'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

// فاز ۱۷۱ (فیدبک: «ثبت‌نام با کلی پروفایل گیج‌کننده است؛ بعد از ورود کسب‌وکار را انتخاب کند») —
// ثبت‌نام دیگر نقش نمی‌پرسد؛ همه «کاربر عادی» شروع می‌کنند. این کامپوننت داخلِ پنلِ پیش‌فرض (/buyer)
// یک کارتِ دوستانهٔ یک‌باره نشان می‌دهد: «کسب‌وکار داری؟» → برگهٔ انتخابِ نوعِ کسب‌وکار (همان نقش‌های
// داینامیکِ /api/roles) → ذخیره با همان POST /api/auth/profile → هدایت به پنلِ همان کسب‌وکار.
// «کاربرِ عادی‌ام» = بستن برای ۳۰ روز (localStorage). فقط برای حساب‌هایی که هنوز نقشِ پیش‌فرض دارند.

const ICONS: Record<string, string> = { '/pros': '🤝', '/agency': '🏢', '/builder': '🏗', '/materials': '🧱', '/legal': '⚖', '/architect': '📐', '/contractor': '🛠', '/appraiser': '📋', '/lawfirm': '⚖', '/finance': '🏦', '/notary': '📜' }
const DESC: Record<string, string> = {
  '/pros': 'مدیریتِ فایل‌ها، لیدها و CRM شخصی',
  '/agency': 'تیم، شعبه‌ها و فایل‌های آژانس',
  '/builder': 'پروژه‌ها، واحدها و سرمایه‌گذارها',
  '/materials': 'فروشگاهِ مصالح و سفارش‌ها',
  '/legal': 'خدماتِ حقوقیِ ملک',
}
const MAIN_DASH = ['/pros', '/agency', '/builder', '/materials', '/legal']
const HIDE_KEY = 'mj-biz-later'
const HIDE_DAYS = 30

export default function BizPicker() {
  const router = useRouter()
  const path = usePathname() || ''
  const [me, setMe] = useState<{ name: string; role: string } | null>(null)
  const [roles, setRoles] = useState<Array<{ id: string; name: string; dashboard: string }>>([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [gone, setGone] = useState(false)

  const onDefaultPanel = path === '/buyer' || path.startsWith('/buyer/')
  useEffect(() => {
    if (!onDefaultPanel) return
    try { const t = Number(localStorage.getItem(HIDE_KEY) || 0); if (t && Date.now() - t < HIDE_DAYS * 864e5) setGone(true) } catch {}
    fetch('/api/auth/profile', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      // فاز ۱۷۲: تشخیصِ «هنوز کسب‌وکاری انتخاب نکرده» با داشبوردِ نقش (dash === '/buyer') نه نامِ نقش —
      // حساب‌های قدیمی نقش را با شناسه ذخیره کرده‌اند و مقایسهٔ نام هرگز نمی‌گرفت (کارت دیده نمی‌شد).
      .then(d => { if (d?.account?.onboarded && d?.dash === '/buyer') setMe({ name: d.account.name || '', role: d.account.role || '' }) })
      .catch(() => {})
  }, [onDefaultPanel])

  const show = onDefaultPanel && !gone && me !== null
  useEffect(() => {
    if (open && !roles.length) fetch('/api/roles').then(r => r.ok ? r.json() : null).then(d => { if (d?.roles?.length) setRoles(d.roles.filter((x: any) => x.name !== 'کاربر عادی')) }).catch(() => {})
  }, [open, roles.length])
  const showPill = onDefaultPanel && gone && me !== null   // فاز ۱۷۲: بعدِ بستن، پیلِ کوچکِ دائمی می‌ماند
  if (!show && !showPill) return null

  const later = () => { setGone(true); try { localStorage.setItem(HIDE_KEY, String(Date.now())) } catch {} }
  const pick = async (r: { id: string; name: string }) => {
    setErr(''); setBusy(r.id)
    try {
      const res = await fetch('/api/auth/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: me!.name || 'کاربر', role: r.id }) })
      const d = await res.json()
      if (!res.ok) { setErr(d.error || 'خطا'); setBusy(''); return }
      try { localStorage.setItem(HIDE_KEY, String(Date.now())) } catch {}
      router.push(d.redirect || '/')
    } catch { setErr('اتصال برقرار نشد — دوباره امتحان کن'); setBusy('') }
  }

  const main = roles.filter(r => MAIN_DASH.includes(r.dashboard))
  const extra = roles.filter(r => !MAIN_DASH.includes(r.dashboard))
  return (
    <>
      {/* فاز ۱۷۲ — پیلِ دائمیِ کوچک بعد از بستنِ کارت: مسیرِ انتخابِ کسب‌وکار هیچ‌وقت گم نمی‌شود */}
      {showPill && !open && (
        <button onClick={() => setOpen(true)} style={{ position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 58, display: 'flex', alignItems: 'center', gap: 7, background: 'var(--surface)', border: '1px solid var(--gold)', borderRadius: 999, padding: '8px 13px', fontSize: 12, fontWeight: 800, color: 'var(--gold)', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 8px 22px rgba(0,0,0,.35)', direction: 'rtl' }}>
          🏢 پنلِ کسب‌وکار
        </button>
      )}
      {/* کارتِ دعوت — بالای پنلِ پیش‌فرض، غیرمسدودکننده */}
      {show && !open && (
        <div style={{ position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 58, width: 'min(560px, calc(100vw - 20px))', direction: 'rtl' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', border: '1px solid var(--gold)', borderRadius: 14, padding: '10px 14px', boxShadow: '0 12px 34px rgba(0,0,0,.35)' }}>
            <span style={{ fontSize: 20 }}>🏢</span>
            <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.8 }}>
              <b>کسب‌وکار داری؟</b> <span style={{ color: 'var(--muted)' }}>مشاور، آژانس، سازنده… پنلِ مخصوصِ خودت را فعال کن.</span>
            </div>
            <button onClick={() => setOpen(true)} style={{ border: 'none', borderRadius: 10, padding: '8px 14px', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', background: 'linear-gradient(135deg,var(--gold),var(--gold2))', color: '#16140f', whiteSpace: 'nowrap' }}>انتخاب</button>
            <button onClick={later} aria-label="بستن" style={{ background: 'none', border: 'none', color: 'var(--faint)', cursor: 'pointer', fontSize: 14, padding: 4, fontFamily: 'inherit' }}>✕</button>
          </div>
        </div>
      )}
      {/* برگهٔ انتخابِ نوعِ کسب‌وکار */}
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(6,4,20,.66)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14, direction: 'rtl' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 'min(520px, 100%)', maxHeight: '86vh', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
              <b style={{ flex: 1, fontSize: 15 }}>نوعِ کسب‌وکارت را انتخاب کن</b>
              <button onClick={() => setOpen(false)} aria-label="بستن" style={{ background: 'none', border: 'none', color: 'var(--faint)', cursor: 'pointer', fontSize: 15, fontFamily: 'inherit' }}>✕</button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 14px', lineHeight: 1.9 }}>پنل و ابزارهای مخصوصِ همان کسب‌وکار برایت فعال می‌شود. بعداً هم از همین‌جا قابلِ‌تغییر است.</p>
            <div style={{ display: 'grid', gap: 8 }}>
              {(main.length ? main : roles).map(r => (
                <button key={r.id} disabled={!!busy} onClick={() => pick(r)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'right', border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--text)', opacity: busy && busy !== r.id ? .6 : 1 }}>
                  <span style={{ fontSize: 22 }}>{ICONS[r.dashboard] || '◆'}</span>
                  <span style={{ flex: 1 }}>
                    <b style={{ display: 'block', fontSize: 13.5 }}>{r.name}</b>
                    {DESC[r.dashboard] && <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{DESC[r.dashboard]}</span>}
                  </span>
                  <span style={{ color: 'var(--gold)', fontWeight: 800, fontSize: 12 }}>{busy === r.id ? '…' : '←'}</span>
                </button>
              ))}
            </div>
            {extra.length > 0 && (
              <details style={{ marginTop: 10 }}>
                <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--muted)' }}>نقش‌های تخصصیِ بیشتر ({extra.length.toLocaleString('fa-IR')})</summary>
                <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                  {extra.map(r => (
                    <button key={r.id} disabled={!!busy} onClick={() => pick(r)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'right', border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--text)' }}>
                      <span style={{ fontSize: 18 }}>{ICONS[r.dashboard] || '◆'}</span>
                      <span style={{ flex: 1, fontSize: 13 }}>{r.name}</span>
                      <span style={{ color: 'var(--gold)', fontWeight: 800, fontSize: 12 }}>{busy === r.id ? '…' : '←'}</span>
                    </button>
                  ))}
                </div>
              </details>
            )}
            {err && <div style={{ marginTop: 12, padding: '9px 12px', borderRadius: 9, background: 'rgba(220,53,69,.1)', border: '1px solid rgba(220,53,69,.25)', color: '#e25563', fontSize: 12.5 }}>{err}</div>}
            <button onClick={() => { later(); setOpen(false) }} style={{ marginTop: 12, width: '100%', background: 'none', border: '1px solid var(--line)', borderRadius: 10, padding: '10px', color: 'var(--muted)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>کاربرِ عادی‌ام — فعلاً لازم ندارم</button>
          </div>
        </div>
      )}
    </>
  )
}
