import { NextRequest, NextResponse } from 'next/server'
import { listItemsStable } from '@/app/lib/scraper-store'
import { deriveListing, cityMatch, type DerivedListing } from '@/app/lib/listing-search'
import { specFromParams, matchesSpec, pointInPoly } from '@/app/lib/search-query'
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
  // فاز د — فیلترها + محله + محدودهٔ رسم‌شده از منبعِ مشترکِ search-query (همان که هشدارِ آگهیِ جدید می‌خواند).
  const spec = specFromParams(sp)
  const city = spec.city

  // فاز ۲۳۲: listItems هر بار آرایهٔ نو می‌ساخت → این کشِ ref هرگز hit نمی‌شد (۱۲هزار regex در هر
  // درخواستِ نقشه). نسخهٔ مرجع-پایدار در هر نسلِ داده همان آرایه را می‌دهد → derive یک‌بار در نسل.
  const items = await listItemsStable('listing', { publicOnly: true })
  if (deriveCache?.src !== items) deriveCache = { src: items, derived: items.map(deriveListing) }
  const derived = deriveCache.derived

  const inCity = city ? derived.filter(d => cityMatch(d.location, city)) : derived
  const matched = inCity.filter(d => matchesSpec(d, spec))
  // مرکزِ محله‌ها از کلِ آگهی‌های مختصات‌دارِ شهر (مستقل از فیلترها → پایدار)
  const centroids = hoodCentroidsOf(inCity, city)
  let points = resolveMapPoints(matched, city, centroids)
  // محدودهٔ رسم‌شده: فقط نقطه‌های درونِ چندضلعی. شناسه‌ها به فهرستِ کلاینت برمی‌گردند تا کارت‌ها هم
  // دقیقاً همان‌ها باشند (آگهیِ بی‌مختصات و بی‌مرکزِ محله، جایی روی نقشه ندارد → بیرون حساب می‌شود).
  const poly = spec.poly
  if (poly) points = points.filter(p => pointInPoly(p.lat, p.lng, poly))

  const bbox = parseBBox(sp.get('bbox') || '')
  let zoom = Number(sp.get('zoom')) || 0
  let view: { center: { lat: number; lng: number }; zoom: number } | null = null
  if (!bbox || !zoom) {
    view = pinBoundsView(poly && !points.length ? poly : points)
    zoom = zoom || view?.zoom || 12
  }
  const { total, clusters, singles } = clusterMapPoints(points, zoom, bbox)
  return NextResponse.json({ ok: true, total, matched: poly ? points.length : matched.length, clusters, singles, view, ...(poly ? { polyIds: points.slice(0, 5000).map(p => p.id) } : {}) })
}
