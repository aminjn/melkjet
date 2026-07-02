import { NextRequest, NextResponse } from 'next/server'
import { referencePriceIndex } from '@/app/lib/catalog-store'
import { sellerCountsByCatalog } from '@/app/lib/materials-store'

export const dynamic = 'force-dynamic'

const SOURCE_LABEL: Record<string, string> = { hypersaz: 'هایپرساز', ahanonline: 'آهن‌آنلاین', manual: 'دستی' }

// نرخِ مرجعِ کالاها (از دادهٔ اسکرپ‌شده) — قیمت + روند + اسپارک‌لاین + تعدادِ فروشنده، همه به تومان.
export async function GET(req: NextRequest) {
  const u = new URL(req.url).searchParams
  const data = referencePriceIndex({ category: u.get('category') || undefined, search: u.get('search') || undefined })
  const counts = sellerCountsByCatalog()
  const rows = data.rows.map(r => ({ ...r, sellerCount: counts[r.id] || 0, sourceLabel: SOURCE_LABEL[r.source] || r.source }))
  return NextResponse.json({ ok: true, ...data, rows })
}
