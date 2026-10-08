import { NextRequest, NextResponse } from 'next/server'
import { getSite } from '@/app/lib/sites-store'
import { recordSiteHit } from '@/app/lib/site-stats-store'

export const runtime = 'nodejs'

// فاز ۲۹۶ب — بیکنِ آمارِ سایت‌های اختصاصی: بازدیدِ صفحه و جستجوی داخلِ سایت.
// عمومی است (از مرورگرِ بازدیدکننده می‌آید)؛ فقط برای slugِ موجود ثبت می‌شود.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({} as any))
  const slug = String(b.slug || '').slice(0, 120)
  const kind = b.kind === 'search' ? 'search' as const : b.kind === 'phone' ? 'phone' as const : 'view' as const
  if (!slug) return NextResponse.json({ ok: false }, { status: 400 })
  const site = await getSite(slug)
  if (!site) return NextResponse.json({ ok: false }, { status: 404 })
  // fire-and-forget — بیکن نباید صفحهٔ بازدیدکننده را کند کند
  recordSiteHit(site.slug, kind, typeof b.q === 'string' ? b.q : undefined).catch(() => {})
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
