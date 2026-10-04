'use client'

import { useState } from 'react'

// فاز ۲۹۷ق — «نمایشِ شماره» (الگوی پلتفرم‌های حرفه‌ای): شماره پشتِ دکمه می‌ماند تا هم
// حسِ پلتفرمِ جدی بدهد و هم ربات‌های اسکرپرِ شماره آن را در HTML خام نبینند.
// فاز ۲۹۷ض۲ — نمایشِ شماره «قابلِ گزارش» شد: با هر نمایش یک بیکنِ سبک ثبت می‌شود تا در
// پنلِ سایت‌سازها «چند نفر شماره را دیدند» گزارش شود (مثلِ بازدید). slug برای ثبت لازم است.
export default function RevealPhone({ phone, primary, slug }: { phone: string; primary: string; slug?: string }) {
  const [shown, setShown] = useState(false)
  const clean = String(phone || '').trim()
  if (!clean) return null

  const track = () => {
    if (!slug) return
    try {
      const body = JSON.stringify({ slug, kind: 'phone' })
      if (navigator.sendBeacon) navigator.sendBeacon('/api/sites/hit', new Blob([body], { type: 'application/json' }))
      else fetch('/api/sites/hit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {})
    } catch { /* گزارش هرگز صفحه را نشکند */ }
  }

  if (shown) {
    return (
      <a href={`tel:${clean.replace(/[^\d+]/g, '')}`} onClick={track} style={{
        fontSize: 16.5, fontWeight: 900, color: primary, textDecoration: 'none',
        direction: 'ltr', letterSpacing: '.5px',
      }}>{clean}</a>
    )
  }
  const mask = clean.replace(/[\s-]/g, '').slice(0, 4)
  return (
    <button type="button" onClick={() => { setShown(true); track() }} className="mjs-btn" style={{
      display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
      padding: '8px 16px', borderRadius: 999, fontFamily: 'inherit',
      fontSize: 13.5, fontWeight: 800, color: primary,
      background: `${primary}0f`, border: `1.5px solid ${primary}55`,
    }}>
      <span style={{ direction: 'ltr', letterSpacing: '1px', opacity: .75 }}>{mask} ··· ····</span>
      <span>نمایشِ شماره</span>
    </button>
  )
}
