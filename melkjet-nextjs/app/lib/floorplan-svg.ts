// رسم قطعی (deterministic) نقشهٔ کف و نمای ایزومتریک از روی چیدمانِ ساخت‌یافته‌ای
// که مدل بینایی از روی عکس‌ها استخراج می‌کند. خروجی SVG است (به‌صورت data URL نمایش داده می‌شود).

export interface PlanRoom { name: string; type?: string; x: number; y: number; w: number; h: number }
export interface PlanDoor { x: number; y: number; side: 'N' | 'S' | 'E' | 'W' }
export interface PlanLayout { cols: number; rows: number; rooms: PlanRoom[]; doors?: PlanDoor[]; summaryFa?: string }

const clampi = (n: any, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)))
const fa = (s: any) => String(s).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d])
const esc = (s: any) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const TYPE_FILL: Record<string, string> = {
  kitchen: '#fbe9cf', living: '#e6f0ff', bedroom: '#e8f8ec', bathroom: '#ddf3fb',
  hall: '#efeff2', balcony: '#eaf7e1', office: '#efe9ff', dining: '#fdeede', other: '#f3f3f5',
}
const FONT = 'Tahoma, Arial, sans-serif'

// تبدیل آرایهٔ اتاق‌ها به ساختار معتبر و محدودشده در گرید
function sanitize(layout: PlanLayout): { cols: number; rows: number; rooms: PlanRoom[]; doors: PlanDoor[] } {
  const cols = clampi(layout.cols, 2, 8), rows = clampi(layout.rows, 2, 8)
  const rooms = (Array.isArray(layout.rooms) ? layout.rooms : []).map(r => {
    const x = clampi(r.x, 0, cols - 1), y = clampi(r.y, 0, rows - 1)
    return { name: String(r.name || '').slice(0, 24), type: String(r.type || 'other'), x, y, w: clampi(r.w, 1, cols - x), h: clampi(r.h, 1, rows - y) }
  }).filter(r => r.name)
  const doors: PlanDoor[] = (Array.isArray(layout.doors) ? layout.doors : [])
    .map(d => ({ x: clampi(d.x, 0, cols - 1), y: clampi(d.y, 0, rows - 1), side: (['N', 'S', 'E', 'W'].includes(d.side) ? d.side : 'N') as PlanDoor['side'] }))
  return { cols, rows, rooms, doors }
}

export function svgDataUrl(svg: string): string {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

// نقشهٔ کفِ بالا‌نما (۲بعدی)
export function renderFloorPlanSVG(layoutIn: PlanLayout, totalArea: number, title = 'پلان وضع موجود'): string {
  const { cols, rows, rooms, doors } = sanitize(layoutIn)
  const W = 900, H = 860, pad = 64, top = 66, bottom = 54
  const gw = W - 2 * pad, gh = H - top - bottom
  const cw = gw / cols, ch = gh / rows
  const cellArea = totalArea / (cols * rows)
  const wall = '#14141a'
  let body = `<rect x="${pad}" y="${top}" width="${gw}" height="${gh}" fill="#ffffff" stroke="${wall}" stroke-width="9"/>`
  for (const r of rooms) {
    const px = pad + r.x * cw, py = top + r.y * ch, pw = r.w * cw, ph = r.h * ch
    const fill = TYPE_FILL[r.type || "other"] || TYPE_FILL.other
    const area = Math.max(1, Math.round(cellArea * r.w * r.h))
    body += `<rect x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${pw.toFixed(1)}" height="${ph.toFixed(1)}" fill="${fill}" stroke="${wall}" stroke-width="6"/>`
    body += `<text x="${(px + pw / 2).toFixed(1)}" y="${(py + ph / 2 - 3).toFixed(1)}" font-family="${FONT}" font-size="22" font-weight="700" fill="#181818" text-anchor="middle" direction="rtl">${esc(r.name)}</text>`
    body += `<text x="${(px + pw / 2).toFixed(1)}" y="${(py + ph / 2 + 22).toFixed(1)}" font-family="${FONT}" font-size="15" fill="#6a6a6a" text-anchor="middle" direction="rtl">${fa(area)} متر</text>`
  }
  // درها: یک شکافِ سفید روی لبهٔ دیوارِ همان سلول (تا حدّ ممکن مثل پلان معماری)
  const dlen = Math.min(cw, ch) * 0.5
  for (const d of doors) {
    const cx = pad + d.x * cw, cy = top + d.y * ch
    let x1: number, y1: number, x2: number, y2: number
    if (d.side === 'N') { const m = cx + cw / 2; x1 = m - dlen / 2; x2 = m + dlen / 2; y1 = y2 = cy }
    else if (d.side === 'S') { const m = cx + cw / 2; x1 = m - dlen / 2; x2 = m + dlen / 2; y1 = y2 = cy + ch }
    else if (d.side === 'W') { const m = cy + ch / 2; y1 = m - dlen / 2; y2 = m + dlen / 2; x1 = x2 = cx }
    else { const m = cy + ch / 2; y1 = m - dlen / 2; y2 = m + dlen / 2; x1 = x2 = cx + cw }
    // شکافِ سفید روی دیوار + خطِ بازشوِ نازکِ در
    body += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#ffffff" stroke-width="9"/>`
    body += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#b9892b" stroke-width="3" stroke-dasharray="4 4"/>`
  }
  const head = `<text x="${W / 2}" y="42" font-family="${FONT}" font-size="25" font-weight="800" fill="#111" text-anchor="middle" direction="rtl">${esc(title)} — ${fa(Math.round(totalArea))} متر مربع</text>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#ffffff"/>${head}${body}</svg>`
}

// نمای ایزومتریک (۳بعدیِ شماتیک) از همان چیدمان
export function renderIsoSVG(layoutIn: PlanLayout, totalArea: number, title = 'نمای سه‌بعدی'): string {
  const { cols, rows, rooms } = sanitize(layoutIn)
  const W = 900, H = 820
  const ux = Math.min(74, (W * 0.86) / (cols + rows))
  const uy = ux * 0.55
  const wallH = ux * 1.15
  const ox = W / 2, oy = 150
  const P = (gx: number, gy: number, z = 0): [number, number] => [ox + (gx - gy) * ux, oy + (gx + gy) * uy - z]
  const pts = (a: [number, number][]) => a.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')
  const poly = (a: [number, number][], fill: string, stroke = '#9aa1ad', sw = 1.2) => `<polygon points="${pts(a)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`

  let body = ''
  // دیوارهای پشتیِ بیرونی (دو ضلع دور)
  body += poly([P(0, 0), P(cols, 0), P(cols, 0, wallH), P(0, 0, wallH)], '#ececf1', '#cdcdd6', 1)
  body += poly([P(0, 0), P(0, rows), P(0, rows, wallH), P(0, 0, wallH)], '#e0e0d8', '#cdcdc4', 1)
  // کفِ اتاق‌ها از عقب به جلو
  const ordered = [...rooms].sort((a, b) => (a.x + a.y) - (b.x + b.y))
  for (const r of ordered) {
    const f = [P(r.x, r.y), P(r.x + r.w, r.y), P(r.x + r.w, r.y + r.h), P(r.x, r.y + r.h)] as [number, number][]
    body += poly(f, TYPE_FILL[r.type || "other"] || TYPE_FILL.other)
    const c = P(r.x + r.w / 2, r.y + r.h / 2)
    body += `<text x="${c[0].toFixed(1)}" y="${c[1].toFixed(1)}" font-family="${FONT}" font-size="15" font-weight="700" fill="#2a2a2a" text-anchor="middle" direction="rtl">${esc(r.name)}</text>`
  }
  const head = `<text x="${W / 2}" y="40" font-family="${FONT}" font-size="24" font-weight="800" fill="#111" text-anchor="middle" direction="rtl">${esc(title)}</text>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#ffffff"/>${head}${body}</svg>`
}
