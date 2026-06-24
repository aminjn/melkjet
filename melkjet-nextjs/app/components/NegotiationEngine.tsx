'use client'
import { useState } from 'react'

// موتور مذاکره — داخلِ پنلِ مشاور/آژانس باز می‌شود (نه صفحهٔ جدا).
// ارزشِ ملک + درصد پیشنهاد → احتمالِ پذیرش + استراتژی + پیام مذاکرهٔ آماده با AI.

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
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16 }

export default function NegotiationEngine({ listings = [] }: { listings?: NegListing[] }) {
  const [value, setValue] = useState('')           // ارزشِ ملک (تومان، ارقام لاتین)
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [pct, setPct] = useState(90)
  const [aiText, setAiText] = useState('')
  const [loading, setLoading] = useState(false)

  const val = Number(value) || 0
  const offer = Math.round(val * pct / 100)
  const acc = acceptance(pct)

  const pickListing = (id: string) => {
    const l = listings.find(x => x.id === id)
    if (!l) { return }
    setValue(String(l.price || '')); setTitle(l.title); setLocation(l.location || '')
  }

  const genMessage = async () => {
    if (!val) { setAiText('ابتدا ارزشِ ملک را وارد کنید.'); return }
    setLoading(true); setAiText('')
    const prompt = `تو یک مشاورِ املاکِ حرفه‌ای هستی. یک پیامِ مذاکرهٔ مؤدبانه و قانع‌کننده به فارسی برای ارائهٔ پیشنهادِ خرید بنویس.
ملک: ${title || 'ملک موردنظر'}${location ? ` در ${location}` : ''}
قیمتِ درخواستیِ فروشنده: ${faMoney(val)}
پیشنهادِ خریدار: ${faMoney(offer)} (${pct}٪ قیمت)
استراتژی: ${acc.strategy}
پیام باید کوتاه (۳ تا ۵ جمله)، محترمانه و حرفه‌ای باشد و دلیلِ منطقی برای قیمتِ پیشنهادی بیاورد.`
    try {
      const r = await fetch('/api/ai/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent: 'chat', input: prompt }) })
      const d = await r.json()
      setAiText(d.ok ? d.text : `⚠ ${d.error || 'خطا در تولید پیام'}`)
    } catch { setAiText('⚠ خطا در ارتباط با هوش مصنوعی') } finally { setLoading(false) }
  }

  const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 9, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: FONT }
  const lab: React.CSSProperties = { fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }

  return (
    <div dir="rtl" style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 760, fontFamily: FONT }}>
      <div style={{ ...card, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}><span style={{ fontSize: 20 }}>🤝</span><div style={{ fontWeight: 800, fontSize: 15 }}>موتور مذاکره</div></div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>پیشنهادِ بهینه را با کمکِ هوش مصنوعی تنظیم کنید و پیامِ مذاکره بسازید.</div>
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
        <div>
          <label style={lab}>ارزشِ ملک / قیمتِ فروشنده (تومان)</label>
          <input value={val ? val.toLocaleString('fa-IR') : ''} onChange={e => setValue(e.target.value.replace(/[^\d۰-۹]/g, '').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))))} placeholder="مثلاً ۴٬۵۰۰٬۰۰۰٬۰۰۰" style={{ ...inp, direction: 'rtl', fontWeight: 700, color: 'var(--gold)' }} />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={lab}>قیمتِ پیشنهادیِ خریدار</label>
            <span style={{ background: 'var(--goldDim)', color: 'var(--gold)', borderRadius: 999, padding: '2px 12px', fontSize: 12.5, fontWeight: 800, border: '1px solid var(--gold)' }}>{pct}٪</span>
          </div>
          <input type="range" min={70} max={105} step={1} value={pct} onChange={e => setPct(+e.target.value)} style={{ width: '100%', accentColor: 'var(--gold)', cursor: 'pointer' }} />
          <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--gold)', marginTop: 8 }}>{faMoney(offer)}</div>
        </div>

        {/* احتمالِ پذیرش + استراتژی */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>احتمالِ پذیرش</div>
            <span style={{ fontWeight: 800, color: acc.color, fontSize: 13.5 }}>{acc.label} · {acc.prob.toLocaleString('fa-IR')}٪</span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: 'var(--line)', overflow: 'hidden', marginBottom: 10 }}>
            <div style={{ width: `${acc.prob}%`, height: '100%', background: acc.color, borderRadius: 999 }} />
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.9 }}>{acc.strategy}</div>
        </div>

        <button onClick={genMessage} disabled={loading || !val} style={{ alignSelf: 'flex-start', padding: '10px 22px', borderRadius: 10, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, fontSize: 13.5, border: 'none', cursor: 'pointer', fontFamily: FONT, opacity: loading || !val ? 0.6 : 1 }}>{loading ? 'در حال نوشتن…' : '✨ تولیدِ پیامِ مذاکره'}</button>

        {aiText && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--gold)', borderRadius: 12, padding: 14, fontSize: 13, lineHeight: 2, whiteSpace: 'pre-wrap' }}>
            {aiText}
            {!aiText.startsWith('⚠') && <button onClick={() => navigator.clipboard?.writeText(aiText)} style={{ display: 'block', marginTop: 10, padding: '6px 14px', borderRadius: 8, background: 'transparent', border: '1px solid var(--line2)', color: 'var(--gold)', fontSize: 12, cursor: 'pointer', fontFamily: FONT }}>کپیِ پیام</button>}
          </div>
        )}
      </div>
    </div>
  )
}
