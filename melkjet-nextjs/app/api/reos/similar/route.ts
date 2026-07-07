import { NextRequest, NextResponse } from 'next/server'
import { similarProperties } from '@/app/lib/reos/data'
import { getItemById } from '@/app/lib/scraper-store'
import { listingHref } from '@/app/lib/listing-url'

// GET /api/reos/similar?propertyId=...&k=8 — «املاکِ مشابه» با شباهتِ برداری (embedding cosine).
// عمومی است (فقط آگهی‌های عمومی را برمی‌گرداند) — مثلِ «خانه‌های مشابه» در Zillow.
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const propertyId = sp.get('propertyId')
  if (!propertyId) return NextResponse.json({ error: 'propertyId لازم است' }, { status: 400 })
  const k = Math.min(Number(sp.get('k')) || 8, 20)

  const neighbors = await similarProperties(propertyId, k)
  const items = await Promise.all(neighbors.map(async n => {
    const it = await getItemById(n.id).catch(() => null)
    if (!it || it.status === 'rejected' || it.status === 'duplicate') return null
    return {
      id: n.id, sim: n.sim, simPct: Math.round(n.sim * 100),
      title: it.title, price: it.price || '', location: it.location || '',
      image: it.image || undefined, href: listingHref(it.id, it.title, it.location),
    }
  }))

  return NextResponse.json({ ok: true, propertyId, similar: items.filter(Boolean) }, { headers: { 'Cache-Control': 'no-store' } })
}
