'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'

// جزیرهٔ تعاملیِ هیروی صفحهٔ اصلی.
// فاز ۲۹۸ی۵ (ری‌برند): حالتِ glass = پنلِ شیشه‌ایِ موکاپ — جعبهٔ زبانِ طبیعی + فیلترِ برچسب‌دار
// + دکمهٔ جستجو + نوارِ دستیار با دکمهٔ گردِ ارسال. همه واقعی‌اند و به /search می‌روند.
// فاز ۳۳۷ (هم‌ترازی با رقبا — دیوار/کیلید/Zillow): «موقعیت» از تکست‌باکسِ آزاد به کَسکِیدِ واقعیِ
// شهر ← محله ارتقا یافت (CitySelectorِ سراسری در هدر شهر را در کوکی mj_city نگه می‌دارد؛ اینجا
// محله با کومبوباکسِ HoodCombo از همان شهر می‌آید)، + انتخابِ سریعِ «حداکثر بودجه».

const KINDS = ['آپارتمان', 'ویلا و خانه', 'زمین و کلنگی', 'دفتر و اداری', 'مغازه و تجاری']
const DEALS: { l: string; v: string }[] = [
  { l: 'خرید', v: '' }, { l: 'رهن و اجاره', v: 'rent' }, { l: 'پیش‌فروش', v: 'presale' },
]
const CITIES = ['تهران', 'مشهد', 'اصفهان', 'کرج', 'شیراز', 'تبریز', 'قم', 'اهواز', 'رشت', 'کرمان', 'ارومیه', 'قزوین', 'یزد']
// حداکثر بودجه (تومان) — میان‌بُرِ رایج؛ فیلترِ کاملِ قیمت در صفحهٔ جستجوست.
const BUDGETS: { l: string; v: string }[] = [
  { l: 'حداکثر بودجه', v: '' },
  { l: 'تا ۳ میلیارد', v: '3000000000' }, { l: 'تا ۵ میلیارد', v: '5000000000' },
  { l: 'تا ۸ میلیارد', v: '8000000000' }, { l: 'تا ۱۲ میلیارد', v: '12000000000' },
  { l: 'تا ۲۰ میلیارد', v: '20000000000' }, { l: 'تا ۴۰ میلیارد', v: '40000000000' },
]
const readCity = () => { try { const m = document.cookie.match(/(?:^|; )mj_city=([^;]*)/); return m ? decodeURIComponent(m[1]) : '' } catch { return '' } }
const writeCity = (c: string) => { try { document.cookie = `mj_city=${encodeURIComponent(c)};path=/;max-age=${365 * 86400};SameSite=Lax` } catch {} }

export default function HeroSearch({ examples, glass = false }: { examples: string[]; glass?: boolean }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState(KINDS[0])
  const [deal, setDeal] = useState('')
  const [city, setCity] = useState('')
  const [hood, setHood] = useState('')
  const [budget, setBudget] = useState('')
  const [chat, setChat] = useState('')

  useEffect(() => { setCity(readCity()) }, [])
  const pickCity = (c: string) => { setCity(c); setHood(''); writeCity(c) }

  const go = (params: Record<string, string>) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => { if (v && v.trim()) qs.set(k, v.trim()) })
    const s = qs.toString()
    router.push(s ? `/search?${s}` : '/search')
  }
  const runSearch = () => go({ q: query, kind, type: deal, hood, pmax: budget })
  const runChat = () => go({ q: chat.trim() || query })
  const fillQuery = (text: string) => { setQuery(text); go({ q: text }) }

  // ── حالتِ ساده (غیرِ هیرو) — دست‌نخورده از نسخهٔ قبلی ──
  if (!glass) {
    return (
      <div style={{ margin: '34px auto 0', maxWidth: 740, width: '100%', textAlign: 'right' }}>
        <div style={{ position: 'relative', background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 18, padding: 18, boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <textarea value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runSearch() } }} placeholder="مثلاً: آپارتمان ۱۳۰ متری در سعادت‌آباد، زیر ۱۸ میلیارد، با آسانسور و پارکینگ، نزدیک مترو…" rows={2} style={{ flex: 1, resize: 'none', border: 'none', outline: 'none', background: 'transparent', color: 'var(--text)', fontFamily: 'inherit', fontSize: 16, lineHeight: 1.7, paddingTop: 8 }} />
            <button onClick={runSearch} style={{ flexShrink: 0, height: 48, padding: '0 22px', border: 'none', borderRadius: 13, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', fontFamily: 'inherit', fontWeight: 700, fontSize: 15, cursor: 'pointer', boxShadow: '0 10px 24px -10px var(--gold)' }}>جستجو</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
            <span style={{ fontSize: 12.5, color: 'var(--faint)', alignSelf: 'center' }}>امتحان کنید:</span>
            {examples.map(ex => (<button key={ex} onClick={() => fillQuery(ex)} style={{ padding: '7px 13px', borderRadius: 999, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--muted)', fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer' }}>{ex}</button>))}
          </div>
        </div>
      </div>
    )
  }

  // ── حالتِ glass — پنلِ هیروی سینمایی (مطابقِ موکاپ) ──
  // رنگ‌ها از توکن‌های تم‌آگاهِ --hsg-* (globals.css) می‌آیند: شب تیره، روز روشن.
  const pill: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, width: '100%', height: 50, padding: '0 20px', borderRadius: 999, border: '1px solid var(--hsg-field-brd)', background: 'var(--hsg-field-bg)', color: 'var(--hsg-text)', overflow: 'hidden', boxSizing: 'border-box' }
  const pillLabel: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--hsg-label)', whiteSpace: 'nowrap', flexShrink: 0 }
  const selStyle: React.CSSProperties = { flex: 1, width: 0, minWidth: 0, appearance: 'none', WebkitAppearance: 'none', border: 'none', outline: 'none', background: 'transparent', color: 'var(--hsg-text)', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: 'right', direction: 'rtl', textOverflow: 'ellipsis' }

  return (
    <div style={{ width: '100%', textAlign: 'right' }}>
      <div style={{ position: 'relative', background: 'var(--hsg-bg)', border: '1px solid var(--hsg-brd)', borderRadius: 30, padding: 'clamp(16px,2.2vw,22px)', boxShadow: 'var(--hsg-shadow)', backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)' }}>
        {/* ردیفِ بالا: فیلترها (راست) + جعبهٔ زبانِ طبیعی (چپ). دسکتاپ کنارِ هم؛ موبایل روی هم. */}
        <div className="mjhp-top" style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'stretch' }}>
          {/* ستونِ فیلترها — دسکتاپ عمودی؛ موبایل اسکرولِ افقی (جمع‌وجور) */}
          <div style={{ flex: '1 1 208px', minWidth: 196, display: 'grid', gap: 10, alignContent: 'start' }}>
            <div className="mjhp-pills" style={{ display: 'grid', gap: 10 }}>
              <label style={pill}>
                <span style={pillLabel}>معامله:</span>
                <select value={deal} onChange={e => setDeal(e.target.value)} style={selStyle}>
                  {DEALS.map(d => <option key={d.l} value={d.v} style={{ color: '#111' }}>{d.l}</option>)}
                </select>
              </label>
              <label style={pill}>
                <span style={pillLabel}>نوع ملک:</span>
                <select value={kind} onChange={e => setKind(e.target.value)} style={selStyle}>
                  {KINDS.map(k => <option key={k} value={k} style={{ color: '#111' }}>{k}</option>)}
                </select>
              </label>
              <label style={pill}>
                <span style={pillLabel}>شهر:</span>
                <select value={city} onChange={e => pickCity(e.target.value)} style={selStyle}>
                  <option value="" style={{ color: '#111' }}>همهٔ شهرها</option>
                  {CITIES.map(c => <option key={c} value={c} style={{ color: '#111' }}>{c}</option>)}
                </select>
              </label>
              {/* محله — کومبوباکسِ بومی، هم‌سبکِ بقیهٔ کادرها؛ لیست با portal (بریده نمی‌شود). */}
              <HoodCombo city={city} value={hood} onChange={setHood} onEnter={runSearch} pill={pill} pillLabel={pillLabel} inputStyle={{ ...selStyle, cursor: 'text' }} />
              <label style={pill}>
                <span style={pillLabel}>بودجه:</span>
                <select value={budget} onChange={e => setBudget(e.target.value)} style={selStyle}>
                  {BUDGETS.map(b => <option key={b.l} value={b.v} style={{ color: '#111' }}>{b.l}</option>)}
                </select>
              </label>
            </div>
            <button onClick={runSearch} style={{ height: 50, borderRadius: 999, background: 'linear-gradient(100deg, rgba(221,194,122,.32), rgba(230,199,102,.2))', border: '1px solid rgba(221,194,122,.7)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', color: 'var(--hsg-label)', fontFamily: 'inherit', fontWeight: 800, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 10px 26px -12px rgba(217,173,62,.5)' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--hsg-label)" strokeWidth="2.4" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
              جستجو
            </button>
          </div>
          {/* جعبهٔ زبانِ طبیعی */}
          <textarea className="mjhp-textarea" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runSearch() } }} placeholder="به زبان خودت بگو چه می‌خواهی… مثلاً: آپارتمان ۱۳۰ متری در سعادت‌آباد، زیر ۱۸ میلیارد، با آسانسور و پارکینگ، نزدیک مترو" style={{ flex: '2 1 240px', minWidth: 0, minHeight: 176, resize: 'none', borderRadius: 16, border: '1px solid var(--hsg-field-brd)', outline: 'none', background: 'var(--hsg-field-bg)', color: 'var(--hsg-text)', fontFamily: 'inherit', fontSize: 15.5, lineHeight: 1.85, padding: '14px 16px' }} />
        </div>

        {/* نوارِ دستیارِ هوشمند با دکمهٔ گردِ ارسال */}
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, height: 56, padding: '0 8px 0 18px', borderRadius: 999, border: '1px solid var(--hsg-ai-brd)', background: 'var(--hsg-ai-bg)' }}>
          <input value={chat} onChange={e => setChat(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') runChat() }} placeholder="از دستیارِ هوشمندِ ملک‌جت بپرس…" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--hsg-text)', fontFamily: 'inherit', fontSize: 14.5 }} />
          {/* Send: دایره با فلشِ طلایی (رنگِ دایره و فلش تم‌آگاه) */}
          <button onClick={runChat} aria-label="ارسال به دستیار" style={{ flexShrink: 0, width: 42, height: 42, borderRadius: '50%', border: '1px solid rgba(221,194,122,.7)', background: 'var(--hsg-send-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'scaleX(-1)', stroke: 'var(--hsg-label)' }}><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
          </button>
        </div>

        {/* نمونه‌های پیشنهادی */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          <span style={{ fontSize: 12.5, color: 'var(--hsg-ex-k)', alignSelf: 'center' }}>امتحان کنید:</span>
          {examples.slice(0, 3).map(ex => (
            <button key={ex} onClick={() => fillQuery(ex)} style={{ padding: '7px 13px', borderRadius: 999, border: '1px solid var(--hsg-ex-brd)', background: 'var(--hsg-ex-bg)', color: 'var(--hsg-ex-text)', fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer' }}>{ex}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── کومبوباکسِ محله (فاز ۳۳۷الف۲) ──────────────────────────────────────────────
// باگِ زنده: NeighborhoodPickerِ عمومی داخلِ کادرِ هیرو (overflow:hidden + backdrop-filter +
// اسکرولِ افقیِ موبایل) لیستش بریده و نامرئی می‌شد و دکمهٔ سفیدِ جدایش با بقیه یکدست نبود.
// اینجا تایپ مستقیم در خودِ کادر است و لیست با portal و position:fixed روی body رندر می‌شود.
let geoCache: any = null
const normFa = (s: string) => (s || '').replace(/‌/g, '').replace(/\s/g, '').replace(/ي/g, 'ی').replace(/ك/g, 'ک')
function HoodCombo({ city, value, onChange, onEnter, pill, pillLabel, inputStyle }: {
  city: string; value: string; onChange: (v: string) => void; onEnter: () => void
  pill: React.CSSProperties; pillLabel: React.CSSProperties; inputStyle: React.CSSProperties
}) {
  const [geo, setGeo] = useState<any>(geoCache)
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const boxRef = useRef<HTMLLabelElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (geoCache) return
    fetch('/api/geo').then(r => r.ok ? r.json() : null).then(d => { if (d) { geoCache = d; setGeo(d) } }).catch(() => {})
  }, [])

  // محله‌های شهرِ انتخابی (بدونِ شهر: همهٔ شهرها — فقط وقتی تایپ شده تا لیست سنگین نشود).
  const all = useMemo(() => {
    const set = new Set<string>()
    const cn = normFa(city)
    for (const p of (geo?.provinces || [])) for (const c of (p.cities || [])) {
      const n = normFa(c.name)
      if (cn && !(n === cn || n.includes(cn) || cn.includes(n))) continue
      for (const d of (c.districts || [])) for (const h of (d.neighborhoods || [])) if (h) set.add(h)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'fa'))
  }, [geo, city])
  const list = useMemo(() => {
    const q = normFa(value)
    if (!q) return city ? all.slice(0, 80) : []
    return all.filter(h => normFa(h).includes(q)).slice(0, 60)
  }, [all, value, city])

  const place = () => {
    const r = boxRef.current?.getBoundingClientRect()
    if (r) setRect({ top: r.bottom + 6, left: r.left, width: Math.max(r.width, 240) })
  }
  useEffect(() => {
    if (!open) return
    place()
    const onMove = () => place()
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (boxRef.current?.contains(t) || listRef.current?.contains(t)) return
      setOpen(false)
    }
    window.addEventListener('scroll', onMove, true); window.addEventListener('resize', onMove)
    document.addEventListener('mousedown', onDown)
    return () => { window.removeEventListener('scroll', onMove, true); window.removeEventListener('resize', onMove); document.removeEventListener('mousedown', onDown) }
  }, [open])

  const pick = (v: string) => { onChange(v); setOpen(false) }
  const showList = open && rect && (list.length > 0 || !!value)

  return (
    <label ref={boxRef} style={pill}>
      <span style={pillLabel}>محله:</span>
      <input value={value} onChange={e => { onChange(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)}
        onKeyDown={e => { if (e.key === 'Enter') { setOpen(false); onEnter() } else if (e.key === 'Escape') setOpen(false) }}
        placeholder={city ? 'همهٔ محله‌ها — تایپ کن…' : 'نامِ محله را تایپ کن…'} style={inputStyle} autoComplete="off" />
      {value && <button type="button" aria-label="پاک کردنِ محله" onClick={e => { e.preventDefault(); onChange('') }}
        style={{ flexShrink: 0, border: 'none', background: 'transparent', color: 'var(--hsg-label)', cursor: 'pointer', fontSize: 15, padding: 0, lineHeight: 1 }}>×</button>}
      {showList && typeof document !== 'undefined' && createPortal(
        <div ref={listRef} dir="rtl" style={{ position: 'fixed', top: rect!.top, left: rect!.left, width: rect!.width, zIndex: 1000, maxHeight: 300, overflowY: 'auto', padding: 6, background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 16, boxShadow: '0 18px 44px -14px rgba(0,0,0,.45)', fontFamily: 'inherit' }}>
          {!value && <button type="button" onMouseDown={e => { e.preventDefault(); pick('') }} style={hoodRow(false)}>همهٔ محله‌ها</button>}
          {list.map(h => <button type="button" key={h} onMouseDown={e => { e.preventDefault(); pick(h) }} style={hoodRow(normFa(h) === normFa(value))}>{h}</button>)}
          {!list.length && <div style={{ padding: 12, fontSize: 12.5, color: 'var(--faint)', textAlign: 'center' }}>در فهرست نیست — با همین متن جستجو می‌شود</div>}
        </div>, document.body)}
    </label>
  )
}
function hoodRow(active: boolean): React.CSSProperties {
  return { display: 'block', width: '100%', textAlign: 'right', padding: '9px 12px', borderRadius: 10, border: 'none', background: active ? 'var(--goldDim)' : 'transparent', color: active ? 'var(--gold)' : 'var(--text)', fontSize: 13.5, fontWeight: active ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' }
}
