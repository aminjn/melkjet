import { NextRequest, NextResponse } from 'next/server'
import { publicQuery, publicFacets } from '@/app/lib/persiansaze-store'

export const dynamic = 'force-dynamic'

// فهرستِ عمومیِ پروژه‌ها با فیلترِ کامل + نقاطِ نقشه + فاستِ فیلترها.
export async function GET(req: NextRequest) {
  const u = new URL(req.url).searchParams
  const num = (k: string) => { const v = Number(u.get(k)); return Number.isFinite(v) && v > 0 ? v : undefined }
  const res = publicQuery({
    city: u.get('city') || undefined,
    region: u.get('region') || undefined,
    hood: u.get('hood') || undefined,
    phase: num('phase'),
    floorsMin: num('floorsMin'),
    unitsMin: num('unitsMin'),
    areaMin: num('areaMin'),
    areaMax: num('areaMax'),
    search: u.get('search') || undefined,
    withPhoto: u.get('withPhoto') === '1',
    sort: (u.get('sort') as any) || undefined,
    page: num('page') || 1,
    pageSize: num('pageSize') || 24,
  })
  const body: any = { ok: true, ...res }
  if (u.get('facets') === '1') body.facets = publicFacets()
  return NextResponse.json(body)
}
