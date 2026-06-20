'use client'
import { useState, useRef, useEffect } from 'react'
import { renderFloorPlanSVG, svgDataUrl, type PlanLayout } from '@/app/lib/floorplan-svg'

export interface ERoom { id: string; name: string; type: string; x: number; y: number; w: number; h: number }

const TYPE_LABELS: [string, string][] = [
  ['living', 'نشیمن'], ['kitchen', 'آشپزخانه'], ['bedroom', 'اتاق خواب'], ['bathroom', 'سرویس بهداشتی'],
  ['dining', 'ناهارخوری'], ['hall', 'هال/راهرو'], ['balcony', 'بالکن/تراس'], ['other', 'سایر'],
]
const FILL: Record<string, string> = { kitchen: '#fbe9cf', living: '#e6f0ff', bedroom: '#e8f8ec', bathroom: '#ddf3fb', hall: '#efeff2', balcony: '#eaf7e1', dining: '#fdeede', other: '#f3f3f5' }
const fa = (n: number) => Math.round(n).toLocaleString('fa-IR')
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const rid = () => Math.random().toString(36).slice(2, 8)

function typeOf(label: string) {
  const s = label || ''
  if (/آشپز/.test(s)) return 'kitchen'
  if (/نشیمن|پذیرا|نشین/.test(s)) return 'living'
  if (/ناهار/.test(s)) return 'dining'
  if (/خواب|اتاق|مستر/.test(s)) return 'bedroom'
  if (/سرویس|حمام|بهداشت|توالت|دستشو/.test(s)) return 'bathroom'
  if (/تراس|بالکن|حیاط/.test(s)) return 'balcony'
  if (/راهرو|ورودی|هال|لابی/.test(s)) return 'hall'
  return 'other'
}

// ویرایشگر پلانِ کاملاً آفلاین — کاربر اتاق‌ها را با درگ جابه‌جا/تغییراندازه می‌کند.
export default function PlanEditor({ labels, area, initial }: { labels: string[]; area: number; initial?: { cols: number; rows: number; rooms: { name: string; type?: string; x: number; y: number; w: number; h: number }[] } }) {
  const [cols, setCols] = useState(4)
  const [rows, setRows] = useState(4)
  const [rooms, setRooms] = useState<ERoom[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const drag = useRef<any>(null)

  useEffect(() => {
    // اگر پیش‌نویسِ AI آمده، از همان شروع کن؛ وگرنه از روی برچسب فضاها بساز.
    if (initial && Array.isArray(initial.rooms) && initial.rooms.length) {
      const c = clamp(initial.cols || 4, 2, 8), r = clamp(initial.rows || 4, 2, 8)
      setCols(c); setRows(r)
      setRooms(initial.rooms.map(rm => ({
        id: rid(), name: rm.name, type: rm.type || typeOf(rm.name),
        x: clamp(rm.x, 0, c - 1), y: clamp(rm.y, 0, r - 1),
        w: clamp(rm.w, 1, c - clamp(rm.x, 0, c - 1)), h: clamp(rm.h, 1, r - clamp(rm.y, 0, r - 1)),
      })))
      return
    }
    const names = labels.filter(Boolean).slice(0, 12)
    const n = Math.max(1, names.length)
    const c = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(n))))
    const r = Math.max(2, Math.ceil(n / c))
    setCols(c); setRows(r)
    setRooms(names.map((name, i) => ({ id: rid(), name, type: typeOf(name), x: i % c, y: Math.floor(i / c), w: 1, h: 1 })))
  }, [labels, initial])

  const cellArea = area / (cols * rows)
  const selRoom = rooms.find(r => r.id === sel) || null

  const onDown = (e: React.PointerEvent, id: string, mode: 'move' | 'resize') => {
    e.preventDefault(); e.stopPropagation()
    const room = rooms.find(r => r.id === id); if (!room || !gridRef.current) return
    const rect = gridRef.current.getBoundingClientRect()
    drag.current = { id, mode, sx: e.clientX, sy: e.clientY, ox: room.x, oy: room.y, ow: room.w, oh: room.h, cw: rect.width / cols, ch: rect.height / rows }
    setSel(id)
    try { gridRef.current.setPointerCapture(e.pointerId) } catch {}
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return
    const dx = Math.round((e.clientX - d.sx) / d.cw), dy = Math.round((e.clientY - d.sy) / d.ch)
    setRooms(rs => rs.map(r => {
      if (r.id !== d.id) return r
      if (d.mode === 'move') return { ...r, x: clamp(d.ox + dx, 0, cols - r.w), y: clamp(d.oy + dy, 0, rows - r.h) }
      return { ...r, w: clamp(d.ow + dx, 1, cols - r.x), h: clamp(d.oh + dy, 1, rows - r.y) }
    }))
  }
  const onUp = () => { drag.current = null }

  const addRoom = () => {
    const name = window.prompt('نام فضا:', 'اتاق جدید')?.trim(); if (!name) return
    setRooms(rs => [...rs, { id: rid(), name, type: typeOf(name), x: 0, y: 0, w: 1, h: 1 }])
  }
  const delRoom = () => { if (sel) { setRooms(rs => rs.filter(r => r.id !== sel)); setSel(null) } }
  const patchSel = (p: Partial<ERoom>) => { if (sel) setRooms(rs => rs.map(r => r.id === sel ? { ...r, ...p } : r)) }
  const resizeGrid = (dc: number, dr: number) => {
    const nc = clamp(cols + dc, 2, 8), nr = clamp(rows + dr, 2, 8)
    setCols(nc); setRows(nr)
    setRooms(rs => rs.map(r => ({ ...r, x: clamp(r.x, 0, nc - 1), y: clamp(r.y, 0, nr - 1), w: clamp(r.w, 1, nc - clamp(r.x, 0, nc - 1)), h: clamp(r.h, 1, nr - clamp(r.y, 0, nr - 1)) })))
  }

  const download = () => {
    const layout: PlanLayout = { cols, rows, rooms: rooms.map(r => ({ name: r.name, type: r.type, x: r.x, y: r.y, w: r.w, h: r.h })) }
    const a = document.createElement('a')
    a.href = svgDataUrl(renderFloorPlanSVG(layout, area, 'پلان'))
    a.download = 'melkjet-plan.svg'; a.click()
  }

  const btn: React.CSSProperties = { padding: '6px 12px', borderRadius: 9, border: '1px solid var(--line2)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600 }
  const grid: React.CSSProperties = { fontSize: 11, color: 'var(--muted)', fontWeight: 700 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* نوار ابزار */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <button onClick={addRoom} style={{ ...btn, color: 'var(--gold)', borderColor: 'var(--gold)' }}>+ فضا</button>
        <span style={grid}>ستون</span>
        <button onClick={() => resizeGrid(-1, 0)} style={btn}>−</button>
        <span style={grid}>{fa(cols)}</span>
        <button onClick={() => resizeGrid(1, 0)} style={btn}>+</button>
        <span style={grid}>ردیف</span>
        <button onClick={() => resizeGrid(0, -1)} style={btn}>−</button>
        <span style={grid}>{fa(rows)}</span>
        <button onClick={() => resizeGrid(0, 1)} style={btn}>+</button>
        <div style={{ flex: 1 }} />
        <button onClick={download} style={{ ...btn, background: 'var(--goldDim)', color: 'var(--gold)', borderColor: 'var(--gold)' }}>دانلود ↓</button>
      </div>

      {/* ویرایش فضای انتخاب‌شده */}
      {selRoom ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, background: 'var(--bg2)', borderRadius: 10, padding: '8px 10px' }}>
          <input value={selRoom.name} onChange={e => patchSel({ name: e.target.value })} style={{ ...btn, minWidth: 120, cursor: 'text' }} />
          <select value={selRoom.type} onChange={e => patchSel({ type: e.target.value })} style={{ ...btn, cursor: 'pointer' }}>
            {TYPE_LABELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <span style={grid}>{fa(Math.max(1, cellArea * selRoom.w * selRoom.h))} متر</span>
          <div style={{ flex: 1 }} />
          <button onClick={delRoom} style={{ ...btn, color: '#e7674a', borderColor: 'rgba(231,103,74,.4)' }}>حذف فضا</button>
        </div>
      ) : (
        <div style={{ fontSize: 11.5, color: 'var(--faint)', textAlign: 'center' }}>روی یک فضا بزن تا انتخاب شود؛ با درگ جابه‌جا کن و از گوشهٔ پایین تغییر اندازه بده.</div>
      )}

      {/* بوم نقشه */}
      <div
        ref={gridRef}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerDown={() => setSel(null)}
        style={{
          direction: 'ltr', position: 'relative', width: '100%', aspectRatio: `${cols} / ${rows}`,
          background: 'var(--surface)', borderRadius: 12, border: '2px solid var(--line2)',
          backgroundImage: `linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)`,
          backgroundSize: `${100 / cols}% ${100 / rows}%`, touchAction: 'none', overflow: 'hidden',
        }}
      >
        {rooms.map(r => (
          <div
            key={r.id}
            onPointerDown={e => onDown(e, r.id, 'move')}
            style={{
              position: 'absolute', left: `${r.x / cols * 100}%`, top: `${r.y / rows * 100}%`,
              width: `${r.w / cols * 100}%`, height: `${r.h / rows * 100}%`,
              background: FILL[r.type] || FILL.other, border: `2px solid ${sel === r.id ? '#d4af37' : '#14141a'}`,
              boxShadow: sel === r.id ? '0 0 0 2px rgba(212,175,55,.4)' : 'none',
              cursor: 'move', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              boxSizing: 'border-box', userSelect: 'none', overflow: 'hidden',
            }}
          >
            <span style={{ direction: 'rtl', fontSize: 13, fontWeight: 800, color: '#181818', textAlign: 'center', padding: '0 4px' }}>{r.name}</span>
            <span style={{ direction: 'rtl', fontSize: 11, color: '#555' }}>{fa(Math.max(1, cellArea * r.w * r.h))} متر</span>
            {/* دستگیرهٔ تغییر اندازه (گوشهٔ پایین-راست) */}
            <span
              onPointerDown={e => onDown(e, r.id, 'resize')}
              style={{ position: 'absolute', right: 0, bottom: 0, width: 16, height: 16, background: '#d4af37', cursor: 'nwse-resize', borderTopLeftRadius: 4 }}
            />
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: 'var(--faint)', textAlign: 'center', lineHeight: 1.7 }}>
        نقشه کاملاً آفلاین و روی دستگاه خودت ساخته می‌شود — بدون نیاز به اینترنت یا هوش مصنوعی. متراژ کل: {fa(area)} متر مربع.
      </div>
    </div>
  )
}
