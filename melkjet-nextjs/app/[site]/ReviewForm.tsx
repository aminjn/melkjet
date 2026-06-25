'use client'

import { useState } from 'react'

const CARD_SHADOW = '0 10px 34px -22px rgba(20,16,10,.55), 0 2px 8px -4px rgba(20,16,10,.10)'

// فرمِ ثبتِ نظر توسطِ بازدیدکننده: نام، انتخابِ ستارهٔ ۱..۵ و متن، سپس POST به /api/reviews.
// در صورتِ موفقیت حالتِ تشکر نمایش داده می‌شود؛ خطا به‌صورتِ پیامِ درون‌خطی.
export default function ReviewForm({ slug, primary }: { slug: string; primary: string }) {
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [rating, setRating] = useState(5)
  const [hover, setHover] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const inputStyle: React.CSSProperties = {
    minHeight: 48, background: 'var(--mjs-bg)', border: '1px solid #e6ddcd', borderRadius: 12,
    padding: '0 16px', fontSize: 14.5, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, name, text, rating }),
      })
      const data = await res.json().catch(() => ({} as any))
      if (!res.ok || data?.error) {
        setError(data?.error || 'ثبتِ نظر ناموفق بود. دوباره تلاش کنید.')
      } else {
        setDone(true)
      }
    } catch {
      setError('خطای شبکه. دوباره تلاش کنید.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div style={{
        maxWidth: 560, margin: '36px auto 0', background: 'var(--mjs-bg)', border: `1px solid ${primary}33`,
        borderRadius: 18, padding: '32px 24px', textAlign: 'center', boxShadow: CARD_SHADOW,
      }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--mjs-heading)', marginBottom: 8 }}>سپاس از شما!</div>
        <p style={{ fontSize: 14, color: 'var(--mjs-muted)', lineHeight: 1.9, margin: 0 }}>نظرِ شما ثبت شد و روی سایت نمایش داده می‌شود.</p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} style={{
      maxWidth: 560, margin: '36px auto 0', background: 'var(--mjs-bg)', border: '1px solid #efe9df',
      borderRadius: 18, padding: 'clamp(22px,4vw,30px)', boxShadow: CARD_SHADOW, direction: 'rtl',
    }}>
      <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--mjs-heading)', marginBottom: 18 }}>ثبتِ نظرِ شما</div>

      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="نام شما"
        style={{ ...inputStyle, marginBottom: 14 }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
        {[1, 2, 3, 4, 5].map(n => {
          const filled = (hover || rating) >= n
          return (
            <button
              key={n}
              type="button"
              aria-label={`${n} ستاره`}
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 2, lineHeight: 1,
                fontSize: 28, color: filled ? primary : '#e3dccf', transition: 'color .15s ease',
              }}
            >★</button>
          )
        })}
      </div>

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="نظرِ خود را بنویسید…"
        style={{
          ...inputStyle, minHeight: 110, padding: 16, marginBottom: 14, resize: 'vertical', lineHeight: 1.9,
        }}
      />

      {error ? (
        <div style={{ fontSize: 13.5, color: '#c0392b', background: '#c0392b12', border: '1px solid #c0392b33', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>{error}</div>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="mjs-btn"
        style={{
          padding: '13px 36px', background: primary, borderRadius: 12, border: 'none',
          fontSize: 15, fontWeight: 800, color: '#fff', cursor: busy ? 'default' : 'pointer',
          opacity: busy ? 0.7 : 1, boxShadow: `0 12px 30px -14px ${primary}`, fontFamily: 'inherit',
        }}
      >{busy ? 'در حالِ ارسال…' : 'ثبتِ نظر'}</button>
    </form>
  )
}
