import { NextRequest, NextResponse } from 'next/server'
import { neighbourhoodForecast } from '@/app/lib/price-forecast'

export const dynamic = 'force-dynamic'

// پیش‌بینیِ قیمتِ یک محله — مدلِ رگرسیونی روی دادهٔ واقعی + پنجرهٔ ۱۲ ماهه تا ماهِ جاری.
export async function GET(req: NextRequest) {
  const u = new URL(req.url).searchParams
  const city = u.get('city') || ''
  const district = u.get('district') || ''
  if (!district && !city) return NextResponse.json({ ok: false, forecast: null })
  const forecast = neighbourhoodForecast(city, district)
  return NextResponse.json({ ok: true, forecast })
}
