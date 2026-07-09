import { NextResponse } from 'next/server'
import { getAdminData } from '@/app/lib/admin-store'

// کلیدِ نقشهٔ وب نشان (web.…) برای نقشهٔ تعاملیِ سمتِ کلاینت.
// این کلید عمومی است (محدود به دامنه) و فقط برای نمایشِ نقشه استفاده می‌شود.
export async function GET() {
  const nz = getAdminData().neshan
  // خودترمیم (فاز ۳۰): هر کدام از دو فیلد که کلیدِ «وب» (web.…) داشت همان برمی‌گردد —
  // حتی اگر ادمین کلیدها را جابه‌جا ذخیره کرده باشد، نقشهٔ تعاملی کلیدِ درست را می‌گیرد.
  const isWeb = (k?: string) => !!k && /^web\./i.test(k)
  const key = isWeb(nz?.mapKey) ? nz!.mapKey! : isWeb(nz?.serviceKey) ? nz!.serviceKey : (nz?.mapKey || '')
  return NextResponse.json({ key }, { headers: { 'Cache-Control': 'public, max-age=60' } })
}
