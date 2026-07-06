import type { Project, Unit } from './builder-store'

// ── موتورِ AI سازنده (heuristic-first) ──
// پیش‌بینیِ فروشِ پروژه + قیمت‌گذاریِ واحد + زمانِ فروشِ کاملِ پروژه.

export interface SellForecast {
  velocity: number         // میانگینِ واحدِ فروخته در ماه (اخیر)
  remaining: number        // واحدهای فروش‌نرفته (available + reserved)
  monthsToSellout: number | null
  soldOutDate: string | null
  revenueLeft: number      // ارزشِ واحدهای باقیمانده
}
export function sellThroughForecast(p: Project): SellForecast {
  const ms = p.monthlySales || []
  const recent = ms.slice(-3)
  const velocity = recent.length ? recent.reduce((s, m) => s + (m.count || 0), 0) / recent.length : 0
  const remainingUnits = p.units.filter(u => u.status === 'available' || u.status === 'reserved')
  const remaining = remainingUnits.length
  const revenueLeft = remainingUnits.reduce((s, u) => s + (u.price || 0), 0)
  const monthsToSellout = velocity > 0 && remaining > 0 ? Math.ceil(remaining / velocity) : (remaining === 0 ? 0 : null)
  let soldOutDate: string | null = null
  if (monthsToSellout && monthsToSellout > 0) {
    try {
      const d = new Date(); d.setMonth(d.getMonth() + monthsToSellout)
      soldOutDate = new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'long' }).format(d)
    } catch {}
  }
  return { velocity: Math.round(velocity * 10) / 10, remaining, monthsToSellout, soldOutDate, revenueLeft }
}

export interface PriceSuggestion { perMeter: number; suggested: number; basis: string; delta: number }
// قیمتِ پیشنهادی برای یک واحد: میانگینِ قیمتِ هر متر (از واحدهای فروخته/همه) × متراژ،
// با تعدیلِ طبقه (هر طبقهٔ بالاتر کمی گران‌تر).
export function suggestUnitPrice(p: Project, unit: Unit): PriceSuggestion {
  const withPPM = p.units.filter(u => u.area > 0 && u.price > 0)
  const soldPPM = withPPM.filter(u => u.status === 'sold')
  const pool = soldPPM.length >= 2 ? soldPPM : withPPM
  const perMeter = pool.length ? Math.round(pool.reduce((s, u) => s + u.price / u.area, 0) / pool.length) : 0
  const floorAdj = 1 + Math.max(0, (unit.floor || 0)) * 0.01   // ۱٪ به‌ازای هر طبقه
  const suggested = Math.round((perMeter * (unit.area || 0)) * floorAdj)
  const delta = unit.price > 0 && suggested > 0 ? Math.round(((suggested - unit.price) / unit.price) * 100) : 0
  return { perMeter, suggested, basis: soldPPM.length >= 2 ? 'میانگینِ واحدهای فروخته' : 'میانگینِ کلِ واحدها', delta }
}

export function projectInsights(p: Project): string[] {
  const out: string[] = []
  const f = sellThroughForecast(p)
  if (f.remaining === 0 && p.units.length) out.push('همهٔ واحدها فروش رفته‌اند 🎉')
  else if (f.velocity === 0 && f.remaining > 0) out.push(`سرعتِ فروش صفر است و ${f.remaining} واحد مانده — کمپینِ فروش یا بازنگریِ قیمت لازم است.`)
  else if (f.soldOutDate) out.push(`با سرعتِ فعلی (${f.velocity} واحد/ماه)، پروژه حدودِ ${f.soldOutDate} فروش می‌رود.`)
  if (f.monthsToSellout && f.monthsToSellout > 12) out.push('زمانِ فروشِ کامل بیش از یک سال است — تخفیفِ پیش‌فروش یا تبلیغِ بیشتر را بسنج.')
  const noPrice = p.units.filter(u => !u.price).length
  if (noPrice) out.push(`${noPrice} واحد بدونِ قیمت است — برای پیش‌بینیِ دقیق‌تر قیمت‌گذاری کن.`)
  const stats = { revenue: p.units.filter(u => u.status === 'sold').reduce((s, u) => s + u.price, 0) }
  const cost = (p.finance?.landCost || 0) + (p.finance?.buildCost || 0) + (p.finance?.otherCost || 0)
  if (cost > 0 && stats.revenue > 0 && stats.revenue < cost) out.push('درآمدِ فعلی هنوز به هزینهٔ پروژه نرسیده — تا نقطهٔ سربه‌سر فاصله دارید.')
  return out
}
