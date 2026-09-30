'use client'

import { useState } from 'react'

// فاز ۲۹۲ — نظراتِ سازنده روی صفحهٔ پروژه: فهرستِ تاییدشده (رندرِ سروری از props) + فرمِ ثبت.
// ثبت به /api/public/builder می‌رود (نیازمندِ ورود، مثلِ صفحهٔ سازنده) و تا تاییدِ ادمین پنهان است.
export type BuilderReviewItem = { name: string; text: string; rating: number; projectName?: string; at: number }

const fa = (n: number) => (Number(n) || 0).toLocaleString('fa-IR')

export default function BuilderReviews({ builderId, builderName, projectName, reviews }: { builderId: string; builderName: string; projectName?: string; reviews: BuilderReviewItem[] }) {
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [rating, setRating] = useState(5)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [open, setOpen] = useState(false)

  const rated = reviews.filter(r => r.rating >= 1)
  const avg = rated.length ? Math.round(rated.reduce((s, r) => s + r.rating, 0) / rated.length * 10) / 10 : 0

  const submit = async () => {
    if (busy || !text.trim()) return
    setBusy(true); setMsg(null)
    try {
      const r = await fetch('/api/public/builder', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: builderId, action: 'review', name: name || 'کاربر', rating, text: text.trim(), projectName }),
      })
      const j = await r.json().catch(() => ({}))
      if (r.status === 401) { window.location.href = '/auth'; return }
      if (r.ok && j.ok) { setMsg({ ok: true, text: j.message || 'نظرِ شما ثبت شد و پس از تاییدِ مدیر نمایش داده می‌شود.' }); setName(''); setText(''); setRating(5); setOpen(false) }
      else setMsg({ ok: false, text: j.error || 'ثبتِ نظر ناموفق بود — دوباره تلاش کنید' })
    } catch { setMsg({ ok: false, text: 'خطای شبکه — دوباره تلاش کنید' }) }
    setBusy(false)
  }

  const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 13px', fontSize: 13.5, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          {rated.length
            ? <>میانگین <b style={{ color: 'var(--gold)' }}>★ {avg.toLocaleString('fa-IR')}</b> از {fa(reviews.length)} نظرِ تاییدشده برای {builderName}</>
            : <>هنوز نظری برای {builderName} ثبت نشده</>}
        </div>
        <button onClick={() => setOpen(o => !o)} style={{ padding: '8px 18px', borderRadius: 999, fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid var(--gold)', background: open ? 'transparent' : 'var(--goldDim)', color: 'var(--gold)' }}>{open ? 'بستنِ فرم' : '✍ ثبتِ نظر'}</button>
      </div>

      {open && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 14, padding: 16, marginBottom: 14, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>امتیازِ شما:</span>
            <span>{[1, 2, 3, 4, 5].map(i => (
              <button key={i} onClick={() => setRating(i)} aria-label={`${i} ستاره`} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, padding: '0 2px', color: i <= rating ? 'var(--gold)' : 'var(--line2)' }}>★</button>
            ))}</span>
          </div>
          <input style={inp} placeholder="نامِ شما" value={name} onChange={e => setName(e.target.value)} maxLength={40} />
          <textarea style={{ ...inp, minHeight: 80, resize: 'vertical' }} placeholder={`تجربهٔ شما از ${builderName}${projectName ? ` و پروژهٔ ${projectName}` : ''}…`} value={text} onChange={e => setText(e.target.value)} maxLength={600} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button disabled={busy || !text.trim()} onClick={submit} style={{ padding: '10px 26px', borderRadius: 11, fontSize: 13.5, fontWeight: 800, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', border: 'none', background: 'var(--gold)', color: '#16140f', opacity: busy || !text.trim() ? 0.6 : 1 }}>{busy ? 'در حال ثبت…' : 'ثبتِ نظر'}</button>
            <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>برای ثبتِ نظر باید وارد باشید؛ نظر پس از تاییدِ مدیر نمایش داده می‌شود.</span>
          </div>
        </div>
      )}
      {msg && <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 11, fontSize: 13, border: `1px solid ${msg.ok ? 'rgba(95,217,138,.4)' : 'rgba(231,103,74,.4)'}`, background: msg.ok ? 'rgba(95,217,138,.08)' : 'rgba(231,103,74,.08)', color: msg.ok ? '#5fd98a' : '#e7674a' }}>{msg.text}</div>}

      {reviews.length > 0 && (
        <div style={{ display: 'grid', gap: 10 }}>
          {reviews.slice(0, 10).map((r, i) => (
            <div key={i} style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 13, padding: '13px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 13.5, fontWeight: 800 }}>{r.name}{r.projectName ? <span style={{ color: 'var(--faint)', fontWeight: 400, fontSize: 12 }}> · {r.projectName}</span> : ''}</span>
                <span style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 800, whiteSpace: 'nowrap' }}>★ {fa(r.rating)}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.9 }}>{r.text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
