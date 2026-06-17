'use client'
import { useRef, useState } from 'react'

// استودیو واقعی تولید پلان دوبعدی و رندر سه‌بعدی از روی عکس‌ها + پارامترها.
// از /api/ai/studio استفاده می‌کند (ایجنت StudioAgent → مدل تصویر).

const STYLES = ['مدرن', 'کلاسیک', 'مینیمال']
const BEDS = ['۱', '۲', '۳', '۴+']
const BED_VAL: Record<string, string> = { '۱': '1', '۲': '2', '۳': '3', '۴+': '4' }
const DEFAULT_ROOMS = ['نشیمن', 'آشپزخانه', 'اتاق خواب', 'سرویس بهداشتی']

interface RoomSlot { label: string; preview?: string }

export default function PlanStudio({ compact }: { compact?: boolean }) {
  const [rooms, setRooms] = useState<RoomSlot[]>(DEFAULT_ROOMS.map(label => ({ label })))
  const [newRoom, setNewRoom] = useState('')
  const [area, setArea] = useState('۱۲۰')
  const [bedrooms, setBedrooms] = useState('۲')
  const [style, setStyle] = useState('مدرن')
  const [openPlan, setOpenPlan] = useState(true)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [out, setOut] = useState<{ description?: string; planUrl?: string; renderUrl?: string } | null>(null)
  const [err, setErr] = useState('')
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({})

  const pickPhoto = (i: number, f: File | null) => {
    if (!f) return
    const url = URL.createObjectURL(f)
    setRooms(rs => rs.map((r, idx) => idx === i ? { ...r, preview: url } : r))
  }
  const addRoom = () => {
    const n = newRoom.trim(); if (!n) return
    setRooms(rs => [...rs, { label: n }]); setNewRoom('')
  }
  const removeRoom = (i: number) => setRooms(rs => rs.filter((_, idx) => idx !== i))

  const toEnDigit = (s: string) => s.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))

  const generate = async () => {
    if (busy) return
    setBusy(true); setErr(''); setOut(null); setProgress('در حال ساخت پلان و مدل سه‌بعدی توسط هوش مصنوعی…')
    try {
      const withPhotos = rooms.filter(r => r.preview).map(r => r.label)
      const r = await fetch('/api/ai/studio', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          area: toEnDigit(area), bedrooms: BED_VAL[bedrooms] || toEnDigit(bedrooms),
          style, openPlan, rooms: withPhotos.length ? withPhotos : rooms.map(r => r.label),
        }),
      })
      const d = await r.json()
      if (!r.ok || d.error) { setErr(d.error || 'خطا در ساخت'); return }
      setOut({ description: d.description, planUrl: d.planUrl, renderUrl: d.renderUrl })
    } catch { setErr('خطا در ارتباط با سرور') }
    finally { setBusy(false); setProgress('') }
  }

  const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 18, padding: 18 }
  const label: React.CSSProperties = { fontSize: 12.5, color: 'var(--muted)', fontWeight: 600, marginBottom: 8, display: 'block' }
  const chip = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: active ? 700 : 500,
    border: `1px solid ${active ? 'var(--gold)' : 'var(--line2)'}`, background: active ? 'var(--goldDim)' : 'transparent', color: active ? 'var(--gold)' : 'var(--muted)',
  })

  return (
    <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr 1fr', gap: 16 }} className="mj-studio">
      {/* INPUT */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>۱. عکس‌های فضا</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>عکس هر اتاق را از زاویه‌های مختلف اضافه کن. (هرچه کامل‌تر، خروجی دقیق‌تر)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {rooms.map((rm, i) => (
              <div key={i} onClick={() => fileRefs.current[i]?.click()} style={{
                position: 'relative', height: 96, borderRadius: 12, cursor: 'pointer', overflow: 'hidden',
                border: `1px dashed ${rm.preview ? 'var(--gold)' : 'var(--line2)'}`, background: rm.preview ? 'transparent' : 'var(--bg2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {rm.preview
                  ? <img src={rm.preview} alt={rm.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 20, color: 'var(--faint)' }}>＋</span>}
                <span style={{ position: 'absolute', insetInlineStart: 8, bottom: 6, fontSize: 11.5, fontWeight: 700, color: rm.preview ? '#fff' : 'var(--muted)', textShadow: rm.preview ? '0 1px 4px rgba(0,0,0,.8)' : 'none' }}>{rm.label}</span>
                {!DEFAULT_ROOMS.includes(rm.label) && (
                  <button onClick={e => { e.stopPropagation(); removeRoom(i) }} style={{ position: 'absolute', insetInlineEnd: 6, top: 6, background: 'rgba(0,0,0,.5)', border: 'none', color: '#fff', borderRadius: 6, width: 20, height: 20, cursor: 'pointer', fontSize: 13 }}>×</button>
                )}
                <input ref={el => { fileRefs.current[i] = el }} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => pickPhoto(i, e.target.files?.[0] || null)} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input value={newRoom} onChange={e => setNewRoom(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addRoom() }}
              placeholder="افزودن فضای جدید (مثلاً تراس)" style={{ flex: 1, background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 9, padding: '8px 11px', color: 'var(--text)', fontSize: 12.5, fontFamily: 'inherit', outline: 'none' }} />
            <button onClick={addRoom} style={{ padding: '8px 14px', borderRadius: 9, border: '1px solid var(--gold)', background: 'transparent', color: 'var(--gold)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+ فضا</button>
          </div>
        </div>

        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 14 }}>۲. قوانین و پارامترها</div>
          <label style={label}>متراژ کل (متر مربع)</label>
          <input value={area} onChange={e => setArea(e.target.value)} style={{ width: '100%', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 10, padding: '10px 12px', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none', marginBottom: 16 }} />

          <label style={label}>تعداد خواب</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {BEDS.map(b => <button key={b} onClick={() => setBedrooms(b)} style={chip(bedrooms === b)}>{b}</button>)}
          </div>

          <label style={label}>سبک پلان</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {STYLES.map(s => <button key={s} onClick={() => setStyle(s)} style={chip(style === s)}>{s}</button>)}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>پلان اوپن (یکپارچه نشیمن و آشپزخانه)</span>
            <button onClick={() => setOpenPlan(v => !v)} style={{ width: 46, height: 26, borderRadius: 999, border: 'none', cursor: 'pointer', background: openPlan ? 'var(--gold)' : 'var(--line2)', position: 'relative', transition: 'background .2s' }}>
              <span style={{ position: 'absolute', top: 3, insetInlineStart: openPlan ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'inset-inline-start .2s' }} />
            </button>
          </div>

          <button onClick={generate} disabled={busy} style={{
            width: '100%', marginTop: 18, padding: '13px', borderRadius: 12, border: 'none', cursor: busy ? 'default' : 'pointer',
            background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, fontSize: 14.5, fontFamily: 'inherit', opacity: busy ? .6 : 1,
          }}>{busy ? '⏳ در حال ساخت…' : '✦ ساخت پلان و سه‌بعدی'}</button>
        </div>
      </div>

      {/* OUTPUT */}
      <div style={{ ...card, minHeight: 320, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>خروجی هوش مصنوعی</div>
          <span style={{ fontSize: 11, color: 'var(--gold)' }}>✦ موتور بینایی هوشمند</span>
        </div>

        {busy && <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--muted)', fontSize: 13 }}>
          <div className="mj-studio-spin" style={{ width: 38, height: 38, border: '3px solid var(--line2)', borderTopColor: 'var(--gold)', borderRadius: '50%' }} />
          <div>{progress}</div>
        </div>}

        {!busy && err && <div style={{ color: '#e7674a', fontSize: 13, padding: '20px 0', textAlign: 'center', lineHeight: 1.8 }}>⚠ {err}</div>}

        {!busy && !err && !out && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--faint)', textAlign: 'center' }}>
            <span style={{ fontSize: 30 }}>▦</span>
            <div style={{ fontSize: 13, maxWidth: 260, lineHeight: 1.8 }}>عکس‌ها را اضافه کن، پارامترها را تنظیم کن و «ساخت پلان و سه‌بعدی» را بزن.</div>
          </div>
        )}

        {!busy && out && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {out.description && <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.9, background: 'var(--bg2)', borderRadius: 12, padding: '12px 14px' }}>{out.description}</div>}
            {out.planUrl && <Figure title="پلان دوبعدی" url={out.planUrl} />}
            {out.renderUrl && <Figure title="رندر سه‌بعدی" url={out.renderUrl} />}
          </div>
        )}
      </div>
    </div>
  )
}

function Figure({ title, url }: { title: string; url: string }) {
  const src = url.startsWith('http') || url.startsWith('data:') ? url : `data:image/png;base64,${url}`
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700 }}>{title}</span>
        <a href={src} download={`melkjet-${title}.png`} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: 'var(--gold)', textDecoration: 'none' }}>دانلود ↓</a>
      </div>
      <img src={src} alt={title} style={{ width: '100%', borderRadius: 12, border: '1px solid var(--line)', display: 'block' }} />
    </div>
  )
}
