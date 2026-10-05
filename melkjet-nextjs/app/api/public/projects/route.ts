import { NextRequest, NextResponse } from 'next/server'
import { publicQuery, publicFacets } from '@/app/lib/persiansaze-store'
import { ensureManyProjectSlugs, allProjectSlugsByHash } from '@/app/lib/project-slug-store'   // فاز ۲۹۸ی۲ — لینکِ canonicalِ اسلاگی

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
  // فاز ۲۹۸ی۲ — اسلاگِ canonical برای هر آیتم (لینکِ کارت → /projects/{slug} به‌جای /proje/{hashId}ِ ریدایرکتی)
  try {
    const its: any[] = res.items || []
    const hashes = its.map(x => ({ hashId: String(x.hashId || ''), name: String(x.address || x.builderName || 'پروژه') })).filter(x => x.hashId)
    if (hashes.length) {
      await ensureManyProjectSlugs(hashes).catch(() => {})
      const slugs = await allProjectSlugsByHash().catch(() => ({} as Record<string, string>))
      for (const it of its) if (it.hashId && slugs[it.hashId]) it.slug = slugs[it.hashId]
    }
  } catch {}
  const body: any = { ok: true, ...res }
  if (u.get('facets') === '1') body.facets = publicFacets()
  return NextResponse.json(body)
}
