// فاز ۳۰۲ — پیشنهادِ قیمتِ منصفانه از «آگهی‌های مشابهِ واقعی» (یادگیری از دیتا، نه عددِ ساختگی).
// از neighbourhoodStats (میانهٔ قیمتِ متریِ فروشِ همان محله/شهر) استفاده می‌کند. اگر نمونهٔ کافی
// نبود → null (هیچ عددِ جعلی). AVM/Digital Twinِ موجود دست‌نخورده می‌ماند — این مکمل است.
import { neighbourhoodStats } from './market-stats'

export interface PriceSuggestion { mid: number; low: number; high: number; ppm: number; samples: number; area: number; basis: string }

const MIN_SAMPLES = 5
const faNum = (n: number) => Math.round(n).toLocaleString('fa-IR')

/** محاسبهٔ خالص از میانهٔ قیمتِ متری (برای تست و استفادهٔ مجدد). */
export function priceFromStats(medianPpm: number, area: number, samples: number, basis = ''): PriceSuggestion | null {
  if (!medianPpm || medianPpm <= 0 || !area || area < 15 || area > 3000 || samples < MIN_SAMPLES) return null
  const mid = Math.round(medianPpm * area)
  return { mid, low: Math.round(mid * 0.85), high: Math.round(mid * 1.15), ppm: Math.round(medianPpm), samples, area, basis }
}

/** پیشنهادِ قیمتِ فروش از آگهی‌های مشابهِ محله (وگرنه شهر). null = دادهٔ کافی نیست. */
export async function suggestSalePrice(opts: { city?: string; district?: string; area: number }): Promise<PriceSuggestion | null> {
  const area = Number(opts.area) || 0
  if (area < 15 || area > 3000) return null
  const city = (opts.city || '').trim(), district = (opts.district || '').trim()
  // اول محله، بعد شهر — هرکدام که نمونهٔ کافی داشت.
  if (district) {
    const s = await neighbourhoodStats(city, district)
    if (s && s.count >= MIN_SAMPLES) return priceFromStats(s.median, area, s.count, `محلهٔ ${district}`)
  }
  if (city) {
    const s = await neighbourhoodStats(city, '')
    if (s && s.count >= MIN_SAMPLES) return priceFromStats(s.median, area, s.count, `شهرِ ${city}`)
  }
  return null
}

/** متنِ فارسیِ پیشنهاد برای نمایش به کاربر (ربات/سایت). */
export function formatSuggestion(s: PriceSuggestion): string {
  const ppmFa = s.ppm >= 1e9 ? `${(s.ppm / 1e9).toLocaleString('fa-IR', { maximumFractionDigits: 1 })} میلیارد` : `${faNum(s.ppm / 1e6)} میلیون`
  return `💡 قیمتِ معمولِ بازار برای این ملک حدودِ «${faNum(s.mid)} تومان» است (بینِ ${faNum(s.low)} تا ${faNum(s.high)})،\nبر پایهٔ متری ${ppmFa} تومان در ${s.basis} از ${faNum(s.samples)} آگهیِ مشابهِ واقعی.\nقیمتِ خودت را بگذار (عددی):`
}
