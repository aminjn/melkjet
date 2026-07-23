import { NextRequest, NextResponse } from 'next/server'
import { listItems } from '@/app/lib/scraper-store'
import { deriveListing, effectiveFiltersOf, matchesListing, cityMatch, type DerivedListing } from '@/app/lib/listing-search'
import { hoodCentroidsOf, resolveMapPoints, clusterMapPoints, parseBBox } from '@/app/lib/map-cluster'
import { pinBoundsView } from '@/app/lib/map-pins'

// فاز ۲۰۴ — نقشهٔ جستجو به سبکِ دیوار: کلاینت فقط «قاب + زوم + فیلترها» را می‌فرستد و
// سرور روی کلِ استخرِ آگهی‌ها (نه ۱۰۰۰تای صفحه) خوشه‌ها/پین‌های همان قاب را برمی‌گرداند.
// فیلترها با همان کتابخانهٔ مشترکِ کارت‌ها (listing-search) اعمال می‌شوند — نقشه و فهرست هم‌زبان‌اند.
// بدونِ bbox (بارِ اول): قابِ پیشنهادی از گسترهٔ کلِ نتیجه‌ها هم برمی‌گردد (کلِ شهر).

// استخراجِ فیلدها روی ۱۲هزار آیتم regexِ سنگین دارد؛ به مرجعِ آرایهٔ کش‌شدهٔ listItems (TTL ~۱۵ث)
// سنجاق می‌شود تا در عمل هر چند ثانیه فقط یک‌بار محاسبه شود.
let deriveCache: { src: unknown; derived: DerivedListing[] } | null = null

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const city = sp.get('city') || ''
  const eff = effectiveFiltersOf({
    tab: sp.get('deal') || 'sale',
    q: sp.get('q') || '',
    kind: sp.get('kind') || '',
    bedsLabel: sp.get('beds') || 'همه',
    priceMin: Number(sp.get('pmin')) || 0,
    priceMax: Number(sp.get('pmax')) || 0,   // ≤۰ = بدونِ سقف (کلاینت pmax را فقط زیرِ سقف می‌فرستد)
    areaMin: Number(sp.get('amin')) || 0,
    areaMax: Number(sp.get('amax')) || 0,
    floorMin: Number(sp.get('fmin')) || 0,
    yearMin: Number(sp.get('ymin')) || 0,
    amenities: (sp.get('amen') || '').split('،').filter(Boolean),
  })

  const items = await listItems('listing', { publicOnly: true })
  if (deriveCache?.src !== items) deriveCache = { src: items, derived: items.map(deriveListing) }
  const derived = deriveCache.derived

  const inCity = city ? derived.filter(d => cityMatch(d.location, city)) : derived
  const matched = inCity.filter(d => matchesListing(d, eff))
  // مرکزِ محله‌ها از کلِ آگهی‌های مختصات‌دارِ شهر (مستقل از فیلترها → پایدار)
  const centroids = hoodCentroidsOf(inCity, city)
  const points = resolveMapPoints(matched, city, centroids)

  const bbox = parseBBox(sp.get('bbox') || '')
  let zoom = Number(sp.get('zoom')) || 0
  let view: { center: { lat: number; lng: number }; zoom: number } | null = null
  if (!bbox || !zoom) {
    view = pinBoundsView(points)
    zoom = zoom || view?.zoom || 12
  }
  const { total, clusters, singles } = clusterMapPoints(points, zoom, bbox)
  return NextResponse.json({ ok: true, total, matched: matched.length, clusters, singles, view })
}
