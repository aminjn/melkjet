import { NextResponse } from 'next/server'
import { geoTileTemplate, geoTileVersion } from '@/app/lib/geo-api'

// فاز ۲۳۴ — نقشهٔ تعاملی حالا از سامانهٔ نقشهٔ اختصاصی کاشی می‌گیرد (نشان حذف شد).
// خروجی: الگوی URLِ کاشی برای Leaflet. کلیدِ کاشی مثلِ «کلیدِ وبِ» سابق عمومی است
// (محدودسازی سمتِ خودِ سامانه انجام می‌شود).
export async function GET() {
  // فاز ۲۳۵: کاشی از پروکسیِ خودِ سایت — مرورگر برای <img> نمی‌تواند هدرِ X-API-Key بفرستد؛
  // پروکسی کلید را سمتِ سرور نگه می‌دارد و کشِ عمومی دارد.
  // فاز ۲۴۹: ?v= کش‌شکنِ مرورگر — با بامپِ نسخه در ادمین، URL کاشی‌ها عوض و گرافیکِ جدید فوری می‌نشیند.
  const configured = !!geoTileTemplate()
  return NextResponse.json({ tiles: configured ? `/api/geo/tile/{z}/{x}/{y}?v=${geoTileVersion()}` : '' }, { headers: { 'Cache-Control': 'public, max-age=60' } })
}
