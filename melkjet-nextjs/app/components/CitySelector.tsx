'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CITIES } from '@/app/lib/taxonomy'

// انتخابگرِ شهر — در نوارِ بالای همهٔ صفحاتِ پابلیک. شهرِ انتخابی در کوکیِ mj_city می‌ماند.
// چون محله‌ها در شهرهای مختلف هم‌نام‌اند، اول باید شهر مشخص شود. قابلِ جست‌وجو.

const PRIORITY = ['تهران', 'مشهد', 'اصفهان', 'کرج', 'شیراز', 'تبریز', 'قم', 'اهواز', 'رشت', 'کرمان', 'ارومیه', 'زاهدان', 'همدان', 'یزد', 'اردبیل', 'بندرعباس', 'قزوین', 'ساری', 'گرگان', 'کرمانشاه']
// فهرستِ گستردهٔ شهرهای ایران (شهرهای بزرگ و متوسط)
const EXTRA = [
  'اراک', 'سنندج', 'خرم‌آباد', 'بوشهر', 'بیرجند', 'بجنورد', 'سمنان', 'شهرکرد', 'ایلام', 'یاسوج', 'دزفول', 'بابل', 'آمل', 'قائم‌شهر', 'بابلسر', 'نوشهر', 'چالوس', 'تنکابن', 'رامسر', 'لاهیجان', 'انزلی', 'لنگرود', 'آستارا', 'تالش',
  'کاشان', 'نجف‌آباد', 'خمینی‌شهر', 'شاهین‌شهر', 'فولادشهر', 'مبارکه', 'گلپایگان', 'نطنز', 'اردکان', 'میبد', 'مهریز', 'بافق',
  'مرودشت', 'کازرون', 'جهرم', 'فسا', 'داراب', 'لار', 'فیروزآباد', 'آباده', 'نی‌ریز', 'اقلید',
  'نیشابور', 'سبزوار', 'تربت حیدریه', 'قوچان', 'کاشمر', 'تربت جام', 'گناباد', 'چناران', 'سرخس', 'تایباد',
  'مراغه', 'مرند', 'اهر', 'میانه', 'بناب', 'شبستر', 'سراب', 'هشترود',
  'آبادان', 'خرمشهر', 'ماهشهر', 'اندیمشک', 'بهبهان', 'شوشتر', 'شوش', 'ایذه', 'مسجدسلیمان', 'رامهرمز',
  'سیرجان', 'رفسنجان', 'بم', 'جیرفت', 'زرند', 'شهربابک', 'کهنوج',
  'قشم', 'کیش', 'بندرلنگه', 'میناب', 'بندر جاسک',
  'گنبد کاووس', 'علی‌آباد', 'آق‌قلا', 'کردکوی', 'بندر ترکمن',
  'ملایر', 'نهاوند', 'تویسرکان', 'اسدآباد', 'کبودرآهنگ',
  'مهاباد', 'خوی', 'میاندوآب', 'بوکان', 'سلماس', 'نقده', 'پیرانشهر', 'ماکو',
  'سقز', 'مریوان', 'بانه', 'قروه', 'بیجار', 'کامیاران',
  'اسلام‌شهر', 'شهریار', 'ملارد', 'قدس', 'پاکدشت', 'ورامین', 'پردیس', 'دماوند', 'لواسان', 'رباط‌کریم', 'پیشوا', 'فیروزکوه',
  'فردیس', 'محمدشهر', 'نظرآباد', 'هشتگرد', 'کمال‌شهر', 'ماهدشت',
  'آبیک', 'تاکستان', 'الوند', 'محمدیه', 'بوئین‌زهرا',
  'کنگاور', 'اسلام‌آباد غرب', 'سرپل ذهاب', 'هرسین', 'صحنه', 'جوانرود', 'پاوه',
  'مسجد سلیمان', 'گچساران', 'دوگنبدان', 'دهدشت',
  'زابل', 'ایرانشهر', 'چابهار', 'سراوان', 'خاش', 'نیک‌شهر',
  'دامغان', 'شاهرود', 'گرمسار', 'مهدیشهر',
  'بروجرد', 'دورود', 'الیگودرز', 'کوهدشت', 'ازنا', 'پلدختر',
  'مراوه‌تپه', 'رامیان', 'آزادشهر', 'مینودشت',
  'بردسکن', 'فریمان', 'درگز', 'خواف', 'مه‌ولات',
  'شیروان', 'اسفراین', 'جاجرم', 'آشخانه',
]
const ALL_CITIES = (() => {
  const set = new Set<string>([...PRIORITY, ...Object.values(CITIES).flat(), ...EXTRA])
  const rest = Array.from(set).filter(c => !PRIORITY.includes(c)).sort((a, b) => a.localeCompare(b, 'fa'))
  return [...PRIORITY.filter(c => set.has(c)), ...rest]
})()
const norm = (s: string) => (s || '').replace(/‌/g, '').replace(/\s/g, '')

export function readCity(): string {
  if (typeof document === 'undefined') return ''
  const m = document.cookie.match(/(?:^|; )mj_city=([^;]*)/)
  if (m) { try { const v = decodeURIComponent(m[1]); if (v) return v } catch {} }
  const lm = document.cookie.match(/(?:^|; )mj_loc=([^;]*)/)
  if (lm) { try { return JSON.parse(decodeURIComponent(lm[1]))?.city || '' } catch {} }
  return ''
}
export function writeCity(city: string) {
  if (typeof document === 'undefined') return
  document.cookie = `mj_city=${encodeURIComponent(city)};path=/;max-age=${365 * 86400};SameSite=Lax`
  window.dispatchEvent(new CustomEvent('mj-city-updated'))
}

export default function CitySelector() {
  const [city, setCity] = useState('')
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setCity(readCity())
    const upd = () => setCity(readCity())
    window.addEventListener('mj-city-updated', upd)
    window.addEventListener('mj-loc-updated', upd)
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => { window.removeEventListener('mj-city-updated', upd); window.removeEventListener('mj-loc-updated', upd); document.removeEventListener('mousedown', onDoc) }
  }, [])
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 30) }, [open])

  const filtered = useMemo(() => {
    const nq = norm(q)
    if (!nq) return ALL_CITIES
    return ALL_CITIES.filter(c => norm(c).includes(nq))
  }, [q])

  const pick = (c: string) => { setCity(c); writeCity(c); setOpen(false); setQ('') }

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={() => setOpen(o => !o)} title="انتخاب شهر" style={{ display: 'flex', alignItems: 'center', gap: 6, height: 40, padding: '0 12px', borderRadius: 11, border: `1px solid ${city ? 'var(--gold)' : 'var(--line2)'}`, background: city ? 'var(--goldDim)' : 'var(--surface)', color: city ? 'var(--gold)' : 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
        <span style={{ fontSize: 14 }}>📍</span>
        <span>{city || 'انتخاب شهر'}</span>
        <span style={{ fontSize: 10, opacity: .7 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '110%', insetInlineStart: 0, zIndex: 100, width: 230, background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 12, boxShadow: '0 14px 40px -12px rgba(0,0,0,.5)', padding: 6 }}>
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="جست‌وجوی شهر…" style={{ width: '100%', boxSizing: 'border-box', height: 36, padding: '0 11px', borderRadius: 9, background: 'var(--bg2)', border: '1px solid var(--line2)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', marginBottom: 6 }} />
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '14px 11px', color: 'var(--muted)', fontSize: 12.5, textAlign: 'center' }}>شهری یافت نشد</div>
            ) : filtered.map(c => (
              <button key={c} onClick={() => pick(c)} style={{ display: 'block', width: '100%', textAlign: 'right', padding: '9px 11px', borderRadius: 8, border: 'none', background: city === c ? 'var(--goldDim)' : 'transparent', color: city === c ? 'var(--gold)' : 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: city === c ? 700 : 500 }}>{c}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
