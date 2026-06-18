'use client'
import { useRef, useState } from 'react'

// دکمهٔ آپلود تصویر قابل‌استفادهٔ مجدد (با پیش‌نمایش) — به‌جای فیلد لینک.
export default function ImageUpload({ value, onChange, label, height = 110 }: { value?: string; onChange: (url: string) => void; label?: string; height?: number }) {
  const ref = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const up = async (f: File | null) => {
    if (!f) return
    setBusy(true); setErr('')
    try {
      const fd = new FormData(); fd.append('file', f)
      const r = await fetch('/api/media', { method: 'POST', body: fd })
      const d = await r.json()
      if (d.ok) onChange(d.url); else setErr(d.error || 'خطا در آپلود')
    } catch { setErr('خطا در آپلود') } finally { setBusy(false) }
  }
  const lab: React.CSSProperties = { fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginBottom: 6, display: 'block' }
  const btn: React.CSSProperties = { padding: '8px 14px', borderRadius: 9, border: '1px solid var(--gold)', background: 'transparent', color: 'var(--gold)', fontWeight: 600, fontSize: 12.5, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit', opacity: busy ? .6 : 1 }
  return (
    <div>
      {label && <label style={lab}>{label}</label>}
      {value
        ? <img src={value} alt="" style={{ width: '100%', height, objectFit: 'cover', borderRadius: 10, display: 'block', marginBottom: 8, border: '1px solid var(--line2)' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
        : <div onClick={() => !busy && ref.current?.click()} style={{ height, borderRadius: 10, border: '1px dashed var(--line2)', background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', cursor: 'pointer', marginBottom: 8, fontSize: 13 }}>برای آپلود کلیک کن</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => ref.current?.click()} disabled={busy} style={btn}>{busy ? 'در حال آپلود…' : (value ? '⬆ تغییر تصویر' : '⬆ آپلود تصویر')}</button>
        {value && <button type="button" onClick={() => onChange('')} style={{ ...btn, border: '1px solid rgba(231,103,74,.4)', color: '#e7674a' }}>حذف</button>}
      </div>
      {err && <div style={{ fontSize: 11.5, color: '#e7674a', marginTop: 5 }}>{err}</div>}
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { up(e.target.files?.[0] || null); e.target.value = '' }} />
    </div>
  )
}
