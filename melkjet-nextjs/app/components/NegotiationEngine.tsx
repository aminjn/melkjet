'use client'
import { useState } from 'react'

// موتور مذاکره — داخلِ پنلِ مشاور/آژانس. چند سناریو + قیمتِ پیشنهادیِ دقیق (قابلِ تایپ).

const FONT = 'Vazirmatn, system-ui, sans-serif'
export interface NegListing { id: string; title: string; price: number; deal?: string; location?: string }

function acceptance(pct: number): { prob: number; color: string; label: string; strategy: string } {
  if (pct >= 100) return { prob: 95, color: '#22c55e', label: 'بسیار بالا', strategy: 'پیشنهاد شما بالاتر یا برابرِ قیمتِ درخواستی است؛ احتمال پذیرش بسیار زیاد است.' }
  if (pct >= 95) return { prob: 80, color: '#22c55e', label: 'بالا', strategy: 'پیشنهادِ معقول با احتمال پذیرشِ بالا. فروشنده احتمالاً با مذاکرهٔ جزئی موافقت می‌کند.' }
  if (pct >= 90) return { prob: 62, color: '#f59e0b', label: 'متوسط', strategy: 'فاصلهٔ مناسب برای مذاکره. با ارائهٔ شرایط پرداختِ بهتر می‌توانید احتمال پذیرش را بالا ببرید.' }
  if (pct >= 85) return { prob: 40, color: '#f97316', label: 'پایین', strategy: 'پیشنهادِ چالش‌برانگیز است؛ بهتر است دلایلِ قویِ قیمت‌گذاری آماده داشته باشید.' }
  return { prob: 18, color: '#ef4444', label: 'بسیار پایین', strategy: 'احتمالِ رد شدن زیاد است؛ این استراتژی فقط در بازارِ راکد یا ملکِ مشکل‌دار توصیه می‌شود.' }
}
const faMoney = (n: number) => n > 0 ? n.toLocaleString('fa-IR') + ' تومان' : '—'
const toLatin = (s: string) => s.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16 }

// سه سناریوی پایه
const SCENARIOS = [
  { key: 'safe', label: 'محتاطانه', pct: 96, hint: 'تخفیفِ کم، احتمالِ پذیرشِ بالا' },
  { key: 'balanced', label: 'متعادل', pct: 90, hint: 'تعادلِ تخفیف و پذیرش' },
  { key: 'bold', label: 'جسورانه', pct: 82, hint: 'تخفیفِ بیشتر، ریسکِ بالاتر' },
]

export default function NegotiationEngine({ listings = [] }: { listings?: NegListing[] }) {
  const [value, setValue] = useState('')           // ارزشِ ملک (تومان)
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [offer, setOffer] = useState(0)            // قیمتِ پیشنهادیِ خریدار (تومان، دقیق)
  const [ai, setAi] = useState<{ scenario: string; text: string }[]>([])
  const [loading, setLoading] = useState('')        // کلیدِ سناریوی در حالِ تولید، یا 'custom'

  const val = Number(value) || 0
  const pct = val > 0 ? Math.round((offer / val) * 100) : 0
  const acc = acceptance(pct || 0)

  const setVal = (raw: string) => {
    const v = Number(toLatin(raw).replace(/[^\d]/g, '')) || 0
    setValue(String(v))
    if (!offer && v) setOffer(Math.round(v * 0.9))   // پیش‌فرضِ اولیه ۹۰٪
  }
  const pickListing = (id: string) => {
    const l = listings.find(x => x.id === id); if (!l) return
    setValue(String(l.price || '')); setTitle(l.title); setLocation(l.location || ''); setOffer(Math.round((l.price || 0) * 0.9))
  }

  const gen = async (scenarioLabel: string, ofr: number, key: string) => {
    if (!val) return
    setLoading(key)
    const p = val > 0 ? Math.round((ofr / val) * 100) : 0
    const a = acceptance(p)
    const prompt = `تو یک مشاورِ املاکِ حرفه‌ای ایرانی هستی. یک پیامِ مذاکرهٔ مؤدبانه و قانع‌کننده به فارسیِ روان (بدون هیچ کلمهٔ انگلیسی) برای ارائهٔ پیشنهادِ خرید بنویس.
سناریو: ${scenarioLabel}
ملک: ${title || 'ملک موردنظر'}${location ? ` در ${location}` : ''}
قیمتِ فروشنده: ${faMoney(val)}
پیشنهادِ خریدار: ${faMoney(ofr)} (${p}٪)
لحن متناسب با سناریو، کوتاه (۳ تا ۵ جمله)، با یک دلیلِ منطقی برای قیمت. اسم و شماره را جای خالی نگذار؛ ننویس [نام شما].`
    try {
      const r = await fetch('/api/ai/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent: 'chat', input: prompt }) })
      const d = await r.json()
      const text = d.ok ? d.text : `⚠ ${d.error || 'خطا'}`
      setAi(prev => [{ scenario: `${scenarioLabel} · ${faMoney(ofr)} (${p}٪) · احتمالِ پذیرش ${a.label}`, text }, ...prev].slice(0, 4))
    } catch { setAi(prev => [{ scenario: scenarioLabel, text: '⚠ خطا در ارتباط با هوش مصنوعی' }, ...prev]) } finally { setLoading('') }
  }

  const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 9, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: FONT }
  const lab: React.CSSProperties = { fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }

  return (
    <div dir="rtl" style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 820, fontFamily: FONT }}>
      <div style={{ ...card, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}><span style={{ fontSize: 20 }}>🤝</span><div style={{ fontWeight: 800, fontSize: 15 }}>موتور مذاکره</div></div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>قیمت را دقیق وارد کنید و از میانِ چند سناریو، پیامِ مذاکره بسازید.</div>
      </div>

      <div style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {listings.length > 0 && (
          <div>
            <label style={lab}>انتخاب از فایل‌های شما</label>
            <select onChange={e => pickListing(e.target.value)} defaultValue="" style={inp}>
              <option value="">— دستی وارد می‌کنم —</option>
              {listings.map(l => <option key={l.id} value={l.id}>{l.title}{l.price ? ` · ${faMoney(l.price)}` : ''}</option>)}
            </select>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <div><label style={lab}>عنوان ملک</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="مثلاً آپارتمان ۱۲۰ متری سعادت‌آباد" style={inp} /></div>
          <div><label style={lab}>منطقه</label><input value={location} onChange={e => setLocation(e.target.value)} style={inp} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label style={lab}>ارزشِ ملک / قیمتِ فروشنده (تومان)</label><input value={val ? val.toLocaleString('fa-IR') : ''} onChange={e => setVal(e.target.value)} placeholder="۲۶۱٬۶۰۰٬۰۰۰٬۰۰۰" style={{ ...inp, fontWeight: 700, color: 'var(--gold)' }} /></div>
          <div><label style={lab}>قیمتِ پیشنهادیِ خریدار (دقیق، تومان)</label><input value={offer ? offer.toLocaleString('fa-IR') : ''} onChange={e => setOffer(Number(toLatin(e.target.value).replace(/[^\d]/g, '')) || 0)} placeholder="عددِ دقیق را تایپ کنید" style={{ ...inp, fontWeight: 700, color: 'var(--gold)' }} /></div>
        </div>
        {/* اسلایدرِ کمکی (تنظیمِ سریع) — قیمتِ دقیق همان فیلدِ بالاست */}
        {val > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={lab}>تنظیم سریع با درصد</label>
              <span style={{ background: 'var(--goldDim)', color: 'var(--gold)', borderRadius: 999, padding: '2px 12px', fontSize: 12.5, fontWeight: 800, border: '1px solid var(--gold)' }}>{(pct || 0).toLocaleString('fa-IR')}٪</span>
            </div>
            <input type="range" min={60} max={105} step={1} value={pct || 90} onChange={e => setOffer(Math.round(val * (+e.target.value) / 100))} style={{ width: '100%', accentColor: 'var(--gold)', cursor: 'pointer' }} />
          </div>
        )}

        {/* احتمالِ پذیرشِ پیشنهادِ فعلی */}
        {val > 0 && offer > 0 && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>پیشنهادِ فعلی: <b style={{ color: 'var(--gold)' }}>{faMoney(offer)}</b></div>
              <span style={{ flex: 1 }} />
              <span style={{ fontWeight: 800, color: acc.color, fontSize: 13 }}>احتمالِ پذیرش: {acc.label} · {acc.prob.toLocaleString('fa-IR')}٪</span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: 'var(--line)', overflow: 'hidden', marginBottom: 10 }}><div style={{ width: `${acc.prob}%`, height: '100%', background: acc.color }} /></div>
            <div style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.9, marginBottom: 10 }}>{acc.strategy}</div>
            <button onClick={() => gen('پیشنهادِ دلخواه', offer, 'custom')} disabled={!!loading} style={{ padding: '9px 18px', borderRadius: 9, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: FONT, opacity: loading ? 0.6 : 1 }}>{loading === 'custom' ? 'در حال نوشتن…' : '✨ پیام برای همین پیشنهاد'}</button>
          </div>
        )}
      </div>

      {/* سناریوهای آماده */}
      {val > 0 && (
        <div style={{ ...card, padding: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>سناریوهای مذاکره</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
            {SCENARIOS.map(s => {
              const ofr = Math.round(val * s.pct / 100); const a = acceptance(s.pct)
              return (
                <div key={s.key} style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: 13, display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <b style={{ fontSize: 13.5 }}>{s.label}</b>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>{s.pct.toLocaleString('fa-IR')}٪</span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--gold)' }}>{faMoney(ofr)}</div>
                  <div style={{ fontSize: 11.5, color: a.color, fontWeight: 700 }}>احتمالِ پذیرش: {a.label} · {a.prob.toLocaleString('fa-IR')}٪</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.7 }}>{s.hint}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
                    <button onClick={() => setOffer(ofr)} style={{ flex: 1, padding: '7px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', fontFamily: FONT }}>اعمال</button>
                    <button onClick={() => gen(s.label, ofr, s.key)} disabled={!!loading} style={{ flex: 1, padding: '7px', borderRadius: 8, background: 'var(--goldDim)', border: '1px solid var(--gold)', color: 'var(--gold)', fontSize: 12, cursor: 'pointer', fontFamily: FONT, opacity: loading ? 0.6 : 1 }}>{loading === s.key ? '…' : '✨ پیام'}</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* پیام‌های تولیدشده */}
      {ai.map((m, i) => (
        <div key={i} style={{ ...card, border: '1px solid var(--gold)', padding: 14 }}>
          <div style={{ fontSize: 11.5, color: 'var(--gold)', fontWeight: 700, marginBottom: 8 }}>{m.scenario}</div>
          <div style={{ fontSize: 13, lineHeight: 2, whiteSpace: 'pre-wrap' }}>{m.text}</div>
          {!m.text.startsWith('⚠') && <button onClick={() => navigator.clipboard?.writeText(m.text)} style={{ marginTop: 10, padding: '6px 14px', borderRadius: 8, background: 'transparent', border: '1px solid var(--line2)', color: 'var(--gold)', fontSize: 12, cursor: 'pointer', fontFamily: FONT }}>کپیِ پیام</button>}
        </div>
      ))}
    </div>
  )
}
