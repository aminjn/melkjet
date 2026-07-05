import { NextRequest, NextResponse } from 'next/server'
import { promotedInArea } from '@/app/lib/promotion-store'
import { getItemById } from '@/app/lib/scraper-store'
import { getProfile } from '@/app/lib/profile-store'
import { getAccount } from '@/app/lib/account-store'

// عمومی: پروموت‌های محله‌محورِ یک محله — مشاوران/متخصصان + آگهی‌های ویژهٔ آن محله.
export async function GET(req: NextRequest) {
  const name = (new URL(req.url).searchParams.get('name') || '').trim()
  if (!name) return NextResponse.json({ profiles: [], listings: [] })
  const { profilePhones, listingIds, profileKinds } = await promotedInArea(name)

  const profiles: any[] = []
  for (const phone of profilePhones) {
    try {
      const p = getProfile(phone); const acc = getAccount(phone)
      const nm = (p.businessName || p.displayName || acc?.name || profileKinds.get(phone)?.title || '').trim() || 'متخصصِ ملک‌جت'
      profiles.push({
        id: phone, title: nm, category: (p.businessType || 'متخصص'), location: p.city || '', image: p.logo || '',
        excerpt: p.tagline || '', hasPhone: !!(p.contactPhone || p.landline), url: `/profile/${encodeURIComponent(phone)}`,
        promoted: true, promoKind: profileKinds.get(phone)?.kind || 'ویژه', revealKind: 'advisor', revealId: phone,
      })
    } catch {}
  }

  const listings: any[] = []
  for (const [id, info] of listingIds) {
    try {
      const it = await getItemById(id)
      if (!it || it.status === 'rejected') continue
      listings.push({ id: it.id, title: it.title, price: it.price, location: it.location, image: it.image, url: it.url, category: it.category, type: it.type, promoted: true, promoKind: info.kind || 'ویژه' })
    } catch {}
  }
  // برندهٔ مزایده (نشانِ «مزایده») بالاتر از پروموت‌های محله‌محورِ عادی نمایش داده می‌شود.
  listings.sort((a, b) => (b.promoKind === 'مزایده' ? 1 : 0) - (a.promoKind === 'مزایده' ? 1 : 0))

  return NextResponse.json({ profiles, listings }, { headers: { 'Cache-Control': 'no-store' } })
}
