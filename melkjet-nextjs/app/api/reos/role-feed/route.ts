import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { loadProperties } from '@/app/lib/reos/data'
import { buildRoleFeed, isRoleKind, type RoleKind } from '@/app/lib/reos/roles'
import { getItemById } from '@/app/lib/scraper-store'
import { listingHref } from '@/app/lib/listing-url'
import { primeEngageModel } from '@/app/lib/reos/train'

// GET /api/reos/role-feed?role=builder — فیدِ نقش‌محورِ REOS v2 (هدفِ متفاوت برای هر نقش).
// نقش از ?role= (کلاینت از مسیرِ داشبورد می‌سازد). نیازمندِ session.
export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  const roleParam = new URL(req.url).searchParams.get('role') || 'buyer'
  const role: RoleKind = isRoleKind(roleParam) ? roleParam : 'buyer'

  await primeEngageModel().catch(() => {})
  const properties = await loadProperties(400)
  const feed = buildRoleFeed(role, properties, {}, 12)

  // غنی‌سازیِ آیتم‌ها با اطلاعاتِ نمایشیِ ملک (یک پاس، بدونِ فراخوانِ اضافه به‌ازای هر کارت).
  const ids = new Set<string>()
  feed.sections.forEach(sec => sec.items.forEach(it => ids.add(it.id)))
  const disp = new Map<string, { title: string; price: string; image?: string; location: string; deal: string; href: string }>()
  await Promise.all(Array.from(ids).map(async id => {
    const it = await getItemById(id).catch(() => null)
    if (it) disp.set(id, {
      title: it.title, price: it.price || '', image: it.image || (typeof it.meta?.__gallery === 'string' ? String(it.meta.__gallery).split('\n')[0] : undefined),
      location: it.location || '', deal: it.meta?.['نوع معامله'] || '', href: listingHref(it.id, it.title, it.location),
    })
  }))

  const sections = feed.sections.map(sec => ({
    key: sec.key, label: sec.label, icon: sec.icon,
    cards: sec.items.map(it => ({ id: it.id, score: it.score, matchPct: it.matchPct, reasons: it.reasons, why: it.reasons, listing: disp.get(it.id) || null })),
  }))

  return NextResponse.json({ ok: true, role: feed.role, label: feed.label, sections }, { headers: { 'Cache-Control': 'no-store, private' } })
}
