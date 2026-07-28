import { NextResponse } from 'next/server'
import { geoTileTemplate } from '@/app/lib/geo-api'

// فاز ۲۳۴ — نقشهٔ تعاملی حالا از سامانهٔ نقشهٔ اختصاصی کاشی می‌گیرد (نشان حذف شد).
// خروجی: الگوی URLِ کاشی برای Leaflet. کلیدِ کاشی مثلِ «کلیدِ وبِ» سابق عمومی است
// (محدودسازی سمتِ خودِ سامانه انجام می‌شود).
export async function GET() {
  const tiles = geoTileTemplate()
  return NextResponse.json({ tiles: tiles || '' }, { headers: { 'Cache-Control': 'public, max-age=60' } })
}
