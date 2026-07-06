'use client'
import { useRef, useState } from 'react'
import { CONTRACT_TEMPLATES, contractTemplateById } from '@/app/lib/contract-templates'
import { SectionCard, btnGold, inputStyle } from '@/app/components/prodesk/ProDeskKit'

// امضای دیجیتالِ ساده روی canvas (بدونِ وابستگی).
function SignaturePad({ onChange, label }: { onChange: (dataUrl: string) => void; label: string }) {
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
      <canvas ref={ref} width={360} height={110} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end}
        style={{ width: '100%', maxWidth: 360, height: 110, background: '#fff', border: '1px dashed var(--line2)', borderRadius: 8, touchAction: 'none', cursor: 'crosshair' }} />
      <button onClick={clear} style={{ marginTop: 4, fontSize: 11, padding: '3px 10px', borderRadius: 7, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit' }}>پاک‌کردنِ امضا</button>
    </div>
  )
}

export default function ContractStudio({ post }: { post: (p: any) => Promise<any> }) {
  const [tid, setTid] = useState(CONTRACT_TEMPLATES[0].id)
  const tpl = contractTemplateById(tid)!
  const [values, setValues] = useState<Record<string, string>>({})
  const [sigSeller, setSigSeller] = useState('')
  const [sigBuyer, setSigBuyer] = useState('')
  const [saved, setSaved] = useState('')
  const set = (k: string, v: string) => setValues(p => ({ ...p, [k]: v }))
  const bodyHtml = tpl.build(values)

  const printDoc = () => {
    const w = window.open('', '_blank', 'width=800,height=1000')
    if (!w) { alert('اجازهٔ بازکردنِ پنجرهٔ چاپ داده نشد.'); return }
    const sig = (label: string, name: string, img: string) =>
      `<div style="text-align:center;width:45%"><div style="font-size:12px;color:#555">${label}</div>${img ? `<img src="${img}" style="height:60px;margin:6px 0"/>` : '<div style="height:60px"></div>'}<div style="border-top:1px solid #333;padding-top:4px;font-size:12px">${name || '…'}</div></div>`
    w.document.write(`<!doctype html><html dir="rtl" lang="fa"><head><meta charset="utf-8"><title>${tpl.name}</title>
      <style>@page{margin:2cm} body{font-family:Vazirmatn,Tahoma,sans-serif;line-height:2;color:#111;font-size:14px} h2{font-size:20px} .foot{margin-top:40px;font-size:11px;color:#888;border-top:1px dashed #ccc;padding-top:8px}</style>
      </head><body>${bodyHtml}
      <div style="display:flex;justify-content:space-between;margin-top:50px">${sig('امضای فروشنده/موجر', values.seller || '', sigSeller)}${sig('امضای خریدار/مستأجر', values.buyer || '', sigBuyer)}</div>
      <div class="foot">این سند با سامانهٔ ملک‌جت تولید شده است. تنظیمِ نهاییِ حقوقی و ثبتِ رسمی بر عهدهٔ طرفین و مراجعِ ذی‌صلاح است.</div>
      </body></html>`)
    w.document.close(); w.focus(); setTimeout(() => w.print(), 350)
  }

  const save = async () => {
    const title = `${tpl.name} — ${values.seller || '؟'} / ${values.buyer || '؟'}`
    const ok = await post({ action: 'addRecord', title, kind: 'قرارداد', subtitle: tpl.name, status: 'active', meta: { contract: true, templateId: tid, values, sigSeller, sigBuyer, date: values.date } })
    if (ok) setSaved('✓ قرارداد در پرونده‌ها ذخیره شد.')
    setTimeout(() => setSaved(''), 4000)
  }

  return (
    <SectionCard title="📝 قراردادساز (تولید + امضا + PDF)">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {CONTRACT_TEMPLATES.map(t => (
          <button key={t.id} onClick={() => { setTid(t.id); setValues({}) }} style={{ padding: '6px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid ' + (tid === t.id ? 'var(--gold)' : 'var(--line2)'), background: tid === t.id ? 'var(--goldDim)' : 'transparent', color: tid === t.id ? 'var(--gold)' : 'var(--muted)' }}>{t.name}</button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10, marginBottom: 16 }}>
        {tpl.fields.map(f => (
          <div key={f.key} style={f.type === 'textarea' ? { gridColumn: '1 / -1' } : undefined}>
            <label style={{ fontSize: 11.5, color: 'var(--muted)' }}>{f.label}</label>
            {f.type === 'textarea'
              ? <textarea value={values[f.key] || ''} onChange={e => set(f.key, e.target.value)} style={{ ...inputStyle, minHeight: 54, resize: 'vertical' }} />
              : <input value={values[f.key] || ''} onChange={e => set(f.key, e.target.value)} style={{ ...inputStyle, ...(f.type === 'number' ? { direction: 'ltr', textAlign: 'left' } : {}) }} />}
          </div>
        ))}
      </div>
      {/* امضاها */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, marginBottom: 16 }}>
        <SignaturePad label="امضای فروشنده/موجر" onChange={setSigSeller} />
        <SignaturePad label="امضای خریدار/مستأجر" onChange={setSigBuyer} />
      </div>
      {/* پیش‌نمایش */}
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>پیش‌نمایش</div>
      <div style={{ background: '#fff', color: '#111', borderRadius: 10, padding: 20, fontSize: 13.5, lineHeight: 2, maxHeight: 340, overflow: 'auto', border: '1px solid var(--line)' }} dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {saved && <span style={{ fontSize: 12.5, color: '#34d399', marginInlineEnd: 'auto' }}>{saved}</span>}
        <button onClick={save} style={{ padding: '9px 18px', borderRadius: 10, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>ذخیره در پرونده‌ها</button>
        <button onClick={printDoc} style={{ ...btnGold, padding: '9px 22px' }}>چاپ / PDF ⬇</button>
      </div>
    </SectionCard>
  )
}
