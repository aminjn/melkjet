'use client'

import { useState } from 'react'

// فاز ۲۹۲ — نظرات روی صفحهٔ عمومیِ متخصصِ دایرکتوری (مشاور/آژانس/معمار و…).
// فهرستِ تاییدشده سمتِ سرور رندر و از props می‌آید (سئو)؛ این کامپوننت فرمِ ثبت را اضافه می‌کند.
// انتشار فقط بعد از تاییدِ ادمین است — پیامِ موفقیت همین را می‌گوید.
export type ApprovedReview = { name: string; text: string; rating: number; createdAt: number }

const fa = (n: number) => (Number(n) || 0).toLocaleString('fa-IR')

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span aria-label={`${value} از ۵`} style={{ fontSize: size, letterSpacing: 1, whiteSpace: 'nowrap' }}>
      {[1, 2, 3, 4, 5].map(i => <span key={i} style={{ color: i <= value ? 'var(--gold)' : 'var(--line2)' }}>★</span>)}
    </span>
  )
}

export default function ProviderReviews({ ptype, pslug, reviews }: { ptype: string; pslug: string; reviews: ApprovedReview[] }) {
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [rating, setRating] = useState(5)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [open, setOpen] = useState(false)

  const rated = reviews.filter(r => r.rating >= 1)
  const avg = rated.length ? Math.round(rated.reduce((s, r) => s + r.rating, 0) / rated.length * 10) / 10 : 0

  const submit = async () => {
    if (busy) return
    setBusy(true); setMsg(null)
    try {
      const r = await fetch('/api/reviews', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ptype, pslug, name, text, rating }),
      })
      const j = await r.json().catch(() => ({}))
      if (r.status === 401) { window.location.href = '/auth' ; return }   // فاز ۲۹۲ب — ورود اجباری (ضدِ اسپم)
      if (r.ok && j.ok) { setMsg({ ok: true, text: j.message || 'نظرِ شما ثبت شد و پس از تاییدِ مدیر نمایش داده می‌شود.' }); setName(''); setText(''); setRating(5); setOpen(false) }
      else setMsg({ ok: false, text: j.error || 'ثبتِ نظر ناموفق بود — دوباره تلاش کنید' })
    } catch { setMsg({ ok: false, text: 'خطای شبکه — دوباره تلاش کنید' }) }
    setBusy(false)
  }

  const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 13px', fontSize: 13.5, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          نظراتِ کاربران
          {rated.length > 0 && <span style={{ fontSize: 13, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Stars value={Math.round(avg)} /> <span style={{ color: 'var(--gold)' }}>{avg.toLocaleString('fa-IR')}</span> <span style={{ color: 'var(--muted)', fontWeight: 600 }}>({fa(reviews.length)} نظر)</span></span>}
        </h2>
        <button onClick={() => setOpen(o => !o)} style={{ padding: '8px 18px', borderRadius: 999, fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid var(--gold)', background: open ? 'transparent' : 'var(--goldDim)', color: 'var(--goldText)' }}>{open ? 'بستنِ فرم' : '✍ ثبتِ نظر'}</button>
      </div>

      {open && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 16, marginBottom: 14, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>امتیازِ شما:</span>
            <span>{[1, 2, 3, 4, 5].map(i => (
              <button key={i} onClick={() => setRating(i)} aria-label={`${i} ستاره`} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, padding: '0 2px', color: i <= rating ? 'var(--gold)' : 'var(--line2)' }}>★</button>
            ))}</span>
          </div>
          <input style={inp} placeholder="نامِ شما" value={name} onChange={e => setName(e.target.value)} maxLength={60} />
          <textarea style={{ ...inp, minHeight: 80, resize: 'vertical' }} placeholder="تجربهٔ خود از همکاری با این متخصص را بنویسید…" value={text} onChange={e => setText(e.target.value)} maxLength={600} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button disabled={busy} onClick={submit} style={{ padding: '10px 26px', borderRadius: 11, fontSize: 13.5, fontWeight: 800, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', border: 'none', background: 'var(--gold)', color: '#1a1508', opacity: busy ? 0.6 : 1 }}>{busy ? 'در حال ثبت…' : 'ثبتِ نظر'}</button>
            <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>برای ثبتِ نظر باید وارد باشید؛ نظر پس از تاییدِ مدیر نمایش داده می‌شود.</span>
          </div>
        </div>
      )}
      {msg && <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 11, fontSize: 13, border: `1px solid ${msg.ok ? 'rgba(95,217,138,.4)' : 'rgba(231,103,74,.4)'}`, background: msg.ok ? 'rgba(95,217,138,.08)' : 'rgba(231,103,74,.08)', color: msg.ok ? '#5fd98a' : '#e7674a' }}>{msg.text}</div>}

      {reviews.length > 0 ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {reviews.map((r, i) => (
            <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 13, padding: '13px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 13.5, fontWeight: 800 }}>{r.name}</span>
                <Stars value={Math.max(1, Math.min(5, Math.round(r.rating)))} />
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.9 }}>{r.text}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: 'var(--faint)', background: 'var(--surface)', border: '1px dashed var(--line)', borderRadius: 13, padding: '14px 16px' }}>هنوز نظری ثبت نشده — اولین نفری باشید که تجربه‌اش را می‌نویسد.</div>
      )}
    </div>
  )
}
