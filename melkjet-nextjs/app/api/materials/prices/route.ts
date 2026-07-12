import { NextRequest, NextResponse } from 'next/server'
import { materialPriceIndex } from '@/app/lib/materials-store'
import { materialsIndexState } from '@/app/lib/materials-index'
import { config } from '@/app/lib/reos/reos-config'

export const dynamic = 'force-dynamic'

// نرخِ روزِ مصالح — تجمیعِ قیمتِ واقعیِ محصولاتِ فروشندگان.
export async function GET(req: NextRequest) {
  const u = new URL(req.url).searchParams
  const data = await materialPriceIndex({ category: u.get('category') || undefined, search: u.get('search') || undefined })
  // فاز ۱۰۰ (جلد ۴۳): شاخصِ زمانیِ مصالح (پایه ۱۰۰) — از اسنپ‌شات‌های روزانهٔ همین قیمت‌ها
  const mi = config().empire.materialsIndex
  const indexState = materialsIndexState(mi.minItems)
  return NextResponse.json({ ok: true, ...data, indexState })
}
