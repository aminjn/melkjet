import { NextRequest, NextResponse } from 'next/server'
import { listActive } from '@/app/lib/promotion-store'
import { getItemById } from '@/app/lib/scraper-store'

// عمومی: آیتم‌های پروموت‌شدهٔ یک جایگاه (با دادهٔ به‌روز).
export async function GET(req: NextRequest) {
  const slot = new URL(req.url).searchParams.get('slot') || ''
  if (!slot) return NextResponse.json({ items: [] })
  const items = (await Promise.all((await listActive(slot)).map(async p => {
    const it = await getItemById(p.targetId)
    if (!it || it.status === 'rejected') return null
    return { id: it.id, title: it.title, price: it.price, location: it.location, image: it.image, url: it.url, category: it.category, type: it.type, rating: it.rating, promoted: true, promoKind: p.kind || 'ویژه' }
  }))).filter(Boolean)
  return NextResponse.json({ items })
}
