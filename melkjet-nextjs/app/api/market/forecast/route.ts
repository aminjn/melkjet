import { NextRequest, NextResponse } from 'next/server'
import { neighbourhoodForecast } from '@/app/lib/price-forecast'
import { parsePrice, parseArea } from '@/app/lib/market-stats'

export const dynamic = 'force-dynamic'

// پیش‌بینیِ قیمتِ یک محله — مدلِ رگرسیونی روی دادهٔ واقعی + پنجرهٔ ۱۲ ماهه تا ماهِ جاری.
// اگر دادهٔ محله نبود، قیمتِ هر مترِ خودِ همین ملک مبنا قرار می‌گیرد تا نمودار همیشه ساخته شود.
export async function GET(req: NextRequest) {
  const u = new URL(req.url).searchParams
  const faToEn = (s: string) => (s || '').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  const city = u.get('city') || ''
  const district = u.get('district') || ''
  const price = parsePrice(u.get('price') || '')
  // متراژ ممکن است «۸۰» (فقط رقمِ فارسی، بدونِ «متر») باشد → faToEn سپس عدد.
  const area = parseArea(u.get('area') || '') || parseArea(u.get('title') || '') || (parseInt(faToEn(u.get('area') || ''), 10) || 0)
  const fallbackAvg = price > 1e8 && area >= 15 ? Math.round(price / area) : 0
  const forecast = neighbourhoodForecast(city, district, fallbackAvg)
  return NextResponse.json({ ok: true, forecast })
}
