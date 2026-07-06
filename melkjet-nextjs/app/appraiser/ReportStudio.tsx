'use client'
import { useRef, useState } from 'react'
import { SectionCard, btnGold, inputStyle, money, fa } from '@/app/components/prodesk/ProDeskKit'

function SignaturePad({ onChange, label }: { onChange: (d: string) => void; label: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)
  const pos = (e: React.PointerEvent) => { const c = ref.current!; const r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) } }
  const start = (e: React.PointerEvent) => { drawing.current = true; const ctx = ref.current!.getContext('2d')!; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y) }
  const move = (e: React.PointerEvent) => { if (!drawing.current) return; const ctx = ref.current!.getContext('2d')!; const p = pos(e); ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#111'; ctx.lineTo(p.x, p.y); ctx.stroke() }
  const end = () => { if (!drawing.current) return; drawing.current = false; onChange(ref.current!.toDataURL('image/png')) }
  const clear = () => { const c = ref.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); onChange('') }
  return (
    <div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 5 }}>{label}</div>
      <canvas ref={ref} width={360} height={100} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end}
        style={{ width: '100%', maxWidth: 320, height: 100, background: '#fff', border: '1px dashed var(--line2)', borderRadius: 8, touchAction: 'none', cursor: 'crosshair' }} />
      <button onClick={clear} style={{ marginTop: 4, fontSize: 11, padding: '3px 10px', borderRadius: 7, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit' }}>پاک‌کردن</button>
    </div>
  )
}

interface Comp { addr: string; area: string; price: string }

export default function ReportStudio({ post }: { post: (p: any) => Promise<any> }) {
  const [f, setF] = useState({ owner: '', addr: '', area: '', age: '', floor: '', ptype: 'آپارتمان', date: '' })
  const [comps, setComps] = useState<Comp[]>([{ addr: '', area: '', price: '' }, { addr: '', area: '', price: '' }, { addr: '', area: '', price: '' }])
  const [sig, setSig] = useState('')
  const [saved, setSaved] = useState('')
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))
  const setComp = (i: number, k: keyof Comp, v: string) => setComps(cs => cs.map((c, ci) => ci === i ? { ...c, [k]: v } : c))

  // تحلیلِ بازار: میانگینِ قیمتِ هر متر از مقایسه‌ای‌ها → ارزشِ برآوردیِ ملکِ موضوع.
  const ppm = comps.map(c => { const a = Number(c.area) || 0, p = Number(c.price) || 0; return a > 0 && p > 0 ? p / a : 0 }).filter(x => x > 0)
  const avgPpm = ppm.length ? Math.round(ppm.reduce((s, v) => s + v, 0) / ppm.length) : 0
  const subjArea = Number(f.area) || 0
  const estimate = avgPpm * subjArea

  const reportHtml = () => `
    <h2 style="text-align:center;margin:0 0 4px">گزارشِ کارشناسیِ ارزیابیِ ملک</h2>
    <div style="text-align:center;color:#666;font-size:12px;margin-bottom:16px">تاریخ: ${f.date || '…'}</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <tr><td style="padding:6px;border:1px solid #ddd;width:35%"><b>مالک</b></td><td style="padding:6px;border:1px solid #ddd">${f.owner || '…'}</td></tr>
      <tr><td style="padding:6px;border:1px solid #ddd"><b>نشانی</b></td><td style="padding:6px;border:1px solid #ddd">${f.addr || '…'}</td></tr>
      <tr><td style="padding:6px;border:1px solid #ddd"><b>نوع / متراژ / سن / طبقه</b></td><td style="padding:6px;border:1px solid #ddd">${f.ptype} · ${f.area || '…'} م² · ${f.age || '…'} سال · طبقه ${f.floor || '…'}</td></tr>
    </table>
    <h3 style="margin:18px 0 6px">تحلیلِ بازار (املاکِ مشابه)</h3>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <tr style="background:#f4f4f4"><th style="padding:6px;border:1px solid #ddd">نشانی</th><th style="padding:6px;border:1px solid #ddd">متراژ</th><th style="padding:6px;border:1px solid #ddd">قیمت کل</th><th style="padding:6px;border:1px solid #ddd">قیمت هر متر</th></tr>
      ${comps.map(c => { const a = Number(c.area) || 0, p = Number(c.price) || 0; const pm = a > 0 ? Math.round(p / a) : 0; return `<tr><td style="padding:6px;border:1px solid #ddd">${c.addr || '—'}</td><td style="padding:6px;border:1px solid #ddd">${c.area || '—'}</td><td style="padding:6px;border:1px solid #ddd">${p ? p.toLocaleString('fa-IR') : '—'}</td><td style="padding:6px;border:1px solid #ddd">${pm ? pm.toLocaleString('fa-IR') : '—'}</td></tr>` }).join('')}
    </table>
    <div style="margin-top:14px;font-size:14px"><b>میانگینِ قیمتِ هر متر:</b> ${avgPpm.toLocaleString('fa-IR')} تومان</div>
    <div style="margin-top:6px;font-size:16px;color:#111"><b>ارزشِ برآوردیِ ملک:</b> <span style="color:#0a7">${estimate.toLocaleString('fa-IR')} تومان</span></div>
    <p style="margin-top:14px;font-size:12px;color:#555">این ارزیابی بر اساسِ روشِ مقایسه‌ایِ املاکِ مشابهِ منطقه انجام شده و جنبهٔ کارشناسی دارد.</p>
  `

  const printDoc = () => {
    const w = window.open('', '_blank', 'width=800,height=1000'); if (!w) { alert('اجازهٔ چاپ داده نشد.'); return }
    w.document.write(`<!doctype html><html dir="rtl" lang="fa"><head><meta charset="utf-8"><title>گزارشِ کارشناسی</title>
      <style>@page{margin:2cm} body{font-family:Vazirmatn,Tahoma,sans-serif;line-height:1.9;color:#111;font-size:14px}</style></head>
      <body>${reportHtml()}
      <div style="margin-top:40px;text-align:left">
        <div style="font-size:12px;color:#555">کارشناسِ رسمی</div>${sig ? `<img src="${sig}" style="height:60px"/>` : '<div style="height:60px"></div>'}<div style="border-top:1px solid #333;width:200px;margin-inline-start:auto"></div>
      </div>
      <div style="margin-top:30px;font-size:11px;color:#888;border-top:1px dashed #ccc;padding-top:8px">تولیدشده با سامانهٔ ملک‌جت.</div>
      </body></html>`)
    w.document.close(); w.focus(); setTimeout(() => w.print(), 350)
  }

  const save = async () => {
    const ok = await post({ action: 'addRecord', title: `کارشناسیِ ${f.owner || '؟'} — ${f.addr || ''}`.slice(0, 90), kind: 'گزارش', subtitle: `${estimate.toLocaleString('fa-IR')} تومان`, amount: estimate || undefined, status: 'active', meta: { report: true, values: f, comps, estimate, sig } })
    if (ok) setSaved('✓ گزارش در «گزارش‌ها» ذخیره شد.'); setTimeout(() => setSaved(''), 4000)
  }

  return (
    <SectionCard title="📄 گزارشِ کارشناسی (ارزیابی + تحلیلِ بازار + PDF)">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 14 }}>
        <div><label style={{ fontSize: 11.5, color: 'var(--muted)' }}>مالک</label><input value={f.owner} onChange={e => set('owner', e.target.value)} style={inputStyle} /></div>
        <div style={{ gridColumn: '1 / -1' }}><label style={{ fontSize: 11.5, color: 'var(--muted)' }}>نشانی ملک</label><input value={f.addr} onChange={e => set('addr', e.target.value)} style={inputStyle} /></div>
        <div><label style={{ fontSize: 11.5, color: 'var(--muted)' }}>نوع</label><select value={f.ptype} onChange={e => set('ptype', e.target.value)} style={inputStyle}>{['آپارتمان', 'ویلا/خانه', 'زمین', 'تجاری', 'اداری'].map(t => <option key={t}>{t}</option>)}</select></div>
        <div><label style={{ fontSize: 11.5, color: 'var(--muted)' }}>متراژ (م²)</label><input value={f.area} onChange={e => set('area', e.target.value.replace(/\D/g, ''))} style={{ ...inputStyle, direction: 'ltr', textAlign: 'left' }} /></div>
        <div><label style={{ fontSize: 11.5, color: 'var(--muted)' }}>سن بنا</label><input value={f.age} onChange={e => set('age', e.target.value.replace(/\D/g, ''))} style={{ ...inputStyle, direction: 'ltr', textAlign: 'left' }} /></div>
        <div><label style={{ fontSize: 11.5, color: 'var(--muted)' }}>طبقه</label><input value={f.floor} onChange={e => set('floor', e.target.value)} style={inputStyle} /></div>
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>املاکِ مشابه (تحلیلِ بازار)</div>
      {comps.map((c, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.4fr', gap: 8, marginBottom: 8 }}>
          <input value={c.addr} onChange={e => setComp(i, 'addr', e.target.value)} placeholder={`مشابه ${fa(i + 1)} — نشانی`} style={inputStyle} />
          <input value={c.area} onChange={e => setComp(i, 'area', e.target.value.replace(/\D/g, ''))} placeholder="متراژ" style={{ ...inputStyle, direction: 'ltr', textAlign: 'left' }} />
          <input value={c.price} onChange={e => setComp(i, 'price', e.target.value.replace(/\D/g, ''))} placeholder="قیمت کل (تومان)" style={{ ...inputStyle, direction: 'ltr', textAlign: 'left' }} />
        </div>
      ))}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '12px 0' }}>
        <div style={{ flex: '1 1 160px', background: 'var(--bg2)', borderRadius: 12, padding: 14 }}><div style={{ fontSize: 11.5, color: 'var(--muted)' }}>میانگینِ قیمتِ هر متر</div><div style={{ fontSize: 17, fontWeight: 800, marginTop: 4 }}>{money(avgPpm)}</div></div>
        <div style={{ flex: '1 1 160px', background: 'var(--bg2)', borderRadius: 12, padding: 14 }}><div style={{ fontSize: 11.5, color: 'var(--muted)' }}>ارزشِ برآوردی</div><div style={{ fontSize: 17, fontWeight: 800, color: '#34d399', marginTop: 4 }}>{money(estimate)}</div></div>
        <div style={{ flex: '1 1 200px' }}><SignaturePad label="امضای کارشناس" onChange={setSig} /></div>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
        {saved && <span style={{ fontSize: 12.5, color: '#34d399', marginInlineEnd: 'auto' }}>{saved}</span>}
        <button onClick={save} style={{ padding: '9px 18px', borderRadius: 10, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>ذخیره در گزارش‌ها</button>
        <button onClick={printDoc} style={{ ...btnGold, padding: '9px 22px' }}>چاپ / PDF ⬇</button>
      </div>
    </SectionCard>
  )
}
