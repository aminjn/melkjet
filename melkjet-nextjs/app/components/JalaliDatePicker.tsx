'use client'
import { useState, useRef, useEffect } from 'react'

// انتخابگر تاریخِ شمسی (جلالی) — بدون وابستگی. خروجی: رشتهٔ فارسی «۱۴۰۴/۰۴/۰۵»
// (اختیاری با ساعت). تقویم از روی تاریخ‌های میلادی ساخته می‌شود، پس نیازی به
// تبدیلِ دستیِ جلالی↔میلادی نیست و با همان رشته‌ای که در استورها ذخیره می‌شود می‌خواند.

const FONT = 'Vazirmatn, system-ui, sans-serif'
const J_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']
const J_WEEK = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']
const JF = new Intl.DateTimeFormat('en-US-u-ca-persian', { year: 'numeric', month: 'numeric', day: 'numeric' })
// فاز ۱۳۹: سال بدونِ جداکنندهٔ هزارگان — «۱۴۰۵» نه «۱٬۴۰۵»
const fa = (n: number) => n.toLocaleString('fa-IR', { useGrouping: false })
const pad = (n: number) => fa(n).padStart(2, '۰')

function jParts(d: Date): { jy: number; jm: number; jd: number } {
  const p = JF.formatToParts(d); const g = (t: string) => Number(p.find(x => x.type === t)?.value || 0)
  return { jy: g('year'), jm: g('month'), jd: g('day') }
}
function firstOfJMonth(offset: number): Date {
  let d = new Date(); const t = jParts(d)
  d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (t.jd - 1))
  let o = offset
  while (o > 0) { const n = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 32); const p = jParts(n); d = new Date(n.getFullYear(), n.getMonth(), n.getDate() - (p.jd - 1)); o-- }
  while (o < 0) { const n = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1); const p = jParts(n); d = new Date(n.getFullYear(), n.getMonth(), n.getDate() - (p.jd - 1)); o++ }
  return d
}

export default function JalaliDatePicker({ value, onChange, onPickTs, placeholder = 'انتخاب تاریخ', withTime = false, style }:
  { value?: string; onChange: (display: string) => void; onPickTs?: (ts: number) => void; placeholder?: string; withTime?: boolean; style?: React.CSSProperties }) {
  const [open, setOpen] = useState(false)
  const [offset, setOffset] = useState(0)
  const [time, setTime] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  // اگر value ساعت داشت، آن را در فیلد ساعت نشان بده
  useEffect(() => { const m = (value || '').match(/(\d{1,2}:\d{2})/); if (m) setTime(m[1]) }, [value])
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [open])

  const inputStyle: React.CSSProperties = { padding: '9px 11px', borderRadius: 9, background: 'var(--bg)', border: '1px solid var(--line)', color: value ? 'var(--text)' : 'var(--faint)', fontSize: 13, outline: 'none', fontFamily: FONT, width: '100%', cursor: 'pointer', textAlign: 'right', ...style }

  const first = firstOfJMonth(offset)
  const { jy, jm } = jParts(first)
  const lead = (first.getDay() + 1) % 7
  const today = jParts(new Date()); const todayKey = `${today.jy}-${today.jm}-${today.jd}`
  const cells: ({ d: Date; jd: number } | null)[] = []
  for (let i = 0; i < lead; i++) cells.push(null)
  for (let dd = new Date(first); jParts(dd).jm === jm; dd = new Date(dd.getFullYear(), dd.getMonth(), dd.getDate() + 1)) cells.push({ d: new Date(dd), jd: jParts(dd).jd })

  const pick = (d: Date, t: string) => {
    const j = jParts(d)
    const ds = `${fa(j.jy)}/${pad(j.jm)}/${pad(j.jd)}`
    onChange(withTime && t ? `${ds} ${t}` : ds)
    if (onPickTs) { const [hh, mm] = (t || '00:00').split(':').map(Number); onPickTs(new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh || 0, mm || 0, 0, 0).getTime()) }
    if (!withTime) setOpen(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }} dir="rtl">
      <div onClick={() => setOpen(o => !o)} style={inputStyle}>
        <span>📅 {value || placeholder}</span>
      </div>
      {open && (
        <div style={{ position: 'absolute', zIndex: 60, top: 'calc(100% + 6px)', right: 0, width: 260, background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 12, boxShadow: '0 12px 32px -10px rgba(0,0,0,.5)', padding: 12, fontFamily: FONT }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button type="button" onClick={() => setOffset(o => o + 1)} style={navBtn}>›</button>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{J_MONTHS[jm - 1]} {fa(jy)}</div>
            <button type="button" onClick={() => setOffset(o => o - 1)} style={navBtn}>‹</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
            {J_WEEK.map(w => <div key={w} style={{ textAlign: 'center', fontSize: 10, color: 'var(--faint)', fontWeight: 700, padding: '3px 0' }}>{w}</div>)}
            {cells.map((c, i) => {
              if (!c) return <div key={i} />
              const key = `${jy}-${jm}-${c.jd}`
              const isToday = key === todayKey
              const sel = !!value && value.startsWith(`${fa(jy)}/${pad(jm)}/${pad(c.jd)}`)
              return (
                <button key={i} type="button" onClick={() => pick(c.d, time)} style={{ aspectRatio: '1', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 12.5, fontWeight: sel || isToday ? 800 : 500, background: sel ? 'var(--gold)' : isToday ? 'var(--goldDim)' : 'transparent', color: sel ? '#16140f' : isToday ? 'var(--gold)' : 'var(--text)' }}>{fa(c.jd)}</button>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10, alignItems: 'center' }}>
            <button type="button" onClick={() => { setOffset(0); pick(new Date(), time) }} style={{ ...navBtn, flex: 1, width: 'auto', fontSize: 11.5, fontWeight: 700, color: 'var(--gold)' }}>امروز</button>
            {withTime && <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ flex: 1, padding: '6px 8px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--text)', fontSize: 12, fontFamily: FONT, direction: 'ltr' }} />}
          </div>
        </div>
      )}
    </div>
  )
}

const navBtn: React.CSSProperties = { width: 26, height: 26, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--muted)', cursor: 'pointer', fontSize: 14, fontFamily: FONT }
