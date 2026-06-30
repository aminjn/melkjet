import { neighbourhoodStats } from './market-stats'

// ─── پیش‌بینیِ قیمت (مدلِ یادگیریِ ماشین سبک) ────────────────────────────────
// رگرسیونِ خطی روی لگاریتمِ قیمتِ هر متر (نرخِ رشدِ درصدی) از دادهٔ واقعیِ آگهی‌ها.
// خروجی: پنجرهٔ ۱۲ ماهه که به «ماهِ جاری» ختم می‌شود + ۳ ماه پیش‌بینی، با نرخِ رشد و اطمینان.

const FA = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']
function curFaMonth(): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', { month: 'numeric' }).formatToParts(new Date())
    return Number(parts.find(p => p.type === 'month')?.value) || 4
  } catch { return 4 }
}
function shortFa(m1to12: number): string { return FA[((m1to12 - 1) % 12 + 12) % 12] }

// رگرسیونِ خطیِ کم‌مربعات روی y[i] با x=i. خروجی: شیب (به‌ازای هر گام).
function slopeOf(ys: number[]): number {
  const n = ys.length
  if (n < 2) return 0
  let sx = 0, sy = 0, sxx = 0, sxy = 0
  for (let i = 0; i < n; i++) { sx += i; sy += ys[i]; sxx += i * i; sxy += i * ys[i] }
  const d = n * sxx - sx * sx
  return d ? (n * sxy - sx * sy) / d : 0
}

export interface FPoint { label: string; value: number; kind: 'real' | 'estimate' | 'current' | 'forecast' }
export interface Forecast {
  points: FPoint[]; currentAvg: number; monthlyGrowthPct: number; yearGrowthPct: number
  method: string; confidence: 'high' | 'medium' | 'low'; samples: number; forecastNext: number
}

// fallbackAvg = قیمتِ هر مترِ خودِ همین ملک (وقتی دادهٔ محله نداریم) تا نمودار همیشه ساخته شود.
export function neighbourhoodForecast(city: string, district: string, fallbackAvg?: number): Forecast | null {
  const stats = neighbourhoodStats(city, district)
  const ys = (stats?.trend || []).map(t => t.avg).filter(v => v > 0)
  const samples = ys.length
  const baseHint = (stats && stats.avg) ? stats.avg : (fallbackAvg && fallbackAvg > 0 ? fallbackAvg : 0)
  if (!baseHint) return null
  const usingFallback = !(stats && stats.avg)

  let monthlyGrowth = 0, method = '', confidence: Forecast['confidence'] = 'low'
  let baseAvg = baseHint                                  // مبنا = میانگینِ فعلیِ واقعی یا قیمتِ همین ملک
  if (samples >= 3) {
    monthlyGrowth = Math.exp(slopeOf(ys.map(v => Math.log(v)))) - 1   // رشدِ درصدیِ ماهانه
    baseAvg = ys[ys.length - 1]
    method = `رگرسیون روی ${samples} ماه دادهٔ واقعیِ محله`
    confidence = samples >= 5 ? 'high' : 'medium'
  } else if (samples === 2) {
    monthlyGrowth = ys[1] / ys[0] - 1; baseAvg = ys[1]
    method = 'روند دو نقطهٔ دادهٔ واقعی'; confidence = 'low'
  } else {
    monthlyGrowth = 0.012   // پیش‌فرضِ محتاطانه (~۱۵٪ سالانه) وقتی تاریخچهٔ کافی نیست
    method = usingFallback ? 'تخمینِ پایه (بر اساسِ قیمتِ همین ملک)' : 'تخمینِ پایه (تاریخچهٔ محدود)'; confidence = 'low'
  }
  monthlyGrowth = Math.max(-0.05, Math.min(0.06, monthlyGrowth))     // محدودهٔ منطقیِ ماهانه
  const yearGrowth = Math.pow(1 + monthlyGrowth, 12) - 1

  const m = curFaMonth()
  const points: FPoint[] = []
  for (let off = -11; off <= 0; off++) points.push({ label: shortFa(m + off), value: Math.round(baseAvg * Math.pow(1 + monthlyGrowth, off)), kind: off === 0 ? 'current' : (samples >= 3 ? 'real' : 'estimate') })
  for (let off = 1; off <= 3; off++) points.push({ label: shortFa(m + off), value: Math.round(baseAvg * Math.pow(1 + monthlyGrowth, off)), kind: 'forecast' })

  return { points, currentAvg: Math.round(baseAvg), monthlyGrowthPct: monthlyGrowth * 100, yearGrowthPct: yearGrowth * 100, method, confidence, samples, forecastNext: Math.round(baseAvg * (1 + monthlyGrowth)) }
}
