'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { renderFloorPlanSVG, svgDataUrl, type PlanLayout, type PlanDoor } from '@/app/lib/floorplan-svg'

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

interface Snapshot { cols: number; rows: number; rooms: ERoom[]; doors: PlanDoor[] }
interface SavedPlan { id: string; name: string; area: number; cols: number; rows: number; rooms: { name: string; type: string; x: number; y: number; w: number; h: number }[]; doors?: PlanDoor[]; updatedAt: number }

// ویرایشگر پلانِ کاملاً آفلاین — کاربر اتاق‌ها را با درگ جابه‌جا/تغییراندازه می‌کند.
// ذخیره/بارگذاری روی سرورِ خودمان (دامین داخلی) انجام می‌شود تا با اینترنت ملی هم کار کند.
export default function PlanEditor({ labels, area, initial }: { labels: string[]; area: number; initial?: { cols: number; rows: number; rooms: { name: string; type?: string; x: number; y: number; w: number; h: number }[]; doors?: PlanDoor[] } }) {
  const [cols, setCols] = useState(4)
  const [rows, setRows] = useState(4)
  const [rooms, setRooms] = useState<ERoom[]>([])
  const [doors, setDoors] = useState<PlanDoor[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [planName, setPlanName] = useState('پلان من')
  const [doorMode, setDoorMode] = useState(false)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const drag = useRef<any>(null)

  // تاریخچهٔ واگرد/بازگرد
  const [past, setPast] = useState<Snapshot[]>([])
  const [future, setFuture] = useState<Snapshot[]>([])

  // ذخیره/بارگذاری
  const [canSave, setCanSave] = useState(true)        // اگر 401 شد، پنهان می‌شود
  const [saveMsg, setSaveMsg] = useState('')
  const [savedId, setSavedId] = useState<string | null>(null)
  const [showList, setShowList] = useState(false)
  const [plans, setPlans] = useState<SavedPlan[]>([])
  const [busy, setBusy] = useState(false)
  // رندرِ ۳بعدی از روی نقشهٔ فعلی (اصلاح‌شده) — تا ۳بعدی با ۲بعدیِ تو بخوانَد
  const [render3d, setRender3d] = useState('')
  const [renderBusy, setRenderBusy] = useState(false)
  const [renderMsg, setRenderMsg] = useState('')
  const make3d = async () => {
    if (renderBusy || !rooms.length) return
    setRenderBusy(true); setRenderMsg('در حال ساختِ رندرِ ۳بعدی از روی نقشه… (تا یک دقیقه)'); setRender3d('')
    try {
      const r = await fetch('/api/ai/studio', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'render', area, layout: { cols, rows, rooms: rooms.map(rm => ({ name: rm.name, type: rm.type, x: rm.x, y: rm.y, w: rm.w, h: rm.h })) } }),
      })
      const d = await r.json().catch(() => ({}))
      if (d?.ok && d.renderUrl) { setRender3d(d.renderUrl); setRenderMsg('') }
      else setRenderMsg(d?.error || 'ساختِ رندر ناموفق بود؛ دوباره تلاش کنید.')
    } catch { setRenderMsg('اتصال به سرور برقرار نشد.') } finally { setRenderBusy(false) }
  }

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
      setDoors(Array.isArray(initial.doors) ? initial.doors : [])
      setPast([]); setFuture([]); setSavedId(null)
      return
    }
    const names = labels.filter(Boolean).slice(0, 12)
    const n = Math.max(1, names.length)
    const c = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(n))))
    const r = Math.max(2, Math.ceil(n / c))
    setCols(c); setRows(r)
    setRooms(names.map((name, i) => ({ id: rid(), name, type: typeOf(name), x: i % c, y: Math.floor(i / c), w: 1, h: 1 })))
    setDoors([]); setPast([]); setFuture([]); setSavedId(null)
  }, [labels, initial])

  const cellArea = area / (cols * rows)
  const selRoom = rooms.find(r => r.id === sel) || null

  // یک عکس از وضعیتِ فعلی را در تاریخچه ثبت می‌کند (قبل از هر تغییرِ ماندگار صدا می‌خورد).
  const snapshot = useCallback(() => {
    setPast(p => {
      const next = [...p, { cols, rows, rooms: rooms.map(r => ({ ...r })), doors: doors.map(d => ({ ...d })) }]
      return next.length > 30 ? next.slice(next.length - 30) : next
    })
    setFuture([])
  }, [cols, rows, rooms, doors])

  const undo = useCallback(() => {
    setPast(p => {
      if (!p.length) return p
      const prev = p[p.length - 1]
      setFuture(f => [...f, { cols, rows, rooms: rooms.map(r => ({ ...r })), doors: doors.map(d => ({ ...d })) }])
      setCols(prev.cols); setRows(prev.rows); setRooms(prev.rooms); setDoors(prev.doors); setSel(null)
      return p.slice(0, -1)
    })
  }, [cols, rows, rooms, doors])

  const redo = useCallback(() => {
    setFuture(f => {
      if (!f.length) return f
      const nx = f[f.length - 1]
      setPast(p => [...p, { cols, rows, rooms: rooms.map(r => ({ ...r })), doors: doors.map(d => ({ ...d })) }])
      setCols(nx.cols); setRows(nx.rows); setRooms(nx.rooms); setDoors(nx.doors); setSel(null)
      return f.slice(0, -1)
    })
  }, [cols, rows, rooms, doors])

  // کلیدهای میانبر Ctrl+Z / Ctrl+Y (و Ctrl+Shift+Z)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  // اگر کاربر واردِ سامانه نشده، GET با 401 پاسخ می‌دهد؛ آن‌گاه ذخیره/بارگذاری پنهان می‌شود.
  const refreshPlans = useCallback(async () => {
    try {
      const r = await fetch('/api/floorplan')
      if (r.status === 401) { setCanSave(false); return [] as SavedPlan[] }
      const d = await r.json().catch(() => ({}))
      const list: SavedPlan[] = Array.isArray(d.plans) ? d.plans : []
      setPlans(list); setCanSave(true)
      return list
    } catch { return [] as SavedPlan[] }
  }, [])

  useEffect(() => { refreshPlans() }, [refreshPlans])

  // درگ با گوش‌دادنِ سراسری روی window (مطمئن‌تر از pointer-capture: حتی اگر موس سریع
  // از روی اتاق خارج شود، حرکت تا رهاکردنِ کلیک ادامه دارد).
  const onDown = (e: React.PointerEvent, id: string, mode: 'move' | 'resize') => {
    if (doorMode) return
    e.preventDefault(); e.stopPropagation()
    const room = rooms.find(r => r.id === id); if (!room || !gridRef.current) return
    snapshot()
    const rect = gridRef.current.getBoundingClientRect()
    const d = { id, mode, sx: e.clientX, sy: e.clientY, ox: room.x, oy: room.y, ow: room.w, oh: room.h, cw: rect.width / cols, ch: rect.height / rows, moved: false }
    drag.current = d
    setSel(id)
    const move = (ev: PointerEvent) => {
      const dx = Math.round((ev.clientX - d.sx) / d.cw), dy = Math.round((ev.clientY - d.sy) / d.ch)
      if (dx || dy) d.moved = true
      setRooms(rs => rs.map(r => {
        if (r.id !== d.id) return r
        if (d.mode === 'move') return { ...r, x: clamp(d.ox + dx, 0, cols - r.w), y: clamp(d.oy + dy, 0, rows - r.h) }
        return { ...r, w: clamp(d.ow + dx, 1, cols - r.x), h: clamp(d.oh + dy, 1, rows - r.y) }
      }))
    }
    const up = () => {
      if (!d.moved) setPast(p => p.slice(0, -1))   // اگر حرکتی نشد، عکسِ بی‌مورد را از تاریخچه پاک کن
      drag.current = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  // افزودنِ در: روی نزدیک‌ترین لبهٔ سلولِ کلیک‌شده یک در می‌گذارد.
  const onCanvasClick = (e: React.PointerEvent) => {
    if (!doorMode || !gridRef.current) return
    const rect = gridRef.current.getBoundingClientRect()
    const cw = rect.width / cols, ch = rect.height / rows
    const lx = e.clientX - rect.left, ly = e.clientY - rect.top
    const gx = clamp(Math.floor(lx / cw), 0, cols - 1), gy = clamp(Math.floor(ly / ch), 0, rows - 1)
    const fx = lx / cw - gx, fy = ly / ch - gy // 0..1 درون سلول
    // به نزدیک‌ترین ضلع بچسبان
    const dN = fy, dS = 1 - fy, dW = fx, dE = 1 - fx
    const min = Math.min(dN, dS, dW, dE)
    const side: PlanDoor['side'] = min === dN ? 'N' : min === dS ? 'S' : min === dW ? 'W' : 'E'
    snapshot()
    setDoors(ds => {
      const exists = ds.findIndex(d => d.x === gx && d.y === gy && d.side === side)
      if (exists >= 0) return ds.filter((_, i) => i !== exists) // کلیک دوباره → حذف
      return [...ds, { x: gx, y: gy, side }]
    })
  }

  const addRoom = () => {
    const name = window.prompt('نام فضا:', 'اتاق جدید')?.trim(); if (!name) return
    snapshot()
    setRooms(rs => [...rs, { id: rid(), name, type: typeOf(name), x: 0, y: 0, w: 1, h: 1 }])
  }
  const delRoom = () => { if (sel) { snapshot(); setRooms(rs => rs.filter(r => r.id !== sel)); setSel(null) } }
  const patchSel = (p: Partial<ERoom>) => { if (sel) { snapshot(); setRooms(rs => rs.map(r => r.id === sel ? { ...r, ...p } : r)) } }
  const resizeGrid = (dc: number, dr: number) => {
    const nc = clamp(cols + dc, 2, 8), nr = clamp(rows + dr, 2, 8)
    if (nc === cols && nr === rows) return
    snapshot()
    setCols(nc); setRows(nr)
    setRooms(rs => rs.map(r => ({ ...r, x: clamp(r.x, 0, nc - 1), y: clamp(r.y, 0, nr - 1), w: clamp(r.w, 1, nc - clamp(r.x, 0, nc - 1)), h: clamp(r.h, 1, nr - clamp(r.y, 0, nr - 1)) })))
    setDoors(ds => ds.filter(d => d.x < nc && d.y < nr))
  }

  const buildLayout = (): PlanLayout => ({ cols, rows, rooms: rooms.map(r => ({ name: r.name, type: r.type, x: r.x, y: r.y, w: r.w, h: r.h })), doors })
  const title = () => planName.trim() || 'پلان'

  const downloadSVG = () => {
    const a = document.createElement('a')
    a.href = svgDataUrl(renderFloorPlanSVG(buildLayout(), area, title()))
    a.download = 'melkjet-plan.svg'; a.click()
  }

  // PNG: SVG را در یک Image بار می‌کنیم، روی canvas می‌کشیم و به PNG تبدیل می‌کنیم.
  const downloadPNG = () => {
    const svg = renderFloorPlanSVG(buildLayout(), area, title())
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 900; canvas.height = 860
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const finish = (url: string) => { const a = document.createElement('a'); a.href = url; a.download = 'melkjet-plan.png'; a.click() }
      try {
        canvas.toBlob(blob => {
          if (blob) { const u = URL.createObjectURL(blob); finish(u); setTimeout(() => URL.revokeObjectURL(u), 4000) }
          else finish(canvas.toDataURL('image/png'))
        }, 'image/png')
      } catch { finish(canvas.toDataURL('image/png')) }
    }
    img.onerror = () => setSaveMsg('خطا در ساخت PNG؛ از خروجی SVG استفاده کن.')
    img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
  }

  // ذخیره روی حساب کاربر (سرور خودمان). برای پلانِ جدید نام می‌پرسد؛ برای موجود به‌روزرسانی می‌کند.
  const savePlan = async () => {
    if (busy) return
    let name = planName.trim()
    if (!savedId) {
      const entered = window.prompt('نام پلان:', name || 'پلان من')?.trim()
      if (entered === undefined || entered === null) return
      name = entered || 'پلان من'
      setPlanName(name)
    }
    setBusy(true); setSaveMsg('')
    try {
      const r = await fetch('/api/floorplan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: savedId || undefined, name, area, cols, rows, rooms: rooms.map(r => ({ name: r.name, type: r.type, x: r.x, y: r.y, w: r.w, h: r.h })), doors }),
      })
      if (r.status === 401) { setCanSave(false); setSaveMsg('برای ذخیره باید وارد شوی.'); return }
      const d = await r.json().catch(() => ({}))
      if (d?.ok && d.plan) { setSavedId(d.plan.id); setSaveMsg('ذخیره شد ✓'); refreshPlans() }
      else setSaveMsg(d?.error || 'ذخیره نشد.')
    } catch { setSaveMsg('ذخیره نشد؛ اتصال به سرور برقرار نشد.') }
    finally { setBusy(false); setTimeout(() => setSaveMsg(''), 2500) }
  }

  const openList = async () => {
    setShowList(s => !s)
    if (!showList) await refreshPlans()
  }

  const loadPlan = (p: SavedPlan) => {
    snapshot()
    const c = clamp(p.cols, 2, 8), r = clamp(p.rows, 2, 8)
    setCols(c); setRows(r)
    setRooms((p.rooms || []).map(rm => ({ id: rid(), name: rm.name, type: rm.type || typeOf(rm.name), x: clamp(rm.x, 0, c - 1), y: clamp(rm.y, 0, r - 1), w: clamp(rm.w, 1, c - clamp(rm.x, 0, c - 1)), h: clamp(rm.h, 1, r - clamp(rm.y, 0, r - 1)) })))
    setDoors(Array.isArray(p.doors) ? p.doors.filter(d => d.x < c && d.y < r) : [])
    setPlanName(p.name || 'پلان من'); setSavedId(p.id); setSel(null); setShowList(false)
  }

  const deletePlan = async (id: string) => {
    try {
      await fetch('/api/floorplan?id=' + encodeURIComponent(id), { method: 'DELETE' })
      if (savedId === id) setSavedId(null)
      refreshPlans()
    } catch {}
  }

  const btn: React.CSSProperties = { padding: '6px 12px', borderRadius: 9, border: '1px solid var(--line2)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600 }
  const btnDis = (d: boolean): React.CSSProperties => ({ ...btn, opacity: d ? 0.4 : 1, cursor: d ? 'default' : 'pointer' })
  const grid: React.CSSProperties = { fontSize: 11, color: 'var(--muted)', fontWeight: 700 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* نام پلان */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ ...grid, whiteSpace: 'nowrap' }}>نام پلان</span>
        <input value={planName} onChange={e => setPlanName(e.target.value)} placeholder="پلان من"
          style={{ flex: 1, background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 9, padding: '7px 11px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', fontWeight: 700 }} />
      </div>

      {/* نوار ابزار */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <button onClick={addRoom} style={{ ...btn, color: 'var(--gold)', borderColor: 'var(--gold)' }}>+ فضا</button>
        <button onClick={() => { setDoorMode(v => !v); setSel(null) }} style={{ ...btn, ...(doorMode ? { background: 'var(--goldDim)', color: 'var(--gold)', borderColor: 'var(--gold)' } : {}) }}>+ در</button>
        <span style={grid}>ستون</span>
        <button onClick={() => resizeGrid(-1, 0)} style={btn}>−</button>
        <span style={grid}>{fa(cols)}</span>
        <button onClick={() => resizeGrid(1, 0)} style={btn}>+</button>
        <span style={grid}>ردیف</span>
        <button onClick={() => resizeGrid(0, -1)} style={btn}>−</button>
        <span style={grid}>{fa(rows)}</span>
        <button onClick={() => resizeGrid(0, 1)} style={btn}>+</button>
        <div style={{ width: 1, height: 22, background: 'var(--line2)' }} />
        <button onClick={undo} disabled={!past.length} style={btnDis(!past.length)} title="واگرد (Ctrl+Z)">↶ واگرد</button>
        <button onClick={redo} disabled={!future.length} style={btnDis(!future.length)} title="بازگرد (Ctrl+Y)">↷ بازگرد</button>
        <div style={{ flex: 1 }} />
        <button onClick={downloadPNG} style={{ ...btn, background: 'var(--goldDim)', color: 'var(--gold)', borderColor: 'var(--gold)' }}>PNG ↓</button>
        <button onClick={downloadSVG} style={btn}>SVG ↓</button>
      </div>

      {/* ذخیره / بارگذاری (در صورت ورود به حساب) */}
      {canSave && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <button onClick={savePlan} disabled={busy} style={{ ...btnDis(busy), color: 'var(--gold)', borderColor: 'var(--gold)' }}>💾 ذخیره</button>
          <button onClick={openList} style={btn}>📂 پلان‌های من</button>
          <button onClick={make3d} disabled={renderBusy || !rooms.length} style={{ ...btnDis(renderBusy || !rooms.length), background: 'rgba(212,175,55,.10)', color: 'var(--gold)', borderColor: 'var(--gold)', fontWeight: 700 }}>{renderBusy ? '⏳ رندر…' : '🎨 رندرِ ۳بعدی از این نقشه'}</button>
          {saveMsg && <span style={{ fontSize: 11.5, color: saveMsg.includes('✓') ? '#5fd98a' : 'var(--muted)' }}>{saveMsg}</span>}
        </div>
      )}

      {/* فهرست پلان‌های ذخیره‌شده */}
      {canSave && showList && (
        <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {plans.length === 0
            ? <div style={{ fontSize: 11.5, color: 'var(--faint)', textAlign: 'center', padding: '6px 0' }}>هنوز پلانی ذخیره نکرده‌ای.</div>
            : plans.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 8, padding: '6px 10px' }}>
                <button onClick={() => loadPlan(p)} style={{ flex: 1, textAlign: 'right', background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700 }}>{p.name}</button>
                <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>{fa(p.area)} متر</span>
                <button onClick={() => deletePlan(p.id)} title="حذف" style={{ background: 'transparent', border: 'none', color: '#e7674a', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}>✕</button>
              </div>
            ))}
        </div>
      )}

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
        <div style={{ fontSize: 11.5, color: doorMode ? 'var(--gold)' : 'var(--faint)', textAlign: 'center' }}>
          {doorMode ? 'حالت در: روی لبهٔ هر سلول بزن تا در گذاشته شود؛ دوباره بزن تا حذف شود.' : 'روی یک فضا بزن تا انتخاب شود؛ با درگ جابه‌جا کن و از گوشهٔ پایین تغییر اندازه بده.'}
        </div>
      )}

      {/* بوم نقشه */}
      <div
        ref={gridRef}
        onPointerDown={e => { if (doorMode) { onCanvasClick(e) } else { setSel(null) } }}
        style={{
          direction: 'ltr', position: 'relative', width: '100%', aspectRatio: `${cols} / ${rows}`,
          background: 'var(--surface)', borderRadius: 12, border: '2px solid var(--line2)',
          backgroundImage: `linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)`,
          backgroundSize: `${100 / cols}% ${100 / rows}%`, touchAction: 'none', overflow: 'hidden',
          cursor: doorMode ? 'crosshair' : 'default',
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
              cursor: doorMode ? 'crosshair' : 'move', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              boxSizing: 'border-box', userSelect: 'none', overflow: 'hidden', touchAction: 'none',
            }}
          >
            <span style={{ direction: 'rtl', fontSize: 13, fontWeight: 800, color: '#181818', textAlign: 'center', padding: '0 4px' }}>{r.name}</span>
            <span style={{ direction: 'rtl', fontSize: 11, color: '#555' }}>{fa(Math.max(1, cellArea * r.w * r.h))} متر</span>
            {/* دستگیرهٔ تغییر اندازه (گوشهٔ پایین-راست) */}
            {!doorMode && (
              <span
                onPointerDown={e => onDown(e, r.id, 'resize')}
                style={{ position: 'absolute', right: 0, bottom: 0, width: 16, height: 16, background: '#d4af37', cursor: 'nwse-resize', borderTopLeftRadius: 4, touchAction: 'none' }}
              />
            )}
          </div>
        ))}
        {/* درها روی لبهٔ سلول‌ها */}
        {doors.map((d, i) => {
          const cw = 100 / cols, ch = 100 / rows
          const baseL = d.x * cw, baseT = d.y * ch
          let style: React.CSSProperties
          if (d.side === 'N') style = { left: `${baseL + cw * 0.25}%`, top: `${baseT}%`, width: `${cw * 0.5}%`, height: 0 }
          else if (d.side === 'S') style = { left: `${baseL + cw * 0.25}%`, top: `${baseT + ch}%`, width: `${cw * 0.5}%`, height: 0 }
          else if (d.side === 'W') style = { left: `${baseL}%`, top: `${baseT + ch * 0.25}%`, width: 0, height: `${ch * 0.5}%` }
          else style = { left: `${baseL + cw}%`, top: `${baseT + ch * 0.25}%`, width: 0, height: `${ch * 0.5}%` }
          const horiz = d.side === 'N' || d.side === 'S'
          return (
            <div key={i} onPointerDown={e => { if (doorMode) { e.stopPropagation(); snapshot(); setDoors(ds => ds.filter((_, j) => j !== i)) } }}
              style={{
                position: 'absolute', ...style, boxSizing: 'border-box',
                borderTop: horiz ? '4px solid #fff' : 'none', borderLeft: !horiz ? '4px solid #fff' : 'none',
                outline: '2px dashed #b9892b', pointerEvents: doorMode ? 'auto' : 'none', cursor: doorMode ? 'pointer' : 'default', zIndex: 5,
              }} />
          )
        })}
      </div>

      {/* راهنمای رنگ فضاها */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {TYPE_LABELS.map(([v, l]) => (
          <span key={v} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted)' }}>
            <span style={{ width: 13, height: 13, borderRadius: 3, background: FILL[v] || FILL.other, border: '1px solid #14141a', display: 'inline-block' }} />{l}
          </span>
        ))}
      </div>

      {/* رندرِ ۳بعدیِ ساخته‌شده از روی همین نقشه */}
      {(renderBusy || render3d || renderMsg) && (
        <div style={{ border: '1px solid var(--line2)', borderRadius: 14, padding: 14, background: 'var(--bg2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontWeight: 800, fontSize: 13.5 }}>رندرِ ۳بعدی از روی این نقشه</span>
            {render3d && <a href={render3d} download="melkjet-3d.png" target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: 'var(--gold)', textDecoration: 'none' }}>دانلود ↓</a>}
          </div>
          {renderBusy && <div style={{ fontSize: 12, color: 'var(--muted)' }}>⏳ {renderMsg}</div>}
          {!renderBusy && renderMsg && <div style={{ fontSize: 12, color: '#e7674a' }}>✕ {renderMsg}</div>}
          {render3d && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={render3d} alt="رندر سه‌بعدی" style={{ width: '100%', borderRadius: 12, border: '1px solid var(--line)', display: 'block' }} />
          )}
          <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 8, lineHeight: 1.7 }}>نکته: نقشهٔ ۲بعدی را با درگ اصلاح کن، بعد این دکمه را بزن تا رندرِ ۳بعدی با چیدمانِ تو هماهنگ ساخته شود.</div>
        </div>
      )}

      <div style={{ fontSize: 11, color: 'var(--faint)', textAlign: 'center', lineHeight: 1.7 }}>
        نقشه کاملاً آفلاین و روی دستگاه خودت ساخته می‌شود؛ رندرِ ۳بعدی نیاز به اینترنت + مدلِ تصویر دارد. متراژ کل: {fa(area)} متر مربع.
      </div>
    </div>
  )
}
