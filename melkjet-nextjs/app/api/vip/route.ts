import { NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { requireModule } from '@/app/lib/plan-gate'
import { loadSnapshots } from '@/app/lib/empire-metrics'
import { listItems, type Item } from '@/app/lib/scraper-store'

// فاز ۱۰۶ — حسابِ حرفه‌ای (VIP، سند ۲۲ Part 05: «اطلاعاتِ بهتر، نه قدرت»):
// مقایسهٔ محله‌ها + روندِ بازار + هشدارِ فرصت — همه از دادهٔ واقعیِ همین سایت.
// قیمتِ اشتراک دستِ ادمین است: پلنی با دسترسیِ «vip» بساز (پنلِ پلن‌ها) — هیچ عددِ hardcode.
export const dynamic = 'force-dynamic'

const faToEn = (x: string) => (x || '').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
const priceOf = (it: Item) => { const n = parseFloat(faToEn(it.price || '').replace(/[^\d.]/g, '')) || 0; return /میلیارد/.test(it.price || '') ? n * 1e9 : /میلیون/.test(it.price || '') ? n * 1e6 : n }
const areaOf = (it: Item) => parseFloat(faToEn(String(it.meta?.['متراژ'] || ''))) || 0
const hoodOf = (loc?: string) => String(loc || '').split('،')[0].trim()

export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای مشاهده وارد شوید', needLogin: true }, { status: 401 })
  const gate = requireModule(s, 'vip')
  if (gate) return NextResponse.json(gate, { status: 403 })

  const snaps = await loadSnapshots(30).catch(() => [])
  const last = snaps[snaps.length - 1]
  const weekAgo = [...snaps].reverse().find(x => x.day <= (last?.day || 0) - 7) || snaps[0]

  // مقایسهٔ محله‌ها: متریِ امروز + Δ نسبت به ~هفتهٔ پیش + عمقِ نمونه — از اسنپ‌شات‌های واقعیِ رصدخانه
  const prevHoods = new Map((weekAgo?.hoods || []).map(h => [h.hood, h.perM]))
  const hoods = (last?.hoods || [])
    .filter(h => h.perM > 0 && h.samples >= 3)
    .map(h => ({
      hood: h.hood, perM: h.perM, samples: h.samples,
      weekPct: prevHoods.get(h.hood) ? Math.round(((h.perM - prevHoods.get(h.hood)!) / prevHoods.get(h.hood)!) * 1000) / 10 : null,
    }))
    .sort((a, b) => b.perM - a.perM)
    .slice(0, 20)

  // روندِ کلِ بازار: متریِ شهر در ۳۰ اسنپ‌شاتِ اخیر
  const trend = snaps.filter(x => x.perM > 0).map(x => ({ day: x.day, perM: x.perM }))

  // هشدارِ فرصت: آگهی‌های قیمت‌دارِ متراژدار که متری‌شان ≥۱۵٪ زیرِ میانهٔ محلهٔ خودشان است
  const items = (await listItems('listing', { publicOnly: true }).catch(() => [] as Item[]))
  const byHood = new Map<string, number[]>()
  const rows = items.map(it => ({ it, hood: hoodOf(it.location), price: priceOf(it), area: areaOf(it) }))
    .filter(r => r.hood && r.price > 0 && r.area > 20)
    .map(r => ({ ...r, perM: Math.round(r.price / r.area) }))
  for (const r of rows) { if (!byHood.has(r.hood)) byHood.set(r.hood, []); byHood.get(r.hood)!.push(r.perM) }
  const med = (xs: number[]) => { const t = [...xs].sort((a, b) => a - b); return t[Math.floor(t.length / 2)] }
  const opportunities = rows
    .filter(r => (byHood.get(r.hood)?.length || 0) >= 4)
    .map(r => { const m = med(byHood.get(r.hood)!); return { id: r.it.id, title: r.it.title.slice(0, 70), hood: r.hood, perM: r.perM, hoodPerM: m, belowPct: Math.round((1 - r.perM / m) * 100) } })
    .filter(x => x.belowPct >= 15 && x.belowPct <= 60)   // بالای ۶۰٪ معمولاً آگهیِ معیوب/رهن است، نه فرصت
    .sort((a, b) => b.belowPct - a.belowPct)
    .slice(0, 12)

  return NextResponse.json({
    ok: true,
    hoods, trend, opportunities,
    coverage: { snapshots: snaps.length, listings: rows.length },
    note: 'همهٔ اعداد از آگهی‌ها و اسنپ‌شات‌های واقعیِ ملک‌جت است؛ «زیرِ میانه» برآوردِ آماری است نه توصیهٔ قطعیِ خرید.',
  })
}
