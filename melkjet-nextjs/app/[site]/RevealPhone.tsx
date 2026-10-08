'use client'

import { useState } from 'react'

// فاز ۲۹۷ق — «نمایشِ شماره» (الگوی پلتفرم‌های حرفه‌ای): شماره پشتِ دکمه می‌ماند.
// فاز ۲۹۷ض۲ — نمایشِ شماره «قابلِ گزارش» شد (بیکن به پنلِ سایت‌سازها).
// فاز ۲۹۸ز — شماره «واقعاً» از HTML حذف شد: دیگر عددِ خام prop نمی‌شود؛ فقط «توکنِ رمزنگاری‌شده»
// (token) در صفحه است و با کلیک، سرور (/api/sites/reveal-phone) آن را باز می‌کند و شماره برمی‌گرداند.
// ماسک فقط ۴رقمِ اول است (هویتی نیست). اگر token نبود ولی phoneِ خام داده شده، سازگاریِ قهقرایی.
export default function RevealPhone({ token, mask, phone, primary, slug }: { token?: string; mask?: string; phone?: string; primary: string; slug?: string }) {
  const [shown, setShown] = useState('')      // شمارهٔ بازشده
  const [loading, setLoading] = useState(false)
  const hasSource = !!(token || String(phone || '').trim())
  if (!hasSource) return null

  const track = () => {
    if (!slug) return
    try {
      const body = JSON.stringify({ slug, kind: 'phone' })
      if (navigator.sendBeacon) navigator.sendBeacon('/api/sites/hit', new Blob([body], { type: 'application/json' }))
      else fetch('/api/sites/hit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {})
    } catch { /* گزارش هرگز صفحه را نشکند */ }
  }

  const reveal = async () => {
    if (loading || shown) return
    // سازگاریِ قهقرایی: اگر عددِ خام داده شده (مسیرهای قدیمی) همان را نشان بده.
    if (!token && phone) { setShown(String(phone).trim()); track(); return }
    setLoading(true)
    try {
      const r = await fetch('/api/sites/reveal-phone', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, slug }) })
      const d = await r.json().catch(() => null)
      if (d?.ok && d.phone) { setShown(String(d.phone)); track() }
    } catch { /* شبکه قطع — دکمه دوباره قابلِ کلیک می‌ماند */ } finally { setLoading(false) }
  }

  if (shown) {
    return (
      <a href={`tel:${shown.replace(/[^\d+]/g, '')}`} onClick={track} style={{
        fontSize: 16.5, fontWeight: 900, color: primary, textDecoration: 'none',
        direction: 'ltr', letterSpacing: '.5px',
      }}>{shown}</a>
    )
  }
  const m = String(mask || (phone ? String(phone).replace(/[^\d]/g, '').slice(0, 4) : '') || '۰۹••')
  return (
    <button type="button" onClick={reveal} disabled={loading} className="mjs-btn" style={{
      display: 'inline-flex', alignItems: 'center', gap: 8, cursor: loading ? 'wait' : 'pointer',
      padding: '8px 16px', borderRadius: 999, fontFamily: 'inherit',
      fontSize: 13.5, fontWeight: 800, color: primary, opacity: loading ? .7 : 1,
      background: `${primary}0f`, border: `1.5px solid ${primary}55`,
    }}>
      <span style={{ direction: 'ltr', letterSpacing: '1px', opacity: .75 }}>{m} ··· ····</span>
      <span>{loading ? 'یک لحظه…' : 'نمایشِ شماره'}</span>
    </button>
  )
}
