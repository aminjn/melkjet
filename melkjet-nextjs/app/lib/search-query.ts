// فاز د — «مشخصاتِ جستجو» یک‌جا: پارامترهای URLِ /search → فیلترها + محله + محدودهٔ رسم‌شده روی نقشه.
// هر سه مصرف‌کننده از همین می‌خوانند تا «آنچه می‌بینی همان است که برایش هشدار می‌گیری»:
//   فهرستِ کلاینت (SearchClient)، نقشه (/api/map/clusters)، و هشدارِ آگهیِ جدید (alerts-runner).
// پیش از این هشدار فقط شهر/محله/معامله/نوع/سقفِ قیمت را می‌فهمید و خواب/متراژ/امکانات/… را نادیده می‌گرفت.
import { canonCity } from './city-name'
import { effectiveFiltersOf, matchesListing, cityMatch, type DerivedListing, type EffectiveFilters } from './listing-search'
import { PROPERTY_KINDS } from './taxonomy'
import { matchesLocationName } from './location-match'

export type LatLng = { lat: number; lng: number }
export interface SearchSpec { city: string; hood: string; eff: EffectiveFilters; poly: LatLng[] | null }

/** کلیدهای معنادارِ جستجو (بدونِ sort/bbox/zoom) — امضای پایدارِ «جستجوی ذخیره‌شده» از همین‌هاست. */
export const SPEC_KEYS = ['deal', 'city', 'hood', 'q', 'kind', 'beds', 'pmin', 'pmax', 'amin', 'amax', 'fmin', 'ymin', 'amen', 'priced', 'photo', 'adv', 'poly'] as const

const norm = (s: string) => (s || '').replace(/‌/g, '').replace(/\s/g, '').toLowerCase()

/** تطبیقِ دوسویهٔ محله با «مرزِ واژه» («جنت‌آباد» ⇄ «جنت آباد شمالی»؛ ولی «ونک» هرگز «پونک» را نمی‌گیرد —
 *  همان درسِ فاز ۲۲۵ که areaMatchِ قدیمیِ فهرست با includes نقضش می‌کرد). جهتِ معکوس (تکهٔ موقعیتِ آگهی
 *  درونِ نامِ محلهٔ انتخابی) تکهٔ «شهر» را نادیده می‌گیرد، وگرنه «تهران نو» کلِ تهران را می‌بلعید. */
export function hoodMatch(loc: string, hood: string, city = ''): boolean {
  if (!norm(hood)) return true
  if (matchesLocationName(hood, loc)) return true
  const c = norm(canonCity(city))
  return String(loc || '').split(/[،,]/).map(x => x.trim())
    .some(p => p.length >= 3 && norm(p) !== c && norm(canonCity(p)) !== c && matchesLocationName(p, hood))
}

/** «lat,lng;lat,lng;…» → چندضلعی (۳ تا ۸۰ رأس، مختصاتِ معتبر)؛ وگرنه null. */
export function parsePoly(s: string | null | undefined): LatLng[] | null {
  if (!s) return null
  const pts: LatLng[] = []
  for (const seg of String(s).split(';')) {
    const [a, b] = seg.split(',').map(Number)
    if (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180) pts.push({ lat: a, lng: b })
  }
  return pts.length >= 3 && pts.length <= 80 ? pts : null
}

/** چندضلعی → پارامترِ URL؛ حداکثر ۴۰ رأس (نمونه‌برداریِ یکنواخت) و ۵ رقمِ اعشار (~۱ متر). */
export function encodePoly(pts: LatLng[]): string {
  let p = pts
  if (p.length > 40) { const step = p.length / 40; p = Array.from({ length: 40 }, (_, i) => pts[Math.floor(i * step)]) }
  return p.map(x => `${x.lat.toFixed(5)},${x.lng.toFixed(5)}`).join(';')
}

/** ray casting — نقطه درونِ چندضلعی؟ */
export function pointInPoly(lat: number, lng: number, poly: LatLng[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j]
    if ((a.lat > lat) !== (b.lat > lat) && lng < ((b.lng - a.lng) * (lat - a.lat)) / (b.lat - a.lat) + a.lng) inside = !inside
  }
  return inside
}

export function specFromParams(sp: URLSearchParams): SearchSpec {
  const eff = effectiveFiltersOf({
    tab: sp.get('deal') || 'sale',
    q: sp.get('q') || '',
    kind: sp.get('kind') || '',
    bedsLabel: sp.get('beds') || 'همه',
    priceMin: Number(sp.get('pmin')) || 0,
    priceMax: Number(sp.get('pmax')) || 0,   // ≤۰ = بدونِ سقف
    areaMin: Number(sp.get('amin')) || 0,
    areaMax: Number(sp.get('amax')) || 0,
    floorMin: Number(sp.get('fmin')) || 0,
    yearMin: Number(sp.get('ymin')) || 0,
    amenities: (sp.get('amen') || '').split('،').filter(Boolean),
    pricedOnly: sp.get('priced') === '1', photoOnly: sp.get('photo') === '1', advertiser: sp.get('adv') || '',
  })
  return { city: canonCity(sp.get('city')), hood: (sp.get('hood') || '').trim(), eff, poly: parsePoly(sp.get('poly')) }
}

/** فیلترهای غیرِمکانیِ مشخصات + شهر + محله (محدودهٔ نقشه جدا با pointInPoly، چون مختصات لازم دارد). */
export function matchesSpec(d: DerivedListing, s: SearchSpec): boolean {
  if (s.city && !cityMatch(d.location, s.city)) return false
  if (s.hood && !hoodMatch(d.location, s.hood, s.city)) return false
  return matchesListing(d, s.eff)
}

/** کوئری‌استرینگِ کانونی (فقط SPEC_KEYS، مرتب) — دو جستجوی هم‌معنا یک امضا دارند. */
export function canonSpecQs(sp: URLSearchParams): string {
  const out = new URLSearchParams()
  for (const k of [...SPEC_KEYS].sort()) {
    let v = (sp.get(k) || '').trim()
    if (k === 'city') v = canonCity(v)
    if (k === 'deal' && !v) v = 'sale'
    if (v) out.set(k, v)
  }
  return out.toString()
}

const DEAL_FA: Record<string, string> = { sale: 'خرید', rent: 'اجاره', presale: 'پیش‌فروش', daily: 'اجارهٔ روزانه' }
const faNum = (n: number) => n.toLocaleString('fa-IR')
/** برچسبِ خوانا برای فهرستِ «جستجوهای ذخیره‌شده» و متنِ هشدار. */
export function specLabel(sp: URLSearchParams): string {
  const parts: string[] = []
  const kind = sp.get('kind') || ''
  parts.push([kind && PROPERTY_KINDS.includes(kind) ? kind.split('/')[0] : '', DEAL_FA[sp.get('deal') || 'sale'] || 'خرید'].filter(Boolean).join(' · '))
  const where = [sp.get('hood'), canonCity(sp.get('city'))].filter(Boolean).join('، ')
  if (sp.get('poly')) parts.push(where ? `${where} (محدودهٔ رسم‌شده)` : 'محدودهٔ رسم‌شده روی نقشه')
  else if (where) parts.push(where)
  const pmin = Number(sp.get('pmin')) || 0, pmax = Number(sp.get('pmax')) || 0
  if (pmin || pmax) parts.push(pmin && pmax ? `${faNum(pmin)} تا ${faNum(pmax)} میلیارد` : pmax ? `تا ${faNum(pmax)} میلیارد` : `از ${faNum(pmin)} میلیارد`)
  const amin = Number(sp.get('amin')) || 0, amax = Number(sp.get('amax')) || 0
  if (amin || amax) parts.push(amin && amax ? `${faNum(amin)}–${faNum(amax)} متر` : amax ? `تا ${faNum(amax)} متر` : `از ${faNum(amin)} متر`)
  const beds = sp.get('beds'); if (beds && beds !== 'همه') parts.push(`${beds} خواب`)
  const q = (sp.get('q') || '').trim(); if (q) parts.push(`«${q.slice(0, 30)}»`)
  return parts.filter(Boolean).join(' · ') || 'جستجوی من'
}

/** مشخصاتِ ذخیره‌شده → لینکِ صفحهٔ جستجو (deal→type؛ شهر هم در URL، تا با کوکیِ شهرِ دیگر عوض نشود). */
export function specToSearchHref(qs: string): string {
  const sp = new URLSearchParams(qs), out = new URLSearchParams()
  for (const [k, v] of sp) {
    if (k === 'deal') { if (v && v !== 'sale') out.set('type', v) }
    else out.set(k, v)
  }
  const s = out.toString()
  return '/search' + (s ? `?${s}` : '')
}
