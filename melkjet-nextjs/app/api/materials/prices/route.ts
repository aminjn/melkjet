import { NextRequest, NextResponse } from 'next/server'
import { materialPriceIndex } from '@/app/lib/materials-store'

export const dynamic = 'force-dynamic'

// نرخِ روزِ مصالح — تجمیعِ قیمتِ واقعیِ محصولاتِ فروشندگان.
export async function GET(req: NextRequest) {
  const u = new URL(req.url).searchParams
  const data = materialPriceIndex({ category: u.get('category') || undefined, search: u.get('search') || undefined })
  return NextResponse.json({ ok: true, ...data })
}
