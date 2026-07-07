// REOS v4 · Seller Intelligence — هوشِ فروشنده برای مشاور/مالک.
// «این فایل ۶۳٪ احتمالِ کاهشِ قیمت دارد؛ ۸٪ کاهش پیشنهاد می‌شود؛ فوریت: بالا».
// هستهٔ خالص (sellerInsight) تست‌پذیر؛ buildSellerInsight روی Digital Twin سوار است.
import { buildTwin } from './digital-twin'

function clamp01(x: number) { return Math.max(0, Math.min(1, x)) }

export interface SellerInput { priceVsMarket: number; demand: number; daysOnMarket: number; saleProbability: number }
export interface SellerInsight {
  priceCutLikelihood: number   // ۰..۱۰۰
  suggestedCutPct: number      // درصدِ کاهشِ پیشنهادی
  urgency: 'کم' | 'متوسط' | 'بالا'
  saleProbability: number
  recommendation: string
  reasons: string[]
}

// priceVsMarket بر حسبِ درصد (مثبت=گران‌تر از بازار). daysOnMarket بر حسبِ روز.
export function sellerInsight(i: SellerInput): SellerInsight {
  const over = Math.max(0, i.priceVsMarket) / 100          // نسبتِ گرانیِ نسبت به بازار
  const lowDemand = 1 - clamp01(i.demand)
  const staleness = clamp01(i.daysOnMarket / 90)
  const reasons: string[] = []
  if (i.priceVsMarket > 8) reasons.push(`قیمت ${Math.round(i.priceVsMarket)}٪ بالاتر از بازار`)
  if (i.demand < 0.3) reasons.push('تقاضای پایین')
  if (i.daysOnMarket > 45) reasons.push(`${Math.round(i.daysOnMarket)} روز در بازار`)

  const likelihood = Math.round(clamp01(0.5 * clamp01(over / 0.2) + 0.3 * lowDemand + 0.2 * staleness) * 100)
  // کاهشِ پیشنهادی: تا نزدیکِ بازار (حداکثر ۱۵٪)، فقط اگر گران‌تر از بازار باشد.
  const suggestedCutPct = i.priceVsMarket > 5 ? Math.min(15, Math.round(i.priceVsMarket * 0.7)) : 0
  const urgency: SellerInsight['urgency'] = likelihood >= 60 ? 'بالا' : likelihood >= 35 ? 'متوسط' : 'کم'
  let recommendation: string
  if (suggestedCutPct >= 3) recommendation = `پیشنهاد: قیمت را حدودِ ${suggestedCutPct}٪ کاهش دهید تا به بازار نزدیک شود و احتمالِ فروش بالا رود.`
  else if (i.demand >= 0.6) recommendation = 'قیمت رقابتی و تقاضا بالاست — روی سرعتِ پاسخ‌گویی به بازدیدها تمرکز کنید.'
  else recommendation = 'قیمت نزدیکِ بازار است — با بازاریابیِ هدفمند (پوش/تبلیغ) تقاضا را بالا ببرید.'

  return { priceCutLikelihood: likelihood, suggestedCutPct, urgency, saleProbability: i.saleProbability, recommendation, reasons: reasons.length ? reasons : ['وضعیتِ متعادل'] }
}

export async function buildSellerInsight(propertyId: string): Promise<(SellerInsight & { title?: string; estimate: number }) | null> {
  const twin = await buildTwin(propertyId)
  if (!twin) return null
  // daysOnMarket از twin نداریم؛ از saleProbability/daysToSell تقریب می‌زنیم — یا صفر اگر تازه.
  const daysOnMarket = Math.max(0, twin.daysToSell - Math.round((twin.saleProbability / 100) * twin.daysToSell))
  const ins = sellerInsight({ priceVsMarket: twin.priceVsMarket, demand: twin.demand, daysOnMarket, saleProbability: twin.saleProbability })
  return { ...ins, title: twin.title, estimate: twin.valuation.estimate }
}
