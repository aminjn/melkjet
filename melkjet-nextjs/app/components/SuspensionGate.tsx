'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import BusinessProfileForm from './BusinessProfileForm'

// اگر پنلِ کاربر به‌خاطرِ پروفایلِ ناقص معلق شده باشد، روی صفحاتِ پنل یک پوششِ اجباریِ
// «پروفایلت را کامل کن» نمایش می‌دهد تا با تکمیل، تعلیق رفع شود.
const PANEL_PREFIXES = ['/pros', '/agency', '/builder', '/materials', '/owner', '/buyer', '/legal', '/crm', '/marketing', '/workflow', '/website-builder']
const FONT = 'Vazirmatn, system-ui, sans-serif'

export default function SuspensionGate() {
  const pathname = usePathname()
  const [suspended, setSuspended] = useState(false)
  const [pct, setPct] = useState(0)
  const [checking, setChecking] = useState(false)
  const check = () => { setChecking(true); return fetch('/api/auth/profile').then(r => r.ok ? r.json() : null).then(d => { setSuspended(!!d?.suspended); setPct(d?.profileCompletion || 0) }).catch(() => {}).finally(() => setChecking(false)) }
  useEffect(() => { check() }, [pathname])
  const onPanel = !!pathname && PANEL_PREFIXES.some(p => pathname.startsWith(p))
  if (!suspended || !onPanel) return null
  const logout = async () => { try { await fetch('/api/auth/logout', { method: 'POST' }) } catch {}; window.location.href = '/' }
  return (
    <div dir="rtl" style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(8,7,6,.97)', overflowY: 'auto', padding: '24px 16px', fontFamily: FONT }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div style={{ background: 'linear-gradient(135deg, rgba(231,103,74,.18), transparent 60%), var(--surface)', border: '1px solid rgba(231,103,74,.4)', borderRadius: 18, padding: '24px 26px', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 30 }}>⛔</span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 19, fontWeight: 900 }}>پنلِ شما معلق شده است</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4, lineHeight: 1.9 }}>به‌دلیلِ تکمیل‌نشدنِ پروفایلِ کسب‌وکار، دسترسیِ پنلِ شما موقتاً معلق شد. برای رفعِ تعلیق، فرمِ زیر را کامل کنید و سپس روی «بررسی و رفعِ تعلیق» بزنید. (تکمیلِ فعلی: {pct.toLocaleString('fa-IR')}٪)</div>
            </div>
            <button onClick={logout} style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontFamily: FONT, fontSize: 13 }}>خروج از حساب</button>
          </div>
        </div>
        <BusinessProfileForm />
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
          <button onClick={check} disabled={checking} style={{ padding: '12px 28px', borderRadius: 12, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, fontSize: 14.5, border: 'none', cursor: 'pointer', fontFamily: FONT, opacity: checking ? 0.6 : 1 }}>{checking ? 'در حال بررسی…' : '✓ بررسی و رفعِ تعلیق'}</button>
        </div>
      </div>
    </div>
  )
}
