import { NextRequest, NextResponse } from 'next/server'
import { getItemById, getArticleBySlug } from '@/app/lib/scraper-store'

// Public: a single item by id, OR an article by slug (?slug=).
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const id = sp.get('id'); const slug = sp.get('slug')
  if (!id && !slug) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
  const item = slug ? await getArticleBySlug(slug) : (id ? await getItemById(id) : null)
  if (!item || item.status === 'rejected') return NextResponse.json({ item: null }, { status: 404 })
  // نشانِ پروموتِ فعال (نوع) — برای نمایشِ ریبونِ «ویژه/VIP/…» در صفحهٔ آگهی.
  let promoKind: string | undefined
  try { const { promotedListingKinds } = await import('@/app/lib/promotion-store'); promoKind = (await promotedListingKinds()).get(String(item.id))?.kind } catch {}
  return NextResponse.json({ item: promoKind ? { ...item, promoted: true, promoKind } : item })
}
